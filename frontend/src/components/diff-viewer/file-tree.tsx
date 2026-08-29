"use client";

import React, { useState } from "react";
import { FileDiff } from "@/lib/types";
import { FileCode, FilePlus, FileX, FileEdit, Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

interface FileTreeProps {
  files: FileDiff[];
  selectedFile: string | null;
  onSelectFile: (filename: string) => void;
}

export function FileTree({ files, selectedFile, onSelectFile }: FileTreeProps) {
  const [filter, setFilter] = useState("");

  const filteredFiles = files.filter((f) =>
    f.filename.toLowerCase().includes(filter.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "added":
        return <FilePlus className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "removed":
        return <FileX className="h-4 w-4 text-rose-500 shrink-0" />;
      case "renamed":
        return <FileEdit className="h-4 w-4 text-blue-500 shrink-0" />;
      default:
        return <FileCode className="h-4 w-4 text-amber-500 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/60 border rounded-lg overflow-hidden text-sm">
      <div className="p-3 border-b space-y-2 bg-card">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Changed Files ({files.length})</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter files..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs bg-background/70"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/30 p-1">
        {filteredFiles.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No matching files found
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSelected = selectedFile === file.filename;
            const parts = file.filename.split("/");
            const fileName = parts.pop();
            const dirPath = parts.join("/");

            return (
              <button
                key={file.filename}
                onClick={() => onSelectFile(file.filename)}
                className={cn(
                  "w-full text-left flex items-center justify-between p-2 rounded-md transition-colors text-xs select-none group cursor-pointer",
                  isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/70 text-foreground"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {getStatusIcon(file.status)}
                  <div className="truncate">
                    <span className="font-mono text-foreground font-medium">{fileName}</span>
                    {dirPath && (
                      <span className="block text-[11px] text-muted-foreground truncate font-mono">
                        {dirPath}/
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                  {file.additions > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      +{file.additions}
                    </span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      -{file.deletions}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
