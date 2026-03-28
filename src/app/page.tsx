"use client";

import { useEffect, useState } from "react";
import { Toolbar } from "@/components/layout/Toolbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { ContentPanel } from "@/components/layout/ContentPanel";
import { StatusBar } from "@/components/layout/StatusBar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAISettings } from "@/context/AISettingsContext";

export default function Home() {
  const { sidebarOpen, saveFile, viewMode, setViewMode } = useWorkspace();
  const { settings } = useAISettings();
  const [chatCollapsed, setChatCollapsed] = useState(true);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+S: save
      if (mod && e.key === "s") {
        e.preventDefault();
        saveFile();
      }

      // Cmd+Shift+M: toggle markdown/preview
      if (mod && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setViewMode(viewMode === "markdown" ? "richtext" : "markdown");
      }

      // Cmd+Shift+L: toggle chat panel
      if (mod && e.shiftKey && e.key === "L") {
        e.preventDefault();
        setChatCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, viewMode, setViewMode]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar
        chatCollapsed={chatCollapsed}
        setChatCollapsed={setChatCollapsed}
      />
      <div className="flex-1 min-h-0 flex">
        {sidebarOpen && <Sidebar />}
        <ContentPanel />
        <ChatPanel key={settings.provider} collapsed={chatCollapsed} setCollapsed={setChatCollapsed} />
      </div>
      <StatusBar />
    </div>
  );
}
