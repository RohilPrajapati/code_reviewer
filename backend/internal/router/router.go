package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rohil/code_reviewer/backend/internal/config"
	"github.com/rohil/code_reviewer/backend/internal/handlers"
)

func NewRouter(cfg *config.Config, h *handlers.Handler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Configure CORS &
	// TODO need to change AllowOrigins
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowOriginFunc:  func(r *http.Request, origin string) bool { return true },
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Origin", "X-Requested-With", "User-Agent"},
		ExposedHeaders:   []string{"Link", "Content-Length", "Access-Control-Allow-Origin"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.HealthCheck)

		// Integrations
		r.Get("/integrations", h.ListIntegrations)
		r.Get("/integrations/gemini/models", h.ListGeminiModels)
		r.Post("/integrations/{provider}", h.SaveIntegration)
		r.Post("/integrations/{provider}/test", h.TestIntegration)
		r.Delete("/integrations/{provider}", h.DeleteIntegration)

		// Repos
		r.Get("/repos", h.ListRepos)
		r.Post("/repos/manual", h.AddManualRepo)

		// Pull Requests
		r.Get("/repos/{provider}/{owner}/{repo}/prs", h.ListPullRequests)
		r.Get("/repos/{provider}/{owner}/{repo}/prs/{number}/diff", h.GetPullRequestDiff)
		r.Get("/repos/{provider}/{owner}/{repo}/prs/{number}/chat", h.GetChatHistory)
		r.Post("/repos/{provider}/{owner}/{repo}/prs/{number}/chat", h.SendChatMessage)
		r.Delete("/repos/{provider}/{owner}/{repo}/prs/{number}/chat", h.ClearChatHistory)
		r.Post("/repos/{provider}/{owner}/{repo}/prs/{number}/comment", h.PostComment)
	})

	return r
}
