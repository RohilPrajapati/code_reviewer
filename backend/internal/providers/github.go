package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rohil/code_reviewer/backend/internal/database"
)

type GitHubProvider struct {
	client *http.Client
}

func NewGitHubProvider() *GitHubProvider {
	return &GitHubProvider{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (g *GitHubProvider) Name() string {
	return "github"
}

func (g *GitHubProvider) doRequest(ctx context.Context, method, url, token string, body any) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "AICodeReviewer-App")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if token != "" {
		if strings.HasPrefix(token, "Bearer ") || strings.HasPrefix(token, "token ") {
			req.Header.Set("Authorization", token)
		} else {
			req.Header.Set("Authorization", "Bearer "+token)
		}
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github api request failed: %w", err)
	}

	return resp, nil
}

func (g *GitHubProvider) TestConnection(ctx context.Context, token, baseURL string) error {
	url := "https://api.github.com/user"
	resp, err := g.doRequest(ctx, http.MethodGet, url, token, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github authentication failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}
	return nil
}

type ghRepo struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Owner    struct {
		Login string `json:"login"`
	} `json:"owner"`
	HTMLURL       string `json:"html_url"`
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
}

func (g *GitHubProvider) ListRepositories(ctx context.Context, token, baseURL string) ([]database.Repository, error) {
	url := "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
	resp, err := g.doRequest(ctx, http.MethodGet, url, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list github repos (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var ghRepos []ghRepo
	if err := json.NewDecoder(resp.Body).Decode(&ghRepos); err != nil {
		return nil, fmt.Errorf("failed to parse github repos response: %w", err)
	}

	var result []database.Repository
	for _, r := range ghRepos {
		branch := r.DefaultBranch
		if branch == "" {
			branch = "main"
		}
		result = append(result, database.Repository{
			Provider:      "github",
			ExternalID:    strconv.FormatInt(r.ID, 10),
			Owner:         r.Owner.Login,
			Name:          r.Name,
			FullName:      r.FullName,
			URL:           r.HTMLURL,
			DefaultBranch: branch,
			IsPrivate:     r.Private,
		})
	}
	return result, nil
}

func (g *GitHubProvider) GetRepository(ctx context.Context, token, baseURL, owner, name string) (*database.Repository, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, name)
	resp, err := g.doRequest(ctx, http.MethodGet, url, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get github repo (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var r ghRepo
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, fmt.Errorf("failed to parse github repo: %w", err)
	}

	branch := r.DefaultBranch
	if branch == "" {
		branch = "main"
	}

	return &database.Repository{
		Provider:      "github",
		ExternalID:    strconv.FormatInt(r.ID, 10),
		Owner:         r.Owner.Login,
		Name:          r.Name,
		FullName:      r.FullName,
		URL:           r.HTMLURL,
		DefaultBranch: branch,
		IsPrivate:     r.Private,
	}, nil
}

type ghPullRequest struct {
	ID     int64  `json:"id"`
	Number int    `json:"number"`
	Title  string `json:"title"`
	State  string `json:"state"`
	User   struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	} `json:"user"`
	Head struct {
		Ref string `json:"ref"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
	HTMLURL   string    `json:"html_url"`
	Body      string    `json:"body"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
	MergedAt  *time.Time `json:"merged_at"`
}

func (g *GitHubProvider) ListPullRequests(ctx context.Context, token, baseURL, owner, name, state string) ([]database.PullRequest, error) {
	if state == "" {
		state = "open"
	}
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=%s&per_page=100&sort=updated&direction=desc", owner, name, state)
	resp, err := g.doRequest(ctx, http.MethodGet, url, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list github pull requests (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var ghPRs []ghPullRequest
	if err := json.NewDecoder(resp.Body).Decode(&ghPRs); err != nil {
		return nil, fmt.Errorf("failed to parse github prs: %w", err)
	}

	var result []database.PullRequest
	for _, pr := range ghPRs {
		prStatus := pr.State
		if pr.MergedAt != nil {
			prStatus = "merged"
		}
		result = append(result, database.PullRequest{
			Provider:     "github",
			Owner:        owner,
			Repo:         name,
			Number:       pr.Number,
			Title:        pr.Title,
			Author:       pr.User.Login,
			AuthorAvatar: pr.User.AvatarURL,
			Status:       prStatus,
			SourceBranch: pr.Head.Ref,
			TargetBranch: pr.Base.Ref,
			URL:          pr.HTMLURL,
			Body:         pr.Body,
			UpdatedAt:    pr.UpdatedAt,
			CreatedAt:    pr.CreatedAt,
		})
	}
	return result, nil
}

func (g *GitHubProvider) GetPullRequest(ctx context.Context, token, baseURL, owner, name string, number int) (*database.PullRequest, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d", owner, name, number)
	resp, err := g.doRequest(ctx, http.MethodGet, url, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get github pr (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var pr ghPullRequest
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		return nil, fmt.Errorf("failed to parse github pr: %w", err)
	}

	prStatus := pr.State
	if pr.MergedAt != nil {
		prStatus = "merged"
	}

	return &database.PullRequest{
		Provider:     "github",
		Owner:        owner,
		Repo:         name,
		Number:       pr.Number,
		Title:        pr.Title,
		Author:       pr.User.Login,
		AuthorAvatar: pr.User.AvatarURL,
		Status:       prStatus,
		SourceBranch: pr.Head.Ref,
		TargetBranch: pr.Base.Ref,
		URL:          pr.HTMLURL,
		Body:         pr.Body,
		UpdatedAt:    pr.UpdatedAt,
		CreatedAt:    pr.CreatedAt,
	}, nil
}

type ghFileDiff struct {
	Filename         string `json:"filename"`
	PreviousFilename string `json:"previous_filename"`
	Status           string `json:"status"`
	Additions        int    `json:"additions"`
	Deletions        int    `json:"deletions"`
	Changes          int    `json:"changes"`
	Patch            string `json:"patch"`
	RawURL           string `json:"raw_url"`
}

func (g *GitHubProvider) GetPullRequestDiff(ctx context.Context, token, baseURL, owner, name string, number int) ([]database.FileDiff, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/files?per_page=100", owner, name, number)
	resp, err := g.doRequest(ctx, http.MethodGet, url, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get github pr files (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var ghFiles []ghFileDiff
	if err := json.NewDecoder(resp.Body).Decode(&ghFiles); err != nil {
		return nil, fmt.Errorf("failed to parse github diff: %w", err)
	}

	var result []database.FileDiff
	for _, f := range ghFiles {
		result = append(result, database.FileDiff{
			Filename:    f.Filename,
			OldFilename: f.PreviousFilename,
			Status:      f.Status,
			Additions:   f.Additions,
			Deletions:   f.Deletions,
			Changes:     f.Changes,
			Patch:       f.Patch,
			RawURL:      f.RawURL,
		})
	}
	return result, nil
}

func (g *GitHubProvider) PostComment(ctx context.Context, token, baseURL, owner, name string, number int, body string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments", owner, name, number)
	payload := map[string]string{"body": body}

	resp, err := g.doRequest(ctx, http.MethodPost, url, token, payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to post github comment (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
