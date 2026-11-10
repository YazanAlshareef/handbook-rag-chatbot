// Vector store: one SQLite file. Rows in `chunks`, vectors in a sqlite-vec `vec0` table.
import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import type { Chunk } from "./chunk";

export type Hit = Chunk & { id: number; score: number };

function load(path: string, readOnly: boolean): DatabaseSync {
  const db = new DatabaseSync(path, { allowExtension: true, readOnly });
  sqliteVec.load(db);
  return db;
}

export function openStore(path: string): DatabaseSync {
  return load(path, true);
}

export function createStore(path: string, dim: number, provider: string): DatabaseSync {
  if (!Number.isInteger(dim) || dim <= 0) throw new Error("bad dimension");
  const db = load(path, false);
  db.exec(`
    create table meta(key text primary key, value text);
    create table chunks(id integer primary key, doc_id text, doc_title text, section text, text text);
    create virtual table vec using vec0(embedding float[${dim}] distance_metric=cosine);
  `);
  const m = db.prepare("insert into meta values (?, ?)");
  m.run("provider", provider);
  m.run("dim", String(dim));
  return db;
}

const bytes = (v: number[]) => new Uint8Array(new Float32Array(v).buffer);

export function addChunks(db: DatabaseSync, chunks: Chunk[], vectors: number[][]): void {
  if (chunks.length !== vectors.length) throw new Error("chunks and vectors differ in length");
  const addChunk = db.prepare("insert into chunks values (?, ?, ?, ?, ?)");
  const addVec = db.prepare("insert into vec(rowid, embedding) values (?, ?)");
  db.exec("begin");
  try {
    chunks.forEach((c, i) => {
      const id = BigInt(i + 1); // vec0 wants integer rowids passed as BigInt
      addChunk.run(id, c.docId, c.docTitle, c.section, c.text);
      addVec.run(id, bytes(vectors[i]));
    });
    db.exec("commit");
  } catch (e) {
    db.exec("rollback");
    throw e;
  }
}

export function getMeta(db: DatabaseSync, key: string): string | undefined {
  const row = db.prepare("select value from meta where key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

// score = cosine similarity (1 - cosine distance), best first
export function search(db: DatabaseSync, query: number[], k: number): Hit[] {
  const rows = db
    .prepare("select rowid, distance from vec where embedding match ? and k = ? order by distance")
    .all(bytes(query), k) as { rowid: number | bigint; distance: number }[];
  const get = db.prepare("select * from chunks where id = ?");
  return rows.map((r) => {
    const c = get.get(r.rowid) as { id: number; doc_id: string; doc_title: string; section: string; text: string };
    return { id: c.id, docId: c.doc_id, docTitle: c.doc_title, section: c.section, text: c.text, score: 1 - r.distance };
  });
}
