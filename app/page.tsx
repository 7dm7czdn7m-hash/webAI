"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { Button } from "../components/ui/button";
import { cn } from "../components/utils";
import { runOCR } from "../lib/ocr";
import { consolidateRuns } from "../lib/verify";
import { pickWinner } from "../lib/arbiter";
import { getRunner } from "../lib/providers";
import type { TutorPrompt, TutorRun, ArbiterDecision } from "../lib/types";
import { systemPrompt } from "../lib/prompts";

interface HistoryDB extends DBSchema {
  history: {
    key: string;
    value: {
      id: string;
      createdAt: number;
      prompt: string;
      runs: TutorRun[];
      decision: ArbiterDecision;
    };
  };
}

const DB_NAME = "tutor-heavy-history";
const STORE_NAME = "history";

const baseRunPlan = [
  { id: "gemini-1", provider: "gemini-flash", label: "Gemini Flash #1", temperature: 0.4 },
  { id: "gemini-2", provider: "gemini-flash", label: "Gemini Flash #2", temperature: 0.65 },
  { id: "gemini-3", provider: "gemini-flash", label: "Gemini Flash #3", temperature: 0.25 },
  { id: "deepseek", provider: "deepseek-r1", label: "DeepSeek R1", temperature: 0.45 },
  { id: "qwen", provider: "qwen3-max", label: "Qwen3 Max", temperature: 0.35 }
] as const;

type RunPlanItem = (typeof baseRunPlan)[number];

type HistoryItem = HistoryDB["history"]["value"];

export default function TutorHeavyPage() {
  const [promptText, setPromptText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [ocrText, setOcrText] = useState("");
  const [runs, setRuns] = useState<TutorRun[]>([]);
  const [decision, setDecision] = useState<ArbiterDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [includeGrok, setIncludeGrok] = useState(false);
  const [includeOpenRouter, setIncludeOpenRouter] = useState(false);
  const [db, setDb] = useState<IDBPDatabase<HistoryDB> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let isActive = true;
    (async () => {
      const database = await openDB<HistoryDB>(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        }
      });
      if (!isActive) return;
      setDb(database);
      const all = await database.getAll(STORE_NAME);
      if (isActive) {
        setHistory(all.sort((a, b) => b.createdAt - a.createdAt));
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  const plan = useMemo(() => {
    const dynamic: RunPlanItem[] = [...baseRunPlan];
    if (includeOpenRouter) {
      dynamic.push({ id: "openrouter", provider: "openrouter", label: "OpenRouter", temperature: 0.5 });
    }
    if (includeGrok) {
      dynamic.push({ id: "grok", provider: "grok", label: "Grok", temperature: 0.4 });
    }
    return dynamic;
  }, [includeGrok, includeOpenRouter]);

  const handleFile = useCallback(async (file: File) => {
    setImageFile(file);
    setStatus("Запускаем OCR...");
    try {
      const [text, base64] = await Promise.all([runOCR(file), toBase64(file)]);
      setOcrText(text);
      setImageBase64(base64);
      setStatus("OCR завершён");
    } catch (error) {
      console.error(error);
      setStatus("Ошибка OCR");
    }
  }, []);

  const reset = () => {
    setRuns([]);
    setDecision(null);
    setStatus(null);
  };

  const handleRun = useCallback(async () => {
    if (!promptText.trim() && !ocrText.trim()) {
      setStatus("Добавьте текст или изображение");
      return;
    }
    setLoading(true);
    setStatus("Запускаем Tutor Heavy...");
    setRuns([]);
    setDecision(null);
    try {
      const prompt: TutorPrompt = {
        content: buildPrompt(promptText, ocrText)
      };
      const results: TutorRun[] = [];
      await Promise.all(
        plan.map(async (item, index) => {
          const runner = getRunner(item.provider);
          const seed = Math.floor(Math.random() * 1_000_000);
          setStatus(`Модель ${item.label}: запуск...`);
          const runId = `${item.provider}-${seed}`;
          const provisional: TutorRun = {
            id: runId,
            provider: item.label,
            final: "",
            units: "",
            short_reason: "",
            check: "",
            score: 0,
            signals: []
          };
          try {
            const output = await runner({
              prompt: composeLLMPrompt(prompt.content),
              temperature: item.temperature,
              seed,
              maxOutputTokens: 1024,
              imageBase64
            });
            const enriched = consolidateRuns(prompt, output, provisional);
            results[index] = enriched;
            setRuns((prev) => {
              const next = [...prev];
              next[index] = enriched;
              return next;
            });
          } catch (error) {
            const fallback = {
              ...provisional,
              final: "Ошибка",
              short_reason: (error as Error).message ?? "LLM error",
              check: "",
              score: -1,
              signals: ["ошибка вызова"]
            } satisfies TutorRun;
            results[index] = fallback;
            setRuns((prev) => {
              const next = [...prev];
              next[index] = fallback;
              return next;
            });
          }
        })
      );
      const filtered = results.filter(Boolean);
      if (filtered.length === 0) throw new Error("Нет успешных запусков");
      const arbiterDecision = pickWinner(filtered);
      setDecision(arbiterDecision);
      setStatus(arbiterDecision.reason);
        await persistHistory({ prompt: prompt.content, runs: filtered, decision: arbiterDecision }, db, setHistory);
    } catch (error) {
      console.error(error);
      setStatus((error as Error).message ?? "Ошибка выполнения");
    } finally {
      setLoading(false);
    }
  }, [promptText, ocrText, plan, imageBase64, db]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Tutor Heavy</h1>
        <p className="text-sm text-muted-foreground">
          Параллельный решатель: несколько моделей выдают ответы, проверка math.js и выбор лучшего.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-foreground/10 bg-card p-6 shadow-xl shadow-black/40">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Ввод задачи</label>
            <textarea
              className="min-h-[180px] w-full rounded-xl border border-foreground/10 bg-background/40 p-4 text-sm text-foreground outline-none focus:border-foreground/60"
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              placeholder="Вставьте условие задачи..."
            />
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <button
                type="button"
                className="rounded-lg border border-dashed border-foreground/30 px-4 py-2 hover:border-foreground/50"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (file) handleFile(file);
                  };
                  input.click();
                }}
              >
                Загрузить изображение
              </button>
              {imageFile && <span className="truncate">{imageFile.name}</span>}
              {ocrText && <span className="text-emerald-400">OCR готов</span>}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/10 bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Конфигурация прогонов</h2>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeOpenRouter}
                    onChange={(event) => setIncludeOpenRouter(event.target.checked)}
                  />
                  OpenRouter
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeGrok}
                    onChange={(event) => setIncludeGrok(event.target.checked)}
                  />
                  Grok
                </label>
              </div>
            </div>
            <ul className="mt-4 grid gap-3">
              {plan.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">temp {item.temperature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleRun} disabled={loading} className="px-6 py-3 text-base">
              {loading ? "Выполняем..." : "Запустить Heavy"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={loading}>
              Сбросить
            </Button>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>

          <RunsTable runs={runs} loading={loading} />
        </div>

        <aside className="space-y-4">
          <FinalDecision decision={decision} />
          <HistoryBlock history={history} onSelect={(item) => {
            setPromptText(item.prompt);
            setRuns(item.runs);
            setDecision(item.decision);
          }} />
        </aside>
      </section>
    </main>
  );
}

function composeLLMPrompt(content: string): string {
  return `${systemPrompt}\n\nЗадача:\n${content}\n\nПомни: верни только JSON.`;
}

function buildPrompt(text: string, ocr: string): string {
  if (text && ocr) {
    return `${text}\n\n---\n\nOCR:\n${ocr}`;
  }
  return text || ocr;
}

async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

type RunsTableProps = {
  runs: TutorRun[];
  loading: boolean;
};

function RunsTable({ runs, loading }: RunsTableProps) {
  const present = runs.filter((run): run is TutorRun => Boolean(run));
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-6">
      <h2 className="text-lg font-semibold">Прогоны моделей</h2>
      <div className="mt-4 grid gap-3">
        {present.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">Ещё нет запусков.</p>
        )}
        {loading && (
          <p className="text-sm text-muted-foreground">Выполняем запросы…</p>
        )}
        {present.map((run) => (
          <article key={run.id} className="rounded-xl border border-foreground/10 bg-background/40 p-4 text-sm">
            <header className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{run.provider}</span>
              <span>score {run.score}</span>
            </header>
            <dl className="mt-2 space-y-1">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">final</dt>
                <dd className="text-sm font-medium">{run.final}</dd>
              </div>
              {run.units && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">units</dt>
                  <dd>{run.units}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">short reason</dt>
                <dd>{run.short_reason}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">check</dt>
                <dd>{run.check}</dd>
              </div>
              {run.signals.length > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">signals</dt>
                  <dd className="text-xs text-muted-foreground">{run.signals.join(" • ")}</dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

type FinalDecisionProps = {
  decision: ArbiterDecision | null;
};

function FinalDecision({ decision }: FinalDecisionProps) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-6">
      <h2 className="text-lg font-semibold">Итог</h2>
      {!decision ? (
        <p className="mt-3 text-sm text-muted-foreground">Пока нет результатов.</p>
      ) : (
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-400">
            {decision.consensus ? "Консенсус 2/3" : "Лучший по проверке"}
          </p>
          <p className="text-sm font-semibold">{decision.winner.final}</p>
          {decision.winner.units && <p className="text-xs text-muted-foreground">единицы: {decision.winner.units}</p>}
          <p className="text-xs text-muted-foreground">{decision.winner.short_reason}</p>
          <p className="text-xs text-muted-foreground">Проверка: {decision.winner.check}</p>
          <p className="text-xs text-muted-foreground">{decision.reason}</p>
        </div>
      )}
    </div>
  );
}

type HistoryBlockProps = {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
};

function HistoryBlock({ history, onSelect }: HistoryBlockProps) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-6">
      <h2 className="text-lg font-semibold">История</h2>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">История появится после запусков.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {history.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "w-full rounded-xl border border-foreground/10 bg-background/40 p-4 text-left text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  <span>{item.decision.consensus ? "консенсус" : "лучший"}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-foreground">{item.runs[0]?.final ?? "—"}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function persistHistory(
  payload: { prompt: string; runs: TutorRun[]; decision: ArbiterDecision },
  db: IDBPDatabase<HistoryDB> | null,
  setHistory: (items: HistoryItem[]) => void
) {
  if (!db) return;
  const item: HistoryItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    prompt: payload.prompt,
    runs: payload.runs,
    decision: payload.decision
  };
  await db.put(STORE_NAME, item);
  const all = await db.getAll(STORE_NAME);
  setHistory(all.sort((a, b) => b.createdAt - a.createdAt));
}
