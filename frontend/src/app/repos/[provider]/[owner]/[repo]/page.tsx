"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { PullRequest } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  GitPullRequest,
  Search,
  ArrowLeft,
  ArrowRight,
  GitMerge,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

export default function RepoPullRequestsPage() {
  const params = useParams();
  const provider = params.provider as string;
  const rawOwner = (params.owner as string) || "";
  const rawRepo = (params.repo as string) || "";
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);

  const [prs, setPRs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [search, setSearch] = useState("");

  const { error } = useToast();

  const loadPRs = async () => {
    setLoading(true);
    try {
      const data = await api.getPullRequests(provider, owner, repo, statusFilter);
      setPRs(data || []);
    } catch (err: any) {
      error(err.message || "Failed to load pull requests", "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provider && owner && repo) {
      loadPRs();
    }
  }, [provider, owner, repo, statusFilter]);

  const filteredPRs = prs.filter((p) => {
    const query = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(query) ||
      p.author.toLowerCase().includes(query) ||
      p.number.toString().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="success">Open</Badge>;
      case "merged":
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            Merged
          </Badge>
        );
      case "closed":
        return <Badge variant="destructive">Closed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto">
      <div className="container py-8 px-4 sm:px-8 space-y-6 max-w-6xl">
        {/* Header with breadcrumbs */}
        <div className="space-y-2">
          <Link
            href="/repos"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Repositories</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight font-mono text-foreground">
                    {owner}/{repo}
                  </h1>
                  <Badge variant="outline" className="capitalize text-[11px]">
                    {provider}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Select a pull/merge request to review code changes</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadPRs} disabled={loading} className="h-8 gap-1.5 text-xs">
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </div >

        {/* Filters and search */}
        < div className="flex flex-col sm:flex-row items-center justify-between gap-3" >
          {/* Status Filter */}
          < div className="flex items-center p-1 rounded-lg bg-secondary/80 border text-xs w-full sm:w-auto" >
            {
              [
                { id: "open", label: "Open PRs" },
                { id: "closed", label: "Closed PRs" },
                { id: "all", label: "All PRs" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-colors flex-1 sm:flex-initial text-center cursor-pointer",
                    statusFilter === tab.id
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))
            }
          </div >

          {/* Search */}
          < div className="relative w-full sm:w-72" >
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div >
        </div >

        {/* PRs List */}
        {
          loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl border bg-card/60 animate-pulse p-4" />
              ))}
            </div>
          ) : filteredPRs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl bg-card space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-foreground">No pull requests found</h3>
                <p className="text-xs text-muted-foreground">
                  There are no {statusFilter !== "all" ? statusFilter : ""} pull requests matching your search.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPRs.map((pr) => (
                <Card
                  key={`${pr.provider}-${pr.number}`}
                  className="hover:border-primary/50 transition-colors shadow-sm"
                >
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">#{pr.number}</span>
                        <h3 className="font-semibold text-sm text-foreground truncate">{pr.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          {pr.author_avatar ? (
                            <img
                              src={pr.author_avatar}
                              alt={pr.author}
                              className="h-4 w-4 rounded-full"
                            />
                          ) : null}
                          <span className="font-medium text-foreground">{pr.author}</span>
                        </div>

                        <span>•</span>

                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <GitBranch className="h-3 w-3" />
                          <span>
                            {pr.source_branch} <span className="text-muted-foreground">→</span> {pr.target_branch}
                          </span>
                        </div>

                        <span>•</span>

                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock className="h-3 w-3" />
                          <span>{formatRelativeTime(pr.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-muted-foreground hover:text-foreground transition rounded-md hover:bg-muted"
                        title="View on Git provider"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>

                      <Link href={`/repos/${provider}/${owner}/${repo}/pulls/${pr.number}`}>
                        <Button size="sm" className="gap-2 text-xs shadow-sm">
                          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                          <span>Review with AI</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
