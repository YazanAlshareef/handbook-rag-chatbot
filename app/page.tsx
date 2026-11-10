"use client";

import { useEffect, useRef, useState } from "react";

type Citation = { n: number; docId: string; docTitle: string; section: string; text: string; score: number };
type Reply = { answer: string; refused: boolean; citations: Citation[]; topScore: number; provider: "fixture" | "gemini" };
type Turn = { id: number; question: string; reply?: Reply; error?: string };

const SUGGESTIONS = [
  "How many hours of advanced sick leave can I request?",
  "How often must I change my ENT password?",
  "Who can earn credit hours?",
  "What is the parking policy at GSA buildings?",
];

export default function Page() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  async function submit(text: string) {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question }]);
    setValue("");
    setBusy(true);
    let patch: Partial<Turn>;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      patch = res.ok ? { reply: data as Reply } : { error: data.error ?? "Something went wrong." };
    } catch {
      patch = { error: "Could not reach the server." };
    }
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setBusy(false);
    input.current?.focus();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5">
      <header className="border-b-2 border-ink pt-10 pb-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-soft">Ask a document set</p>
        <h1 className="text-5xl font-semibold leading-none tracking-tight">
          Ask the <span className="text-accent italic">Handbook</span>
        </h1>
        <p className="mt-3 max-w-xl text-soft">
          Answers come only from the handbook pages, with the passage shown. If the pages do not say, it tells you so.
        </p>
      </header>

      <main className="flex-1 py-6">
        <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-8">
          {turns.length === 0 && (
            <div>
              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-soft">Try one</p>
              <ul className="flex flex-col items-start gap-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => submit(s)}
                      className="border border-rule bg-paper-2 px-3 py-2 text-left hover:border-accent"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {turns.map((t) => (
            <article key={t.id}>
              <h2 className="text-xl font-semibold">{t.question}</h2>
              {!t.reply && !t.error && <p className="mt-2 font-mono text-sm text-soft">Searching the handbook…</p>}
              {t.error && (
                <p role="alert" className="mt-2 border-l-4 border-accent pl-3">
                  {t.error}
                </p>
              )}
              {t.reply && <ReplyView reply={t.reply} />}
            </article>
          ))}
          <div ref={end} />
        </div>
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="sticky bottom-0 border-t-2 border-ink bg-paper py-4"
      >
        <label htmlFor="q" className="mb-1 block font-mono text-xs uppercase tracking-widest text-soft">
          Your question
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setValue("");
            }}
            maxLength={500}
            autoComplete="off"
            placeholder="e.g. How many weeks of FMLA leave?"
            className="min-w-0 flex-1 border-2 border-ink bg-paper-2 px-3 py-2 text-lg placeholder:text-soft"
          />
          <button
            type="submit"
            disabled={busy}
            className="border-2 border-ink bg-ink px-5 py-2 font-semibold text-paper disabled:opacity-50"
          >
            {busy ? "…" : "Ask"}
          </button>
        </div>
        <p className="mt-2 font-mono text-xs text-soft">
          <kbd>Enter</kbd> ask · <kbd>Ctrl</kbd>+<kbd>K</kbd> focus · <kbd>Esc</kbd> clear
        </p>
      </form>

      <footer className="border-t border-rule py-4 font-mono text-xs text-soft">
        Corpus: GSA-TTS handbook, US government work, public domain (CC0 1.0).
      </footer>
    </div>
  );
}

function ReplyView({ reply }: { reply: Reply }) {
  return (
    <div className="mt-2">
      {reply.refused ? (
        <p className="border-l-4 border-accent bg-paper-2 py-2 pl-3 italic">
          <span className="font-mono text-xs not-italic uppercase tracking-widest text-accent">No answer · </span>
          {reply.answer}
        </p>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-lg leading-relaxed">{reply.answer}</p>
          <ol className="mt-4 space-y-2">
            {reply.citations.map((c) => (
              <li key={c.n}>
                <details className="border border-rule bg-paper-2">
                  <summary className="cursor-pointer px-3 py-2">
                    <span className="mr-2 inline-block bg-ink px-1.5 font-mono text-sm text-paper">{c.n}</span>
                    {c.docTitle} <span className="text-soft">› {c.section}</span>
                  </summary>
                  <p className="border-t border-rule px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">{c.text}</p>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-2 font-mono text-xs text-soft">
        {reply.provider === "fixture" ? "offline demo (no model key)" : "gemini"} · best match {reply.topScore.toFixed(2)}
      </p>
    </div>
  );
}
