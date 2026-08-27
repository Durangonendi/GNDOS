// Vercel serverless function — GNDOS AI Copilot / brifing / öncelik / firma bulma.
// Faz 7: frontend'deki anahtarsız (kırık) Anthropic çağrılarının yerini alıyor.
// API anahtarı sadece burada, backend'de — tarayıcıya hiç gitmiyor.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Sunucu yapılandırma hatası (API key eksik). Vercel > Environment Variables'a ANTHROPIC_API_KEY ekle." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: "Geçersiz istek." });
    return;
  }

  const { system, messages } = body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    res.status(400).json({ error: "Geçersiz mesaj listesi." });
    return;
  }

  const cleanMessages = messages
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-10);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system: typeof system === "string" ? system.slice(0, 4000) : undefined,
        messages: cleanMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data?.error?.message || "Anthropic API hatası." });
      return;
    }

    const reply = data?.content?.[0]?.text || "";
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}
