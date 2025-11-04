import { NextResponse } from "next/server";
import { systemPrompt } from "../../../lib/prompts";

type Payload = {
  provider: string;
  prompt: string;
  temperature: number;
  seed: number;
  maxOutputTokens?: number;
  imageBase64?: string;
};

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Payload;
    const output = await dispatch(body);
    return NextResponse.json({ output });
  } catch (error) {
    console.error(error);
    return new NextResponse((error as Error).message ?? "LLM error", { status: 500 });
  }
}

async function dispatch(payload: Payload): Promise<string> {
  const { provider } = payload;
  switch (provider) {
    case "gemini-flash":
      return callGemini(payload);
    case "deepseek-r1":
      return callDeepSeek(payload);
    case "qwen3-max":
      return callQwen(payload);
    case "openrouter":
      return callOpenRouter(payload);
    case "grok":
      return callGrok(payload);
    default:
      throw new Error(`Неизвестный провайдер: ${provider}`);
  }
}

function buildUserContent(prompt: string, imageBase64?: string) {
  if (!imageBase64) {
    return [{ type: "text", text: prompt }];
  }
  return [
    { type: "text", text: prompt },
    { type: "input_image", image_base64: imageBase64 }
  ];
}

async function callDeepSeek({ prompt, temperature, seed, maxOutputTokens, imageBase64 }: Payload) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY не задан");
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "deepseek-reasoner",
      temperature,
      seed,
      reasoning: { effort: "medium" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(prompt, imageBase64) }
      ],
      max_tokens: maxOutputTokens ?? 1024
    })
  });
  if (!response.ok) {
    throw new Error(`DeepSeek: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const choice = data.choices?.[0]?.message?.content;
  if (!choice) throw new Error("DeepSeek: пустой ответ");
  return typeof choice === "string" ? choice : JSON.stringify(choice);
}

async function callQwen({ prompt, temperature, seed, maxOutputTokens, imageBase64 }: Payload) {
  const key = process.env.QWEN_API_KEY;
  if (!key) throw new Error("QWEN_API_KEY не задан");
  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "qwen3-max-instruct",
      temperature,
      seed,
      reasoning: { effort: "medium" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(prompt, imageBase64) }
      ],
      max_tokens: maxOutputTokens ?? 1024
    })
  });
  if (!response.ok) {
    throw new Error(`Qwen: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const choice = data.choices?.[0]?.message?.content;
  if (!choice) throw new Error("Qwen: пустой ответ");
  return typeof choice === "string" ? choice : JSON.stringify(choice);
}

async function callGemini({ prompt, temperature, seed, maxOutputTokens, imageBase64 }: Payload) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY не задан");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: buildGeminiParts(prompt, imageBase64)
        }
      ],
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature,
        maxOutputTokens: maxOutputTokens ?? 1024,
        candidateCount: 1,
        seed
      },
      safetySettings: []
    })
  });
  if (!response.ok) {
    throw new Error(`Gemini: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) throw new Error("Gemini: пустой ответ");
  return candidate;
}

function buildGeminiParts(prompt: string, imageBase64?: string) {
  if (!imageBase64) {
    return [{ text: prompt }];
  }
  return [
    { text: prompt },
    {
      inlineData: {
        data: imageBase64,
        mimeType: "image/png"
      }
    }
  ];
}

async function callOpenRouter({ prompt, temperature, seed, maxOutputTokens, imageBase64 }: Payload) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY не задан");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://tutor-heavy.example",
      "X-Title": "Tutor Heavy"
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      temperature,
      seed,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(prompt, imageBase64) }
      ],
      max_tokens: maxOutputTokens ?? 1024
    })
  });
  if (!response.ok) {
    throw new Error(`OpenRouter: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const choice = data.choices?.[0]?.message?.content;
  if (!choice) throw new Error("OpenRouter: пустой ответ");
  return typeof choice === "string" ? choice : JSON.stringify(choice);
}

async function callGrok({ prompt, temperature, seed, maxOutputTokens, imageBase64 }: Payload) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY не задан");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "grok-beta",
      temperature,
      seed,
      reasoning: { effort: "medium" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(prompt, imageBase64) }
      ],
      max_tokens: maxOutputTokens ?? 1024
    })
  });
  if (!response.ok) {
    throw new Error(`Grok: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const choice = data.choices?.[0]?.message?.content;
  if (!choice) throw new Error("Grok: пустой ответ");
  return typeof choice === "string" ? choice : JSON.stringify(choice);
}
