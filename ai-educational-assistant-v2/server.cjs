/**
 * AI Educational Assistant v2
 * Сервер для обработки текстов и изображений (OCR + AI)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const cheerio = require("cheerio");
const Tesseract = require("tesseract.js");

const app = express();
const PORT = process.env.PORT || 3000;

// === Middleware ===
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/public", express.static("public"));

// === OCR SETUP ===
const upload = multer({ storage: multer.memoryStorage() });

// === UTILS ===

// 🧩 Функция для извлечения текста задания со страницы
async function extractTaskFromPage(url, taskNumber) {
  try {
    console.log(`🔍 Завантажую сторінку: ${url}`);
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const text = $("body").text().replace(/\s+/g, " ").trim();

    const regex = new RegExp(`\\b${taskNumber}[\\).\\s-]*(.*?)(?=\\b\\d{3}[\\).\\s-]|$)`, "gis");
    const match = text.match(regex);

    if (match && match[1]) {
      console.log(`✅ Знайдено текст для завдання №${taskNumber}`);
      return match[0].slice(0, 800);
    } else {
      console.log(`⚠️ Не знайдено збігів для завдання №${taskNumber}`);
      return null;
    }
  } catch (err) {
    console.error("💥 Помилка при завантаженні сторінки:", err.message);
    return null;
  }
}

// === ROUTES ===

// 1️⃣ Анализ текста по URL
app.post("/api/chat", async (req, res) => {
  const { url, task, instruction } = req.body;
  console.log(`🧩 /api/chat: ${url}, завдання №${task}`);

  try {
    const taskText = await extractTaskFromPage(url, task);

    if (!taskText) {
      return res.json({
        message:
          "⚠️ Не вдалося знайти завдання. Будь ласка, перевірте URL або номер завдання.",
      });
    }

    const prompt = `Текст завдання: ${taskText}\n\nІнструкція: ${instruction}\n\nПоясни це зрозуміло для учня 5 класу.`;

    // Симуляция AI-ответа (в будущем можно заменить на Gemini/OpenAI API)
    const explanation = `🧠 Завдання №${task}:\n\n${taskText}\n\n👉 Відповідь: ${instruction ? "Пояснюю крок — " + instruction : "Рішення буде тут."}`;

    res.json({ message: explanation, taskFound: true });
  } catch (err) {
    console.error("💥 Error /api/chat:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 2️⃣ Анализ зображення (PNG / скрін / фото)
app.post("/api/vision", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Файл не завантажено" });
  }

  try {
    console.log("🖼️ Розпізнаю текст із зображення...");
    const { data } = await Tesseract.recognize(req.file.buffer, "ukr+eng");

    const text = data.text.replace(/\s+/g, " ").trim();
    console.log("✅ OCR результат:", text.slice(0, 150) + "...");

    res.json({ message: "Розпізнано текст із зображення", extractedText: text });
  } catch (err) {
    console.error("💥 OCR помилка:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 3️⃣ Перевірка сервера
app.get("/api/check", (req, res) => {
  res.json({ status: "✅ API працює", services: ["OCR", "chat"], version: "v2" });
});

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 AI Educational Assistant v2 running at http://localhost:${PORT}`);
});
