import { create, all } from "mathjs";
import { z } from "zod";
import type { TutorPrompt, TutorRun } from "./types";

const math = create(all, {});

const OutputSchema = z.object({
  final: z.string(),
  units: z.string().optional(),
  short_reason: z.string(),
  check: z.string()
});

export type VerificationSignal =
  | { type: "consistency"; passed: boolean; detail: string }
  | { type: "units"; passed: boolean; detail: string }
  | { type: "structure"; passed: boolean; detail: string };

export type VerificationResult = {
  score: number;
  signals: string[];
  normalized: z.infer<typeof OutputSchema>;
};

const numericPattern = /(-?\d+[\d.,]*(?:e[-+]?\d+)?)/i;
const mcqPattern = /\b([A-DА-Д])[).:]/i;
const unitPattern = /([A-Za-zμΩ°/%]+)$/;

export function parseLLMOutput(raw: string): z.infer<typeof OutputSchema> {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Ответ не в JSON");
  }
  const substring = trimmed.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(substring);
  return OutputSchema.parse(parsed);
}

export function verifyOutput(
  prompt: TutorPrompt,
  raw: string
): VerificationResult {
  const normalized = parseLLMOutput(raw);
  const signals: string[] = [];
  let score = 0.25; // базовая уверенность, если JSON корректный

  const final = normalized.final.trim();
  const numericMatch = final.match(numericPattern);
  if (numericMatch) {
    const expression = numericMatch[1]
      .replace(/,/g, "")
      .replace(/\s+/g, "");
    try {
      const numericValue = math.evaluate(expression);
      const recomputed = attemptRecompute(prompt.content);
      if (typeof recomputed === "number") {
        const delta = Math.abs(recomputed - numericValue);
        const tolerance = Math.max(1e-6, Math.abs(recomputed) * 1e-6);
        const passed = delta <= tolerance;
        signals.push(
          passed
            ? `numeric-check: совпало (|Δ|=${delta.toExponential(2)})`
            : `numeric-check: расхождение (|Δ|=${delta.toExponential(2)})`
        );
        score += passed ? 0.5 : -0.15;
      } else {
        signals.push("numeric-check: нет эталона, оставляем как есть");
        score += 0.1;
      }
    } catch (error) {
      signals.push(`numeric-check: не удалось разобрать (${(error as Error).message})`);
      score -= 0.1;
    }
  }

  const mcqMatch = final.match(mcqPattern);
  if (mcqMatch) {
    const option = mcqMatch[1].toUpperCase();
    signals.push(`mcq-choice: вариант ${option}`);
    score += 0.15;
  }

  if (normalized.units) {
    const units = normalized.units.trim();
    const hasUnits = unitPattern.test(units);
    signals.push(
      hasUnits ? `units: ${units}` : "units: формат не распознан"
    );
    score += hasUnits ? 0.1 : -0.05;
  }

  if (normalized.short_reason.length >= 8) {
    score += 0.05;
    signals.push("short_reason: есть краткое обоснование");
  }

  if (normalized.check.length >= 4) {
    score += 0.05;
    signals.push("check: верификация предоставлена");
  }

  return {
    score: Number(score.toFixed(3)),
    signals,
    normalized
  };
}

function attemptRecompute(content: string): number | null {
  const expressionLines = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /[=<>]/.test(line) || /\d/.test(line));
  for (const line of expressionLines.reverse()) {
    const cleaned = line.replace(/^[^:=]*[:=]/, "").trim();
    if (!cleaned) continue;
    try {
      const result = math.evaluate(cleaned);
      if (typeof result === "number") {
        return result;
      }
    } catch (error) {
      if ((error as Error).message.includes("Undefined symbol")) {
        continue;
      }
    }
  }
  return null;
}

export function consolidateRuns(prompt: TutorPrompt, raw: string, run: TutorRun): TutorRun {
  const verification = verifyOutput(prompt, raw);
  return {
    ...run,
    final: verification.normalized.final,
    units: verification.normalized.units,
    short_reason: verification.normalized.short_reason,
    check: verification.normalized.check,
    score: verification.score,
    signals: verification.signals
  };
}
