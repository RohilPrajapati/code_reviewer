"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { PRDiffResponse, FileDiff, PullRequest } from "@/lib/types";
import { FileTree } from "@/components/diff-viewer/file-tree";
import { DiffFile } from "@/components/diff-viewer/diff-file";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  GitPullRequest,
  ExternalLink,
  GitBranch,
  FileCode,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Columns,
  Rows,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PRReviewPage() {
  const params = useParams();
  const provider = (params?.provider as string) || "";
  const rawOwner = (params?.owner as string) || "";
  const rawRepo = (params?.repo as string) || "";
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const pullNumberStr = (params?.pullNumber as string) || "0";
  const pullNumber = parseInt(pullNumberStr, 10);

  const [diffData, setDiffData] = useState<PRDiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const [showFileTree, setShowFileTree] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [referencedLine, setReferencedLine] = useState<string | null>(null);

  const { error } = useToast();

  const loadDiff = async () => {
    setLoading(true);
    try {
      const data = await api.getPullRequestDiff(provider, owner, repo, pullNumber);
      setDiffData(data);
      if (data.files && data.files.length > 0) {
        setSelectedFile(data.files[0].filename);
      }
    } catch (err: any) {
      error(err.message || "Failed to load PR diff", "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provider && owner && repo && pullNumber) {
      loadDiff();
    }
  }, [provider, owner, repo, pullNumber]);

  const handleSelectFile = (filename: string) => {
    setSelectedFile(filename);
    const elementId = `file-${filename.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Fetching diff and pull request metadata...</span>
        </div>
      </div>
    );
  }

  if (!diffData || !diffData.pull_request) {
    return (
      <div className="container py-12 text-center space-y-4 max-w-md">
        <h2 className="text-lg font-bold text-foreground">Failed to load Pull Request</h2>
        <p className="text-xs text-muted-foreground">Could not fetch PR details or diff files. Verify your token permissions.</p>
        <Link href={`/repos/${provider}/${owner}/${repo}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to PRs</span>
          </Button>
        </Link>
      </div>
    );
  }

  const { pull_request: pr, files, total_additions, total_deletions } = diffData;

  return (
    <div className="flex-1 min-h-0 h-full max-h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
      <div className="border-b bg-card/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/repos/${provider}/${owner}/${repo}`}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title="Back to PR List"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">#{pr.number}</span>
              <h2 className="font-semibold text-sm text-foreground truncate">{pr.title}</h2>
              <Badge variant="outline" className="capitalize text-[10px] hidden sm:inline-flex">
                {pr.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono truncate">{owner}/{repo}</span>
              <span>•</span>
              <span className="font-medium text-foreground">{pr.author}</span>
              <span>•</span>
              <span className="font-mono hidden md:inline">
                {pr.source_branch} → {pr.target_branch}
              </span>
            </div>
          </div>
        </div>

        {/* Diff Metrics & Actions */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 font-mono text-[11px] bg-secondary/80 px-2.5 py-1 rounded-md border">
            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{files.length} files</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{total_additions}</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">-{total_deletions}</span>
          </div>

          {/* Global View Mode Switcher */}
          <div className="hidden sm:flex items-center border rounded bg-background p-0.5 shadow-xs">
            <button
              onClick={() => setViewMode("unified")}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition cursor-pointer flex items-center gap-1.5",
                viewMode === "unified" ? "bg-muted text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Switch all diffs to Unified View"
            >
              <Rows className="h-3.5 w-3.5" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition cursor-pointer flex items-center gap-1.5",
                viewMode === "split" ? "bg-muted text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Switch all diffs to Side-by-Side Split View"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Split</span>
            </button>
          </div>

          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-xs font-medium px-2 py-1 rounded hover:bg-muted"
          >
            <span>View on {provider === "gitlab" ? "GitLab" : "GitHub"}</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFileTree(!showFileTree)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {showFileTree ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Split Review Body (Locked full height, 3 independently scrollable columns) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Side: File Tree sidebar */}
        {showFileTree && (
          <div className="w-64 border-r hidden md:flex flex-col shrink-0 h-full overflow-hidden p-2 bg-card/40">
            <FileTree
              files={files}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
            />
          </div>
        )}

        {/* Middle Column: Diff Files Container */}
        <div className="flex-1 h-full overflow-y-auto p-4 space-y-4 bg-muted/10 border-r min-h-0">
          {files.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No changed files found in this pull request.
            </div>
          ) : (
            files.map((file) => (
              <DiffFile
                key={file.filename}
                file={file}
                initialViewMode={viewMode}
              />
            ))
          )}
        </div>

        {/* Right Column: AI Chat Panel (Locked sticky column, full height) */}
        <div className="w-full md:w-[480px] lg:w-[540px] xl:w-[580px] shrink-0 h-full p-2.5 bg-background flex flex-col min-h-0 overflow-hidden">
          <ChatPanel
            provider={provider}
            owner={owner}
            repo={repo}
            pr={pr}
            files={files}
            referencedLine={referencedLine}
            onClearReference={() => setReferencedLine(null)}
          />
        </div>
      </div>
    </div>
  );
}
