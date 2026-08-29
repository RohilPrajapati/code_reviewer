package providers

import (
	"context"

	"github.com/rohil/code_reviewer/backend/internal/database"
)

type GitProvider interface {
	Name() string
	TestConnection(ctx context.Context, token, baseURL string) error
	ListRepositories(ctx context.Context, token, baseURL string) ([]database.Repository, error)
	GetRepository(ctx context.Context, token, baseURL, owner, name string) (*database.Repository, error)
	ListPullRequests(ctx context.Context, token, baseURL, owner, name, state string) ([]database.PullRequest, error)
	GetPullRequest(ctx context.Context, token, baseURL, owner, name string, number int) (*database.PullRequest, error)
	GetPullRequestDiff(ctx context.Context, token, baseURL, owner, name string, number int) ([]database.FileDiff, error)
	PostComment(ctx context.Context, token, baseURL, owner, name string, number int, body string) error
}
