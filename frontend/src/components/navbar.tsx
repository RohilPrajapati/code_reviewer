"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, GitPullRequest, Settings, FolderGit2, Moon, Sun, ShieldCheck, AlertTriangle, HelpCircle } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { Integration } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getIntegrations();
        setIntegrations(data);
      } catch {
        // ignore
      }
    };
    fetchStatus();
  }, [pathname]);

  const navLinks = [
    { name: "Overview", href: "/", icon: Bot },
    { name: "Repositories", href: "/repos", icon: FolderGit2 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const getProviderStatus = (p: string) => {
    const found = integrations.find((i) => i.provider === p);
    return found?.status || "not_configured";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between px-4 sm:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-foreground transition hover:opacity-90">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
              <Bot className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
              ReviewerAI
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side status indicators & Theme toggle */}
        <div className="flex items-center gap-3">
          {/* Integration Status Badges */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            {["gemini", "github", "gitlab"].map((p) => {
              const status = getProviderStatus(p);
              const isConnected = status === "connected";
              const isInvalid = status === "invalid";

              return (
                <Link
                  key={p}
                  href="/settings"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition hover:opacity-80",
                    isConnected && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    isInvalid && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    !isConnected && !isInvalid && "border-muted bg-secondary text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isConnected && "bg-emerald-500",
                      isInvalid && "bg-amber-500",
                      !isConnected && !isInvalid && "bg-muted-foreground"
                    )}
                  />
                  <span className="capitalize">{p}</span>
                </Link>
              );
            })}
          </div>

          {/* Theme switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
