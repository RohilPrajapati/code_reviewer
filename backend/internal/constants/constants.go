package constants

import "time"

// Providers
const (
	ProviderGitHub = "github"
	ProviderGitLab = "gitlab"
	ProviderGemini = "gemini"
)

// Integration Statuses
const (
	StatusConnected     = "connected"
	StatusNotConfigured = "not_configured"
	StatusError         = "error"
)

// Remote API URLs
const (
	DefaultGitHubAPIURL = "https://api.github.com"
	DefaultGitLabURL    = "https://gitlab.com"
	DefaultGeminiURL    = "https://generativelanguage.googleapis.com"
)

// HTTP & Network Constants
const (
	UserAgentHeader     = "AICodeReviewer-App"
	GitHubAPIVersion    = "2022-11-28"
	DefaultHTTPTimeout  = 30 * time.Second
	GeminiStreamTimeout = 60 * time.Second
)

// Chat & Review Roles
const (
	RoleUser      = "user"
	RoleAssistant = "assistant"
	RoleModel     = "model"
)

// AI Models
const (
	DefaultGeminiModel = "gemini-2.5-flash"
	FallbackModel      = "gemini-2.0-flash"
)

// Default Configuration Fallbacks
const (
	DefaultPort       = "8080"
	DefaultDBPath     = "./reviewer.db"
	DefaultCORSOrigin = "*"
)

// System Prompts
const (
	SeniorReviewerSystemPrompt = `You are an expert, meticulous AI Senior Code Reviewer and Staff Software Engineer.
Your job is to thoroughly inspect code diffs and pull requests, answering developer questions, flagging bugs, security vulnerabilities, performance regressions, code quality issues, and suggesting concrete inline fixes and automated test cases.

Formatting Guidelines:
- Format all code blocks with proper syntax highlighting.
- Be constructive, concise, and prioritize high-severity problems (security, logic bugs, race conditions, edge cases) before stylistic nitpicks.
- When referencing specific lines or files, cite them clearly using markdown links or code spans (e.g. path/to/file.go:L42).
- If asked for a 'Full Review', structure it cleanly:
  1. 📝 **Summary of Changes**: High-level overview.
  2. ⚠️ **Critical & High Priority Issues**: Bugs, security, performance.
  3. 💡 **Suggestions & Improvements**: Code readability, maintainability, modern idioms.
  4. 🧪 **Testing Recommendations**: Edge cases to cover.
  5. ✅ **Verdict**: (Approve / Request Changes / Comment).`
)
