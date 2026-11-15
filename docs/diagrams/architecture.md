# Architecture

Components of the app and what each one calls. Arrows point from caller to callee.

```mermaid
flowchart LR
  subgraph Browser
    page["app/page.tsx<br/>chat page"]
  end
  subgraph Server["Next.js server"]
    route["app/api/ask/route.ts<br/>POST handler"]
    ratelimit["lib/ratelimit.ts<br/>rateLimit, dailyCap, clientKey"]
    rag["lib/rag.ts<br/>ask, getEngine, citedPassages"]
    config["lib/config.ts<br/>limits, TOP_K, REFUSAL, minScore"]
  end
  subgraph Libs["Shared libs"]
    llm["lib/llm.ts<br/>getProvider"]
    store["lib/store.ts<br/>search, addChunks, createStore"]
    chunk["lib/chunk.ts<br/>parseDoc, chunkDoc, embedText"]
  end
  subgraph Scripts["npm scripts"]
    ingest["scripts/ingest.ts"]
    askcli["scripts/ask.ts"]
    evalcli["scripts/eval.ts"]
  end
  docs[("data/docs/*.md")]
  index[("data/index.provider.db<br/>SQLite + sqlite-vec")]
  gemini["Gemini API<br/>@google/genai"]
  fixture["fixture provider<br/>offline, in lib/llm.ts"]

  page -->|"POST /api/ask"| route
  route --> ratelimit
  route --> rag
  route --> config
  rag --> llm
  rag --> store
  rag --> config
  llm --> gemini
  llm --> fixture
  store --> index
  ingest --> chunk
  ingest --> llm
  ingest --> store
  ingest --> docs
  askcli --> rag
  evalcli --> rag
```

Sources: [app/page.tsx](../../app/page.tsx), [app/api/ask/route.ts](../../app/api/ask/route.ts), [lib/rag.ts](../../lib/rag.ts), [lib/llm.ts](../../lib/llm.ts), [lib/store.ts](../../lib/store.ts), [lib/chunk.ts](../../lib/chunk.ts), [lib/ratelimit.ts](../../lib/ratelimit.ts), [lib/config.ts](../../lib/config.ts), [scripts/ingest.ts](../../scripts/ingest.ts), [scripts/ask.ts](../../scripts/ask.ts), [scripts/eval.ts](../../scripts/eval.ts).
