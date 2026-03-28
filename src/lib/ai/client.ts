import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIProvider, AIRequestConfig } from "@/types/ai-settings";
import { PROVIDER_CONFIGS, getDefaultModel } from "./config";

export function extractAIConfig(headers: Headers): AIRequestConfig {
  const provider =
    (headers.get("X-AI-Provider") as AIProvider) || "anthropic";
  const model = headers.get("X-AI-Model") || getDefaultModel(provider);
  const apiKey = headers.get("X-AI-API-Key") || getEnvApiKey(provider);
  const baseUrl = headers.get("X-AI-Base-URL") || getDefaultBaseUrl(provider);
  const customModelId = headers.get("X-AI-Custom-Model") || "";

  return {
    provider,
    model: customModelId || model,
    apiKey,
    baseUrl: baseUrl || undefined,
  };
}

function getEnvApiKey(provider: AIProvider): string {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY || "";
    case "openai":
      return process.env.OPENAI_API_KEY || "";
    case "google":
      return process.env.GOOGLE_API_KEY || "";
    default:
      return "";
  }
}

function getDefaultBaseUrl(provider: AIProvider): string {
  return PROVIDER_CONFIGS[provider].defaultBaseUrl || "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createModelInstance(config: AIRequestConfig): any {
  const { provider, model, apiKey, baseUrl } = config;

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);

    case "openai":
      return createOpenAI({ apiKey })(model);

    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);

    case "ollama":
      return createOpenAI({
        apiKey: "ollama",
        baseURL: (baseUrl || "http://localhost:11434") + "/v1",
      }).chat(model);

    case "openai-compatible":
      return createOpenAI({ apiKey, baseURL: baseUrl }).chat(model);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function validateAIConfig(config: AIRequestConfig): { valid: boolean; error?: string } {
  const { provider, apiKey } = config;
  const providerConfig = PROVIDER_CONFIGS[provider];

  if (providerConfig.requiresApiKey && !apiKey) {
    return {
      valid: false,
      error: `${providerConfig.name} requires an API key. Please configure it in AI Settings.`,
    };
  }

  return { valid: true };
}
