export type ProviderType = "github" | "gitlab" | "gemini";

export interface Integration {
  id?: number;
  provider: ProviderType;
  base_url?: string;
  status: "connected" | "invalid" | "expired" | "not_configured";
  masked_token?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Repository {
  id: number;
  provider: "github" | "gitlab";
  external_id: string;
  owner: string;
  name: string;
  full_name: string;
  description?: string;
  url: string;
  default_branch: string;
  is_private: boolean;
  created_at: string;
}

export interface PullRequest {
  id: number;
  provider: "github" | "gitlab";
  owner: string;
  repo: string;
  number: number;
  title: string;
  description: string;
  author: string;
  author_avatar?: string;
  source_branch: string;
  target_branch: string;
  state: "open" | "closed" | "merged";
  status?: string;
  url: string;
  additions: number;
  deletions: number;
  changed_files_count?: number;
  updated_at: string;
  created_at: string;
}

export interface FileDiff {
  filename: string;
  old_filename?: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  raw_url?: string;
}

export interface PRDiffResponse {
  pull_request: PullRequest;
  files: FileDiff[];
  total_files: number;
  total_additions: number;
  total_deletions: number;
}

export interface ChatMessage {
  id?: number | string;
  provider?: string;
  owner?: string;
  repo?: string;
  pr_number?: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  status?: "thinking" | "streaming" | "completed" | "error";
}
