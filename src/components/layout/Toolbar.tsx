"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelLeft, PanelLeftClose, Terminal, Moon, Sun, MessageSquare, FolderOpen, Loader2 } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PullDialog } from "@/components/canvas/PullDialog";
import { PushDialog } from "@/components/canvas/PushDialog";
import { CanvasLogDialog } from "@/components/canvas/CanvasLogDialog";
import { SettingsDialog } from "@/components/canvas/SettingsDialog";
import { AISettingsModal } from "@/components/settings/AISettingsModal";

interface ToolbarProps {
  chatCollapsed: boolean;
  setChatCollapsed: (collapsed: boolean) => void;
}

export function Toolbar({ chatCollapsed, setChatCollapsed }: ToolbarProps) {
  const { sidebarOpen, setSidebarOpen, canvasLog, setShowCanvasLog, workspaceRoot, setWorkspaceRoot } =
    useWorkspace();

  const [dark, setDark] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("cw:dark");
    if (stored === "true") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("cw:dark", String(next));
  };

  const handleOpenProject = useCallback(async () => {
    setIsOpeningProject(true);
    try {
      const res = await fetch("/api/browse/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "open" }),
      });
      const data = await res.json();
      if (data.ok) {
        setWorkspaceRoot(data.path);
      }
    } catch {
      // User cancelled or an error occurred
    } finally {
      setIsOpeningProject(false);
    }
  }, [setWorkspaceRoot]);

  return (
    <header className="px-4 py-2 border-b border-border bg-cream/30 dark:bg-muted/30 flex items-center gap-3">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="btn-editorial-ghost !px-2 !py-1.5"
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="w-4 h-4" />
        ) : (
          <PanelLeft className="w-4 h-4" />
        )}
      </button>

      <h1 className="font-display text-display-md font-bold text-foreground select-none">
        Course Workbench
      </h1>

      {/* Open project — always available */}
      <button
        onClick={handleOpenProject}
        disabled={isOpeningProject}
        className="btn-editorial-ghost !px-2 !py-1.5"
        title={workspaceRoot ? "Open different project" : "Open project folder"}
      >
        {isOpeningProject ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FolderOpen className="w-4 h-4" />
        )}
      </button>

      <div className="flex-1" />

      <PullDialog />
      <PushDialog />

      {/* Show log button */}
      {canvasLog && (
        <button
          onClick={() => setShowCanvasLog(true)}
          className="btn-editorial-ghost !px-2 !py-1.5"
          title="Canvas operation log"
        >
          <Terminal className="w-4 h-4" />
        </button>
      )}

      <SettingsDialog />

      {/* Separator */}
      <div className="w-px h-4 bg-border" />

      {/* Chat toggle */}
      <button
        onClick={() => setChatCollapsed(!chatCollapsed)}
        className="btn-editorial-ghost !px-2 !py-1.5"
        title={chatCollapsed ? "Open AI chat (Cmd+Shift+L)" : "Close AI chat (Cmd+Shift+L)"}
      >
        <MessageSquare className={`w-4 h-4 ${!chatCollapsed ? "text-burgundy" : ""}`} />
      </button>

      {/* AI settings */}
      <AISettingsModal />

      {/* Dark mode toggle */}
      <button
        onClick={toggleDark}
        className="btn-editorial-ghost !px-2 !py-1.5"
        title={dark ? "Light mode" : "Dark mode"}
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <CanvasLogDialog />
    </header>
  );
}
