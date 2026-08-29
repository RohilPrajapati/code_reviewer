/**
 * Application Constants
 * Single source of truth for frontend configuration, presets, and model settings.
 */

// API Configuration
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Git & AI Providers
export const PROVIDERS = {
  GITHUB: "github",
  GITLAB: "gitlab",
  GEMINI: "gemini",
} as const;

export const PROVIDER_NAMES: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  gemini: "Google Gemini",
};

// AI Models
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const MODEL_OPTIONS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast, balanced & modern (Recommended)" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Ultra-fast generation" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Deep reasoning & large context" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Lightweight review" },
];

// Quick Action Review Presets
export const QUICK_ACTIONS = [
  {
    id: "full-review",
    label: "Full Review",
    icon: "Rocket",
    description: "Complete senior code review with summary, critical issues, suggestions, and verdict",
    prompt:
      "Perform a comprehensive senior-level code review on these changes. Structure your response into:\n1. 📝 Summary of Changes\n2. ⚠️ Critical & High Priority Issues (Bugs, Security, Performance)\n3. 💡 Suggestions & Improvements (Readability, Maintainability)\n4. 🧪 Testing Recommendations\n5. ✅ Verdict (Approve, Request Changes, or Comment)",
  },
  {
    id: "security",
    label: "Security Check",
    icon: "ShieldAlert",
    description: "Audit for OWASP Top 10 vulnerabilities, injection, and auth bypasses",
    prompt:
      "Perform a thorough security vulnerability audit on these code changes. Check for OWASP Top 10 vulnerabilities, injection flaws, sensitive data exposure, authentication/authorization bypasses, unsafe deserialization, or logic flaws.",
  },
  {
    id: "tests",
    label: "Suggest Tests",
    icon: "TestTube",
    description: "Generate unit tests and boundary test cases",
    prompt:
      "Analyze these code changes and write comprehensive automated test cases covering edge cases, happy paths, error scenarios, and boundary conditions.",
  },
  {
    id: "explain",
    label: "Explain Changes",
    icon: "Lightbulb",
    description: "Provide a plain-English architectural overview",
    prompt:
      "Provide a clear, high-level architectural walkthrough of these code changes. Explain what problem is being solved, how the solution works, and any trade-offs made.",
  },
  {
    id: "performance",
    label: "Performance Check",
    icon: "Zap",
    description: "Check for algorithmic bottlenecks, N+1 queries, and memory leaks",
    prompt:
      "Analyze these code changes specifically for performance bottlenecks, algorithmic complexity (Big-O), memory leaks, unnecessary allocations, concurrency race conditions, or unoptimized database queries.",
  },
] as const;

// Integration Status Labels & Colors
export const STATUS_MAP = {
  connected: {
    label: "Connected",
    variant: "success" as const,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  not_configured: {
    label: "Not Configured",
    variant: "secondary" as const,
    color: "text-muted-foreground bg-secondary border-border",
  },
  error: {
    label: "Error",
    variant: "destructive" as const,
    color: "text-destructive bg-destructive/10 border-destructive/20",
  },
};
