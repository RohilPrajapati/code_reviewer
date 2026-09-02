"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FileDiff } from "@/lib/types";
import { ChevronDown, ChevronRight, Copy, Check, MessageSquareCode, Columns, Rows } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { getLanguageFromFilename, highlightCodeLine } from "@/lib/syntax";

interface DiffFileProps {
  file: FileDiff;
  initialViewMode?: "unified" | "split";
  onReferenceLine?: (refString: string) => void;
}

interface ParsedLine {
  type: "add" | "del" | "normal" | "hunk";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface SplitCell {
  lineNumber?: number;
  type: "del" | "add" | "normal" | "empty";
  content: string;
}

interface SplitRow {
  type: "hunk" | "row";
  hunkContent?: string;
  left?: SplitCell;
  right?: SplitCell;
}

export function DiffFile({ file, initialViewMode = "unified", onReferenceLine }: DiffFileProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"unified" | "split">(initialViewMode);
  const language = useMemo(() => getLanguageFromFilename(file.filename), [file.filename]);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  const parsedLines = useMemo(() => {
    if (!file.patch) return [];

    const lines = file.patch.split("\n");
    const result: ParsedLine[] = [];

    let oldLine = 0;
    let newLine = 0;

    for (const rawLine of lines) {
      if (rawLine.startsWith("@@")) {
        const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        result.push({ type: "hunk", content: rawLine });
      } else if (rawLine.startsWith("+")) {
        result.push({
          type: "add",
          newLineNumber: newLine,
          content: rawLine.substring(1),
        });
        newLine++;
      } else if (rawLine.startsWith("-")) {
        result.push({
          type: "del",
          oldLineNumber: oldLine,
          content: rawLine.substring(1),
        });
        oldLine++;
      } else {
        result.push({
          type: "normal",
          oldLineNumber: oldLine,
          newLineNumber: newLine,
          content: rawLine.startsWith(" ") ? rawLine.substring(1) : rawLine,
        });
        oldLine++;
        newLine++;
      }
    }

    return result;
  }, [file.patch]);

  const splitRows = useMemo(() => {
    if (!file.patch) return [];

    const lines = file.patch.split("\n");
    const rows: SplitRow[] = [];

    let oldLine = 0;
    let newLine = 0;

    let leftBuffer: SplitCell[] = [];
    let rightBuffer: SplitCell[] = [];

    const flushBuffers = () => {
      const maxLen = Math.max(leftBuffer.length, rightBuffer.length);
      for (let i = 0; i < maxLen; i++) {
        rows.push({
          type: "row",
          left: leftBuffer[i] || { type: "empty", content: "" },
          right: rightBuffer[i] || { type: "empty", content: "" },
        });
      }
      leftBuffer = [];
      rightBuffer = [];
    };

    for (const rawLine of lines) {
      if (rawLine.startsWith("@@")) {
        flushBuffers();
        const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        rows.push({ type: "hunk", hunkContent: rawLine });
      } else if (rawLine.startsWith("-")) {
        leftBuffer.push({
          type: "del",
          lineNumber: oldLine,
          content: rawLine.substring(1),
        });
        oldLine++;
      } else if (rawLine.startsWith("+")) {
        rightBuffer.push({
          type: "add",
          lineNumber: newLine,
          content: rawLine.substring(1),
        });
        newLine++;
      } else {
        flushBuffers();
        const content = rawLine.startsWith(" ") ? rawLine.substring(1) : rawLine;
        rows.push({
          type: "row",
          left: {
            type: "normal",
            lineNumber: oldLine,
            content,
          },
          right: {
            type: "normal",
            lineNumber: newLine,
            content,
          },
        });
        oldLine++;
        newLine++;
      }
    }

    flushBuffers();
    return rows;
  }, [file.patch]);

  const copyPath = () => {
    navigator.clipboard.writeText(file.filename);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "added":
        return <Badge variant="success">Added</Badge>;
      case "removed":
        return <Badge variant="destructive">Deleted</Badge>;
      case "renamed":
        return <Badge variant="secondary">Renamed</Badge>;
      default:
        return <Badge variant="outline">Modified</Badge>;
    }
  };

  return (
    <div id={`file-${file.filename.replace(/[^a-zA-Z0-9]/g, "-")}`} className="border rounded-lg bg-card overflow-hidden shadow-sm">
      {/* File header (Sticky while scrolling this diff) */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between px-4 py-2 bg-card/95 backdrop-blur-md border-b gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <span className="font-mono font-semibold text-foreground truncate">{file.filename}</span>
          {file.old_filename && file.old_filename !== file.filename && (
            <span className="text-muted-foreground font-mono truncate">(renamed from {file.old_filename})</span>
          )}
          {getStatusBadge(file.status)}
          {language !== "plaintext" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase font-mono font-medium text-muted-foreground/80 bg-muted/30">
              {language}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 font-mono text-[11px] mr-2">
            <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
            <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
          </div>

          <div className="flex items-center border rounded bg-background p-0.5">
            <button
              onClick={() => setViewMode("unified")}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded transition cursor-pointer flex items-center gap-1",
                viewMode === "unified" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              title="Unified View"
            >
              <Rows className="h-3 w-3" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded transition cursor-pointer flex items-center gap-1",
                viewMode === "split" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              title="Split View"
            >
              <Columns className="h-3 w-3" />
              <span>Split</span>
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={copyPath}
            className="h-7 w-7 p-0"
            title="Copy path"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
        </div>
      </div>

      {/* Code diff body */}
      {!collapsed && (
        <div className="overflow-x-auto font-mono text-[12px] leading-relaxed">
          {parsedLines.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-xs italic">
              Binary file or no text changes to display
            </div>
          ) : viewMode === "split" ? (
            /* Side-by-Side Split Diff View */
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col className="w-10" />
                <col className="w-[calc(50%-2.5rem)]" />
                <col className="w-10" />
                <col className="w-[calc(50%-2.5rem)]" />
              </colgroup>
              <tbody>
                {splitRows.map((row, idx) => {
                  if (row.type === "hunk") {
                    return (
                      <tr key={idx} className="bg-primary/5 text-primary text-[11px] select-none border-y border-border/40">
                        <td colSpan={4} className="py-1 px-4 font-semibold">
                          {row.hunkContent}
                        </td>
                      </tr>
                    );
                  }

                  const left = row.left!;
                  const right = row.right!;

                  const isLeftDel = left.type === "del";
                  const isRightAdd = right.type === "add";
                  const isLeftEmpty = left.type === "empty";
                  const isRightEmpty = right.type === "empty";

                  return (
                    <tr key={idx} className="group transition-colors border-b border-border/10">
                      {/* Left Line Number */}
                      <td
                        className={cn(
                          "py-0.5 px-2 text-right select-none text-[11px] font-mono border-r border-border/30",
                          isLeftDel && "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold",
                          isLeftEmpty && "bg-muted/30 text-transparent",
                          !isLeftDel && !isLeftEmpty && "text-muted-foreground/60"
                        )}
                      >
                        {left.lineNumber || ""}
                      </td>

                      {/* Left Content */}
                      <td
                        className={cn(
                          "py-0.5 px-2.5 relative whitespace-pre font-mono border-r border-border/40 overflow-hidden",
                          isLeftDel && "bg-rose-500/10 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200",
                          isLeftEmpty && "bg-muted/20 select-none",
                          !isLeftDel && !isLeftEmpty && "hover:bg-muted/30 text-foreground"
                        )}
                      >
                        {!isLeftEmpty && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className={cn("w-2.5 select-none font-bold shrink-0 text-center", isLeftDel ? "text-rose-600" : "text-transparent")}>
                                {isLeftDel ? "-" : " "}
                              </span>
                              <span
                                className="truncate font-mono"
                                dangerouslySetInnerHTML={{
                                  __html: highlightCodeLine(left.content, language),
                                }}
                              />
                            </div>
                            {onReferenceLine && left.lineNumber && (
                              <button
                                onClick={() => onReferenceLine(`@${file.filename}:L${left.lineNumber}`)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-[10px] px-1 py-0.5 rounded shadow-xs ml-1 cursor-pointer shrink-0"
                                title="Reference this line in AI chat"
                              >
                                <MessageSquareCode className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Right Line Number */}
                      <td
                        className={cn(
                          "py-0.5 px-2 text-right select-none text-[11px] font-mono border-r border-border/30",
                          isRightAdd && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold",
                          isRightEmpty && "bg-muted/30 text-transparent",
                          !isRightAdd && !isRightEmpty && "text-muted-foreground/60"
                        )}
                      >
                        {right.lineNumber || ""}
                      </td>

                      {/* Right Content */}
                      <td
                        className={cn(
                          "py-0.5 px-2.5 relative whitespace-pre font-mono overflow-hidden",
                          isRightAdd && "bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200",
                          isRightEmpty && "bg-muted/20 select-none",
                          !isRightAdd && !isRightEmpty && "hover:bg-muted/30 text-foreground"
                        )}
                      >
                        {!isRightEmpty && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className={cn("w-2.5 select-none font-bold shrink-0 text-center", isRightAdd ? "text-emerald-600" : "text-transparent")}>
                                {isRightAdd ? "+" : " "}
                              </span>
                              <span
                                className="truncate font-mono"
                                dangerouslySetInnerHTML={{
                                  __html: highlightCodeLine(right.content, language),
                                }}
                              />
                            </div>
                            {onReferenceLine && right.lineNumber && (
                              <button
                                onClick={() => onReferenceLine(`@${file.filename}:L${right.lineNumber}`)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-[10px] px-1 py-0.5 rounded shadow-xs ml-1 cursor-pointer shrink-0"
                                title="Reference this line in AI chat"
                              >
                                <MessageSquareCode className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Unified Diff View */
            <table className="w-full border-collapse">
              <tbody>
                {parsedLines.map((line, idx) => {
                  if (line.type === "hunk") {
                    return (
                      <tr key={idx} className="bg-primary/5 text-primary text-[11px] select-none border-y border-border/40">
                        <td colSpan={3} className="py-1 px-4 font-semibold">
                          {line.content}
                        </td>
                      </tr>
                    );
                  }

                  const isAdd = line.type === "add";
                  const isDel = line.type === "del";

                  return (
                    <tr
                      key={idx}
                      className={cn(
                        "group transition-colors",
                        isAdd && "bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200",
                        isDel && "bg-rose-500/10 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200",
                        !isAdd && !isDel && "hover:bg-muted/40"
                      )}
                    >
                      {/* Old Line Number */}
                      <td className="w-12 py-0.5 px-2 text-right select-none text-[11px] text-muted-foreground/60 border-r border-border/30 font-mono">
                        {line.oldLineNumber || ""}
                      </td>

                      {/* New Line Number */}
                      <td className="w-12 py-0.5 px-2 text-right select-none text-[11px] text-muted-foreground/60 border-r border-border/30 font-mono">
                        {line.newLineNumber || ""}
                      </td>

                      {/* Line Prefix & Content with inline reference button */}
                      <td className="py-0.5 px-3 relative whitespace-pre font-mono">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 overflow-hidden">
                            <span className="w-3 select-none text-muted-foreground/80 font-bold shrink-0">
                              {isAdd ? "+" : isDel ? "-" : " "}
                            </span>
                            <span
                              className="truncate font-mono"
                              dangerouslySetInnerHTML={{
                                __html: highlightCodeLine(line.content, language),
                              }}
                            />
                          </div>

                          {/* Ask AI / Reference Button on Hover */}
                          {onReferenceLine && (line.newLineNumber || line.oldLineNumber) && (
                            <button
                              onClick={() => {
                                const lineNum = line.newLineNumber || line.oldLineNumber;
                                onReferenceLine(`@${file.filename}:L${lineNum}`);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-xs ml-2 cursor-pointer shrink-0"
                              title="Reference this line in AI chat"
                            >
                              <MessageSquareCode className="h-3 w-3" />
                              <span>Ask AI</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
