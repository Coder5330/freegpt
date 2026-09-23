// Vercel serverless function — runs on the server, key never reaches the browser.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const ALLOWED_MODELS = ["gpt-6-sol", "gpt-5", "gpt-4o", "gpt-4o-mini", "o3-mini"];

  try {
    const { messages, model } = req.body;
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
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({ error: data.error?.message || "OpenAI error" });
    }

    res.status(200).json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
}
