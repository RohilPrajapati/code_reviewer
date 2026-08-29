package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/rohil/code_reviewer/backend/internal/config"
	"github.com/rohil/code_reviewer/backend/internal/database"
)

func setupTestApp(t *testing.T) (*Handler, http.Handler, func()) {
	tmpDir, err := os.MkdirTemp("", "code_reviewer_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}

	cfg := &config.Config{
		Port:          "8080",
		DBPath:        dbPath,
		EncryptionKey: "test-secret-key-32-chars-long1234",
		CORSOrigin:    "*",
	}

	h := NewHandler(cfg, db)

	r := chi.NewRouter()
	r.Get("/api/health", h.HealthCheck)
	r.Get("/api/integrations", h.ListIntegrations)
	r.Post("/api/integrations/{provider}", h.SaveIntegration)
	r.Delete("/api/integrations/{provider}", h.DeleteIntegration)
	r.Get("/api/repos", h.ListRepos)
	r.Post("/api/repos/manual", h.AddManualRepo)
	r.Get("/api/repos/{provider}/{owner}/{repo}/prs/{number}/chat", h.GetChatHistory)
	r.Delete("/api/repos/{provider}/{owner}/{repo}/prs/{number}/chat", h.ClearChatHistory)

	cleanup := func() {
		db.Close()
		os.RemoveAll(tmpDir)
	}

	return h, r, cleanup
}

func TestHealthCheck(t *testing.T) {
	_, router, cleanup := setupTestApp(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["status"] != "ok" {
		t.Fatalf("expected status 'ok', got %v", resp["status"])
	}
}

func TestIntegrationsListAndSave(t *testing.T) {
	_, router, cleanup := setupTestApp(t)
	defer cleanup()

	// 1. List initial integrations (should have gemini, github, gitlab with not_configured)
	req := httptest.NewRequest(http.MethodGet, "/api/integrations", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var items []database.Integration
	if err := json.NewDecoder(rec.Body).Decode(&items); err != nil {
		t.Fatalf("failed to decode items: %v", err)
	}

	if len(items) != 3 {
		t.Fatalf("expected 3 integrations, got %d", len(items))
	}

	// 2. Save Gemini integration
	savePayload := map[string]string{
		"token": "AIzaSyFakeKeyForTesting1234567890",
	}
	body, _ := json.Marshal(savePayload)
	req = httptest.NewRequest(http.MethodPost, "/api/integrations/gemini", bytes.NewReader(body))
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 on save, got %d", rec.Code)
	}

	// 3. List integrations again and check masked token
	req = httptest.NewRequest(http.MethodGet, "/api/integrations", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if err := json.NewDecoder(rec.Body).Decode(&items); err != nil {
		t.Fatalf("failed to decode items: %v", err)
	}

	var geminiInteg *database.Integration
	for _, it := range items {
		if it.Provider == "gemini" {
			geminiInteg = &it
			break
		}
	}

	if geminiInteg == nil {
		t.Fatalf("gemini integration not found")
	}

	if geminiInteg.MaskedToken == "" || geminiInteg.MaskedToken == "AIzaSyFakeKeyForTesting1234567890" {
		t.Fatalf("expected masked token, got %q", geminiInteg.MaskedToken)
	}
}

func TestManualRepoAndChatHistory(t *testing.T) {
	handler, router, cleanup := setupTestApp(t)
	defer cleanup()

	// 1. Add manual repo
	addRepoPayload := map[string]string{
		"provider": "github",
		"url":      "https://github.com/facebook/react",
		"owner":    "facebook",
		"name":     "react",
	}
	body, _ := json.Marshal(addRepoPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/repos/manual", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", rec.Code)
	}

	// 2. List repos
	req = httptest.NewRequest(http.MethodGet, "/api/repos", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var repos []database.Repository
	if err := json.NewDecoder(rec.Body).Decode(&repos); err != nil {
		t.Fatalf("failed to decode repos: %v", err)
	}

	if len(repos) != 1 || repos[0].FullName != "facebook/react" {
		t.Fatalf("expected facebook/react, got %+v", repos)
	}

	// 3. Save chat messages directly and fetch via router
	_, err := handler.db.SaveChatMessage("github", "facebook", "react", 42, "user", "What changed here?")
	if err != nil {
		t.Fatalf("failed to save chat message: %v", err)
	}
	_, err = handler.db.SaveChatMessage("github", "facebook", "react", 42, "assistant", "This PR fixes a hook dependency.")
	if err != nil {
		t.Fatalf("failed to save assistant chat message: %v", err)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/repos/github/facebook/react/prs/42/chat", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var chatHistory []database.ChatMessage
	if err := json.NewDecoder(rec.Body).Decode(&chatHistory); err != nil {
		t.Fatalf("failed to decode chat history: %v", err)
	}

	if len(chatHistory) != 2 {
		t.Fatalf("expected 2 chat messages, got %d", len(chatHistory))
	}

	// 4. Clear chat history
	req = httptest.NewRequest(http.MethodDelete, "/api/repos/github/facebook/react/prs/42/chat", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 on delete, got %d", rec.Code)
	}

	// Check empty history
	req = httptest.NewRequest(http.MethodGet, "/api/repos/github/facebook/react/prs/42/chat", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	chatHistory = nil
	if err := json.NewDecoder(rec.Body).Decode(&chatHistory); err != nil {
		t.Fatalf("failed to decode chat history: %v", err)
	}

	if len(chatHistory) != 0 {
		t.Fatalf("expected 0 chat messages, got %d", len(chatHistory))
	}
}
