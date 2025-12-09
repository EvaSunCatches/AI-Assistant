import dotenv from "dotenv";
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";

if (!OPENROUTER_API_KEY) {
  console.warn("[AI] OPENROUTER_API_KEY не встановлено. Відповіді AI працювати не будуть.");
}

export async function callOpenRouter(messages, options = {}) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const body = {
    model: OPENROUTER_MODEL,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.max_tokens ?? 1200
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[OpenRouter error]", res.status, text);
    throw new Error(`OpenRouter error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");

  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(c => c.text || "").join("");

  return String(content);
}

export async function askAssistant(systemPrompt, userPrompt, extraOptions = {}) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
  return callOpenRouter(messages, extraOptions);
}
