const NARRATIVE_KEYS = ["strengths", "weaknesses", "opportunities", "keyTakeaways"];
const DIRECT_TRANSCRIPT_CHAR_LIMIT = 18000;
const CHUNK_SIZE = 14000;
const CHUNK_OVERLAP = 1200;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 8;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors = getCorsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return jsonResponse({ message: "Method not allowed." }, 405, cors);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ message: "Server misconfigured: missing GEMINI_API_KEY." }, 500, cors);
    }

    const rateLimitResult = await enforceRateLimit(request, env);
    if (!rateLimitResult.ok) {
      return jsonResponse(
        { message: "Rate limit exceeded. Please retry in about a minute." },
        429,
        cors
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonResponse({ message: "Invalid JSON body." }, 400, cors);
    }

    const turnstileOk = await verifyTurnstile(body.turnstileToken, request, env);
    if (!turnstileOk) {
      return jsonResponse({ message: "Verification failed. Complete challenge and retry." }, 403, cors);
    }

    const context = normalizeContext(body.context || {});
    const transcript = normalizeTranscript(body.transcript || {});
    const existingNarratives = normalizeNarratives(body.existingNarratives || {});
    const options = normalizeOptions(body.options || {});

    if (!transcript.text) {
      return jsonResponse({ message: "Transcript text is required." }, 400, cors);
    }

    if (!options.targetKeys.length) {
      return jsonResponse({ message: "No target narrative keys were supplied." }, 400, cors);
    }

    try {
      const notes = await buildStructuredNotes(transcript.text, env);
      const rawDrafts = await generateNarrativeDrafts({
        env,
        context,
        notes,
        existingNarratives,
        options,
      });

      const drafts = enforceDraftShape(rawDrafts, options.maxChars);
      const filteredDrafts = filterToTargetKeys(drafts, options.targetKeys);

      return jsonResponse(
        {
          drafts: filteredDrafts,
          meta: {
            transcriptChars: transcript.text.length,
            targetKeys: options.targetKeys,
            maxChars: options.maxChars,
            mode: options.mode,
          },
        },
        200,
        cors
      );
    } catch (error) {
      console.error("Draft generation error:", error);
      const message = String(error?.message || "Unknown generation error.").slice(0, 240);
      return jsonResponse({ message }, 500, cors);
    }
  },
};

function getCorsHeaders(env, origin) {
  const allowedOrigin = String(env.ALLOWED_ORIGIN || "*").trim() || "*";
  const originHeader = resolveAllowedOrigin(origin, allowedOrigin);
  return {
    "Access-Control-Allow-Origin": originHeader,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function resolveAllowedOrigin(requestOrigin, allowedOrigin) {
  if (allowedOrigin === "*") return "*";
  if (!requestOrigin) return allowedOrigin;
  return requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;
}

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders,
  });
}

function normalizeContext(input) {
  return {
    studentName: String(input.studentName || "").trim(),
    satAct: String(input.satAct || "").trim(),
    gpa: String(input.gpa || "").trim(),
    targetSchool: String(input.targetSchool || "").trim(),
    reader1: String(input.reader1 || "").trim(),
    reader2: String(input.reader2 || "").trim(),
    reader3: String(input.reader3 || "").trim(),
  };
}

function normalizeTranscript(input) {
  return {
    fileName: String(input.fileName || "").trim(),
    text: String(input.text || "").replace(/\r\n/g, "\n").trim(),
  };
}

function normalizeNarratives(input) {
  const value = {};
  for (const key of NARRATIVE_KEYS) {
    value[key] = String(input[key] || "").trim();
  }
  return value;
}

function normalizeOptions(input) {
  const maxCharsCandidate = Number(input.maxChars);
  const maxChars = Number.isFinite(maxCharsCandidate) && maxCharsCandidate > 0
    ? Math.floor(maxCharsCandidate)
    : 500;
  const targetKeys = Array.isArray(input.targetKeys)
    ? input.targetKeys.filter((key) => NARRATIVE_KEYS.includes(key))
    : [];
  const mode = String(input.mode || "fill_empty_only").trim() || "fill_empty_only";

  return {
    maxChars,
    targetKeys,
    mode,
  };
}

async function enforceRateLimit(request, env) {
  if (!env.RATE_LIMIT_KV) return { ok: true };
  const limit = Number(env.RATE_LIMIT_PER_MINUTE) || DEFAULT_RATE_LIMIT_PER_MINUTE;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const windowStart = Math.floor(Date.now() / 60000);
  const key = `rl:${ip}:${windowStart}`;

  const currentRaw = await env.RATE_LIMIT_KV.get(key);
  const current = Number(currentRaw || "0");
  if (current >= limit) {
    return { ok: false };
  }

  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 120 });
  return { ok: true };
}

async function verifyTurnstile(token, request, env) {
  const secret = String(env.TURNSTILE_SECRET || "").trim();
  if (!secret) return true;
  if (!token) return false;

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", String(token));
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) {
    formData.append("remoteip", ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => ({}));
  return Boolean(data.success);
}

async function buildStructuredNotes(transcriptText, env) {
  if (transcriptText.length <= DIRECT_TRANSCRIPT_CHAR_LIMIT) {
    return summarizeChunk(transcriptText, env, 1, 1);
  }

  const chunks = chunkTranscript(transcriptText, CHUNK_SIZE, CHUNK_OVERLAP);
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const summary = await summarizeChunk(chunks[i], env, i + 1, chunks.length);
    chunkSummaries.push(summary);
  }

  const mergePrompt = [
    "You are merging partial notes from a Zoom admissions-prep discussion.",
    "Return strict JSON only with keys:",
    "strengthSignals, weaknessSignals, opportunitySignals, keyActionItems, notableConstraints, confidenceNotes.",
    "Each key should be an array of concise strings.",
    "",
    `Chunk summaries JSON: ${JSON.stringify(chunkSummaries)}`,
  ].join("\n");

  const merged = await callGeminiJson(env, mergePrompt, 0.2);
  return merged;
}

async function summarizeChunk(chunkText, env, chunkIndex, totalChunks) {
  const prompt = [
    "You are analyzing part of a Zoom transcript to help draft admissions committee review notes.",
    `This is chunk ${chunkIndex} of ${totalChunks}.`,
    "Return strict JSON only with keys:",
    "strengthSignals, weaknessSignals, opportunitySignals, keyActionItems, notableConstraints, confidenceNotes.",
    "Each key should be an array of concise strings (max 12 items each).",
    "Use only evidence from transcript. Do not invent facts.",
    "",
    `Transcript chunk:\n${chunkText}`,
  ].join("\n");

  return callGeminiJson(env, prompt, 0.2);
}

async function generateNarrativeDrafts({ env, context, notes, existingNarratives, options }) {
  const prompt = [
    "You are drafting admissions committee review content for human editors.",
    "Return strict JSON only, with exactly these keys:",
    "strengths, weaknesses, opportunities, keyTakeaways.",
    `Each value must be plain text, max ${options.maxChars} characters, no markdown.`,
    "Use concise professional tone. Prioritize clarity and actionable language.",
    "Do not repeat boilerplate.",
    "",
    `Student Context JSON: ${JSON.stringify(context)}`,
    `Existing Narrative JSON: ${JSON.stringify(existingNarratives)}`,
    `Structured Notes JSON: ${JSON.stringify(notes)}`,
    `Target keys to fill: ${JSON.stringify(options.targetKeys)}`,
    "For non-target keys, return an empty string.",
  ].join("\n");

  return callGeminiJson(env, prompt, 0.35);
}

async function callGeminiJson(env, prompt, temperature = 0.3) {
  const model = String(env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || `Gemini request failed (${response.status}).`;
    throw new Error(detail);
  }

  const text = extractGeminiText(payload);
  const parsed = parseLooseJson(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini returned non-JSON output.");
  }
  return parsed;
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const first = candidates[0];
  const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];
  const textParts = parts
    .map((part) => String(part?.text || ""))
    .filter(Boolean);
  return textParts.join("\n").trim();
}

function parseLooseJson(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    // continue
  }

  const stripped = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (_error) {
    // continue
  }

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = stripped.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function enforceDraftShape(rawDrafts, maxChars) {
  const output = {};
  for (const key of NARRATIVE_KEYS) {
    output[key] = String(rawDrafts?.[key] || "").trim().slice(0, maxChars);
  }
  return output;
}

function filterToTargetKeys(drafts, targetKeys) {
  const target = new Set(targetKeys);
  const output = {};
  for (const key of NARRATIVE_KEYS) {
    output[key] = target.has(key) ? String(drafts[key] || "") : "";
  }
  return output;
}

function chunkTranscript(text, size, overlap) {
  const safeText = String(text || "");
  if (!safeText) return [];

  const chunks = [];
  let cursor = 0;
  while (cursor < safeText.length) {
    const end = Math.min(cursor + size, safeText.length);
    const slice = safeText.slice(cursor, end);
    chunks.push(slice);
    if (end >= safeText.length) break;
    cursor = Math.max(0, end - overlap);
  }
  return chunks;
}
