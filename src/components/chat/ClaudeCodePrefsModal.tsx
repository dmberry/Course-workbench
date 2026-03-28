"use client";

import { useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAISettings } from "@/context/AISettingsContext";
import {
  DEFAULT_CC_PREFERENCES,
  type ResponseStyle,
  type Verbosity,
  type CCToolName,
} from "@/types/ai-settings";

interface ClaudeCodePrefsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RESPONSE_STYLES: { id: ResponseStyle; label: string; desc: string }[] = [
  { id: "prose", label: "Prose", desc: "Flowing paragraphs" },
  { id: "bullets", label: "Bullet lists", desc: "Structured points" },
];

const VERBOSITY_LEVELS: { id: Verbosity; label: string; desc: string }[] = [
  { id: "short", label: "Short", desc: "Brief, to the point" },
  { id: "medium", label: "Medium", desc: "Balanced detail" },
  { id: "detailed", label: "Detailed", desc: "Thorough explanations" },
];

const TOOL_OPTIONS: { id: CCToolName; label: string; desc: string }[] = [
  { id: "Read", label: "Read", desc: "Read file contents" },
  { id: "Glob", label: "Glob", desc: "Search for files by pattern" },
  { id: "Grep", label: "Grep", desc: "Search within file contents" },
];

export function ClaudeCodePrefsModal({ open, onOpenChange }: ClaudeCodePrefsModalProps) {
  const { settings, updateSettings } = useAISettings();
  const prefs = settings.ccPreferences ?? DEFAULT_CC_PREFERENCES;

  const updatePrefs = useCallback(
    (updates: Partial<typeof prefs>) => {
      updateSettings({
        ccPreferences: { ...prefs, ...updates },
      });
    },
    [prefs, updateSettings],
  );

  const toggleTool = useCallback(
    (tool: CCToolName) => {
      const current = prefs.allowedTools;
      const next = current.includes(tool)
        ? current.filter((t) => t !== tool)
        : [...current, tool];
      if (next.length === 0) return;
      updatePrefs({ allowedTools: next });
    },
    [prefs.allowedTools, updatePrefs],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/40 dark:bg-black/60 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover rounded-sm shadow-editorial-lg border border-border w-[90vw] max-w-md max-h-[85vh] overflow-y-auto z-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-display text-display-md font-bold text-foreground">
              Claude Code
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 text-slate-muted hover:text-ink dark:hover:text-foreground rounded-sm transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            {/* Response Style */}
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                Response Style
              </label>
              <div className="flex gap-2">
                {RESPONSE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => updatePrefs({ responseStyle: style.id })}
                    className={cn(
                      "flex-1 px-2.5 py-1.5 rounded-sm border font-sans text-[11px] transition-colors text-left",
                      prefs.responseStyle === style.id
                        ? "bg-burgundy/5 border-burgundy text-burgundy"
                        : "border-border text-foreground hover:border-slate-muted",
                    )}
                  >
                    <div className="font-medium">{style.label}</div>
                    <div className="text-[9px] text-slate-muted">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Verbosity */}
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                Verbosity
              </label>
              <div className="flex gap-2">
                {VERBOSITY_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => updatePrefs({ verbosity: level.id })}
                    className={cn(
                      "flex-1 px-2.5 py-1.5 rounded-sm border font-sans text-[11px] transition-colors text-left",
                      prefs.verbosity === level.id
                        ? "bg-burgundy/5 border-burgundy text-burgundy"
                        : "border-border text-foreground hover:border-slate-muted",
                    )}
                  >
                    <div className="font-medium">{level.label}</div>
                    <div className="text-[9px] text-slate-muted">{level.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tool Permissions */}
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                Tool Permissions
              </label>
              <p className="font-sans text-[10px] text-slate-muted mb-2">
                What Claude Code can access when answering. At least one must be enabled.
              </p>
              <div className="space-y-1.5">
                {TOOL_OPTIONS.map((tool) => {
                  const enabled = prefs.allowedTools.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm border font-sans text-[11px] transition-colors",
                        enabled
                          ? "bg-burgundy/5 border-burgundy/30"
                          : "border-border hover:border-slate-muted",
                      )}
                    >
                      <div className="text-left">
                        <span className="font-medium text-foreground">{tool.label}</span>
                        <span className="text-slate-muted ml-1.5 text-[9px]">{tool.desc}</span>
                      </div>
                      <div
                        className={cn(
                          "w-8 h-4 rounded-full transition-colors relative flex-shrink-0",
                          enabled ? "bg-burgundy" : "bg-parchment dark:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
                            enabled ? "translate-x-4" : "translate-x-0",
                          )}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
