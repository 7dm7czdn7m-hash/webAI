import { describe, expect, it } from "vitest";
import { pickWinner } from "../lib/arbiter";
import type { TutorRun } from "../lib/types";

describe("pickWinner", () => {
  const baseRun = (final: string, score: number): TutorRun => ({
    id: crypto.randomUUID(),
    provider: "test",
    final,
    units: "",
    short_reason: "",
    check: "",
    score,
    signals: []
  });

  it("prefers consensus", () => {
    const runs = [baseRun("5", 0.9), baseRun("5", 0.7), baseRun("6", 0.95)];
    const decision = pickWinner(runs);
    expect(decision.consensus).toBe(true);
    expect(decision.winner.final).toBe("5");
  });

  it("falls back to highest score", () => {
    const runs = [baseRun("1", 0.5), baseRun("2", 0.6), baseRun("3", 0.8)];
    const decision = pickWinner(runs);
    expect(decision.consensus).toBe(false);
    expect(decision.winner.final).toBe("3");
  });
});
