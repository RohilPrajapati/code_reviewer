import { Integration, Repository, PullRequest, PRDiffResponse, ChatMessage } from "./types";
import { API_BASE_URL } from "./constants";

const API_BASE = API_BASE_URL.endsWith("/api") ? API_BASE_URL : `${API_BASE_URL}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Integrations
  async getIntegrations(): Promise<Integration[]> {
    return request<Integration[]>("/integrations");
  },

  async saveIntegration(provider: string, token: string, baseUrl?: string): Promise<{ integration: Integration; valid: boolean; warning?: string }> {
    return request(`/integrations/${provider}`, {
      method: "POST",
      body: JSON.stringify({ token, base_url: baseUrl }),
    });
  },

  async testIntegration(provider: string): Promise<{ success: boolean; status: string; message?: string; error?: string }> {
    return request(`/integrations/${provider}/test`, {
      method: "POST",
    });
  },

  async deleteIntegration(provider: string): Promise<{ message: string }> {
    return request(`/integrations/${provider}`, {
      method: "DELETE",
    });
  },

  async getGeminiModels(): Promise<string[]> {
    return request<string[]>("/integrations/gemini/models");
  },

  // Repositories
  async getRepos(provider?: string): Promise<Repository[]> {
    const query = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    return request<Repository[]>(`/repos${query}`);
  },

  async addManualRepo(data: { provider: string; url?: string; owner?: string; name?: string }): Promise<Repository> {
    return request<Repository>("/repos/manual", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Pull Requests & Diffs
  async getPullRequests(provider: string, owner: string, repo: string, state = "open"): Promise<PullRequest[]> {
    return request<PullRequest[]>(`/repos/${provider}/${owner}/${repo}/prs?state=${state}`);
  },

  async getPullRequestDiff(provider: string, owner: string, repo: string, number: number): Promise<PRDiffResponse> {
    return request<PRDiffResponse>(`/repos/${provider}/${owner}/${repo}/prs/${number}/diff`);
  },

  // Chat
  async getChatHistory(provider: string, owner: string, repo: string, number: number): Promise<ChatMessage[]> {
    return request<ChatMessage[]>(`/repos/${provider}/${owner}/${repo}/prs/${number}/chat`);
  },

  async clearChatHistory(provider: string, owner: string, repo: string, number: number): Promise<{ message: string }> {
    return request(`/repos/${provider}/${owner}/${repo}/prs/${number}/chat`, {
      method: "DELETE",
    });
  },

  // Comment posting
  async postComment(provider: string, owner: string, repo: string, number: number, body: string): Promise<{ message: string }> {
    return request(`/repos/${provider}/${owner}/${repo}/prs/${number}/comment`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  // SSE Chat Streaming
  async streamChat(
    provider: string,
    owner: string,
    repo: string,
    number: number,
    prompt: string,
    diffContext: string | undefined,
    model: string | undefined,
    onChunk: (text: string) => void,
    onError: (err: string) => void,
    onDone: () => void,
    timeoutMs: number = 60000,
    externalSignal?: AbortSignal
  ) {
    const internalController = new AbortController();
    let timeoutTimer: NodeJS.Timeout | null = null;

    const resetTimeout = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(() => {
        internalController.abort("timeout");
      }, timeoutMs);
    };

    resetTimeout();

    // Listen to external user cancellation
    if (externalSignal) {
      if (externalSignal.aborted) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        onDone();
        return;
      }
      externalSignal.addEventListener("abort", () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        internalController.abort("user_cancelled");
      });
    }

    try {
      const response = await fetch(`${API_BASE}/repos/${provider}/${owner}/${repo}/prs/${number}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, diff_context: diffContext, model }),
        signal: internalController.signal,
      });

      if (!response.ok) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        let errText = `HTTP ${response.status}`;
        try {
          const errObj = await response.json();
          if (errObj.error) errText = errObj.error;
        } catch {
          // ignore
        }
        onError(errText);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        onError("Stream reading not supported");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let doneCalled = false;

      const safeDone = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (!doneCalled) {
          doneCalled = true;
          onDone();
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Reset inactivity timeout when new chunk arrives
        resetTimeout();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.substring(5).trim();
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                onChunk(parsed.text);
              }
              if (parsed.error) {
                if (timeoutTimer) clearTimeout(timeoutTimer);
                onError(parsed.error);
                return;
              }
              if (parsed.done) {
                safeDone();
                return;
              }
            } catch {
              // Non-JSON SSE line, ignore
            }
          }
        }
      }

      safeDone();
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (externalSignal?.aborted || internalController.signal.reason === "user_cancelled") {
        // User explicitly paused / canceled the stream
        onDone();
      } else if (err.name === "AbortError" || internalController.signal.aborted) {
        onError("Request timed out after 60 seconds. Gemini took too long to respond. Please try again.");
      } else {
        onError(err.message || "Failed to stream chat response");
      }
    }
  },
};
