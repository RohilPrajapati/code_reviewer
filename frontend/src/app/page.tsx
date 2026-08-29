"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Integration } from "@/lib/types";
import {
  Bot,
  GitPullRequest,
  KeyRound,
  ShieldCheck,
  Zap,
  ArrowRight,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.getIntegrations();
        setIntegrations(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getStatus = (p: string) => {
    return integrations.find((i) => i.provider === p)?.status || "not_configured";
  };

  const geminiStatus = getStatus("gemini");
  const githubStatus = getStatus("github");
  const gitlabStatus = getStatus("gitlab");

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto">
      <div className="container py-8 px-4 sm:px-8 space-y-8 max-w-6xl">
        {/* Hero section */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-primary/10 via-card to-card p-8 sm:p-12 shadow-sm">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Powered by Google Gemini</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              AI-Powered Senior Code Reviews for GitHub & GitLab
            </h1>

            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Inspect pull request diffs, chat with an AI reviewer in real-time, catch security vulnerabilities and performance bottlenecks, and post reviews straight to your Git provider.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/repos">
                <Button size="lg" className="gap-2 shadow-sm font-semibold">
                  <FolderGit2 className="h-4 w-4" />
                  <span>Browse Repositories</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" size="lg" className="gap-2">
                  <KeyRound className="h-4 w-4" />
                  <span>Configure Integrations</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Integration Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Gemini Card */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Sparkles className="h-5 w-5" />
                </div>
                <StatusBadge status={geminiStatus} />
              </div>
              <CardTitle className="text-base mt-2">Google Gemini AI</CardTitle>
              <CardDescription className="text-xs">
                LLM reasoning engine for diff analysis and interactive chat review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs font-medium">
                  <span>{geminiStatus === "connected" ? "Manage API Key" : "Connect Gemini"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* GitHub Card */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-zinc-900/10 dark:bg-zinc-100/10 text-foreground flex items-center justify-center font-bold">
                  <GitPullRequest className="h-5 w-5" />
                </div>
                <StatusBadge status={githubStatus} />
              </div>
              <CardTitle className="text-base mt-2">GitHub</CardTitle>
              <CardDescription className="text-xs">
                Connect GitHub with a Personal Access Token to review PRs and post comments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs font-medium">
                  <span>{githubStatus === "connected" ? "Manage GitHub Token" : "Connect GitHub"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* GitLab Card */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <FolderGit2 className="h-5 w-5" />
                </div>
                <StatusBadge status={gitlabStatus} />
              </div>
              <CardTitle className="text-base mt-2">GitLab</CardTitle>
              <CardDescription className="text-xs">
                Connect GitLab (cloud or self-hosted) to inspect merge requests and diffs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs font-medium">
                  <span>{gitlabStatus === "connected" ? "Manage GitLab Token" : "Connect GitLab"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <Card className="border bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">How AI Code Reviewer Works</CardTitle>
            <CardDescription className="text-xs">
              Review any pull request with automated analysis in three simple steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-muted-foreground">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                <span>Connect & Add Keys</span>
              </div>
              <p>Add your Google Gemini API key and Git Personal Access Tokens. All secrets are encrypted at rest with AES-256-GCM.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                <span>Select Repository & PR</span>
              </div>
              <p>Browse your repositories automatically or paste any repository URL to view open pull requests and unified/split diffs.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
                <span>Chat & Post Review</span>
              </div>
              <p>Stream real-time AI answers, request full reviews or security audits, and post the summary to the PR.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        <span>Connected</span>
      </Badge>
    );
  }
  if (status === "invalid") {
    return (
      <Badge variant="warning" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        <span>Invalid Token</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <span>Not Configured</span>
    </Badge>
  );
}
