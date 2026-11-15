# Ingest flow

What `npm run ingest` does: read the pages, chunk them, embed them, and write a fresh index.

```mermaid
sequenceDiagram
  actor Dev
  participant Ingest as scripts/ingest.ts
  participant Chunk as lib/chunk.ts
  participant LLM as lib/llm.ts provider
  participant Store as lib/store.ts
  participant DB as data/index.provider.db

  Dev->>Ingest: npm run ingest
  Ingest->>LLM: getProvider(name)
  loop each .md file in data/docs
    Ingest->>Chunk: parseDoc(id, raw)
    Chunk-->>Ingest: Doc
    Ingest->>Chunk: chunkDoc(doc)
    Chunk-->>Ingest: Chunk list
  end
  Ingest->>LLM: embed(chunks.map(embedText), "doc")
  LLM-->>Ingest: vectors
  Ingest->>DB: rmSync old file
  Ingest->>Store: createStore(path, dim, name)
  Store->>DB: create meta, chunks, vec tables
  Ingest->>Store: addChunks(db, chunks, vectors)
  Store->>DB: insert rows in one transaction
  Ingest-->>Dev: wrote index
```

With `--dry-run` the script sets `LLM_PROVIDER=fixture` first. Files named `LICENSE*` are skipped.

Sources: [scripts/ingest.ts](../../scripts/ingest.ts), [lib/chunk.ts](../../lib/chunk.ts), [lib/llm.ts](../../lib/llm.ts), [lib/store.ts](../../lib/store.ts).
