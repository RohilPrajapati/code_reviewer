package providers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/rohil/code_reviewer/backend/internal/constants"
)

type GeminiClient struct {
	httpClient *http.Client
	modelCache sync.Map // cached working models per apiKey prefix
}

func NewGeminiClient() *GeminiClient {
	return &GeminiClient{
		httpClient: &http.Client{Timeout: constants.GeminiStreamTimeout},
	}
}

func (g *GeminiClient) GetAvailableModels(ctx context.Context, apiKey string) ([]string, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("gemini api key is empty")
	}

	url := fmt.Sprintf("%s/v1beta/models?key=%s", constants.DefaultGeminiURL, apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
	}

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini connection error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini list models failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Models []struct {
			Name                       string   `json:"name"`
			SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode gemini models: %w", err)
	}

	var validModels []string
	for _, m := range result.Models {
		for _, method := range m.SupportedGenerationMethods {
			if method == "generateContent" {
				clean := strings.TrimPrefix(m.Name, "models/")
				validModels = append(validModels, clean)
				break
			}
		}
	}
	return validModels, nil
}

func (g *GeminiClient) TestConnection(ctx context.Context, apiKey string) error {
	models, err := g.GetAvailableModels(ctx, apiKey)
	if err != nil {
		return err
	}
	if len(models) == 0 {
		return fmt.Errorf("no content generation models found for this api key")
	}
	return nil
}

type GeminiContentPart struct {
	Text string `json:"text"`
}

type GeminiContent struct {
	Role  string              `json:"role"` // "user" or "model"
	Parts []GeminiContentPart `json:"parts"`
}

type GeminiGenerateRequest struct {
	SystemInstruction *GeminiSystemInstruction `json:"system_instruction,omitempty"`
	Contents          []GeminiContent          `json:"contents"`
	GenerationConfig  *GeminiGenerationConfig  `json:"generation_config,omitempty"`
}

type GeminiSystemInstruction struct {
	Parts []GeminiContentPart `json:"parts"`
}

type GeminiGenerationConfig struct {
	Temperature     float64 `json:"temperature,omitempty"`
	MaxOutputTokens int     `json:"max_output_tokens,omitempty"`
}

type GeminiResponseCandidate struct {
	Content struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
		Role string `json:"role"`
	} `json:"content"`
	FinishReason string `json:"finishReason"`
}

type GeminiStreamChunk struct {
	Candidates []GeminiResponseCandidate `json:"candidates"`
}

type ChatMessageInput struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

func (g *GeminiClient) StreamChat(
	ctx context.Context,
	apiKey string,
	model string,
	diffContext string,
	history []ChatMessageInput,
	prompt string,
	onChunk func(chunk string) error,
) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("gemini api key is required")
	}

	model = strings.TrimPrefix(strings.TrimSpace(model), "models/")
	if model == "" {
		model = constants.DefaultGeminiModel
	}

	systemPrompt := constants.SeniorReviewerSystemPrompt
	reqBody := GeminiGenerateRequest{
		SystemInstruction: &GeminiSystemInstruction{
			Parts: []GeminiContentPart{
				{Text: systemPrompt},
			},
		},
		GenerationConfig: &GeminiGenerationConfig{
			Temperature: 0.2,
		},
	}

	var contents []GeminiContent

	// Prepend Diff Context as the first message context seed
	if diffContext != "" {
		contents = append(contents, GeminiContent{
			Role: "user",
			Parts: []GeminiContentPart{
				{Text: fmt.Sprintf("Here is the context and code diff of the pull request under review:\n\n%s\n\nPlease acknowledge receipt of this diff context and be ready to review.", diffContext)},
			},
		})
		contents = append(contents, GeminiContent{
			Role: "model",
			Parts: []GeminiContentPart{
				{Text: "I have analyzed the pull request diff and context. I am ready to review the changes, answer your questions, assess security and performance, and provide inline suggestions."},
			},
		})
	}

	// Add chat history
	for _, msg := range history {
		role := "user"
		if msg.Role == "assistant" || msg.Role == "model" {
			role = "model"
		}
		contents = append(contents, GeminiContent{
			Role: role,
			Parts: []GeminiContentPart{
				{Text: msg.Content},
			},
		})
	}

	// Add current prompt
	if prompt != "" {
		contents = append(contents, GeminiContent{
			Role: "user",
			Parts: []GeminiContentPart{
				{Text: prompt},
			},
		})
	}

	reqBody.Contents = contents

	jsonPayload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal gemini payload: %w", err)
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s", model, apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonPayload))
	if err != nil {
		return "", fmt.Errorf("failed to build gemini stream request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini stream request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		// If the requested model returns 404, automatically discover and fallback to available models
		if resp.StatusCode == http.StatusNotFound {
			available, err := g.GetAvailableModels(ctx, apiKey)
			if err == nil && len(available) > 0 {
				// Find first model different from current failing model
				for _, altModel := range available {
					if altModel != model {
						return g.StreamChat(ctx, apiKey, altModel, diffContext, history, prompt, onChunk)
					}
				}
			}
		}
		return "", fmt.Errorf("gemini api returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var fullResponse strings.Builder
	reader := bufio.NewReader(resp.Body)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			return fullResponse.String(), fmt.Errorf("error reading stream chunk: %w", err)
		}

		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}

		dataJSON := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if dataJSON == "" || dataJSON == "[DONE]" {
			continue
		}

		var chunk GeminiStreamChunk
		if err := json.Unmarshal([]byte(dataJSON), &chunk); err != nil {
			continue
		}

		if len(chunk.Candidates) > 0 {
			for _, part := range chunk.Candidates[0].Content.Parts {
				if part.Text != "" {
					fullResponse.WriteString(part.Text)
					if onChunk != nil {
						if err := onChunk(part.Text); err != nil {
							return fullResponse.String(), err
						}
					}
				}
			}
		}
	}

	return fullResponse.String(), nil
}
