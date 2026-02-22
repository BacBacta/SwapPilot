"use client";

import { useState, useCallback } from "react";
import { parseIntent, type ParseIntentResult, type ApiError } from "@/lib/api";

type Props = {
  onResult: (result: ParseIntentResult) => void;
  disabled?: boolean;
};

function confidenceBadge(c: number): string {
  if (c >= 0.8) return "🟢";
  if (c >= 0.5) return "🟡";
  return "🔴";
}

export function IntentInput({ onResult, disabled }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ParseIntentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await parseIntent(text);
      setResult(res);
      setStatus("success");
      onResult(res);
    } catch (err) {
      const e = err as ApiError;
      if (e?.status === 501) {
        setErrorMsg("Feature temporairement indisponible (Intent Solver désactivé côté serveur).");
      } else {
        setErrorMsg(e?.message ?? "Erreur lors de l'analyse. Réessayez.");
      }
      setStatus("error");
    }
  }, [text, onResult]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-end">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder='ex : "Swap 0.5 BNB pour USDT avec 1% de slippage"'
          disabled={disabled || status === "loading"}
          className="flex-1 rounded-2xl border border-sp-border bg-sp-surface2 px-4 py-3 text-sm text-sp-text placeholder:text-sp-muted resize-none focus:outline-none focus:ring-2 focus:ring-sp-accent/50 disabled:opacity-50 transition"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleParse();
            }
          }}
        />
        <button
          onClick={handleParse}
          disabled={disabled || status === "loading" || !text.trim()}
          className="shrink-0 rounded-2xl bg-sp-accent px-4 py-3 text-sm font-semibold text-black disabled:opacity-40 hover:bg-sp-accent/90 active:scale-95 transition"
        >
          {status === "loading" ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              …
            </span>
          ) : (
            "Analyser"
          )}
        </button>
      </div>

      {status === "success" && result && (
        <div className="rounded-2xl border border-sp-border bg-sp-surface2 px-4 py-3 text-xs text-sp-muted">
          <span className="mr-1">{confidenceBadge(result.confidence)}</span>
          <span className="font-semibold text-sp-text">
            Confiance {Math.round(result.confidence * 100)}%
          </span>
          {" — "}
          {result.explanation}
          {result.clarifications && result.clarifications.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.clarifications.map((c, i) => (
                <li key={i} className="text-yellow-400">
                  ⚠ {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === "error" && (
        <p className="px-1 text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
