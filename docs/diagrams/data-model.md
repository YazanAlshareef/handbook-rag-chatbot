# Data model

The three tables in the SQLite index file. `vec` is a sqlite-vec `vec0` virtual table. Its rowid equals `chunks.id`. There is no declared foreign key.

```mermaid
erDiagram
  chunks ||--|| vec : "same rowid"
  meta {
    text key PK
    text value
  }
  chunks {
    integer id PK
    text doc_id
    text doc_title
    text section
    text text
  }
  vec {
    integer rowid
    float_array embedding
  }
```

`meta` holds the keys `provider` and `dim`. `getEngine()` checks them against the active provider before it serves questions. The embedding uses cosine distance.

Sources: [lib/store.ts](../../lib/store.ts), [lib/rag.ts](../../lib/rag.ts).
