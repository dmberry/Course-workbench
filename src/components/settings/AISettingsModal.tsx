"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAISettings } from "@/context/AISettingsContext";
import { PROVIDER_CONFIGS, getAllProviders } from "@/lib/ai/config";
import type { AIProvider } from "@/types/ai-settings";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Settings2,
  X,
} from "lucide-react";

export function AISettingsModal() {
  const {
    settings,
    setProvider,
    setModel,
    setApiKey,
    setBaseUrl,
    setCustomModelId,
    setAiEnabled,
    isConfigured,
    connectionStatus,
    connectionError,
    setConnectionStatus,
  } = useAISettings();

  const [showApiKey, setShowApiKey] = useState(false);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const currentProvider = PROVIDER_CONFIGS[settings.provider];
  const providers = getAllProviders();

  const handleProviderChange = (provider: AIProvider) => {
    setProvider(provider);
    setIsProviderDropdownOpen(false);
  };

  const handleModelChange = (model: string) => {
    setModel(model);
    setIsModelDropdownOpen(false);
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Provider": settings.provider,
          "X-AI-Model": settings.model,
          "X-AI-API-Key": settings.apiKey || "",
          "X-AI-Base-URL": settings.baseUrl || "",
          "X-AI-Custom-Model": settings.customModelId || "",
        },
      });
      const data = await response.json();
      if (data.success) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error", data.error || "Connection test failed");
      }
    } catch (error) {
      setConnectionStatus(
        "error",
        error instanceof Error ? error.message : "Connection test failed"
      );
    }
  };

  const showBaseUrl =
    settings.provider === "ollama" ||
    settings.provider === "openai-compatible";
  const showCustomModel = settings.model === "custom";

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className="btn-editorial-ghost !px-2 !py-1.5"
          title="AI Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/40 dark:bg-black/60 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover rounded-sm shadow-editorial-lg border border-border w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto z-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-display text-display-md font-bold text-foreground">
              AI Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 text-slate-muted hover:text-ink dark:hover:text-foreground rounded-sm transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <label className="block font-sans text-caption font-medium text-foreground">
                  Enable AI Assistant
                </label>
                <p className="font-sans text-[10px] text-slate-muted mt-0.5">
                  Chat with AI about your course content
                </p>
              </div>
              <button
                onClick={() => setAiEnabled(!settings.aiEnabled)}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative flex-shrink-0",
                  settings.aiEnabled ? "bg-burgundy" : "bg-parchment dark:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    settings.aiEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Provider Selection */}
            <div
              className={cn(
                !settings.aiEnabled && "opacity-50 pointer-events-none"
              )}
            >
              <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                AI Provider
              </label>
              <div className="relative">
                <button
                  onClick={() =>
                    setIsProviderDropdownOpen(!isProviderDropdownOpen)
                  }
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5",
                    "bg-card border border-border rounded-sm",
                    "font-sans text-[11px] text-foreground",
                    "hover:border-slate-muted transition-colors",
                    isProviderDropdownOpen && "ring-1 ring-burgundy border-burgundy"
                  )}
                >
                  <div>
                    <span className="font-medium">{currentProvider.name}</span>
                    <span className="text-slate-muted ml-1.5 text-[9px]">
                      {currentProvider.description}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-slate-muted transition-transform",
                      isProviderDropdownOpen && "rotate-180"
                    )}
                  />
                </button>

                {isProviderDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-sm shadow-editorial-lg border border-border py-1 z-50 max-h-64 overflow-y-auto">
                    {providers.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => handleProviderChange(provider.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 font-sans text-[11px]",
                          "hover:bg-cream dark:hover:bg-muted transition-colors",
                          settings.provider === provider.id &&
                            "bg-burgundy/5 text-burgundy"
                        )}
                      >
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-[9px] text-slate-muted">
                          {provider.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Model Selection */}
            <div
              className={cn(
                !settings.aiEnabled && "opacity-50 pointer-events-none"
              )}
            >
              <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                Model
              </label>
              <div className="relative">
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5",
                    "bg-card border border-border rounded-sm",
                    "font-sans text-[11px] text-foreground",
                    "hover:border-slate-muted transition-colors",
                    isModelDropdownOpen && "ring-1 ring-burgundy border-burgundy"
                  )}
                >
                  <span>
                    {currentProvider.models.find(
                      (m) => m.id === settings.model
                    )?.name || settings.model}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-slate-muted transition-transform",
                      isModelDropdownOpen && "rotate-180"
                    )}
                  />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-sm shadow-editorial-lg border border-border py-1 z-50 max-h-48 overflow-y-auto">
                    {currentProvider.models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => handleModelChange(model.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 font-sans text-[11px]",
                          "hover:bg-cream dark:hover:bg-muted transition-colors",
                          settings.model === model.id &&
                            "bg-burgundy/5 text-burgundy"
                        )}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Model ID */}
            {showCustomModel && (
              <div
                className={cn(
                  !settings.aiEnabled && "opacity-50 pointer-events-none"
                )}
              >
                <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                  Custom Model ID
                </label>
                <input
                  type="text"
                  value={settings.customModelId || ""}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  placeholder="Enter model identifier"
                  className="w-full px-2.5 py-1.5 bg-card border border-border rounded-sm font-sans text-[11px] text-foreground placeholder:text-slate-muted focus:outline-none focus:ring-1 focus:ring-burgundy focus:border-burgundy"
                />
              </div>
            )}

            {/* Claude Code info box */}
            {settings.provider === "claude-code" && (
              <div
                className={cn(
                  "rounded-sm border border-burgundy/20 bg-burgundy/5 dark:bg-burgundy/10 px-3 py-2.5",
                  !settings.aiEnabled && "opacity-50 pointer-events-none",
                )}
              >
                <p className="font-sans text-[11px] text-foreground">
                  Uses your <strong>Claude Code subscription</strong>. No API key needed.
                </p>
                <p className="font-sans text-[10px] text-slate-muted mt-1">
                  The Claude CLI must be installed and authenticated.
                  Run{" "}
                  <code className="bg-cream dark:bg-muted px-1 rounded-sm text-[10px]">
                    claude login
                  </code>{" "}
                  if you haven&apos;t already.
                </p>
              </div>
            )}

            {/* API Key */}
            {currentProvider.requiresApiKey && (
              <div
                className={cn(
                  !settings.aiEnabled && "opacity-50 pointer-events-none"
                )}
              >
                <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey || ""}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${currentProvider.name} API key`}
                    className="w-full px-2.5 py-1.5 pr-8 bg-card border border-border rounded-sm font-sans text-[11px] text-foreground placeholder:text-slate-muted focus:outline-none focus:ring-1 focus:ring-burgundy focus:border-burgundy"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-muted hover:text-ink dark:hover:text-foreground transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 font-sans text-[10px] text-slate-muted">
                  Stored locally in your browser, never sent to our servers.
                </p>
              </div>
            )}

            {/* Base URL */}
            {showBaseUrl && (
              <div
                className={cn(
                  !settings.aiEnabled && "opacity-50 pointer-events-none"
                )}
              >
                <label className="block font-sans text-[10px] uppercase tracking-widest text-slate-muted mb-1.5">
                  Base URL
                </label>
                <input
                  type="text"
                  value={settings.baseUrl || ""}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    settings.provider === "ollama"
                      ? "http://localhost:11434"
                      : "https://api.example.com/v1"
                  }
                  className="w-full px-2.5 py-1.5 bg-card border border-border rounded-sm font-sans text-[11px] text-foreground placeholder:text-slate-muted focus:outline-none focus:ring-1 focus:ring-burgundy focus:border-burgundy"
                />
                {settings.provider === "ollama" && (
                  <p className="mt-1 font-sans text-[10px] text-slate-muted">
                    Start Ollama with{" "}
                    <code className="bg-cream dark:bg-muted px-1 rounded-sm text-[10px]">
                      ollama serve
                    </code>{" "}
                    in your terminal.
                  </p>
                )}
              </div>
            )}

            {/* Test Connection */}
            <div
              className={cn(
                "pt-1",
                !settings.aiEnabled && "opacity-50 pointer-events-none"
              )}
            >
              <button
                onClick={handleTestConnection}
                disabled={
                  connectionStatus === "testing" ||
                  !isConfigured ||
                  !settings.aiEnabled
                }
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-2.5 py-1.5",
                  "font-sans text-[11px] rounded-sm transition-all",
                  connectionStatus === "success"
                    ? "bg-success/10 text-success border border-success/30"
                    : connectionStatus === "error"
                      ? "bg-error/10 text-error border border-error/30"
                      : "bg-cream dark:bg-muted text-foreground border border-border hover:border-burgundy",
                  (connectionStatus === "testing" || !isConfigured) &&
                    "opacity-50 cursor-not-allowed"
                )}
              >
                {connectionStatus === "testing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Testing connection...
                  </>
                ) : connectionStatus === "success" ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    Connection successful
                  </>
                ) : connectionStatus === "error" ? (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    Connection failed
                  </>
                ) : (
                  "Test Connection"
                )}
              </button>

              {connectionError && (
                <p className="mt-1.5 font-sans text-[10px] text-error">
                  {connectionError}
                </p>
              )}

              {!isConfigured && (
                <p className="mt-1.5 font-sans text-[10px] text-slate-muted">
                  Please enter your API key to test the connection.
                </p>
              )}

              {isConfigured &&
                settings.aiEnabled &&
                connectionStatus !== "success" &&
                connectionStatus !== "testing" && (
                  <p className="mt-1.5 font-sans text-[10px] text-amber-600 dark:text-amber-400">
                    Please test connection to enable AI features.
                  </p>
                )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
