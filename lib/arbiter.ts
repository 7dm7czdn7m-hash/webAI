import type { TutorRun, ArbiterDecision } from "./types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-я0-9.,+-]/gi, "")
    .trim();
}

export function pickWinner(runs: TutorRun[]): ArbiterDecision {
  if (runs.length === 0) {
    throw new Error("Нет прогонов для выбора");
  }

  const grouped = new Map<string, TutorRun[]>();
  for (const run of runs) {
    const key = normalize(run.final);
    const bucket = grouped.get(key) ?? [];
    bucket.push(run);
    grouped.set(key, bucket);
  }

  let consensusRun: TutorRun | null = null;
  for (const [, bucket] of grouped) {
    if (bucket.length >= 2) {
      bucket.sort((a, b) => b.score - a.score);
      consensusRun = bucket[0];
      break;
    }
  }

  if (consensusRun) {
    return {
      winner: consensusRun,
      consensus: true,
      reason: "2 из 3 решений сошлись"
    };
  }

  const [best] = [...runs].sort((a, b) => b.score - a.score);
  return {
    winner: best,
    consensus: false,
    reason: "выбрано по наилучшему score"
  };
}
