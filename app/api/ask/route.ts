import { MAX_BODY_BYTES, dailyLimit, MAX_QUESTION_CHARS, MIN_QUESTION_CHARS, rateLimitPerMinute } from "@/lib/config";
import { ask, getEngine } from "@/lib/rag";
import { clientKey, dailyCap, rateLimit } from "@/lib/ratelimit";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

// reads the body but stops as soon as it passes the cap, so a chunked upload cannot fill memory
async function readCapped(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString("utf8");
}

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req), rateLimitPerMinute());
  if (!limit.ok)
    return json({ error: "Too many questions. Try again shortly." }, 429, {
      "Retry-After": String(limit.retryAfterSec),
    });

  if (!dailyCap(dailyLimit())) return json({ error: "Daily question limit reached. Try again tomorrow." }, 429, { "Retry-After": "3600" });

  // reject oversized bodies: check the declared size, then count bytes while reading
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);
  const raw = await readCapped(req, MAX_BODY_BYTES);
  if (raw === null) return json({ error: "Request too large." }, 413);

  let question: unknown;
  try {
    question = (JSON.parse(raw) as { question?: unknown }).question;
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  if (typeof question !== "string") return json({ error: "Field 'question' must be a string." }, 400);
  const q = question.trim();
  if (q.length < MIN_QUESTION_CHARS || q.length > MAX_QUESTION_CHARS)
    return json({ error: `Question must be ${MIN_QUESTION_CHARS}-${MAX_QUESTION_CHARS} characters.` }, 400);

  try {
    const { provider, db } = getEngine();
    const r = await ask(q, provider, db);
    // `retrieved` is for eval/debugging and is not sent to the browser
    return json({
      answer: r.answer,
      refused: r.refused,
      citations: r.citations,
      topScore: r.topScore,
      provider: r.provider,
    });
  } catch (e) {
    console.error("ask failed:", e instanceof Error ? e.message : e); // message only: never log the key or request headers
    return json({ error: "Could not answer right now. See the server log." }, 500);
  }
}
