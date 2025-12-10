// server.mjs — сервер PDF + AI (OpenRouter, авто-модели, fallback, retry)

import express from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { askAssistant } from "./aiClient.mjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOOKS_DIR = path.join(process.cwd(), "books");

// ===== MIDDLEWARE =====
app.use(express.json({ limit: "10mb" }));
app.use(fileUpload());
app.use(express.static(path.join(process.cwd(), "public")));

// ===== HELPERS: PDF =====
function bufferToUint8Array(buffer) {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

async function loadPdf(bookFile) {
  const filePath = path.join(BOOKS_DIR, bookFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF файл не знайдено: ${bookFile}`);
  }
  const buffer = fs.readFileSync(filePath);
  const data = bufferToUint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    verbosity: 0,
    useWorkerFetch: false,
    isEvalSupported: false
  });
  const pdf = await loadingTask.promise;
  return pdf;
}

async function readPdfPageText(bookFile, pageIndex) {
  const pdf = await loadPdf(bookFile);
  if (pageIndex < 1 || pageIndex > pdf.numPages) {
    throw new Error(`Сторінка ${pageIndex} поза діапазоном (1..${pdf.numPages})`);
  }
  const page = await pdf.getPage(pageIndex);
  const textContent = await page.getTextContent();
  const tokens = textContent.items.map((it) => String(it.str || "").trim());
  const text = tokens.join(" ").replace(/-\s+/g, "").replace(/\s+/g, " ").trim();

  return { text, pageIndex, numPages: pdf.numPages };
}

// Вытаскиваем конкретное задание по номеру
function extractTaskFragment(pageText, taskNumber) {
  const cur = String(taskNumber);
  const next = String(Number(taskNumber) + 1);

  const regex = new RegExp(
    `\\b${cur}[\\.)]\\s*(.*?)(?=\\b${next}[\\.)]|$)`,
    "s"
  );
  const match = pageText.match(regex);
  if (!match) return null;

  return `${cur}. ${match[1].trim()}`;
}

// Поиск задания по всей книге
async function findTaskInBook(bookFile, taskNumber) {
  const pdf = await loadPdf(bookFile);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const tokens = textContent.items.map((it) => String(it.str || "").trim());
    const text = tokens.join(" ").replace(/-\s+/g, "").replace(/\s+/g, " ").trim();

    const fragment = extractTaskFragment(text, taskNumber);
    if (fragment) {
      return { pageIndex: i, fragment };
    }
  }
  return null;
}

// ===== HEURISTICS: определяем тип задачи =====

function looksLikeMath(text = "") {
  const t = text.toLowerCase();
  if (/[0-9]/.test(t) && /[+×*÷:/-]/.test(t)) return true;
  if (/(дроб|частин|відсот|процент|рівнян|добуток|частка|сума)/.test(t)) return true;
  if (/(square|fraction|percent|equation)/.test(t)) return true;
  return false;
}

// ===== PROMPTS =====

function buildTaskPrompt(fragment, details, mode) {
  let base =
    "Ти — доброзичливий репетитор з математики для учня 5 класу. Пояснюй дуже просто, українською мовою.\n\n" +
    "Структура відповіді:\n" +
    "1) **Правило** — коротко (1–3 речення).\n" +
    "2) **Розв'язання** — крок за кроком.\n" +
    "3) **Відповідь** — чітко та окремим блоком.\n\n";

  if (details && details.trim()) {
    base += `Додаткове прохання учня: "${details.trim()}". Зверни на це особливу увагу.\n\n`;
  }

  base += mode === "strict"
    ? "Режим: строгий (номер сторінки відомий).\n\n"
    : "Режим: розумний пошук по підручнику.\n\n";

  base += `Текст завдання з підручника:\n${fragment}\n\n` +
    "Сформуй відповідь у форматі Markdown.";

  return base;
}

function buildChatPrompt(question) {
  return (
    "Ти пояснюєш матеріал дитині 4–6 класу простими словами, українською мовою.\n\n" +
    `Питання учня:\n${question}\n\n` +
    "Структура відповіді: коротке пояснення + простий приклад (якщо доречно)."
  );
}

// ===== API ENDPOINTS =====

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, ai: "OpenRouter", port: String(PORT), mode: "smart+strict" });
});

// Список книг
app.get("/api/books", (req, res) => {
  try {
    if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

    const files = fs
      .readdirSync(BOOKS_DIR)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .map((filename) => ({
        id: filename,
        filename,
        title: filename.replace(/\.pdf$/i, "").replace(/[-_]/g, " ")
      }));

    res.json({ books: files });
  } catch (err) {
    console.error("[/api/books] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Загрузка PDF
app.post("/api/upload-book", async (req, res) => {
  try {
    if (!req.files?.book) {
      return res.status(400).json({ error: "Файл 'book' не надіслано" });
    }

    if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

    const file = req.files.book;
    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, "_");
    const destPath = path.join(BOOKS_DIR, safeName);
    await file.mv(destPath);

    res.json({ ok: true, filename: safeName });
  } catch (err) {
    console.error("[/api/upload-book] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// STRICT режим (номер страницы + номер задания)
app.post("/api/task/strict", async (req, res) => {
  try {
    const { book, page, taskNumber, details } = req.body;

    if (!book || !page || !taskNumber) {
      return res
        .status(400)
        .json({ error: "Потрібні параметри: book, page, taskNumber" });
    }

    const pageIndex = Number(page);
    const { text, numPages } = await readPdfPageText(book, pageIndex);
    const fragment = extractTaskFragment(text, taskNumber);

    if (!fragment) {
      return res.status(404).json({
        error: `Task ${taskNumber} not found on page ${pageIndex}`,
        pageIndex,
        numPages
      });
    }

    const prompt = buildTaskPrompt(fragment, details, "strict");

    const aiResponse = await askAssistant({
      system: "Ти — репетитор з математики. Допомагаєш учню 5 класу.",
      prompt,
      type: "math"
    });

    res.json({
      ok: true,
      mode: "strict",
      book,
      pageIndex,
      fragment,
      aiResponse
    });
  } catch (err) {
    console.error("[/api/task/strict] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// SMART режим + чат
app.post("/api/task/smart", async (req, res) => {
  try {
    const { book, taskNumber, details, question } = req.body;

    // 1) Если указан book + taskNumber → умный поиск по книге
    if (book && taskNumber) {
      const found = await findTaskInBook(book, taskNumber);
      if (!found) {
        return res
          .status(404)
          .json({ error: `Task ${taskNumber} not found in book ${book}` });
      }

      const { pageIndex, fragment } = found;
      const prompt = buildTaskPrompt(fragment, details, "smart");

      const aiResponse = await askAssistant({
        system: "Ти — репетитор з математики. Пояснюєш завдання з підручника.",
        prompt,
        type: "math"
      });

      return res.json({
        ok: true,
        mode: "smart",
        book,
        pageIndex,
        fragment,
        aiResponse
      });
    }

    // 2) Чистый чат-вопрос
    const q = (question || details || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Немає тексту питання" });
    }

    const prompt = buildChatPrompt(q);

    const aiResponse = await askAssistant({
      system: "Ти — вчитель, який пояснює матеріал дитині 4–6 класу.",
      prompt,
      type: looksLikeMath(q) ? "math" : "chat"
    });

    res.json({
      ok: true,
      mode: "chat",
      question: q,
      aiResponse
    });
  } catch (err) {
    console.error("[/api/task/smart] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Заглушка для OCR-режима по изображению, чтобы фронт не падал
app.post("/api/image-ocr", async (req, res) => {
  res.json({
    text:
      "Режим по зображенню (OCR) буде додано окремо. Наразі скористайтесь режимом PDF або просто опишіть завдання текстом."
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Server running with OpenRouter AI on http://localhost:${PORT}`);
});