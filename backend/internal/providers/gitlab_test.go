package providers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGitLabGetProjectPath(t *testing.T) {
	// Mock GitLab API server that returns project matching search
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/api/v4/projects") {
			w.Header().Set("Content-Type", "application/json")
			query := r.URL.Query().Get("search")
			if query == "loyalty-program" || query == "Loyalty-Program" {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[
					{
						"id": 77458911,
						"name": "Loyalty Program",
						"path": "loyalty-program",
						"path_with_namespace": "Kingsofttech/loyalty-program"
					}
				]`))
				return
			}
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	g := NewGitLabProvider()

	// 1. Numeric ID test
	numericGot := g.ResolveProjectIdentifier(context.Background(), "token", server.URL, "Kingsofttech", "77458911")
	if numericGot != "77458911" {
		t.Errorf("numeric ID resolution failed: got %q, want '77458911'", numericGot)
	}

	// 2. API search match test
	searchGot := g.ResolveProjectIdentifier(context.Background(), "token", server.URL, "Kingsofttech", "loyalty-program")
	if searchGot != "77458911" {
		t.Errorf("API search resolution failed: got %q, want '77458911'", searchGot)
	}

	// 3. Fallback URL encoded tests
	tests := []struct {
		owner    string
		name     string
		expected string
	}{
		{"group/subgroup", "my-repo", "group%2Fsubgroup%2Fmy-repo"},
		{"myorg", "project 123", "myorg%2Fproject-123"},
	}

	for _, tt := range tests {
		got := g.ResolveProjectIdentifier(context.Background(), "token", server.URL, tt.owner, tt.name)
		if !strings.EqualFold(got, tt.expected) && got != tt.expected {
			t.Errorf("ResolveProjectIdentifier(%q, %q) = %q; want %q", tt.owner, tt.name, got, tt.expected)
		}
	}
}

func TestGitLabListPullRequests(t *testing.T) {
	// Mock GitLab API server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "merge_requests") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[
				{
					"id": 101,
					"iid": 1,
					"title": "Add loyalty points feature",
					"state": "opened",
					"description": "Implements bonus calculation",
					"web_url": "https://gitlab.com/Kingsofttech/loyalty-program/-/merge_requests/1",
					"source_branch": "feat/loyalty-points",
					"target_branch": "main",
					"author": {
						"username": "developer1",
						"avatar_url": "https://gitlab.com/avatar.png"
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

	g := NewGitLabProvider()
	prs, err := g.ListPullRequests(context.Background(), "fake-token", server.URL, "Kingsofttech", "Loyalty Program", "open")
	if err != nil {
		t.Fatalf("ListPullRequests failed: %v", err)
	}

	if len(prs) != 1 {
		t.Fatalf("expected 1 PR, got %d", len(prs))
	}

	if prs[0].Number != 1 || prs[0].Title != "Add loyalty points feature" || prs[0].Status != "open" {
		t.Fatalf("unexpected PR data: %+v", prs[0])
	}
}

func TestGitLabGetPullRequestDiff(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "changes") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"changes": [
					{
						"old_path": "main.go",
						"new_path": "main.go",
						"new_file": false,
						"renamed_file": false,
						"deleted_file": false,
						"diff": "@@ -1,3 +1,4 @@\n package main\n+import \"fmt\"\n func main() {}"
					}
				]
			}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	g := NewGitLabProvider()
	diffs, err := g.GetPullRequestDiff(context.Background(), "fake-token", server.URL, "Kingsofttech", "loyalty-program", 1)
	if err != nil {
		t.Fatalf("GetPullRequestDiff failed: %v", err)
	}

	if len(diffs) != 1 {
		t.Fatalf("expected 1 diff file, got %d", len(diffs))
	}

	if diffs[0].Filename != "main.go" || diffs[0].Additions != 1 {
		t.Errorf("unexpected diff stats: %+v", diffs[0])
	}
}
