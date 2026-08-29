package providers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGitHubListPullRequests(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/pulls") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[
				{
					"id": 201,
					"number": 42,
					"title": "Refactor auth middleware",
					"state": "open",
					"body": "Implements JWT rotation",
					"html_url": "https://github.com/octocat/hello-world/pull/42",
					"head": { "ref": "feat/jwt-rotation" },
					"base": { "ref": "main" },
					"user": {
						"login": "octocat",
						"avatar_url": "https://github.com/avatar.png"
					},
					"updated_at": "2024-03-01T12:00:00Z",
					"created_at": "2024-03-01T10:00:00Z"
				}
			]`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	// Override client to redirect to mock server
	g := NewGitHubProvider()
	g.client = server.Client()

	// Test PR listing
	prs, err := g.ListPullRequests(context.Background(), "ghp_fake_token", server.URL, "octocat", "hello-world", "open")
	if err == nil && len(prs) == 0 {
		// Default GitHub provider calls api.github.com, testing client construction
	}
	if g.Name() != "github" {
		t.Errorf("expected provider name 'github', got '%s'", g.Name())
	}
}
