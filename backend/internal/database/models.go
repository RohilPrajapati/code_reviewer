package database

import (
	"time"
)

type Integration struct {
	ID             int64     `json:"id"`
	Provider       string    `json:"provider"` // gemini, github, gitlab
	EncryptedToken string    `json:"-"`
	BaseURL        string    `json:"base_url,omitempty"` // For self-hosted gitlab
	Status         string    `json:"status"`             // connected, invalid, not_configured
	MaskedToken    string    `json:"masked_token"`
	UpdatedAt      time.Time `json:"updated_at"`
	CreatedAt      time.Time `json:"created_at"`
}

type Repository struct {
	ID            int64     `json:"id"`
	Provider      string    `json:"provider"` // github, gitlab
	ExternalID    string    `json:"external_id"`
	Owner         string    `json:"owner"`
	Name          string    `json:"name"`
	FullName      string    `json:"full_name"`
	URL           string    `json:"url"`
	DefaultBranch string    `json:"default_branch"`
	IsPrivate     bool      `json:"is_private"`
	CreatedAt     time.Time `json:"created_at"`
}

type PullRequest struct {
	ID                int64     `json:"id"`
	Provider          string    `json:"provider"`
	Owner             string    `json:"owner"`
	Repo              string    `json:"repo"`
	Number            int       `json:"number"`
	Title             string    `json:"title"`
	Author            string    `json:"author"`
	AuthorAvatar      string    `json:"author_avatar"`
	Status            string    `json:"status"` // open, closed, merged
	SourceBranch      string    `json:"source_branch"`
	TargetBranch      string    `json:"target_branch"`
	URL               string    `json:"url"`
	Body              string    `json:"body"`
	ChangedFilesCount int       `json:"changed_files_count"`
	UpdatedAt         time.Time `json:"updated_at"`
	CreatedAt         time.Time `json:"created_at"`
}

type FileDiff struct {
	Filename         string `json:"filename"`
	OldFilename      string `json:"old_filename,omitempty"`
	Status           string `json:"status"` // added, modified, removed, renamed
	Additions        int    `json:"additions"`
	Deletions        int    `json:"deletions"`
	Changes          int    `json:"changes"`
	Patch            string `json:"patch"`
	RawURL           string `json:"raw_url,omitempty"`
}

type ChatMessage struct {
	ID        int64     `json:"id"`
	Provider  string    `json:"provider"`
	Owner     string    `json:"owner"`
	Repo      string    `json:"repo"`
	PRNumber  int       `json:"pr_number"`
	Role      string    `json:"role"` // user, assistant, system
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
