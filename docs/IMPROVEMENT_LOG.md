# Improvement log

## 2026-11-15, cycle 1

Baseline: 22 tests pass on main (aa27624). Lint and `tsc --noEmit` are clean.

### Done this cycle (branches awaiting review, not merged)

| Item | Branch | Commit | Result |
|---|---|---|---|
| Citation markers like `[1, 2]` were ignored (lib/rag.ts:29). Bug fix, behaviour change: `[1, 2]` is now accepted. Ranges like `[1-2]` are still not accepted. Any bracketed number list in the answer text now counts as citations. | fix/citation-multi-marker | 478e07d | lint and tsc clean |
| Tests for the refusal branches of `ask`. Tests only, no behaviour change. | test/ask-refusals | 2bc2fa0 | tests 22 to 26 |
| README deploy note said to ship an index that is git-ignored (README.md:73). Docs only, no behaviour change. | docs/deploy-index-note | 628bd4d | README.md:73 only |

Each branch holds one commit on top of main.

### Not verified

- The live model path (no real model call was made).
- `npm run build`.
- The eval script.
- The `/api/ask` route end to end.

### Backlog, top 5 not yet done

1. One request can hold a worker for minutes (lib/llm.ts:8, lib/llm.ts:84-93, lib/rag.ts:39 and 54, no maxDuration in app/). Each model call allows 3 attempts with backoff, and a question makes two calls. Effort M, risk medium. Changes behaviour.
2. Failed requests still use the daily cap (app/api/ask/route.ts:52 counts, :65-67 is the 500 path, tests/daily.test.ts:12-19 covers only the 400 case). Effort S, risk low. Changes behaviour.
3. Rate limit edge cases: shared "unknown" bucket and key eviction (lib/ratelimit.ts:37, lib/ratelimit.ts:17, README.md:132). Effort M, risk medium. Changes behaviour.
4. Prompt assembly does not escape passage attributes or fence the question (lib/llm.ts:68, lib/llm.ts:73). Effort S, risk low. Changes the prompt text, which cannot be tested offline.
5. The offline eval is not part of CI (.github/workflows/ci.yml:21-23, scripts/eval.ts:21-76 never exits non-zero). Effort M, risk low.

### Diagrams

Diagrams live on the `docs/diagrams` branch, in `docs/diagrams/` (architecture.md, ask-flow.md, data-model.md, ingest-flow.md). They are not on main.

### Lessons

- The new citation matcher is wider than before. It counts any bracketed number list, so it may count a list that is not a citation. Ranges are the known gap.
- The fixture provider only writes single markers (lib/llm.ts:172), so the offline tests cannot show how a real model writes citations. That is why the live path stays unchecked.

### Status

All branches are local. Nothing is pushed or merged. They await the owner's approval.
