import type { LLMRequest, ProviderRunner } from "./types";

export function buildCloudRunner(provider: string): ProviderRunner {
  return async ({ prompt, temperature, seed, maxOutputTokens, imageBase64 }: LLMRequest) => {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        provider,
        prompt,
        temperature,
        seed,
        maxOutputTokens,
        imageBase64
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data.output as string;
  };
}
