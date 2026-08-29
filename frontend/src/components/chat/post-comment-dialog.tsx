"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { api } from "@/lib/api";
import { useToast } from "../ui/toast";
import { Send, GitPullRequest } from "lucide-react";

interface PostCommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  owner: string;
  repo: string;
  prNumber: number;
  initialContent: string;
}

export function PostCommentDialog({
  open,
  onOpenChange,
  provider,
  owner,
  repo,
  prNumber,
  initialContent,
}: PostCommentDialogProps) {
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handlePost = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      await api.postComment(provider, owner, repo, prNumber, content);
      success("Review comment successfully posted to PR!", "Comment Posted");
      onOpenChange(false);
    } catch (err: any) {
      error(err.message || "Failed to post comment", "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2 text-primary mb-1">
          <GitPullRequest className="h-5 w-5" />
          <DialogTitle>Post Review to {provider === "gitlab" ? "Merge Request" : "Pull Request"}</DialogTitle>
        </div>
        <DialogDescription>
          Post the AI-generated review as a comment to <span className="font-mono font-medium text-foreground">{owner}/{repo}#{prNumber}</span>.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Comment Content (Markdown)
        </label>
        <textarea
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-md border border-input bg-card p-3 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Write your review markdown here..."
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handlePost} isLoading={loading} className="gap-2">
          <Send className="h-4 w-4" />
          <span>Post Comment</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
