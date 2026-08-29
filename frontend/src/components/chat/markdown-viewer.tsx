"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  // Parse simple markdown blocks (headings, code blocks, lists, bold/italic, inline code)
  const renderFormatted = () => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeBuffer: string[] = [];
    let listBuffer: string[] = [];

    const flushList = (key: number) => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`list-${key}`} className="my-2 space-y-1 pl-5 list-disc text-xs leading-relaxed">
            {listBuffer.map((item, i) => (
              <li key={i}>{formatInline(item)}</li>
            ))}
          </ul>
        );
        listBuffer = [];
      }
    };

    lines.forEach((line, idx) => {
      // Code block start / end
      if (line.trim().startsWith("```")) {
        flushList(idx);
        if (inCodeBlock) {
          // Finish code block
          const codeText = codeBuffer.join("\n");
          elements.push(
            <CodeBlockSnippet key={`code-${idx}`} code={codeText} language={codeLanguage} />
          );
          codeBuffer = [];
          inCodeBlock = false;
          codeLanguage = "";
        } else {
          inCodeBlock = true;
          codeLanguage = line.trim().substring(3).trim();
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      // Bullet points
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        listBuffer.push(line.trim().substring(2));
        return;
      } else {
        flushList(idx);
      }

      // Headings
      if (line.startsWith("### ")) {
        elements.push(
          <h4 key={idx} className="font-semibold text-sm mt-3 mb-1 text-foreground">
            {formatInline(line.substring(4))}
          </h4>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h3 key={idx} className="font-bold text-base mt-4 mb-1.5 text-foreground border-b pb-1">
            {formatInline(line.substring(3))}
          </h3>
        );
      } else if (line.startsWith("# ")) {
        elements.push(
          <h2 key={idx} className="font-bold text-lg mt-4 mb-2 text-foreground border-b pb-1">
            {formatInline(line.substring(2))}
          </h2>
        );
      } else if (line.trim() === "") {
        elements.push(<div key={idx} className="h-1.5" />);
      } else {
        elements.push(
          <p key={idx} className="text-xs leading-relaxed my-1 text-foreground/90">
            {formatInline(line)}
          </p>
        );
      }
    });

    flushList(lines.length);

    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <CodeBlockSnippet key="code-final" code={codeBuffer.join("\n")} language={codeLanguage} />
      );
    }

    return elements;
  };

  const formatInline = (text: string): React.ReactNode => {
    // Process inline code `...`, bold **...**, italic *...*
    const parts: React.ReactNode[] = [];
    let current = text;
    let key = 0;

    // Simple regex matching for backticks
    const tokens = current.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

    return tokens.map((tok, i) => {
      if (tok.startsWith("`") && tok.endsWith("`") && tok.length >= 2) {
        return (
          <code
            key={i}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      if (tok.startsWith("**") && tok.endsWith("**") && tok.length >= 4) {
        return <strong key={i} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>;
      }
      if (tok.startsWith("*") && tok.endsWith("*") && tok.length >= 2) {
        return <em key={i} className="italic text-foreground/90">{tok.slice(1, -1)}</em>;
      }
      return tok;
    });
  };

  return <div className="space-y-0.5 select-text">{renderFormatted()}</div>;
}

function CodeBlockSnippet({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-lg border bg-zinc-950 text-zinc-100 overflow-hidden font-mono text-[11px] shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
        <span>{language || "code"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 hover:text-zinc-200 transition cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
