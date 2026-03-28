"use client";

import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { AISettingsProvider } from "@/context/AISettingsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AISettingsProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </AISettingsProvider>
  );
}
