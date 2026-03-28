export type AIProvider =
  | "claude-code"
  | "anthropic"
  | "openai"
  | "google"
  | "ollama"
  | "openai-compatible";

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
}

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  models: ModelConfig[];
  requiresApiKey: boolean;
  baseUrlConfigurable: boolean;
  defaultBaseUrl?: string;
}

// Claude Code preferences
export type ResponseStyle = "prose" | "bullets";
export type Verbosity = "short" | "medium" | "detailed";
export type CCToolName = "Read" | "Glob" | "Grep";

export interface ClaudeCodePreferences {
  responseStyle: ResponseStyle;
  verbosity: Verbosity;
  allowedTools: CCToolName[];
}

export const DEFAULT_CC_PREFERENCES: ClaudeCodePreferences = {
  responseStyle: "prose",
  verbosity: "medium",
  allowedTools: ["Read", "Glob", "Grep"],
};

export interface AISettings {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  customModelId?: string;
  aiEnabled: boolean;
  claudeCodeSessionId?: string;
  ccPreferences?: ClaudeCodePreferences;
}

export interface AISettingsStorage {
  version: string;
  settings: AISettings;
  lastUpdated: string;
}

export interface AIRequestConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  aiEnabled: false,
  ccPreferences: DEFAULT_CC_PREFERENCES,
};
