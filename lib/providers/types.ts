export type ProviderConfig = {
  id: string;
  name: string;
  description: string;
  mode: "cloud" | "local";
  models: string[];
  enabled: boolean;
};

export type LLMRequest = {
  prompt: string;
  temperature: number;
  seed: number;
  maxOutputTokens?: number;
  imageBase64?: string;
};

export type ProviderRunner = (payload: LLMRequest) => Promise<string>;
