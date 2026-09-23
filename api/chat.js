// Runs on Vercel's Edge Runtime so the response can stream token-by-token.
export const config = { runtime: "edge" };

const ALLOWED_MODELS = ["gpt-6-sol", "gpt-5", "gpt-4o", "gpt-4o-mini", "o3-mini"];

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
  }

  try {
    const { messages, model } = await request.json();
    const chosenModel = ALLOWED_MODELS.includes(model) ? model : "gpt-6-sol";

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages,
        stream: true,
      }),
    });

    if (!openaiRes.ok || !openaiRes.body) {
      const errBody = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: errBody || "OpenAI error" }),
        { status: openaiRes.status || 500 }
      );
    }

    // Forward OpenAI's SSE stream straight through, unchanged.
    return new Response(openaiRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Something went wrong" }),
      { status: 500 }
    );
  }
}
