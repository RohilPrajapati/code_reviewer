import Prism from "prismjs";

// Load essential Prism language grammars
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";

const EXTENSION_MAP: Record<string, string> = {
  // Go
  go: "go",

  // TypeScript / JavaScript
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",

  // Python
  py: "python",
  pyw: "python",

  // Rust
  rs: "rust",

  // Java / Kotlin
  java: "java",

  // C / C++
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cxx: "cpp",

  // Config & Data
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  toml: "yaml",

  // Databases
  sql: "sql",

  // Shell & Scripts
  sh: "bash",
  bash: "bash",
  zsh: "bash",

  // Web & Styles
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  css: "css",
  scss: "scss",

  // Docs
  md: "markdown",
  markdown: "markdown",

  // Container & CI
  dockerfile: "docker",
  dockerignore: "bash",
};

/**
 * Detect language identifier from filename
 */
export function getLanguageFromFilename(filename: string): string {
  if (!filename) return "plaintext";

  const lower = filename.toLowerCase();
  const basename = lower.split("/").pop() || "";

  // Exact filename matches
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) return "docker";
  if (basename === "makefile") return "bash";
  if (basename.endsWith(".env") || basename.startsWith(".env.")) return "bash";

  // Extension matching
  const ext = basename.split(".").pop() || "";
  return EXTENSION_MAP[ext] || "plaintext";
}

/**
 * Escape HTML special characters safely
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Highlight a single code line with Prism
 */
export function highlightCodeLine(lineContent: string, language: string): string {
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
