"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Repository } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  FolderGit2,
  GitPullRequest,
  Search,
  Plus,
  Lock,
  Globe,
  ExternalLink,
  GitBranch,
  RefreshCw,
  ArrowRight,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<"all" | "github" | "gitlab">("all");
  const [search, setSearch] = useState("");

  // Manual Add Modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualProvider, setManualProvider] = useState("github");
  const [manualUrl, setManualUrl] = useState("");
  const [manualOwner, setManualOwner] = useState("");
  const [manualName, setManualName] = useState("");
  const [addingManual, setAddingManual] = useState(false);

  const { success, error } = useToast();

  const loadRepos = async () => {
    setLoading(true);
    try {
      const providerParam = selectedProvider === "all" ? undefined : selectedProvider;
      const data = await api.getRepos(providerParam);
      setRepos(data || []);
    } catch (err: any) {
      error(err.message || "Failed to load repositories", "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, [selectedProvider]);

  const handleAddManual = async () => {
    if (!manualUrl && (!manualOwner || !manualName)) {
      error("Please enter either a repository URL or Owner & Name", "Validation Error");
      return;
    }

    setAddingManual(true);
    try {
      await api.addManualRepo({
        provider: manualProvider,
        url: manualUrl.trim() || undefined,
        owner: manualOwner.trim() || undefined,
        name: manualName.trim() || undefined,
      });

      success("Repository added successfully", "Saved");
      setManualOpen(false);
      setManualUrl("");
      setManualOwner("");
      setManualName("");
      loadRepos();
    } catch (err: any) {
      error(err.message || "Failed to add repository", "Error");
    } finally {
      setAddingManual(false);
    }
  };

  const filteredRepos = repos.filter((r) => {
    const query = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(query) ||
      r.owner.toLowerCase().includes(query) ||
      r.full_name.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto">
      <div className="container py-8 px-4 sm:px-8 space-y-6 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Repositories</h1>
            <p className="text-xs text-muted-foreground">
              Browse repositories from your connected GitHub & GitLab accounts or add by URL
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadRepos} disabled={loading} className="h-8 gap-1.5 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            <Button size="sm" onClick={() => setManualOpen(true)} className="h-8 gap-1.5 text-xs shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Repository</span>
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Provider Tabs */}
          <div className="flex items-center p-1 rounded-lg bg-secondary/80 border text-xs w-full sm:w-auto">
            {[
              { id: "all", label: "All Providers" },
              { id: "github", label: "GitHub" },
              { id: "gitlab", label: "GitLab" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedProvider(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium transition-colors flex-1 sm:flex-initial text-center cursor-pointer",
                  selectedProvider === tab.id
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Repositories Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-36 rounded-xl border bg-card/60 animate-pulse p-4" />
            ))}
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-16 border rounded-2xl bg-card/40 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <FolderGit2 className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-semibold text-foreground">No repositories found</h3>
              <p className="text-xs text-muted-foreground">
                {repos.length === 0
                  ? "Configure your personal access tokens in Settings or manually add a repository by URL."
                  : "No repositories matched your search filter."}
              </p>
            </div>
            {repos.length === 0 ? (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <Settings className="h-3.5 w-3.5" />
                    <span>Go to Settings</span>
                  </Button>
                </Link>
                <Button size="sm" onClick={() => setManualOpen(true)} className="gap-2 text-xs shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add by URL</span>
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="text-xs">
                Clear Search Filter
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map((repo) => (
              <Card
                key={`${repo.provider}-${repo.id || repo.external_id}`}
                className="hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                      {repo.provider}
                    </Badge>
                    {repo.is_private ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Private Repository">
                        <Lock className="h-3 w-3" />
                        <span>Private</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Public Repository">
                        <Globe className="h-3 w-3" />
                        <span>Public</span>
                      </span>
                    )}
                  </div>

                  <CardTitle className="text-sm font-bold truncate group-hover:text-primary transition-colors mt-2">
                    {repo.name}
                  </CardTitle>
                  <CardDescription className="text-xs font-mono text-muted-foreground truncate">
                    {repo.owner}/{repo.name}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {repo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {repo.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span className="font-mono text-[11px]">{repo.default_branch || "main"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-muted-foreground hover:text-foreground transition rounded hover:bg-muted"
                        title="Open on Git provider"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>

                      <Link href={`/repos/${repo.provider}/${repo.owner}/${repo.name}`}>
                        <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <GitPullRequest className="h-3 w-3" />
                          <span>View PRs</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Manual Add Dialog */}
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogHeader>
            <DialogTitle>Add Repository</DialogTitle>
            <DialogDescription>
              Add any repository from GitHub or GitLab to review its pull requests and code changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Provider</label>
              <select
                value={manualProvider}
                onChange={(e) => setManualProvider(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Repository URL (Recommended)</label>
              <Input
                placeholder="https://github.com/facebook/react or https://gitlab.com/group/repo"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <span className="text-[11px] text-muted-foreground block">
                Owner and repository name will be parsed automatically from the URL.
              </span>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Or enter manually</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Owner / Organization</label>
                <Input
                  placeholder="facebook"
                  value={manualOwner}
                  onChange={(e) => setManualOwner(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Repo Name</label>
                <Input
                  placeholder="react"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddManual} isLoading={addingManual}>
              Add Repository
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </div>
  );
}
