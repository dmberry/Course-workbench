import type { AIProvider, ProviderConfig, ModelConfig } from "@/types/ai-settings";

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code (CLI)",
    description: "Uses your Claude Code subscription — no API key needed",
    requiresApiKey: false,
    baseUrlConfigurable: false,
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        contextWindow: 200000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        contextWindow: 200000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
      },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Claude models - excellent for research and analysis",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
      },
      {
        id: "custom",
        name: "Custom Model",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "GPT models - strong reasoning capabilities",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
      },
      {
        id: "custom",
        name: "Custom Model",
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
      },
    ],
  },
  google: {
    id: "google",
    name: "Google (Gemini)",
    description: "Gemini models - large context windows",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        contextWindow: 1048576,
        maxOutputTokens: 65536,
        supportsStreaming: true,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        contextWindow: 1048576,
        maxOutputTokens: 65536,
        supportsStreaming: true,
      },
      {
        id: "custom",
        name: "Custom Model",
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
      },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run models locally - private and free",
    requiresApiKey: false,
    baseUrlConfigurable: true,
    defaultBaseUrl: "http://localhost:11434",
    models: [
      {
        id: "llama3.2",
        name: "Llama 3.2",
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
      },
      {
        id: "mistral",
        name: "Mistral",
        contextWindow: 32000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
      },
      {
        id: "custom",
        name: "Custom Model",
        contextWindow: 32000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
      },
    ],
  },
  "openai-compatible": {
    id: "openai-compatible",
    name: "OpenAI-Compatible API",
    description: "Any API compatible with OpenAI format (Together, Groq, etc.)",
    requiresApiKey: true,
    baseUrlConfigurable: true,
    models: [
      {
        id: "custom",
        name: "Custom Model",
        contextWindow: 32000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
      },
    ],
  },
};

export function getDefaultModel(provider: AIProvider): string {
  return PROVIDER_CONFIGS[provider].models[0]?.id || "custom";
}

export function getProviderConfig(provider: AIProvider): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS);
}

export function getModelDisplayName(provider: AIProvider, modelId: string): string {
  const config = PROVIDER_CONFIGS[provider];
  const model = config.models.find((m) => m.id === modelId);
  return model ? model.name : modelId;
}
