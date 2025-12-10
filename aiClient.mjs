// aiClient.mjs — клиент для OpenRouter с авто-моделью, fallback и retry

import dotenv from "dotenv";
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Базовая модель из окружения (если задана)
const ENV_DEFAULT_MODEL = process.env.OPENROUTER_MODEL;

// Явные профили (по желанию — можно задать в Render):
// OPENROUTER_MODEL_MATH, OPENROUTER_MODEL_CODE, OPENROUTER_MODEL_DEEP
const MODEL_MATH = process.env.OPENROUTER_MODEL_MATH || null;
const MODEL_CODE = process.env.OPENROUTER_MODEL_CODE || null;
const MODEL_DEEP = process.env.OPENROUTER_MODEL_DEEP || null;

// Жёсткий fallback (то, на что всегда можем откатиться)
const FALLBACK_MODEL = "anthropic/claude-3.5-haiku";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function pickBaseModel() {
  return ENV_DEFAULT_MODEL || FALLBACK_MODEL;
}

// Выбор модели по типу задачи и подсказке
function pickModel({ type, modelHint } = {}) {
  if (modelHint) return modelHint;

  if (type === "math" && MODEL_MATH) return MODEL_MATH;
  if (type === "code" && MODEL_CODE) return MODEL_CODE;
  if (type === "deep" && MODEL_DEEP) return MODEL_DEEP;

  return pickBaseModel();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Универсальный вызов OpenRouter
 * 
 * @param {Object} params
 * @param {string} params.system - системный промпт
 * @param {string} params.prompt - пользовательский промпт
 * @param {("math"|"code"|"deep"|"chat"|"general")} [params.type] - тип задачи
 * @param {string} [params.modelHint] - конкретная модель (если нужно принудительно)
 * @param {number} [params.maxRetries] - кол-во повторов при 429/5xx
 */
export async function askAssistant({
  system,
  prompt,
  type = "general",
  modelHint,
  maxRetries = 2
} = {}) {
  if (!OPENROUTER_API_KEY) {
    console.warn("⚠️ OPENROUTER_API_KEY не задан в переменных окружения");
    return "AI: відсутній OPENROUTER_API_KEY у змінних середовища.";
  }

  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    // На первой попытке — выбранная модель, на последующих — базовый fallback
    const model = attempt === 0 ? pickModel({ type, modelHint }) : pickBaseModel();

    try {
      const resp = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          // Рекомендуется OpenRouter'ом (метаданные, не секреты):
          "HTTP-Referer": "https://ai-assistant-qv8x.onrender.com",
          "X-Title": "AI Educational Assistant"
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: prompt }
          ],
          temperature: type === "math" ? 0.4 : 0.7,
          max_tokens: 1024
        })
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const msg = data?.error?.message || resp.statusText;
        console.error(
          `[OpenRouter error] status=${resp.status} model=${model} attempt=${attempt} message=${msg}`
        );

        // ❌ Модель некорректна — пробуем сразу откатиться на базовую
        if (
          resp.status === 400 &&
          msg &&
          msg.toLowerCase().includes("not a valid model id") &&
          model !== pickBaseModel()
        ) {
          attempt++;
          lastError = msg;
          continue;
        }

        // ⏳ Рейт-лимит / серверные ошибки — ретрай с backoff
        if ([429, 500, 502, 503, 504].includes(resp.status) && attempt < maxRetries) {
          const delay = 500 * Math.pow(2, attempt);
          console.warn(`⏳ OpenRouter retry in ${delay}ms (status ${resp.status})`);
          await sleep(delay);
          attempt++;
          lastError = msg;
          continue;
        }

        // Полный фейл
        return `OpenRouter error: ${resp.status} ${JSON.stringify(data)}`;
      }

      const choice = data.choices?.[0];
      const content = choice?.message?.content;

      if (!content) {
        console.error("⚠️ OpenRouter: пустой ответ", data);
        return "AI не повернув текст відповіді.";
      }

      const text = Array.isArray(content)
        ? content.map((c) => (typeof c === "string" ? c : c.text || "")).join("\n")
        : typeof content === "string"
        ? content
        : content.text || "";

      return text.trim();
    } catch (err) {
      console.error(`[OpenRouter fetch error] attempt=${attempt}`, err);
      lastError = err?.message || String(err);

      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt);
        console.warn(`⏳ Network error, retry in ${delay}ms`);
        await sleep(delay);
        attempt++;
      } else {
        return `OpenRouter fetch error: ${lastError}`;
      }
    }
  }

  return `OpenRouter error after retries: ${lastError || "невідома помилка"}`;
}