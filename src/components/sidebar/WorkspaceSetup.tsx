"use client";

import { useState } from "react";
import { FolderPlus, FolderOpen, Loader2 } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

export function WorkspaceSetup() {
  const { setWorkspaceRoot } = useWorkspace();
  const [mode, setMode] = useState<"choose" | "new">("choose");

  // New workspace fields
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const handleOpenExisting = async () => {
    setOpening(true);
    setError("");
    try {
      const res = await fetch("/api/browse/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "open" }),
      });
      const data = await res.json();
      if (data.cancelled) {
        // User closed the dialog — do nothing
      } else if (data.ok) {
        setWorkspaceRoot(data.path);
      } else {
        setError(data.error || "Failed to open folder");
      }
    } catch {
      setError("Failed to open folder picker");
    } finally {
      setOpening(false);
    }
  };

  const handleCreateNew = async () => {
    const name = projectName.trim();
    if (!name) return;

    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/browse/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "new", name }),
      });
      const data = await res.json();
      if (data.cancelled) {
        // User closed the dialog — do nothing
      } else if (data.ok) {
        setWorkspaceRoot(data.path);
      } else {
        setError(data.error || "Failed to create workspace");
      }
    } catch {
      setError("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  };

  // New workspace form — just needs a name, location picked via OS dialog
  if (mode === "new") {
    return (
      <div className="space-y-3">
        <p className="text-caption font-sans font-medium text-foreground">
          New Workspace
        </p>
        <div>
          <label className="text-caption font-sans text-muted-foreground block mb-1">
            Folder name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateNew()}
            placeholder="e.g. Canvas Work"
            className="input-editorial !py-1.5 !text-caption"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            You'll choose where to put it next
          </p>
        </div>

        {error && <p className="text-caption text-error-500">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("choose");
              setError("");
            }}
            className="btn-editorial-ghost !px-3 !py-1.5 text-caption flex-1"
          >
            Back
          </button>
          <button
            onClick={handleCreateNew}
            disabled={!projectName.trim() || creating}
            className="btn-editorial-primary !px-3 !py-1.5 text-caption flex-1 gap-1.5"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderPlus className="w-3.5 h-3.5" />
            )}
            Create
          </button>
        </div>
      </div>
    );
  }

  // Initial choice screen
  return (
    <div className="space-y-2">
      <p className="text-caption font-sans text-muted-foreground">
        Choose a workspace folder where your Canvas content will live.
      </p>
      <button
        onClick={() => setMode("new")}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-caption font-sans
          bg-card border border-border hover:bg-cream/60 dark:hover:bg-muted/60 hover:border-burgundy/30 transition-colors"
      >
        <FolderPlus className="w-4 h-4 text-burgundy" />
        <div className="text-left">
          <span className="font-medium text-foreground block">
            New Workspace
          </span>
          <span className="text-muted-foreground text-[10px]">
            Create a new folder for courses
          </span>
        </div>
      </button>
      <button
        onClick={handleOpenExisting}
        disabled={opening}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-caption font-sans
          bg-card border border-border hover:bg-cream/60 dark:hover:bg-muted/60 hover:border-burgundy/30 transition-colors"
      >
        {opening ? (
          <Loader2 className="w-4 h-4 text-gold animate-spin" />
        ) : (
          <FolderOpen className="w-4 h-4 text-gold" />
        )}
        <div className="text-left">
          <span className="font-medium text-foreground block">
            Open Existing
          </span>
          <span className="text-muted-foreground text-[10px]">
            {opening ? "Waiting for folder selection..." : "Pick an existing folder"}
          </span>
        </div>
      </button>
      {error && <p className="text-caption text-error-500 mt-1">{error}</p>}
    </div>
  );
}
