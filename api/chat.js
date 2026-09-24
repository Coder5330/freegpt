// Runs on Vercel's Edge Runtime so the response can stream token-by-token.
export const config = { runtime: "edge" };

const ALLOWED_MODELS = [
  "gpt-6-astra",
  "gpt-6-sol",
  "gpt-6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-4o",
  "gpt-4o-mini",
  "o3",
  "o3-pro",
  "o1",
  "o3-mini",
];
const GENERATION_TIMEOUT_MS = 90000; // allow slower/reasoning-heavy replies
const HEARTBEAT_MS = 8000; // how often to ping the client while waiting

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not set on the server" }),
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const { messages, model } = body;
  const chosenModel = ALLOWED_MODELS.includes(model) ? model : "gpt-6-sol";
  const encoder = new TextEncoder();

  // Build our own stream and return it immediately — this is what satisfies
  // Vercel's "must respond within 25s" rule, regardless of how long OpenAI
  // takes afterward to actually start producing tokens.
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk) => {
        if (!closed) {
          try { controller.enqueue(chunk); } catch { /* stream already closed */ }
        }
      };
      const safeClose = () => {
        if (!closed) { closed = true; try { controller.close(); } catch {} }
      };

      // Silent SSE comment lines — keep the connection alive and reset any
      // idle timeouts while OpenAI is still "thinking" and sending nothing.
      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(": keep-alive\n\n"));
      }, HEARTBEAT_MS);

      const controller_ = new AbortController();
      const timeout = setTimeout(() => controller_.abort(), GENERATION_TIMEOUT_MS);

      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ model: chosenModel, messages, stream: true }),
          signal: controller_.signal,
        });

        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text();
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: errText || "OpenAI error" })}\n\n`));
          safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          safeClose();
          return;
        }

        const reader = openaiRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          safeEnqueue(value);
        }
        safeClose();
      } catch (err) {
        const message =
          err.name === "AbortError"
            ? "The model took too long to respond. Try a shorter prompt or a different model."
            : err.message || "Something went wrong";
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        safeEnqueue(encoder.encode("data: [DONE]\n\n"));
        safeClose();
      } finally {
        clearInterval(heartbeat);
        clearTimeout(timeout);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
