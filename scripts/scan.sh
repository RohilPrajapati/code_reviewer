#!/usr/bin/env bash
# ==============================================================================
# Security & Secret Scanner Before Git Commits
# Checks for leaked API keys, tokens, .env files, and database files.
# ==============================================================================

set -e

# Always resolve project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Running Pre-Commit Security & Secret Scanner...${NC}"
FAILED=0

# 1. Check for .env files that should not be tracked
echo -e "  [1/4] Checking for staged or tracked secret environment files..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    ENV_FILES=$(git diff --cached --name-only | grep -E '^\.env$|\.env\.local$|\.env\.production$' || true)
    if [ -n "$ENV_FILES" ]; then
        echo -e "    ${RED}❌ ERROR: Secret environment file staged for commit:${NC}"
        echo -e "    $ENV_FILES"
        echo -e "    ${YELLOW}👉 Run: git reset HEAD <file> and add it to .gitignore${NC}"
        FAILED=1
    fi
fi

# 2. Check for SQLite database files
echo -e "  [2/4] Checking for SQLite database files..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    DB_FILES=$(git diff --cached --name-only | grep -E '\.(db|sqlite|sqlite3|db-wal|db-shm)$' || true)
    if [ -n "$DB_FILES" ]; then
        echo -e "    ${RED}❌ ERROR: Database file staged for commit:${NC}"
        echo -e "    $DB_FILES"
        FAILED=1
    fi
fi

# 3. Check for plaintext hardcoded API keys & secrets in staged changes
echo -e "  [3/4] Scanning files for hardcoded secrets and API keys..."

SCAN_TARGETS="backend/ frontend/src/"
PATTERNS=(
    "AIzaSy[A-Za-z0-9_-]{33}"             # Google Gemini / Google Cloud API Key
    "ghp_[A-Za-z0-9]{36}"                 # GitHub Personal Access Token
    "github_pat_[A-Za-z0-9_]{82}"          # GitHub Fine-grained PAT
    "glpat-[A-Za-z0-9_-]{20,}"             # GitLab Personal Access Token
    "sk-[a-zA-Z0-9]{32,}"                  # OpenAI API Key
    "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----" # Private keys
)

for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(grep -rE --exclude-dir={node_modules,.next,.git,data,scripts} --exclude="*_test.go" --exclude="*.test.*" --exclude="*.example" "$pattern" $SCAN_TARGETS 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
        echo -e "    ${RED}❌ ERROR: Potential plaintext secret matching pattern '$pattern':${NC}"
        echo "$MATCHES" | head -n 5
        FAILED=1
    fi
done

# 4. Code compilation and test check
echo -e "  [4/4] Verifying backend and frontend test health..."
if (cd backend && go vet ./... >/dev/null 2>&1); then
    echo -e "    ${GREEN}✓ Go backend static analysis (go vet) passed.${NC}"
else
    echo -e "    ${RED}❌ ERROR: Go backend static analysis failed.${NC}"
    FAILED=1
fi

if (cd frontend && npm test >/dev/null 2>&1); then
    echo -e "    ${GREEN}✓ Frontend unit tests passed.${NC}"
else
    echo -e "    ${RED}❌ ERROR: Frontend unit tests failed.${NC}"
    FAILED=1
fi

echo ""
if [ $FAILED -eq 1 ]; then
    echo -e "${RED}🚨 Security scan FAILED! Please fix the errors above before committing.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All security and code health checks PASSED! Safe to commit.${NC}"
    exit 0
fi
