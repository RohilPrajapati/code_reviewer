package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rohil/code_reviewer/backend/internal/config"
	"github.com/rohil/code_reviewer/backend/internal/constants"
	"github.com/rohil/code_reviewer/backend/internal/crypto"
	"github.com/rohil/code_reviewer/backend/internal/database"
	"github.com/rohil/code_reviewer/backend/internal/providers"
)

type Handler struct {
	cfg          *config.Config
	db           *database.DB
	github       *providers.GitHubProvider
	gitlab       *providers.GitLabProvider
	geminiClient *providers.GeminiClient
}

func NewHandler(cfg *config.Config, db *database.DB) *Handler {
	return &Handler{
		cfg:          cfg,
		db:           db,
		github:       providers.NewGitHubProvider(),
		gitlab:       providers.NewGitLabProvider(),
		geminiClient: providers.NewGeminiClient(),
	}
}

func (h *Handler) respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func (h *Handler) respondError(w http.ResponseWriter, status int, message string) {
	h.respondJSON(w, status, map[string]string{"error": message})
}

// HealthCheck
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.respondJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

// Integrations

type SaveIntegrationRequest struct {
	Token   string `json:"token"`
	BaseURL string `json:"base_url,omitempty"`
}

func (h *Handler) ListIntegrations(w http.ResponseWriter, r *http.Request) {
	list, err := h.db.ListIntegrations()
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to query integrations: "+err.Error())
		return
	}

	knownProviders := []string{"gemini", "github", "gitlab"}
	providerMap := make(map[string]database.Integration)
	for _, item := range list {
		providerMap[item.Provider] = item
	}

	var results []database.Integration
	for _, p := range knownProviders {
		if item, exists := providerMap[p]; exists {
			results = append(results, item)
		} else {
			results = append(results, database.Integration{
				Provider: p,
				Status:   "not_configured",
			})
		}
	}

	h.respondJSON(w, http.StatusOK, results)
}

func (h *Handler) SaveIntegration(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if provider != "gemini" && provider != "github" && provider != "gitlab" {
		h.respondError(w, http.StatusBadRequest, "unsupported provider: "+provider)
		return
	}

	var req SaveIntegrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		h.respondError(w, http.StatusBadRequest, "token cannot be empty")
		return
	}

	// Validate connection
	status := "connected"
	var testErr error
	if provider == "gemini" {
		testErr = h.geminiClient.TestConnection(r.Context(), req.Token)
	} else if provider == "github" {
		testErr = h.github.TestConnection(r.Context(), req.Token, "")
	} else if provider == "gitlab" {
		testErr = h.gitlab.TestConnection(r.Context(), req.Token, req.BaseURL)
	}

	if testErr != nil {
		status = "invalid"
	}

	encrypted, err := crypto.Encrypt(req.Token, h.cfg.EncryptionKey)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to encrypt token: "+err.Error())
		return
	}

	masked := crypto.MaskToken(req.Token)
	integration, err := h.db.UpsertIntegration(provider, encrypted, req.BaseURL, status, masked)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to save integration: "+err.Error())
		return
	}

	response := map[string]any{
		"integration": integration,
		"valid":       testErr == nil,
	}
	if testErr != nil {
		response["warning"] = "Token saved, but verification failed: " + testErr.Error()
	}

	h.respondJSON(w, http.StatusOK, response)
}

func (h *Handler) TestIntegration(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	integration, err := h.db.GetIntegration(provider)
	if err != nil || integration == nil || integration.EncryptedToken == "" {
		h.respondError(w, http.StatusNotFound, "integration not found or not configured")
		return
	}

	rawToken, err := crypto.Decrypt(integration.EncryptedToken, h.cfg.EncryptionKey)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to decrypt token: "+err.Error())
		return
	}

	var testErr error
	if provider == "gemini" {
		testErr = h.geminiClient.TestConnection(r.Context(), rawToken)
	} else if provider == "github" {
		testErr = h.github.TestConnection(r.Context(), rawToken, "")
	} else if provider == "gitlab" {
		testErr = h.gitlab.TestConnection(r.Context(), rawToken, integration.BaseURL)
	} else {
		h.respondError(w, http.StatusBadRequest, "unknown provider")
		return
	}

	status := "connected"
	if testErr != nil {
		status = "invalid"
	}

	_, _ = h.db.UpsertIntegration(provider, integration.EncryptedToken, integration.BaseURL, status, integration.MaskedToken)

	if testErr != nil {
		h.respondJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"status":  "invalid",
			"error":   testErr.Error(),
		})
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"status":  "connected",
		"message": "Connection test passed successfully",
	})
}

func (h *Handler) DeleteIntegration(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if err := h.db.DeleteIntegration(provider); err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to delete integration: "+err.Error())
		return
	}
	h.respondJSON(w, http.StatusOK, map[string]string{"message": "integration removed"})
}

func (h *Handler) ListGeminiModels(w http.ResponseWriter, r *http.Request) {
	geminiInteg, err := h.db.GetIntegration("gemini")
	if err != nil || geminiInteg == nil || geminiInteg.EncryptedToken == "" {
		h.respondError(w, http.StatusPreconditionRequired, "Gemini API key is not configured")
		return
	}

	geminiKey, err := crypto.Decrypt(geminiInteg.EncryptedToken, h.cfg.EncryptionKey)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to decrypt gemini key: "+err.Error())
		return
	}

	models, err := h.geminiClient.GetAvailableModels(r.Context(), geminiKey)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to fetch gemini models: "+err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, models)
}

// Repositories

func (h *Handler) getGitProvider(providerName string) (providers.GitProvider, string, string, error) {
	integration, err := h.db.GetIntegration(providerName)
	if err != nil || integration == nil || integration.EncryptedToken == "" {
		return nil, "", "", fmt.Errorf("integration for %s is not configured", providerName)
	}

	rawToken, err := crypto.Decrypt(integration.EncryptedToken, h.cfg.EncryptionKey)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to decrypt %s token: %w", providerName, err)
	}

	if providerName == "github" {
		return h.github, rawToken, "", nil
	} else if providerName == "gitlab" {
		return h.gitlab, rawToken, integration.BaseURL, nil
	}

	return nil, "", "", fmt.Errorf("unsupported provider %s", providerName)
}

func (h *Handler) ListRepos(w http.ResponseWriter, r *http.Request) {
	providerParam := r.URL.Query().Get("provider")

	var allRepos []database.Repository

	// If a specific provider is requested, or both are checked
	targetProviders := []string{"github", "gitlab"}
	if providerParam != "" {
		targetProviders = []string{providerParam}
	}

	for _, p := range targetProviders {
		providerClient, token, baseURL, err := h.getGitProvider(p)
		if err == nil && token != "" {
			liveRepos, fetchErr := providerClient.ListRepositories(r.Context(), token, baseURL)
			if fetchErr == nil {
				for _, r := range liveRepos {
					_ = h.db.SaveRepo(&r)
				}
			}
		}
	}

	// Read all stored repos from DB
	storedRepos, err := h.db.ListRepos(providerParam)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to list repos: "+err.Error())
		return
	}
	allRepos = storedRepos

	h.respondJSON(w, http.StatusOK, allRepos)
}

type AddManualRepoRequest struct {
	Provider string `json:"provider"` // github or gitlab
	URL      string `json:"url"`
	Owner    string `json:"owner"`
	Name     string `json:"name"`
}

func (h *Handler) AddManualRepo(w http.ResponseWriter, r *http.Request) {
	var req AddManualRepoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	req.Provider = strings.ToLower(strings.TrimSpace(req.Provider))
	if req.Provider == "" {
		req.Provider = "github"
	}

	if req.URL != "" && (req.Owner == "" || req.Name == "") {
		parsedURL, err := url.Parse(req.URL)
		if err == nil {
			path := strings.Trim(parsedURL.Path, "/")
			parts := strings.Split(path, "/")
			if len(parts) >= 2 {
				req.Owner = parts[len(parts)-2]
				req.Name = strings.TrimSuffix(parts[len(parts)-1], ".git")
			}
		}
	}

	if req.Owner == "" || req.Name == "" {
		h.respondError(w, http.StatusBadRequest, "owner and repo name are required")
		return
	}

	repoURL := req.URL
	if repoURL == "" {
		if req.Provider == "github" {
			repoURL = fmt.Sprintf("https://github.com/%s/%s", req.Owner, req.Name)
		} else {
			repoURL = fmt.Sprintf("https://gitlab.com/%s/%s", req.Owner, req.Name)
		}
	}

	repo := database.Repository{
		Provider:      req.Provider,
		ExternalID:    fmt.Sprintf("%s/%s", req.Owner, req.Name),
		Owner:         req.Owner,
		Name:          req.Name,
		FullName:      fmt.Sprintf("%s/%s", req.Owner, req.Name),
		URL:           repoURL,
		DefaultBranch: "main",
		IsPrivate:     false,
	}

	if err := h.db.SaveRepo(&repo); err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to save repo: "+err.Error())
		return
	}

	h.respondJSON(w, http.StatusCreated, repo)
}

// Pull Requests

func cleanParam(param string) string {
	unescaped, err := url.PathUnescape(param)
	if err != nil || unescaped == "" {
		unescaped, err = url.QueryUnescape(param)
		if err != nil || unescaped == "" {
			return param
		}
	}
	return strings.TrimSpace(unescaped)
}

func (h *Handler) ListPullRequests(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	owner := cleanParam(chi.URLParam(r, "owner"))
	repo := cleanParam(chi.URLParam(r, "repo"))
	state := r.URL.Query().Get("state")
	if state == "" {
		state = "open"
	}

	client, token, baseURL, err := h.getGitProvider(provider)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, err.Error())
		return
	}

	prs, err := client.ListPullRequests(r.Context(), token, baseURL, owner, repo, state)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to fetch PRs: "+err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, prs)
}

func (h *Handler) GetPullRequestDiff(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	owner := cleanParam(chi.URLParam(r, "owner"))
	repo := cleanParam(chi.URLParam(r, "repo"))
	numberStr := chi.URLParam(r, "number")

	number, err := strconv.Atoi(numberStr)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid pr number")
		return
	}

	client, token, baseURL, err := h.getGitProvider(provider)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, err.Error())
		return
	}

	pr, err := client.GetPullRequest(r.Context(), token, baseURL, owner, repo, number)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to fetch PR details: "+err.Error())
		return
	}

	diffs, err := client.GetPullRequestDiff(r.Context(), token, baseURL, owner, repo, number)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to fetch PR diff: "+err.Error())
		return
	}

	totalAdditions := 0
	totalDeletions := 0
	for _, d := range diffs {
		totalAdditions += d.Additions
		totalDeletions += d.Deletions
	}

	h.respondJSON(w, http.StatusOK, map[string]any{
		"pull_request":    pr,
		"files":           diffs,
		"total_files":     len(diffs),
		"total_additions": totalAdditions,
		"total_deletions": totalDeletions,
	})
}

// Chat & Streaming

func (h *Handler) GetChatHistory(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	owner := cleanParam(chi.URLParam(r, "owner"))
	repo := cleanParam(chi.URLParam(r, "repo"))
	numberStr := chi.URLParam(r, "number")

	number, err := strconv.Atoi(numberStr)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid pr number")
		return
	}

	history, err := h.db.GetChatHistory(provider, owner, repo, number)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to load chat history: "+err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, history)
}

func (h *Handler) ClearChatHistory(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	owner := cleanParam(chi.URLParam(r, "owner"))
	repo := cleanParam(chi.URLParam(r, "repo"))
	numberStr := chi.URLParam(r, "number")

	number, err := strconv.Atoi(numberStr)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid pr number")
		return
	}

	if err := h.db.ClearChatHistory(provider, owner, repo, number); err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to clear history: "+err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "chat history cleared"})
}

type SendChatMessageRequest struct {
	Prompt      string `json:"prompt"`
	Model       string `json:"model,omitempty"`
	DiffContext string `json:"diff_context,omitempty"`
}

func (h *Handler) SendChatMessage(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	owner := cleanParam(chi.URLParam(r, "owner"))
	repo := cleanParam(chi.URLParam(r, "repo"))
	numberStr := chi.URLParam(r, "number")

	number, err := strconv.Atoi(numberStr)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid pr number")
		return
	}

	var req SendChatMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		h.respondError(w, http.StatusBadRequest, "prompt cannot be empty")
		return
	}

	// Fetch Gemini API key
	geminiInteg, err := h.db.GetIntegration("gemini")
	if err != nil || geminiInteg == nil || geminiInteg.EncryptedToken == "" {
		h.respondError(w, http.StatusPreconditionRequired, "Gemini API key is not configured. Please add your key in Settings.")
		return
	}

	geminiKey, err := crypto.Decrypt(geminiInteg.EncryptedToken, h.cfg.EncryptionKey)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to decrypt gemini key: "+err.Error())
		return
	}

	// Save user message to database
	_, _ = h.db.SaveChatMessage(provider, owner, repo, number, "user", req.Prompt)

	// Fetch history
	storedHistory, err := h.db.GetChatHistory(provider, owner, repo, number)
	var historyInputs []providers.ChatMessageInput
	if err == nil {
		for _, msg := range storedHistory {
			// Skip current user message since it will be passed as the prompt
			if msg.Role == "user" && msg.Content == req.Prompt && msg.ID == storedHistory[len(storedHistory)-1].ID {
				continue
			}
			historyInputs = append(historyInputs, providers.ChatMessageInput{
				Role:    msg.Role,
				Content: msg.Content,
			})
		}
	}

	// If diffContext was not provided in body, build it from PR diff
	diffCtx := req.DiffContext
	if diffCtx == "" {
		if gitProvider, token, baseURL, err := h.getGitProvider(provider); err == nil {
			if diffs, err := gitProvider.GetPullRequestDiff(r.Context(), token, baseURL, owner, repo, number); err == nil {
				var sb strings.Builder
				sb.WriteString(fmt.Sprintf("Pull Request #%d in %s/%s\n\n", number, owner, repo))
				for _, f := range diffs {
					sb.WriteString(fmt.Sprintf("--- File: %s (%s, +%d/-%d) ---\n", f.Filename, f.Status, f.Additions, f.Deletions))
					if f.Patch != "" {
						sb.WriteString(f.Patch)
						sb.WriteString("\n\n")
					}
				}
				diffCtx = sb.String()
			}
		}
	}

	// Setup SSE response
	flusher, ok := w.(http.Flusher)
	if !ok {
		h.respondError(w, http.StatusInternalServerError, "streaming unsupported by server")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	onChunk := func(text string) error {
		payload, _ := json.Marshal(map[string]string{"text": text})
		_, err := fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(payload))
		if err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	model := req.Model
	if model == "" {
		model = constants.DefaultGeminiModel
	}

	streamCtx, streamCancel := context.WithTimeout(r.Context(), constants.GeminiStreamTimeout)
	defer streamCancel()

	fullResponse, streamErr := h.geminiClient.StreamChat(streamCtx, geminiKey, model, diffCtx, historyInputs, req.Prompt, onChunk)

	if streamErr != nil {
		errMsg := streamErr.Error()
		if errors.Is(streamCtx.Err(), context.DeadlineExceeded) || strings.Contains(strings.ToLower(errMsg), "deadline exceeded") || strings.Contains(strings.ToLower(errMsg), "timeout") {
			errMsg = "Request timed out after 60 seconds. Gemini took too long to respond. Please try again."
		}
		errPayload, _ := json.Marshal(map[string]string{"error": errMsg})
		_, _ = fmt.Fprintf(w, "event: error\ndata: %s\n\n", string(errPayload))
		flusher.Flush()
		return
	}

	// Save assistant message to DB
	if fullResponse != "" {
		_, _ = h.db.SaveChatMessage(provider, owner, repo, number, "assistant", fullResponse)
	}

	donePayload, _ := json.Marshal(map[string]bool{"done": true})
	_, _ = fmt.Fprintf(w, "event: done\ndata: %s\n\n", string(donePayload))
	flusher.Flush()
}

// Post Comment

type PostCommentRequest struct {
	Body string `json:"body"`
}

func (h *Handler) PostComment(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	owner := cleanParam(chi.URLParam(r, "owner"))
	repo := cleanParam(chi.URLParam(r, "repo"))
	numberStr := chi.URLParam(r, "number")

	number, err := strconv.Atoi(numberStr)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid pr number")
		return
	}

	var req PostCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		h.respondError(w, http.StatusBadRequest, "comment body cannot be empty")
		return
	}

	client, token, baseURL, err := h.getGitProvider(provider)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, err.Error())
		return
	}

	if err := client.PostComment(r.Context(), token, baseURL, owner, repo, number, req.Body); err != nil {
		h.respondError(w, http.StatusInternalServerError, "failed to post comment: "+err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "comment posted successfully"})
}
