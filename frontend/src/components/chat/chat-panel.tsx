"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, FileDiff, PullRequest } from "@/lib/types";
import { api } from "@/lib/api";
import { QuickActions } from "./quick-actions";
import { MarkdownViewer } from "./markdown-viewer";
import { PostCommentDialog } from "./post-comment-dialog";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import {
  Send,
  Bot,
  User,
  Trash2,
  MessageSquareShare,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  provider: string;
  owner: string;
  repo: string;
  pr: PullRequest;
  files: FileDiff[];
  referencedLine?: string | null;
  onClearReference?: () => void;
}

export function ChatPanel({
  provider,
  owner,
  repo,
  pr,
  files,
  referencedLine,
  onClearReference,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("gemini-3.6-flash");
  const [availableModels, setAvailableModels] = useState<string[]>([
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
  ]);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [postDialogContent, setPostDialogContent] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);

  const isSendingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { error: toastError, success: toastSuccess } = useToast();

  // Load chat history & available models on mount
  useEffect(() => {
    loadHistory();
    loadModels();
  }, [provider, owner, repo, pr.number]);

  const loadModels = async () => {
    try {
      const models = await api.getGeminiModels();
      if (models && models.length > 0) {
        setAvailableModels(models);
        if (!models.includes(model)) {
          const preferred = models.find((m) => m.includes("3.6-flash") || m.includes("flash")) || models[0];
          setModel(preferred);
        }
      }
    } catch {
      // ignore
    }
  };

  // When referencedLine changes from the diff viewer, append to input
  useEffect(() => {
    if (referencedLine) {
      setInput((prev) => (prev ? `${prev} ${referencedLine} ` : `${referencedLine} `));
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      if (onClearReference) onClearReference();
    }
  }, [referencedLine]);

  // Contained auto scroll inside messages container only
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await api.getChatHistory(provider, owner, repo, pr.number);
      if (history && history.length > 0) {
        // Keep the latest turn (or last user + assistant pair)
        const lastAssistantIdx = history.map((m) => m.role).lastIndexOf("assistant");
        if (lastAssistantIdx >= 0) {
          const lastUserIdx = history.slice(0, lastAssistantIdx).map((m) => m.role).lastIndexOf("user");
          const recent = lastUserIdx >= 0 ? history.slice(lastUserIdx) : history.slice(lastAssistantIdx);
          setMessages(recent.map((m) => ({ ...m, status: "completed" })));
        } else {
          setMessages(history.slice(-2).map((m) => ({ ...m, status: "completed" })));
        }
      } else {
        setMessages([]);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.clearChatHistory(provider, owner, repo, pr.number);
      setMessages([]);
      setLoading(false);
      isSendingRef.current = false;
      toastSuccess("Chat cleared");
    } catch (err: any) {
      toastError(err.message || "Failed to clear chat");
    }
  };

  const buildDiffContext = () => {
    let ctx = `Pull Request: ${pr.title} (#${pr.number})\nAuthor: ${pr.author}\nBranch: ${pr.source_branch} -> ${pr.target_branch}\n\n`;
    ctx += `Changed Files (${files.length}):\n`;
    for (const f of files) {
      ctx += `--- File: ${f.filename} (${f.status}, +${f.additions}/-${f.deletions}) ---\n`;
      if (f.patch) {
        ctx += f.patch + "\n\n";
      }
    }
    return ctx;
  };

  const handleCancelResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSend = async (promptToSend?: string) => {
    if (isSendingRef.current) return;
    const text = (promptToSend || input).trim();
    if (!text) return;

    isSendingRef.current = true;
    setLoading(true);
    setInput("");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const timestamp = new Date().toISOString();
    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: text,
      created_at: timestamp,
      status: "completed",
    };

    const initialAssistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      created_at: timestamp,
      status: "thinking",
    };

    // Keep active review focused to the current prompt & response turn
    setMessages([userMsg, initialAssistantMsg]);

    const diffContext = buildDiffContext();

    // Typewriter Queue Management for smooth animated streaming
    let fullTargetText = "";
    let currentRenderedLength = 0;
    let isStreamDone = false;
    let typingTimer: NodeJS.Timeout | null = null;
    const minThinkingUntil = Date.now() + 650; // Visible thinking stage guarantee

    // Handle instant cancel event
    abortController.signal.addEventListener("abort", () => {
      if (typingTimer) clearTimeout(typingTimer);
      const finalText = fullTargetText.trim()
        ? `${fullTargetText.trim()}\n\n*(Response stopped by user)*`
        : "*(Review cancelled by user)*";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: finalText, status: "completed" }
            : msg
        )
      );
      setLoading(false);
      isSendingRef.current = false;
      toastSuccess("Response generation stopped");
    });

    const processTypewriter = () => {
      if (abortController.signal.aborted) return;

      if (Date.now() < minThinkingUntil && fullTargetText.length > 0) {
        typingTimer = setTimeout(processTypewriter, 30);
        return;
      }

      if (currentRenderedLength < fullTargetText.length) {
        const remaining = fullTargetText.length - currentRenderedLength;
        const step = remaining > 120 ? 10 : remaining > 40 ? 5 : 2;
        currentRenderedLength = Math.min(fullTargetText.length, currentRenderedLength + step);
        const nextSlice = fullTargetText.slice(0, currentRenderedLength);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: nextSlice, status: "streaming" }
              : msg
          )
        );

        typingTimer = setTimeout(processTypewriter, 16);
      } else if (isStreamDone) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullTargetText.trim(), status: "completed" }
              : msg
          )
        );
        setLoading(false);
        isSendingRef.current = false;
      } else {
        typingTimer = setTimeout(processTypewriter, 30);
      }
    };

    typingTimer = setTimeout(processTypewriter, 30);

    await api.streamChat(
      provider,
      owner,
      repo,
      pr.number,
      text,
      diffContext,
      model,
      (chunk) => {
        if (!abortController.signal.aborted) {
          fullTargetText += chunk;
        }
      },
      (err) => {
        if (abortController.signal.aborted) return;
        if (typingTimer) clearTimeout(typingTimer);
        toastError(err, "Gemini Chat Error");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                ...msg,
                content: fullTargetText.trim() || `⚠️ Error: ${err}`,
                status: "error",
              }
              : msg
          )
        );
        setLoading(false);
        isSendingRef.current = false;
      },
      () => {
        if (!abortController.signal.aborted) {
          isStreamDone = true;
        }
      },
      60000,
      abortController.signal
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openPostDialog = (content: string) => {
    setPostDialogContent(content);
    setPostDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-card/70 border rounded-xl overflow-hidden shadow-sm">
      {/* Chat header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-card border-b">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-semibold text-xs text-foreground">AI Code Reviewer</span>
            <span className="text-[11px] text-muted-foreground block font-mono">{model}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer max-w-[160px] truncate"
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Clear history */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            disabled={loading}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
            title="Clear Chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages view (Independently scrollable) */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs scroll-smooth">
        {historyLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading reviewer...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 px-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Bot className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="font-semibold text-sm text-foreground">Ready to review this PR</h4>
              <p className="text-xs text-muted-foreground">
                Click any quick action prompt below or ask any question to start.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const isThinking = msg.status === "thinking";
            const isStreaming = msg.status === "streaming";

            return (
              <div
                key={msg.id || `${msg.role}-${idx}-${msg.created_at}`}
                className={cn(
                  "flex gap-3 max-w-[98%]",
                  isUser ? "ml-auto flex-row-reverse" : "mr-auto w-full"
                )}
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-0.5",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary border border-border text-foreground"
                  )}
                >
                  {isUser ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className={cn("h-4 w-4 text-primary", (isThinking || isStreaming) && "animate-pulse")} />
                  )}
                </div>

                <div
                  className={cn(
                    "flex-1 p-3.5 rounded-xl text-xs space-y-2 border",
                    isUser
                      ? "bg-primary text-primary-foreground border-transparent"
                      : isThinking
                        ? "bg-card text-foreground border-primary/30 shadow-md animate-in fade-in-50 duration-200"
                        : "bg-card text-foreground border-border/80 shadow-sm"
                  )}
                >
                  {isUser ? (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary-foreground/80 mb-1">
                        <User className="h-3 w-3" />
                        <span>You</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  ) : isThinking ? (
                    /* Instant Thinking UI */
                    <div className="space-y-3 p-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                          </span>
                          <span className="font-semibold text-xs text-foreground animate-pulse">
                            Thinking & analyzing code diff...
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelResponse}
                          className="h-6 text-[11px] text-destructive hover:bg-destructive/10 gap-1 px-2 cursor-pointer font-medium"
                        >
                          <Square className="h-2.5 w-2.5 fill-current" />
                          <span>Stop</span>
                        </Button>
                      </div>

                      <div className="space-y-2 pl-1 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Scanning changed files & diff hunks</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          <span>Evaluating bugs, security, and edge cases</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                          <span>Synthesizing senior code review feedback</span>
                        </div>
                      </div>

                      <div className="h-1.5 w-full bg-secondary/80 overflow-hidden rounded-full mt-2">
                        <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full w-full animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between border-b border-border/40 pb-1.5 mb-1.5 text-[11px] font-semibold text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>Gemini AI Reviewer</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{model}</span>
                          {isStreaming && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelResponse}
                              className="h-5 text-[10px] text-destructive hover:bg-destructive/10 gap-1 px-1.5 cursor-pointer font-medium"
                            >
                              <Square className="h-2 w-2 fill-current" />
                              <span>Stop</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {msg.status === "error" ? (
                        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2.5 my-1">
                          <div className="flex items-start gap-2 text-destructive font-medium">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="font-semibold block text-xs">Request Failed or Timed Out</span>
                              <span className="text-[11px] text-destructive/90 block mt-0.5">{msg.content}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-destructive/20">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={loading}
                              onClick={() => {
                                const lastUserMsg = messages.find((m) => m.role === "user")?.content;
                                if (lastUserMsg) handleSend(lastUserMsg);
                              }}
                              className="h-6 text-[11px] gap-1 px-2.5 bg-background hover:bg-secondary border-destructive/30 text-destructive hover:text-foreground cursor-pointer"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>Retry Request</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const lastUserMsg = messages.find((m) => m.role === "user")?.content;
                                if (lastUserMsg) {
                                  setInput(lastUserMsg);
                                  textareaRef.current?.focus();
                                }
                              }}
                              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Edit Prompt
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <MarkdownViewer content={msg.content} />
                          {isStreaming && (
                            <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
                          )}
                        </div>
                      )}
                      {isStreaming && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                          <div className="flex items-center gap-2 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                            <span>Gemini is generating response...</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelResponse}
                            className="h-5 text-[10px] text-destructive hover:bg-destructive/10 gap-1 px-1.5 cursor-pointer font-medium"
                          >
                            <Square className="h-2 w-2 fill-current" />
                            <span>Stop</span>
                          </Button>
                        </div>
                      )}
                      {!isStreaming && msg.status !== "error" && (
                        <div className="pt-2 flex items-center justify-between border-t border-border/40 text-[11px] text-muted-foreground">
                          <span>AI Reviewer</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPostDialog(msg.content)}
                            className="h-6 text-[11px] gap-1 px-2 hover:text-primary cursor-pointer"
                          >
                            <MessageSquareShare className="h-3 w-3" />
                            <span>Post as Comment</span>
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Action prompts bar */}
      <div className="shrink-0 px-3 pt-2 pb-1 border-t bg-card/40">
        <QuickActions onSelectAction={(prompt) => handleSend(prompt)} disabled={loading} />
      </div>

      {/* Input container */}
      <div className="shrink-0 p-3 bg-card border-t">
        <div className="relative flex items-end gap-2 rounded-lg border border-input bg-background p-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={
              loading
                ? "AI is analyzing and typing response..."
                : "Ask about these changes (e.g. 'Are there edge cases in @file.go:L10?')..."
            }
            className="flex-1 resize-none bg-transparent p-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
          />
          {loading ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancelResponse}
              className="h-8 px-3 gap-1.5 shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer animate-in fade-in-50"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop</span>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!input.trim()}
              onClick={() => handleSend()}
              className="h-8 px-3 gap-1.5 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          )}
        </div>
      </div>

      {/* Post comment dialog */}
      <PostCommentDialog
        open={postDialogOpen}
        onOpenChange={setPostDialogOpen}
        provider={provider}
        owner={owner}
        repo={repo}
        prNumber={pr.number}
        initialContent={postDialogContent}
      />
    </div>
  );
}
