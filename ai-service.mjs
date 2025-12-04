import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.mjs";

export async function solveTaskWithAi({ fragment, mode = "smart", details }) {
  if (!GEMINI_API_KEY) {
    return "Помилка: GEMINI_API_KEY не налаштовано на сервері.";
  }

  const strictHint =
    mode === "strict"
      ? "Дотримуйся максимально шкільного рівня 5 класу. Не вигадуй нові умови й не змінюй числа, працюй тільки з наведеним текстом."
      : "Можна наводити додаткові пояснення, приклади й лайфхаки, але числа і умову не змінюй.";

  const rulePart =
    "Спочатку дуже коротко запиши правило або властивість/формулу, на якій базується розв'язання цього завдання. Почни рядок з 'Правило:'.";
  const solutionPart =
    "Потім запиши розв'язання з детальними кроками, почни з 'Розв'язання:'.";
  const answerPart =
    "Наприкінці дай коротку відповідь у форматі 'Відповідь: ...'.";

  const extra =
    details && details.trim()
      ? `\nДодатковий запит від учня: ${details.trim()}`
      : "";

  const prompt = `Ти — пояснювач для учня 5 класу. Працюєш українською мовою.

${strictHint}

${rulePart}
${solutionPart}
${answerPart}

Текст завдання:
${fragment}
${extra}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await resp.json();

  if (!resp.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    return `Помилка Gemini: ${msg}`;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Вибач, я не зміг сформувати відповідь.";

  return text.trim();
}