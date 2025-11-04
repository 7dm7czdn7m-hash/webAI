import { describe, expect, it } from "vitest";
import { verifyOutput } from "../lib/verify";

const prompt = { content: "2+2" };

describe("verifyOutput", () => {
  it("parses correct JSON and rewards numeric match", () => {
    const raw = '{"final":"4","units":"","short_reason":"Сложение","check":"подстановка"}';
    const result = verifyOutput(prompt, raw);
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.signals.some((signal) => signal.includes("numeric-check"))).toBe(true);
  });

  it("penalizes invalid json", () => {
    const raw = 'не json';
    expect(() => verifyOutput(prompt, raw)).toThrow();
  });
});
