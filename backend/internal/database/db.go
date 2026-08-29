package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	conn *sql.DB
}

func InitDB(dbPath string) (*DB, error) {
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database at %s: %w", dbPath, err)
	}

	// Ensure WAL mode and foreign keys
	if _, err := conn.Exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;"); err != nil {
		return nil, fmt.Errorf("failed to configure sqlite pragmas: %w", err)
	}

	db := &DB{conn: conn}
	if err := db.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run database migrations: %w", err)
	}

	return db, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS integrations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider TEXT NOT NULL UNIQUE,
		encrypted_token TEXT NOT NULL,
		base_url TEXT DEFAULT '',
		status TEXT NOT NULL DEFAULT 'not_configured',
		masked_token TEXT DEFAULT '',
		updated_at TEXT NOT NULL,
		created_at TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS repos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider TEXT NOT NULL,
		external_id TEXT NOT NULL DEFAULT '',
		owner TEXT NOT NULL,
		name TEXT NOT NULL,
		full_name TEXT NOT NULL,
		url TEXT NOT NULL DEFAULT '',
		default_branch TEXT NOT NULL DEFAULT 'main',
		is_private INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		UNIQUE(provider, full_name)
	);

	CREATE TABLE IF NOT EXISTS chat_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider TEXT NOT NULL,
		owner TEXT NOT NULL,
		repo TEXT NOT NULL,
		pr_number INTEGER NOT NULL,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_chat_messages_pr ON chat_messages(provider, owner, repo, pr_number);
	`

	_, err := db.conn.Exec(schema)
	return err
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, _ = time.Parse("2006-01-02 15:04:05", s)
	}
	return t
}

// Integration methods

func (db *DB) UpsertIntegration(provider, encryptedToken, baseURL, status, maskedToken string) (*Integration, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `
	INSERT INTO integrations (provider, encrypted_token, base_url, status, masked_token, updated_at, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(provider) DO UPDATE SET
		encrypted_token = excluded.encrypted_token,
		base_url = excluded.base_url,
		status = excluded.status,
		masked_token = excluded.masked_token,
		updated_at = excluded.updated_at;
	`
	_, err := db.conn.Exec(query, provider, encryptedToken, baseURL, status, maskedToken, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert integration for %s: %w", provider, err)
	}

	return db.GetIntegration(provider)
}

func (db *DB) GetIntegration(provider string) (*Integration, error) {
	query := `SELECT id, provider, encrypted_token, base_url, status, masked_token, updated_at, created_at FROM integrations WHERE provider = ?`
	row := db.conn.QueryRow(query, provider)

	var item Integration
	var updatedAtStr, createdAtStr string
	err := row.Scan(&item.ID, &item.Provider, &item.EncryptedToken, &item.BaseURL, &item.Status, &item.MaskedToken, &updatedAtStr, &createdAtStr)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	item.UpdatedAt = parseTime(updatedAtStr)
	item.CreatedAt = parseTime(createdAtStr)
	return &item, nil
}

func (db *DB) ListIntegrations() ([]Integration, error) {
	query := `SELECT id, provider, encrypted_token, base_url, status, masked_token, updated_at, created_at FROM integrations ORDER BY provider ASC`
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Integration, 0)
	for rows.Next() {
		var item Integration
		var updatedAtStr, createdAtStr string
		if err := rows.Scan(&item.ID, &item.Provider, &item.EncryptedToken, &item.BaseURL, &item.Status, &item.MaskedToken, &updatedAtStr, &createdAtStr); err != nil {
			return nil, err
		}
		item.UpdatedAt = parseTime(updatedAtStr)
		item.CreatedAt = parseTime(createdAtStr)
		list = append(list, item)
	}
	return list, nil
}

func (db *DB) DeleteIntegration(provider string) error {
	query := `DELETE FROM integrations WHERE provider = ?`
	_, err := db.conn.Exec(query, provider)
	return err
}

// Repositories methods

func (db *DB) SaveRepo(repo *Repository) error {
	now := time.Now().UTC().Format(time.RFC3339)
	isPriv := 0
	if repo.IsPrivate {
		isPriv = 1
	}

	query := `
	INSERT INTO repos (provider, external_id, owner, name, full_name, url, default_branch, is_private, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(provider, full_name) DO UPDATE SET
		external_id = excluded.external_id,
		url = excluded.url,
		default_branch = excluded.default_branch,
		is_private = excluded.is_private;
	`
	_, err := db.conn.Exec(query, repo.Provider, repo.ExternalID, repo.Owner, repo.Name, repo.FullName, repo.URL, repo.DefaultBranch, isPriv, now)
	return err
}

func (db *DB) ListRepos(provider string) ([]Repository, error) {
	var query string
	var rows *sql.Rows
	var err error

	if provider != "" {
		query = `SELECT id, provider, external_id, owner, name, full_name, url, default_branch, is_private, created_at FROM repos WHERE provider = ? ORDER BY full_name ASC`
		rows, err = db.conn.Query(query, provider)
	} else {
		query = `SELECT id, provider, external_id, owner, name, full_name, url, default_branch, is_private, created_at FROM repos ORDER BY full_name ASC`
		rows, err = db.conn.Query(query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Repository, 0)
	for rows.Next() {
		var item Repository
		var isPriv int
		var createdAtStr string
		if err := rows.Scan(&item.ID, &item.Provider, &item.ExternalID, &item.Owner, &item.Name, &item.FullName, &item.URL, &item.DefaultBranch, &isPriv, &createdAtStr); err != nil {
			return nil, err
		}
		item.IsPrivate = isPriv != 0
		item.CreatedAt = parseTime(createdAtStr)
		list = append(list, item)
	}
	return list, nil
}

// Chat Messages methods

func (db *DB) SaveChatMessage(provider, owner, repo string, prNumber int, role, content string) (*ChatMessage, error) {
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	query := `
	INSERT INTO chat_messages (provider, owner, repo, pr_number, role, content, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.conn.Exec(query, provider, owner, repo, prNumber, role, content, nowStr)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return &ChatMessage{
		ID:        id,
		Provider:  provider,
		Owner:     owner,
		Repo:      repo,
		PRNumber:  prNumber,
		Role:      role,
		Content:   content,
		CreatedAt: now,
	}, nil
}

func (db *DB) GetChatHistory(provider, owner, repo string, prNumber int) ([]ChatMessage, error) {
	query := `
	SELECT id, provider, owner, repo, pr_number, role, content, created_at
	FROM chat_messages
	WHERE provider = ? AND owner = ? AND repo = ? AND pr_number = ?
	ORDER BY id ASC
	`
	rows, err := db.conn.Query(query, provider, owner, repo, prNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]ChatMessage, 0)
	for rows.Next() {
		var item ChatMessage
		var createdAtStr string
		if err := rows.Scan(&item.ID, &item.Provider, &item.Owner, &item.Repo, &item.PRNumber, &item.Role, &item.Content, &createdAtStr); err != nil {
			return nil, err
		}
		item.CreatedAt = parseTime(createdAtStr)
		list = append(list, item)
	}
	return list, nil
}

func (db *DB) ClearChatHistory(provider, owner, repo string, prNumber int) error {
	query := `DELETE FROM chat_messages WHERE provider = ? AND owner = ? AND repo = ? AND pr_number = ?`
	_, err := db.conn.Exec(query, provider, owner, repo, prNumber)
	return err
}
