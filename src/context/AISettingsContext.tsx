"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { AISettings, AISettingsStorage, AIProvider } from "@/types/ai-settings";
import { DEFAULT_AI_SETTINGS } from "@/types/ai-settings";
import { getDefaultModel, PROVIDER_CONFIGS } from "@/lib/ai/config";

const STORAGE_KEY = "cw-ai-settings";
const STORAGE_VERSION = "1.0";

export type ConnectionStatus = "unknown" | "testing" | "success" | "error";

interface AISettingsContextValue {
  settings: AISettings;
  isLoaded: boolean;
  isConfigured: boolean;
  isAiReady: boolean;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;
  updateSettings: (updates: Partial<AISettings>) => void;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: string) => void;
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setCustomModelId: (modelId: string) => void;
  setAiEnabled: (enabled: boolean) => void;
  setClaudeCodeSessionId: (id: string | undefined) => void;
  clearClaudeCodeSession: () => void;
  clearSettings: () => void;
  getRequestHeaders: () => Record<string, string>;
}

const AISettingsContext = createContext<AISettingsContextValue | null>(null);

export function AISettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [connectionStatus, setConnectionStatusState] = useState<ConnectionStatus>("unknown");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: AISettingsStorage = JSON.parse(stored);
        if (parsed.version === STORAGE_VERSION && parsed.settings) {
          setSettings({ ...DEFAULT_AI_SETTINGS, ...parsed.settings });
        }
      }
    } catch (e) {
      console.error("Failed to load AI settings:", e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        const storage: AISettingsStorage = {
          version: STORAGE_VERSION,
          settings,
          lastUpdated: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
      } catch (e) {
        console.error("Failed to save AI settings:", e);
      }
    }
  }, [settings, isLoaded]);

  const isConfigured = useCallback(() => {
    const providerConfig = PROVIDER_CONFIGS[settings.provider];
    if (providerConfig.requiresApiKey && !settings.apiKey) return false;
    return true;
  }, [settings.provider, settings.apiKey]);

  const setConnectionStatus = useCallback(
    (status: ConnectionStatus, error: string | null = null) => {
      setConnectionStatusState(status);
      setConnectionError(error);
    },
    []
  );

  const resetConnectionStatus = useCallback(() => {
    setConnectionStatusState("unknown");
    setConnectionError(null);
  }, []);

  const updateSettings = useCallback(
    (updates: Partial<AISettings>) => {
      setSettings((prev) => ({ ...prev, ...updates }));
      if (updates.provider || updates.model || updates.apiKey || updates.baseUrl || updates.customModelId) {
        resetConnectionStatus();
      }
    },
    [resetConnectionStatus]
  );

  const setProvider = useCallback(
    (provider: AIProvider) => {
      setSettings((prev) => ({
        ...prev,
        provider,
        model: getDefaultModel(provider),
        baseUrl:
          provider === "ollama" || provider === "openai-compatible"
            ? prev.baseUrl
            : undefined,
        customModelId: undefined,
        claudeCodeSessionId:
          provider === "claude-code" ? prev.claudeCodeSessionId : undefined,
      }));
      resetConnectionStatus();
    },
    [resetConnectionStatus]
  );

  const setModel = useCallback(
    (model: string) => {
      setSettings((prev) => ({ ...prev, model }));
      resetConnectionStatus();
    },
    [resetConnectionStatus]
  );

  const setApiKey = useCallback(
    (apiKey: string) => {
      setSettings((prev) => ({ ...prev, apiKey }));
      resetConnectionStatus();
    },
    [resetConnectionStatus]
  );

  const setBaseUrl = useCallback(
    (baseUrl: string) => {
      setSettings((prev) => ({ ...prev, baseUrl }));
      resetConnectionStatus();
    },
    [resetConnectionStatus]
  );

  const setCustomModelId = useCallback(
    (customModelId: string) => {
      setSettings((prev) => ({ ...prev, customModelId }));
      resetConnectionStatus();
    },
    [resetConnectionStatus]
  );

  const setAiEnabled = useCallback((aiEnabled: boolean) => {
    setSettings((prev) => ({ ...prev, aiEnabled }));
  }, []);

  const setClaudeCodeSessionId = useCallback(
    (claudeCodeSessionId: string | undefined) => {
      setSettings((prev) => ({ ...prev, claudeCodeSessionId }));
    },
    [],
  );

  const clearClaudeCodeSession = useCallback(() => {
    setSettings((prev) => ({ ...prev, claudeCodeSessionId: undefined }));
  }, []);

  const clearSettings = useCallback(() => {
    setSettings(DEFAULT_AI_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getRequestHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      "X-AI-Provider": settings.provider,
      "X-AI-Model": settings.model,
    };
    if (settings.apiKey) headers["X-AI-API-Key"] = settings.apiKey;
    if (settings.baseUrl) headers["X-AI-Base-URL"] = settings.baseUrl;
    if (settings.customModelId) headers["X-AI-Custom-Model"] = settings.customModelId;
    if (settings.claudeCodeSessionId)
      headers["X-CC-Session-Id"] = settings.claudeCodeSessionId;
    return headers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.provider, settings.model, settings.apiKey, settings.baseUrl, settings.customModelId, settings.claudeCodeSessionId]);

  const isAiReady = settings.aiEnabled && connectionStatus === "success";
  const isConfiguredValue = isConfigured();

  const value = useMemo<AISettingsContextValue>(() => ({
    settings,
    isLoaded,
    isConfigured: isConfiguredValue,
    isAiReady,
    connectionStatus,
    connectionError,
    setConnectionStatus,
    updateSettings,
    setProvider,
    setModel,
    setApiKey,
    setBaseUrl,
    setCustomModelId,
    setAiEnabled,
    setClaudeCodeSessionId,
    clearClaudeCodeSession,
    clearSettings,
    getRequestHeaders,
  }), [
    settings, isLoaded, isConfiguredValue, isAiReady,
    connectionStatus, connectionError,
    setConnectionStatus, updateSettings, setProvider, setModel,
    setApiKey, setBaseUrl, setCustomModelId, setAiEnabled,
    setClaudeCodeSessionId, clearClaudeCodeSession, clearSettings,
    getRequestHeaders,
  ]);

  return (
    <AISettingsContext.Provider value={value}>
      {children}
    </AISettingsContext.Provider>
  );
}

export function useAISettings() {
  const context = useContext(AISettingsContext);
  if (!context) {
    throw new Error("useAISettings must be used within an AISettingsProvider");
  }
  return context;
}
