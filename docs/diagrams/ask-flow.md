# Ask flow

## Request sequence

One question from the browser to an answer with citations, or a refusal.

```mermaid
sequenceDiagram
  actor User
  participant Page as app/page.tsx
  participant Route as app/api/ask/route.ts
  participant RL as lib/ratelimit.ts
  participant Rag as lib/rag.ts
  participant LLM as lib/llm.ts provider
  participant Store as lib/store.ts

  User->>Page: type question
  Page->>Route: POST /api/ask
  Route->>RL: rateLimit(clientKey, perMinute)
  RL-->>Route: ok or 429
  Route->>Route: check body size and question length
  Route->>RL: dailyCap(dailyLimit)
  RL-->>Route: ok or 429
  Route->>Rag: getEngine()
  Route->>Rag: ask(question, provider, db)
  Rag->>LLM: embed([question], "query")
  LLM-->>Rag: query vector
  Rag->>Store: search(db, vector, TOP_K)
  Store-->>Rag: hits with cosine score
  alt top score below threshold
    Rag-->>Route: REFUSAL, no model call
  else score ok
    Rag->>LLM: answer(question, passages)
    LLM-->>Rag: text with [n] markers
    Rag->>Rag: citedPassages(text, passages)
    Rag-->>Route: answer and cited passages, or REFUSAL
  end
  Route-->>Page: JSON answer, refused, citations, topScore, provider
  Page-->>User: show answer or refusal
```

## Decisions inside ask()

How `ask()` ends in an answer or a refusal.

```mermaid
flowchart TD
  A[embed question] --> B[search top TOP_K chunks]
  B --> C{top score below threshold?}
  C -->|yes| R[refuse: REFUSAL, citations empty]
  C -->|no| D[provider.answer]
  D --> E{empty text or contains REFUSAL?}
  E -->|yes| R
  E -->|no| F[citedPassages: keep passages cited as n]
  F --> G{any valid citation?}
  G -->|no| R
  G -->|yes| OK[return answer with cited passages]
```

The threshold comes from `minScore(provider.name)`: 0.3 for fixture, 0.6 for gemini, or `RAG_MIN_SCORE` if set.

Sources: [app/page.tsx](../../app/page.tsx), [app/api/ask/route.ts](../../app/api/ask/route.ts), [lib/rag.ts](../../lib/rag.ts), [lib/ratelimit.ts](../../lib/ratelimit.ts), [lib/config.ts](../../lib/config.ts), [lib/llm.ts](../../lib/llm.ts), [lib/store.ts](../../lib/store.ts).
