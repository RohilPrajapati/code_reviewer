const assert = require("node:assert/strict");
const test = require("node:test");
const Prism = require("prismjs");

require("prismjs/components/prism-clike");
require("prismjs/components/prism-go");
require("prismjs/components/prism-javascript");
require("prismjs/components/prism-typescript");
require("prismjs/components/prism-python");
require("prismjs/components/prism-json");
require("prismjs/components/prism-yaml");

const EXTENSION_MAP = {
  go: "go",
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  sh: "bash",
  md: "markdown",
  dockerfile: "docker",
};

function getLanguageFromFilename(filename) {
  if (!filename) return "plaintext";
  const lower = filename.toLowerCase();
  const basename = lower.split("/").pop() || "";
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) return "docker";
  if (basename === "makefile") return "bash";
  if (basename.endsWith(".env") || basename.startsWith(".env.")) return "bash";
  const ext = basename.split(".").pop() || "";
  return EXTENSION_MAP[ext] || "plaintext";
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightCodeLine(lineContent, language) {
  if (!lineContent) return "";
  if (!language || language === "plaintext" || !Prism.languages[language]) {
    return escapeHtml(lineContent);
  }
  try {
    return Prism.highlight(lineContent, Prism.languages[language], language);
  } catch {
    return escapeHtml(lineContent);
  }
}

test("getLanguageFromFilename maps file extensions correctly", () => {
  assert.equal(getLanguageFromFilename("backend/main.go"), "go");
  assert.equal(getLanguageFromFilename("src/app/page.tsx"), "tsx");
  assert.equal(getLanguageFromFilename("lib/utils.ts"), "typescript");
  assert.equal(getLanguageFromFilename("script.py"), "python");
  assert.equal(getLanguageFromFilename("package.json"), "json");
  assert.equal(getLanguageFromFilename("docker-compose.yml"), "yaml");
  assert.equal(getLanguageFromFilename("Dockerfile"), "docker");
  assert.equal(getLanguageFromFilename("unknown.xyz"), "plaintext");
  assert.equal(getLanguageFromFilename(null), "plaintext");
});

test("highlightCodeLine produces tokenized HTML for Go code", () => {
  const code = "func main() { return nil }";
  const highlighted = highlightCodeLine(code, "go");
  assert.match(highlighted, /class="token keyword">func<\/span>/);
  assert.match(highlighted, /class="token function">main<\/span>/);
  assert.match(highlighted, /class="token boolean">nil<\/span>/);
});

test("highlightCodeLine produces tokenized HTML for TypeScript code", () => {
  const code = "const message: string = 'hello';";
  const highlighted = highlightCodeLine(code, "typescript");
  assert.match(highlighted, /class="token keyword">const<\/span>/);
  assert.match(highlighted, /class="token string">'hello'<\/span>/);
});

test("highlightCodeLine safely escapes plaintext and invalid languages", () => {
  const code = "<div>&'\"</div>";
  const highlighted = highlightCodeLine(code, "plaintext");
  assert.equal(highlighted, "&lt;div&gt;&amp;&#039;&quot;&lt;/div&gt;");
});
