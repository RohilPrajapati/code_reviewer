"use client";

import React from "react";
import { ShieldAlert, Sparkles, TestTube2, FileText, Zap, HelpCircle } from "lucide-react";
import { Button } from "../ui/button";

interface QuickActionsProps {
  onSelectAction: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onSelectAction, disabled }: QuickActionsProps) {
  const actions = [
    {
      label: "Full Review",
      icon: Sparkles,
      color: "text-amber-500",
      prompt: "Please provide a comprehensive senior code review for this pull request. Structure your response into: 1) Summary of changes, 2) Critical & High priority issues, 3) Suggestions & Improvements, 4) Testing recommendations, and 5) Final verdict.",
    },
    {
      label: "Security Check",
      icon: ShieldAlert,
      color: "text-rose-500",
      prompt: "Perform a thorough security vulnerability audit on these code changes. Check for OWASP top 10 vulnerabilities, injection flaws, sensitive data exposure, authentication/authorization bypasses, unsafe deserialization, or logic flaws.",
    },
    {
      label: "Suggest Tests",
      icon: TestTube2,
      color: "text-emerald-500",
      prompt: "Analyze the changes in this PR and provide detailed test cases (including unit tests, edge cases, negative tests, and boundary conditions) to ensure high test coverage and prevent regressions.",
    },
    {
      label: "Summarize Changes",
      icon: FileText,
      color: "text-blue-500",
      prompt: "Summarize the architectural and logical changes introduced in this PR in a clear bullet-point format for the changelog / release notes.",
    },
    {
      label: "Performance Check",
      icon: Zap,
      color: "text-purple-500",
      prompt: "Inspect the diff for any potential performance bottlenecks, memory leaks, algorithmic complexity issues (e.g. O(N^2) loops or N+1 queries), or concurrency race conditions.",
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <Button
            key={act.label}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onSelectAction(act.prompt)}
            className="h-7 text-xs gap-1.5 shrink-0 bg-background/80 hover:bg-secondary border-border/80"
          >
            <Icon className={`h-3.5 w-3.5 ${act.color}`} />
            <span>{act.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
