import { buildCloudRunner } from "./base";
import type { ProviderConfig, ProviderRunner } from "./types";

export const providerCatalog: ProviderConfig[] = [
  {
    id: "gemini-flash",
    name: "Gemini 2.5 Flash",
    description: "Быстрая облачная reasoning-модель",
    mode: "cloud",
    models: ["gemini-2.5-flash"],
    enabled: true
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    description: "Модель с reasoning-трейсами",
    mode: "cloud",
    models: ["deepseek-reasoner"],
    enabled: true
  },
  {
    id: "qwen3-max",
    name: "Qwen3 Max",
    description: "Alibaba DashScope премиум модель",
    mode: "cloud",
    models: ["qwen3-max-instruct"],
    enabled: true
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Универсальный роутер моделей",
    mode: "cloud",
    models: ["openrouter/auto"],
    enabled: false
  },
  {
    id: "grok",
    name: "Grok",
    description: "xAI reasoning модель (опционально)",
    mode: "cloud",
    models: ["grok-beta"],
    enabled: false
  }
];

export function getRunner(providerId: string): ProviderRunner {
  return buildCloudRunner(providerId);
}
