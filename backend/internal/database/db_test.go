package database

import (
	"path/filepath"
	"testing"
)

func TestDatabaseOperations(t *testing.T) {
	// Create temporary SQLite DB
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_reviewer.db")

	db, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 1. Test Integration Upsert & Get
	integ, err := db.UpsertIntegration("gitlab", "enc_secret_token", "https://gitlab.com", "connected", "glpat-...123")
	if err != nil {
		t.Fatalf("UpsertIntegration failed: %v", err)
	}
	if integ.Provider != "gitlab" || integ.Status != "connected" {
		t.Errorf("unexpected integration: %+v", integ)
	}

	fetched, err := db.GetIntegration("gitlab")
	if err != nil {
		t.Fatalf("GetIntegration failed: %v", err)
	}
	if fetched.EncryptedToken != "enc_secret_token" || fetched.MaskedToken != "glpat-...123" {
		t.Errorf("unexpected fetched integration: %+v", fetched)
	}

	allInteg, err := db.ListIntegrations()
	if err != nil || len(allInteg) != 1 {
		t.Fatalf("ListIntegrations failed: %v, count=%d", err, len(allInteg))
	}

	// 2. Test Repository Save & List
	repo := &Repository{
		Provider:      "gitlab",
		ExternalID:    "77458911",
		Owner:         "Kingsofttech",
		Name:          "Loyalty Program",
		FullName:      "Kingsofttech/loyalty-program",
		URL:           "https://gitlab.com/Kingsofttech/loyalty-program",
		DefaultBranch: "main",
		IsPrivate:     true,
	}
	if err := db.SaveRepo(repo); err != nil {
		t.Fatalf("SaveRepo failed: %v", err)
	}

	savedRepos, err := db.ListRepos("gitlab")
	if err != nil || len(savedRepos) != 1 {
		t.Fatalf("ListRepos failed: %v, count=%d", err, len(savedRepos))
	}
	if savedRepos[0].ExternalID != "77458911" || savedRepos[0].FullName != "Kingsofttech/loyalty-program" {
		t.Errorf("unexpected repository data: %+v", savedRepos[0])
	}

	// 3. Test Chat Message Save, Get, and Clear
	msgUser, err := db.SaveChatMessage("gitlab", "Kingsofttech", "loyalty-program", 129, "user", "Review this PR")
	if err != nil {
		t.Fatalf("SaveChatMessage user failed: %v", err)
	}
	if msgUser.Role != "user" || msgUser.Content != "Review this PR" {
		t.Errorf("unexpected msgUser: %+v", msgUser)
	}

	_, err = db.SaveChatMessage("gitlab", "Kingsofttech", "loyalty-program", 129, "assistant", "Here is the AI review...")
	if err != nil {
		t.Fatalf("SaveChatMessage assistant failed: %v", err)
	}

	history, err := db.GetChatHistory("gitlab", "Kingsofttech", "loyalty-program", 129)
	if err != nil || len(history) != 2 {
		t.Fatalf("GetChatHistory failed: %v, count=%d", err, len(history))
	}

	if err := db.ClearChatHistory("gitlab", "Kingsofttech", "loyalty-program", 129); err != nil {
		t.Fatalf("ClearChatHistory failed: %v", err)
	}

	historyAfterClear, err := db.GetChatHistory("gitlab", "Kingsofttech", "loyalty-program", 129)
	if err != nil || len(historyAfterClear) != 0 {
		t.Fatalf("expected 0 messages after clear, got %d", len(historyAfterClear))
	}

	// 4. Test Delete Integration
	if err := db.DeleteIntegration("gitlab"); err != nil {
		t.Fatalf("DeleteIntegration failed: %v", err)
	}
	integAfterDel, err := db.GetIntegration("gitlab")
	if err != nil {
		t.Fatalf("GetIntegration after del failed: %v", err)
	}
	if integAfterDel != nil {
		t.Errorf("expected nil integration after delete, got %+v", integAfterDel)
	}
}
