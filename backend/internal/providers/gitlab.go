package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rohil/code_reviewer/backend/internal/database"
)

type GitLabProvider struct {
	client *http.Client
	cache  sync.Map // maps "owner/repo" variations to numeric project ID string
}

func NewGitLabProvider() *GitLabProvider {
	return &GitLabProvider{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (g *GitLabProvider) Name() string {
	return "gitlab"
}

func (g *GitLabProvider) getBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		return "https://gitlab.com"
	}
	return strings.TrimRight(baseURL, "/")
}

func (g *GitLabProvider) ResolveProjectIdentifier(ctx context.Context, token, baseURL, owner, name string) string {
	cleanOwner := strings.TrimSpace(owner)
	cleanName := strings.TrimSpace(name)

	// If owner is empty and name contains full path e.g. "group/subgroup/repo"
	if strings.Contains(cleanName, "/") && cleanOwner == "" {
		lastSlash := strings.LastIndex(cleanName, "/")
		cleanOwner = cleanName[:lastSlash]
		cleanName = cleanName[lastSlash+1:]
	} else if cleanOwner != "" && strings.HasPrefix(cleanName, cleanOwner+"/") {
		cleanName = strings.TrimPrefix(cleanName, cleanOwner+"/")
	}

	// If name is already a numeric ID
	if _, err := strconv.ParseInt(cleanName, 10, 64); err == nil {
		return cleanName
	}

	slugName := strings.ToLower(strings.ReplaceAll(cleanName, " ", "-"))
	lookupKey := fmt.Sprintf("%s/%s", cleanOwner, slugName)
	lookupKeyLower := strings.ToLower(lookupKey)
	rawKey := fmt.Sprintf("%s/%s", cleanOwner, cleanName)

	// 1. Check in-memory cache
	if val, ok := g.cache.Load(lookupKey); ok {
		return val.(string)
	}
	if val, ok := g.cache.Load(lookupKeyLower); ok {
		return val.(string)
	}
	if val, ok := g.cache.Load(rawKey); ok {
		return val.(string)
	}

	// 2. Try direct project endpoint by URL-encoded path: /api/v4/projects/:path
	directURL := fmt.Sprintf("%s/api/v4/projects/%s", g.getBaseURL(baseURL), url.PathEscape(lookupKey))
	resp, err := g.doRequest(ctx, http.MethodGet, directURL, token, nil)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var p glProject
			if err := json.NewDecoder(resp.Body).Decode(&p); err == nil && p.ID != 0 {
				pIDStr := strconv.FormatInt(p.ID, 10)
				g.cache.Store(lookupKey, pIDStr)
				g.cache.Store(lookupKeyLower, pIDStr)
				g.cache.Store(rawKey, pIDStr)
				g.cache.Store(p.PathWithNamespace, pIDStr)
				return pIDStr
			}
		}
	}

	// 3. Try searching GitLab API for project by name / slug
	searchQuery := cleanName
	searchURL := fmt.Sprintf("%s/api/v4/projects?search=%s&per_page=20", g.getBaseURL(baseURL), url.QueryEscape(searchQuery))
	resp, err = g.doRequest(ctx, http.MethodGet, searchURL, token, nil)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var projects []glProject
			if err := json.NewDecoder(resp.Body).Decode(&projects); err == nil {
				for _, p := range projects {
					pIDStr := strconv.FormatInt(p.ID, 10)
					g.cache.Store(p.PathWithNamespace, pIDStr)
					g.cache.Store(strings.ToLower(p.PathWithNamespace), pIDStr)
					g.cache.Store(fmt.Sprintf("%s/%s", p.Namespace.Path, p.Path), pIDStr)
					g.cache.Store(fmt.Sprintf("%s/%s", p.Namespace.Path, p.Name), pIDStr)

					if strings.EqualFold(p.PathWithNamespace, lookupKey) ||
						strings.EqualFold(p.PathWithNamespace, rawKey) ||
						strings.EqualFold(p.Path, slugName) ||
						strings.EqualFold(p.Name, cleanName) {
						return pIDStr
					}
				}
			}
		}
	}

	// 4. Fallback to URL-encoded path with namespace (e.g. Kingsofttech%2Floyalty-program)
	return url.PathEscape(fmt.Sprintf("%s/%s", cleanOwner, slugName))
}

func (g *GitLabProvider) resolveProjectIdentifier(ctx context.Context, token, baseURL, owner, name string) string {
	return g.ResolveProjectIdentifier(ctx, token, baseURL, owner, name)
}

func (g *GitLabProvider) doRequest(ctx context.Context, method, requestURL, token string, body any) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal gitlab body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, requestURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create gitlab request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "AICodeReviewer-App")
	if token != "" {
		req.Header.Set("PRIVATE-TOKEN", token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gitlab api request failed: %w", err)
	}

	return resp, nil
}

func (g *GitLabProvider) TestConnection(ctx context.Context, token, baseURL string) error {
	apiURL := fmt.Sprintf("%s/api/v4/user", g.getBaseURL(baseURL))
	resp, err := g.doRequest(ctx, http.MethodGet, apiURL, token, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gitlab authentication failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}
	return nil
}

type glProject struct {
	ID                int64  `json:"id"`
	Name              string `json:"name"`
	Path              string `json:"path"`
	PathWithNamespace string `json:"path_with_namespace"`
	Namespace         struct {
		Path string `json:"path"`
	} `json:"namespace"`
	WebURL        string `json:"web_url"`
	DefaultBranch string `json:"default_branch"`
	Visibility    string `json:"visibility"`
}

func (g *GitLabProvider) ListRepositories(ctx context.Context, token, baseURL string) ([]database.Repository, error) {
	apiURL := fmt.Sprintf("%s/api/v4/projects?membership=true&per_page=100&order_by=updated_at", g.getBaseURL(baseURL))
	resp, err := g.doRequest(ctx, http.MethodGet, apiURL, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list gitlab projects (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var glProjects []glProject
	if err := json.NewDecoder(resp.Body).Decode(&glProjects); err != nil {
		return nil, fmt.Errorf("failed to parse gitlab projects: %w", err)
	}

	var result []database.Repository
	for _, p := range glProjects {
		branch := p.DefaultBranch
		if branch == "" {
			branch = "main"
		}
		owner := p.Namespace.Path
		repoName := p.Path
		if repoName == "" {
			repoName = p.Name
		}
		if owner == "" {
			parts := strings.Split(p.PathWithNamespace, "/")
			if len(parts) >= 2 {
				owner = strings.Join(parts[:len(parts)-1], "/")
				if p.Path == "" {
					repoName = parts[len(parts)-1]
				}
			}
		}

		pIDStr := strconv.FormatInt(p.ID, 10)
		g.cache.Store(p.PathWithNamespace, pIDStr)
		g.cache.Store(strings.ToLower(p.PathWithNamespace), pIDStr)
		g.cache.Store(fmt.Sprintf("%s/%s", owner, repoName), pIDStr)
		g.cache.Store(fmt.Sprintf("%s/%s", owner, p.Name), pIDStr)

		result = append(result, database.Repository{
			Provider:      "gitlab",
			ExternalID:    pIDStr,
			Owner:         owner,
			Name:          repoName,
			FullName:      p.PathWithNamespace,
			URL:           p.WebURL,
			DefaultBranch: branch,
			IsPrivate:     p.Visibility != "public",
		})
	}
	return result, nil
}

func (g *GitLabProvider) GetRepository(ctx context.Context, token, baseURL, owner, name string) (*database.Repository, error) {
	projectIdentifier := g.resolveProjectIdentifier(ctx, token, baseURL, owner, name)
	apiURL := fmt.Sprintf("%s/api/v4/projects/%s", g.getBaseURL(baseURL), projectIdentifier)
	resp, err := g.doRequest(ctx, http.MethodGet, apiURL, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get gitlab project (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var p glProject
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		return nil, fmt.Errorf("failed to parse gitlab project: %w", err)
	}

	branch := p.DefaultBranch
	if branch == "" {
		branch = "main"
	}

	repoName := p.Path
	if repoName == "" {
		repoName = p.Name
	}

	return &database.Repository{
		Provider:      "gitlab",
		ExternalID:    strconv.FormatInt(p.ID, 10),
		Owner:         owner,
		Name:          repoName,
		FullName:      p.PathWithNamespace,
		URL:           p.WebURL,
		DefaultBranch: branch,
		IsPrivate:     p.Visibility != "public",
	}, nil
}

type glMergeRequest struct {
	ID           int64  `json:"id"`
	IID          int    `json:"iid"`
	Title        string `json:"title"`
	State        string `json:"state"` // opened, closed, merged
	Description  string `json:"description"`
	WebURL       string `json:"web_url"`
	SourceBranch string `json:"source_branch"`
	TargetBranch string `json:"target_branch"`
	Author       struct {
		Username  string `json:"username"`
		AvatarURL string `json:"avatar_url"`
	} `json:"author"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
}

func (g *GitLabProvider) ListPullRequests(ctx context.Context, token, baseURL, owner, name, state string) ([]database.PullRequest, error) {
	projectIdentifier := g.resolveProjectIdentifier(ctx, token, baseURL, owner, name)
	glState := state
	if glState == "open" {
		glState = "opened"
	}
	if glState == "" {
		glState = "opened"
	}

	apiURL := fmt.Sprintf("%s/api/v4/projects/%s/merge_requests?state=%s&per_page=100", g.getBaseURL(baseURL), projectIdentifier, glState)
	if glState == "all" {
		apiURL = fmt.Sprintf("%s/api/v4/projects/%s/merge_requests?per_page=100", g.getBaseURL(baseURL), projectIdentifier)
	}

	resp, err := g.doRequest(ctx, http.MethodGet, apiURL, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list gitlab merge requests (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var glMRs []glMergeRequest
	if err := json.NewDecoder(resp.Body).Decode(&glMRs); err != nil {
		return nil, fmt.Errorf("failed to parse gitlab MRs: %w", err)
	}

	var result []database.PullRequest
	for _, mr := range glMRs {
		normState := mr.State
		if normState == "opened" {
			normState = "open"
		}

		result = append(result, database.PullRequest{
			Provider:     "gitlab",
			Owner:        owner,
			Repo:         name,
			Number:       mr.IID,
			Title:        mr.Title,
			Author:       mr.Author.Username,
			AuthorAvatar: mr.Author.AvatarURL,
			Status:       normState,
			SourceBranch: mr.SourceBranch,
			TargetBranch: mr.TargetBranch,
			URL:          mr.WebURL,
			Body:         mr.Description,
			UpdatedAt:    mr.UpdatedAt,
			CreatedAt:    mr.CreatedAt,
		})
	}
	return result, nil
}

func (g *GitLabProvider) GetPullRequest(ctx context.Context, token, baseURL, owner, name string, number int) (*database.PullRequest, error) {
	projectIdentifier := g.resolveProjectIdentifier(ctx, token, baseURL, owner, name)
	apiURL := fmt.Sprintf("%s/api/v4/projects/%s/merge_requests/%d", g.getBaseURL(baseURL), projectIdentifier, number)

	resp, err := g.doRequest(ctx, http.MethodGet, apiURL, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get gitlab merge request (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var mr glMergeRequest
	if err := json.NewDecoder(resp.Body).Decode(&mr); err != nil {
		return nil, fmt.Errorf("failed to parse gitlab MR: %w", err)
	}

	normState := mr.State
	if normState == "opened" {
		normState = "open"
	}

	return &database.PullRequest{
		Provider:     "gitlab",
		Owner:        owner,
		Repo:         name,
		Number:       mr.IID,
		Title:        mr.Title,
		Author:       mr.Author.Username,
		AuthorAvatar: mr.Author.AvatarURL,
		Status:       normState,
		SourceBranch: mr.SourceBranch,
		TargetBranch: mr.TargetBranch,
		URL:          mr.WebURL,
		Body:         mr.Description,
		UpdatedAt:    mr.UpdatedAt,
		CreatedAt:    mr.CreatedAt,
	}, nil
}

type glMRChanges struct {
	Changes []struct {
		OldPath      string `json:"old_path"`
		NewPath      string `json:"new_path"`
		Diff         string `json:"diff"`
		NewFile      bool   `json:"new_file"`
		RenamedFile  bool   `json:"renamed_file"`
		DeletedFile  bool   `json:"deleted_file"`
	} `json:"changes"`
}

func (g *GitLabProvider) GetPullRequestDiff(ctx context.Context, token, baseURL, owner, name string, number int) ([]database.FileDiff, error) {
	projectIdentifier := g.resolveProjectIdentifier(ctx, token, baseURL, owner, name)
	apiURL := fmt.Sprintf("%s/api/v4/projects/%s/merge_requests/%d/changes", g.getBaseURL(baseURL), projectIdentifier, number)

	resp, err := g.doRequest(ctx, http.MethodGet, apiURL, token, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get gitlab merge request changes (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var mrChanges glMRChanges
	if err := json.NewDecoder(resp.Body).Decode(&mrChanges); err != nil {
		return nil, fmt.Errorf("failed to parse gitlab MR changes: %w", err)
	}

	var result []database.FileDiff
	for _, c := range mrChanges.Changes {
		status := "modified"
		if c.NewFile {
			status = "added"
		} else if c.DeletedFile {
			status = "removed"
		} else if c.RenamedFile {
			status = "renamed"
		}

		// Count additions and deletions from the diff lines
		additions := 0
		deletions := 0
		lines := strings.Split(c.Diff, "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "+") && !strings.HasPrefix(line, "+++") {
				additions++
			} else if strings.HasPrefix(line, "-") && !strings.HasPrefix(line, "---") {
				deletions++
			}
		}

		result = append(result, database.FileDiff{
			Filename:    c.NewPath,
			OldFilename: c.OldPath,
			Status:      status,
			Additions:   additions,
			Deletions:   deletions,
			Changes:     additions + deletions,
			Patch:       c.Diff,
		})
	}
	return result, nil
}

func (g *GitLabProvider) PostComment(ctx context.Context, token, baseURL, owner, name string, number int, body string) error {
	projectIdentifier := g.resolveProjectIdentifier(ctx, token, baseURL, owner, name)
	apiURL := fmt.Sprintf("%s/api/v4/projects/%s/merge_requests/%d/notes", g.getBaseURL(baseURL), projectIdentifier, number)
	payload := map[string]string{"body": body}

	resp, err := g.doRequest(ctx, http.MethodPost, apiURL, token, payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to post gitlab comment (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
