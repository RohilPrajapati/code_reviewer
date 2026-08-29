# ⚡ AI Code Reviewer

A modern, high-performance, full-stack **AI Code Reviewer** application designed to connect with **GitHub** and **GitLab**, parse multi-file pull/merge request diffs, interactively chat with **Google Gemini models** in real-time (via Server-Sent Events token streaming), and publish structured senior-level code reviews directly to remote repositories.

> [!NOTE]
> **Single-User & Local Deployment Notice**: The application is currently designed for single-user, local workstation use and does not include built-in multi-tenant user authentication (login/signup). All API keys and Personal Access Tokens are encrypted and stored locally in your SQLite database via AES-256-GCM.

---

## 🌟 Key Features

- 🔐 **AES-256-GCM Encrypted Secret Storage**: All API keys (Gemini) and Personal Access Tokens (GitHub / GitLab) are encrypted at rest using standard library AES-256-GCM. Raw tokens are never sent to the client—only masked previews (e.g. `glpat-...3f8a`) are exposed.
- 🐙 **Multi-Provider Git Integration**:
  - **GitHub** (Personal Access Token with `repo` and `read:user` scopes).
  - **GitLab** (GitLab.com or custom self-hosted instances with automatic project path resolution).
  - Clean `GitProvider` interface easily extensible to Bitbucket and other VCS.
- 📂 **Multi-Pane Review Studio**:
  - Split and Unified collapsible file diff viewer with additions/deletions diff metrics.
  - Interactive file tree with status indicators (`modified`, `added`, `removed`, `renamed`).
  - Click-to-quote line numbers (e.g., clicking on line 42 inserts `@filename:L42` into the prompt).
- ✨ **Gemini AI Streaming & Typewriter Engine**:
  - Real-time token streaming via Server-Sent Events (SSE).
  - Client-side typewriter engine for smooth token rendering.
  - Instant **"Thinking & Analyzing" diagnostic stage** with live radar progress beacons.
  - **Quick Action Prompts**:
    - 🚀 **Full Review**: Structured senior review covering summary, critical bugs, suggestions, testing, and verdict.
    - 🔒 **Security Check**: OWASP Top 10, injection, ReDoS, sensitive data exposure, and authentication audits.
    - 🧪 **Suggest Tests**: Boundary conditions, edge cases, and unit test implementations.
    - 💡 **Explain Changes**: Plain English architectural overview.
    - ⚡ **Performance Check**: Big-O algorithmic complexity, race conditions, and memory leaks.
- 💬 **One-Click Post to PR / MR**: Publish the AI-generated review markdown directly to the GitHub PR or GitLab MR discussion thread.
- 💾 **Persistent Chat History**: Session history per pull request persisted in SQLite.
- 🌓 **Modern Dark / Light UI**: Responsive Next.js 14 App Router interface with Tailwind CSS and Radix UI primitives.

---

## 🏗️ System Architecture & Data Flow

```
   ┌────────────────────────────────────────────────────────┐
   │            Git Providers (Unified GitProvider)         │
   │      GitHub REST API  │  GitLab API  │  Bitbucket      │
   └───────────────────────────┬────────────────────────────┘
                               │ Fetch Multi-File Diffs
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │         Context-Selection & Diff Pruning Pipeline      │
   │  - Classify files (drop lockfiles, generated code)     │
   │  - Detect changed AST symbols & call graphs            │
   │  - Rank relevant hunks & retrieve surrounding context  │
   └───────────────────────────┬────────────────────────────┘
                               │ Compact Grounded Context
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │           Senior AI Review Engine (AIProvider)         │
   │    Google Gemini (SSE) │ OpenAI GPT-4o │ Anthropic     │
   └───────────────────────────┬────────────────────────────┘
                               │ Streamed Line-Level Findings
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │       Evidence-Based Review Studio (Next.js 14)        │
   │  - PR Risk Scorecard (Security, Correctness, Tests)    │
   │  - Traceable Code Evidence (Line references & Proof)   │
   │  - Side-by-Side & Unified Diff Viewers                 │
   │  - Interactive AI Discussion & One-Click Fix Patching  │
   └───────────────────────────┬────────────────────────────┘
                               │ Publish Structured Verdict
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │     Remote Pull Request / Merge Request Discussion     │
   └────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) (Recommended) **OR**
- [Go 1.26+](https://golang.org/dl/) & [Node.js 18+](https://nodejs.org/)

---

### Option 1: Docker Compose (Quickest)

1. Clone the repository:
   ```bash
   git clone https://github.com/rohil/code_reviewer.git
   cd code_reviewer
   ```

2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

3. Launch the full stack:
   ```bash
   docker compose up -d --build
   ```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8080](http://localhost:8080)

---

### Option 2: Running Locally (Development)

#### 1. Start the Go Backend
```bash
cd backend
export ENCRYPTION_KEY=$(openssl rand -hex 32)
export PORT="8080"
export DB_PATH="./reviewer.db"

go run cmd/server/main.go
```
The backend starts at `http://localhost:8080`.

#### 2. Start the Next.js Frontend
In a new terminal tab:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Configuration & Access Tokens

Navigate to **Settings** (`/settings`) to connect your accounts:

| Provider | Required Scope | Setup Instructions |
| :--- | :--- | :--- |
| **Google Gemini** | `API Key` | Get free key at [Google AI Studio](https://aistudio.google.com/app/apikey). |
| **GitHub** | `repo`, `read:user` | Create token at [GitHub PAT Settings](https://github.com/settings/tokens). |
| **GitLab** | `api`, `read_user` | Create token at [GitLab Access Tokens](https://gitlab.com/-/user_settings/personal_access_tokens). Supports custom GitLab URLs. |

---

## 📚 REST API Reference

### Health & Integrations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/integrations` | List integration connection status and masked tokens |
| `POST` | `/api/integrations/:provider` | Save & validate provider key/token (encrypted at rest) |
| `POST` | `/api/integrations/:provider/test` | Test provider connection live |
| `DELETE` | `/api/integrations/:provider` | Remove provider integration |
| `GET` | `/api/integrations/gemini/models` | List available content generation models |

### Repositories & Pull Requests
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/repos?provider=github\|gitlab` | List accessible repositories |
| `POST` | `/api/repos/manual` | Manually track repository by URL or owner/name |
| `GET` | `/api/repos/:provider/:owner/:repo/prs?state=open\|closed\|all` | List pull/merge requests |
| `GET` | `/api/repos/:provider/:owner/:repo/prs/:number/diff` | Get PR metadata and changed file diffs |
| `POST` | `/api/repos/:provider/:owner/:repo/prs/:number/comment` | Post AI review comment back to PR/MR |

### Gemini AI Streaming Chat
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/repos/:provider/:owner/:repo/prs/:number/chat` | Retrieve chat history for PR |
| `POST` | `/api/repos/:provider/:owner/:repo/prs/:number/chat` | Send message & stream Gemini response via SSE |
| `DELETE` | `/api/repos/:provider/:owner/:repo/prs/:number/chat` | Clear chat history for PR |

---

## 🧪 Testing

### Backend Unit & Integration Tests
```bash
cd backend

# Run all backend tests
go test -v -count=1 ./...

# Run specific package tests
go test -v -count=1 ./internal/providers
go test -v -count=1 ./internal/database
go test -v -count=1 ./internal/handlers
go test -v -count=1 ./internal/crypto
```

### Frontend Tests & Type Checking
```bash
cd frontend

# Run frontend tests
npm test

# Verify production build and linting
npm run build
```

---

## 🛡️ Pre-Commit Security & Secret Scanner

Scan the entire repository for accidental secret leaks, `.env` files, SQLite database dumps, and failing tests before committing:

```bash
# Run scanner from root:
./scripts/scan.sh

# Or run from the frontend directory:
npm run scan
```

The scanner runs in milliseconds and verifies:
- ✅ **Secret Shield**: Ensures no `.env` or secret configuration files are tracked or staged.
- ✅ **Database Protection**: Ensures SQLite binaries (`*.db`, `*.db-wal`) are excluded.
- ✅ **Secret Pattern Scanner**: Scans for Google Gemini (`AIzaSy...`), GitHub (`ghp_...`), GitLab (`glpat-...`), and private keys.
- ✅ **Code Health & Tests**: Runs `go vet ./...` and `npm test` to guarantee clean compilation.


---

## 7. Strategic Engineering Roadmap & TODO List

1. **Milestone 1: Decision Intelligence & Risk Scorecard** (`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`) with deep-link navigation.
2. **Milestone 2: Evidence-Based Line Proofs** (Concrete line citations, confidence ratings, and suggested test generation).
3. **Milestone 3: Context-Selection & Diff Pruning** (Noise filtering, AST symbol extraction, relevance ranking).
4. **Milestone 4: Finding-Centric Structured Entities** (Relational `findings` model with threaded per-finding discussion).
5. **Milestone 5: Multi-Provider Extensibility** (`GitProvider`: Bitbucket; `AIProvider`: OpenAI, Anthropic, Ollama).
6. **Milestone 6: Review-to-Resolution Studio** (Auto-scan, evidence jump, 1-click patch generation, publish senior review).
7. **Product Focus Principle**: Zero feature dilution — singular focus on world-class Pull Request code reviews.