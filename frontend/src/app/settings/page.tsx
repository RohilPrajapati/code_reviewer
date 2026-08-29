"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { Integration } from "@/lib/types";
import {
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  Bot,
  GitPullRequest,
  FolderGit2,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [geminiKey, setGeminiKey] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);

  const [githubToken, setGithubToken] = useState("");
  const [showGithub, setShowGithub] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);
  const [testingGithub, setTestingGithub] = useState(false);

  const [gitlabToken, setGitlabToken] = useState("");
  const [gitlabBaseUrl, setGitlabBaseUrl] = useState("");
  const [showGitlab, setShowGitlab] = useState(false);
  const [savingGitlab, setSavingGitlab] = useState(false);
  const [testingGitlab, setTestingGitlab] = useState(false);

  const { success, error, info } = useToast();

  const loadIntegrations = async () => {
    try {
      const data = await api.getIntegrations();
      setIntegrations(data);
      const gl = data.find((i) => i.provider === "gitlab");
      if (gl?.base_url) {
        setGitlabBaseUrl(gl.base_url);
      }
    } catch (err: any) {
      error(err.message || "Failed to load integrations", "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const getInteg = (p: string) => integrations.find((i) => i.provider === p);

  // Gemini actions
  const handleSaveGemini = async () => {
    if (!geminiKey.trim()) return;
    setSavingGemini(true);
    try {
      const res = await api.saveIntegration("gemini", geminiKey);
      if (res.valid) {
        success("Gemini API key verified and saved securely!", "Gemini Connected");
      } else {
        error(res.warning || "Key saved, but validation failed", "Validation Warning");
      }
      setGeminiKey("");
      loadIntegrations();
    } catch (err: any) {
      error(err.message || "Failed to save Gemini key", "Error");
    } finally {
      setSavingGemini(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    try {
      const res = await api.testIntegration("gemini");
      if (res.success) {
        success(res.message || "Gemini connection is working properly!", "Test Succeeded");
      } else {
        error(res.error || "Gemini test failed", "Test Failed");
      }
      loadIntegrations();
    } catch (err: any) {
      error(err.message || "Test failed", "Error");
    } finally {
      setTestingGemini(false);
    }
  };

  // GitHub actions
  const handleSaveGithub = async () => {
    if (!githubToken.trim()) return;
    setSavingGithub(true);
    try {
      const res = await api.saveIntegration("github", githubToken);
      if (res.valid) {
        success("GitHub Personal Access Token verified and saved!", "GitHub Connected");
      } else {
        error(res.warning || "Token saved, but validation failed", "Validation Warning");
      }
      setGithubToken("");
      loadIntegrations();
    } catch (err: any) {
      error(err.message || "Failed to save GitHub token", "Error");
    } finally {
      setSavingGithub(false);
    }
  };

  const handleTestGithub = async () => {
    setTestingGithub(true);
    try {
      const res = await api.testIntegration("github");
      if (res.success) {
        success(res.message || "GitHub authentication is valid!", "Test Succeeded");
      } else {
        error(res.error || "GitHub test failed", "Test Failed");
      }
      loadIntegrations();
    } catch (err: any) {
      error(err.message || "Test failed", "Error");
    } finally {
      setTestingGithub(false);
    }
  };

  // GitLab actions
  const handleSaveGitlab = async () => {
    if (!gitlabToken.trim()) return;
    setSavingGitlab(true);
    try {
      const res = await api.saveIntegration("gitlab", gitlabToken, gitlabBaseUrl);
      if (res.valid) {
        success("GitLab Personal Access Token verified and saved!", "GitLab Connected");
      } else {
        error(res.warning || "Token saved, but validation failed", "Validation Warning");
      }
      setGitlabToken("");
      loadIntegrations();
    } catch (err: any) {
      error(err.message || "Failed to save GitLab token", "Error");
    } finally {
      setSavingGitlab(false);
    }
  };

  const handleTestGitlab = async () => {
    setTestingGitlab(true);
    try {
      const res = await api.testIntegration("gitlab");
      if (res.success) {
        success(res.message || "GitLab authentication is valid!", "Test Succeeded");
      } else {
        error(res.error || "GitLab test failed", "Test Failed");
      }
      loadIntegrations();
    } catch (err: any) {
      error(err.message || "Test failed", "Error");
    } finally {
      setTestingGitlab(false);
    }
  };

  // Remove integration
  const handleDelete = async (provider: string) => {
    try {
      await api.deleteIntegration(provider);
      info(`${provider} integration removed`);
      loadIntegrations();
    } catch (err: any) {
      error(err.message || "Failed to remove integration");
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto">
      <div className="container py-8 px-4 sm:px-8 space-y-8 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Integrations</h1>
          <p className="text-xs text-muted-foreground">
            Configure your Google Gemini API key and Git access tokens. All secrets are encrypted at rest with AES-256-GCM.
          </p>
        </div>

        {/* Security notice */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 text-xs text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="space-y-0.5">
            <span className="font-semibold text-primary">Zero-exposure Secret Storage</span>
            <p className="text-muted-foreground">
              Keys and tokens are securely encrypted server-side using AES-256-GCM. Raw keys are never returned to the frontend or exposed in responses.
            </p>
          </div>
        </div >

        <div className="space-y-6">
          {/* 1. Google Gemini API Key */}
          {(() => {
            const integ = getInteg("gemini");
            const isConfigured = integ?.status === "connected" || integ?.status === "invalid";

            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Google Gemini API Key</CardTitle>
                        <CardDescription className="text-xs">Required for AI code reviews and streaming chat</CardDescription>
                      </div>
                    </div>
                    <IntegrationBadge status={integ?.status || "not_configured"} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {isConfigured && integ?.masked_token && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border font-mono">
                      <span className="text-muted-foreground">Current Key:</span>
                      <span className="font-semibold text-foreground">{integ.masked_token}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="font-medium text-foreground">
                      {isConfigured ? "Update Gemini API Key" : "Enter Gemini API Key"}
                    </label>
                    <div className="relative">
                      <Input
                        type={showGemini ? "text" : "password"}
                        placeholder="AIzaSy..."
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGemini(!showGemini)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <span>Don&apos;t have an API key?</span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Get one at Google AI Studio <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t p-4 bg-muted/20">
                  <div className="flex gap-2">
                    {isConfigured && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete("gemini")}
                        className="text-xs h-8 gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isConfigured && (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={testingGemini}
                        onClick={handleTestGemini}
                        className="text-xs h-8"
                      >
                        Test Connection
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={!geminiKey.trim()}
                      isLoading={savingGemini}
                      onClick={handleSaveGemini}
                      className="text-xs h-8"
                    >
                      Save Key
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })()}

          {/* 2. GitHub PAT */}
          {(() => {
            const integ = getInteg("github");
            const isConfigured = integ?.status === "connected" || integ?.status === "invalid";

            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-zinc-500/10 text-foreground flex items-center justify-center font-bold">
                        <GitPullRequest className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">GitHub Integration</CardTitle>
                        <CardDescription className="text-xs">Personal Access Token (PAT) for repo & PR access</CardDescription>
                      </div>
                    </div>
                    <IntegrationBadge status={integ?.status || "not_configured"} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {isConfigured && integ?.masked_token && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border font-mono">
                      <span className="text-muted-foreground">Current PAT:</span>
                      <span className="font-semibold text-foreground">{integ.masked_token}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="font-medium text-foreground">
                      {isConfigured ? "Update GitHub Token" : "Enter GitHub Personal Access Token"}
                    </label>
                    <div className="relative">
                      <Input
                        type={showGithub ? "text" : "password"}
                        placeholder="ghp_... or github_pat_..."
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGithub(!showGithub)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showGithub ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <span>Create a token with <code className="text-primary">repo</code> and <code className="text-primary">read:user</code> scopes at</span>
                      <a
                        href="https://github.com/settings/tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        GitHub Token Settings <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t p-4 bg-muted/20">
                  <div className="flex gap-2">
                    {isConfigured && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete("github")}
                        className="text-xs h-8 gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isConfigured && (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={testingGithub}
                        onClick={handleTestGithub}
                        className="text-xs h-8"
                      >
                        Test Connection
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={!githubToken.trim()}
                      isLoading={savingGithub}
                      onClick={handleSaveGithub}
                      className="text-xs h-8"
                    >
                      Save Token
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })()}

          {/* 3. GitLab PAT */}
          {(() => {
            const integ = getInteg("gitlab");
            const isConfigured = integ?.status === "connected" || integ?.status === "invalid";

            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                        <FolderGit2 className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">GitLab Integration</CardTitle>
                        <CardDescription className="text-xs">GitLab.com or Self-Hosted GitLab instance</CardDescription>
                      </div>
                    </div>
                    <IntegrationBadge status={integ?.status || "not_configured"} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {isConfigured && integ?.masked_token && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border font-mono">
                      <span className="text-muted-foreground">Current PAT:</span>
                      <span className="font-semibold text-foreground">{integ.masked_token}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="font-medium text-foreground">Self-Hosted Instance URL (Optional)</label>
                    <Input
                      placeholder="https://gitlab.example.com (leave blank for gitlab.com)"
                      value={gitlabBaseUrl}
                      onChange={(e) => setGitlabBaseUrl(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-medium text-foreground">
                      {isConfigured ? "Update GitLab Token" : "Enter GitLab Personal Access Token"}
                    </label>
                    <div className="relative">
                      <Input
                        type={showGitlab ? "text" : "password"}
                        placeholder="glpat-..."
                        value={gitlabToken}
                        onChange={(e) => setGitlabToken(e.target.value)}
                        className="pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGitlab(!showGitlab)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showGitlab ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <span>Create a token with <code className="text-primary">api</code> and <code className="text-primary">read_user</code> scopes at</span>
                      <a
                        href="https://gitlab.com/-/user_settings/personal_access_tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        GitLab Access Tokens <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t p-4 bg-muted/20">
                  <div className="flex gap-2">
                    {isConfigured && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete("gitlab")}
                        className="text-xs h-8 gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isConfigured && (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={testingGitlab}
                        onClick={handleTestGitlab}
                        className="text-xs h-8"
                      >
                        Test Connection
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={!gitlabToken.trim()}
                      isLoading={savingGitlab}
                      onClick={handleSaveGitlab}
                      className="text-xs h-8"
                    >
                      Save Token
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function IntegrationBadge({ status }: { status: string }) {
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
        <span>Invalid / Expired</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Not Configured
    </Badge>
  );
}
