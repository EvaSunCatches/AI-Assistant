// server.mjs — единый сервер с умным и строгим поиском по PDF + AI Gemini

import express from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const BOOKS_DIR = path.join(process.cwd(), "books");
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// --- базовые проверки ---
if (!GEMINI_KEY) {
  console.warn("⚠️ GEMINI_API_KEY не задан в .env — AI відповіді працювати не будуть");
}

// --- middleware ---
app.use(express.json({ limit: "10mb" }));
app.use(fileUpload());
app.use(express.static(path.join(process.cwd(), "public")));

// ====== PDF helpers ======
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

// Витяг завдання з тексту сторінки
function extractTaskFragment(pageText, taskNumber) {
  const cur = String(taskNumber);
  const next = String(Number(taskNumber) + 1);

  // шукаємо тип "535." або "535)"
  const regex = new RegExp(
    `\\b${cur}[\\.)]\\s*(.*?)(?=\\b${next}[\\.)]|$)`,
    "s"
  );
  const match = pageText.match(regex);
  if (!match) return null;
  // повертаємо весь фрагмент з номером
  return `${cur}. ${match[1].trim()}`;
}

// Пошук завдання по всій книзі
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

// ====== AI (Gemini) ======
async function askGemini(prompt) {
  if (!GEMINI_KEY) {
    return "AI: відсутній GEMINI_API_KEY у .env";
  }
  const modelName = GEMINI_MODEL.startsWith("models/")
    ? GEMINI_MODEL
    : `models/${GEMINI_MODEL}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${GEMINI_KEY}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  const data = await resp.json();
  if (!resp.ok) {
    console.error("Gemini error:", data);
    return `Gemini error: ${data.error?.message || JSON.stringify(data)}`;
  }
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") ||
    "AI не повернув текст відповіді";
  return text.trim();
}

function buildTaskPrompt(fragment, details, mode) {
  let base =
    "Ти — доброзичливий репетитор для учня 5 класу. Пояснюй дуже просто, українською мовою.\n\n" +
    "1) Спочатку КОРОТКО сформулюй правило, на якому базується це завдання (1–3 речення), з підзаголовком 'Правило'.\n" +
    "2) Потім оформи 'Розв'язання' крок за кроком.\n" +
    "3) Наприкінці дай чітку 'Відповідь'.\n\n";

  if (details && details.trim()) {
    base += `Учень додатково просить: "${details.trim()}". Зверни на це особливу увагу.\n\n`;
  }

  if (mode === "strict") {
    base += "Режим: строгий (номер сторінки та завдання відомі).\n\n";
  } else {
    base += "Режим: розумний пошук по підручнику або вільне питання.\n\n";
  }

  base += `Текст завдання з підручника:\n${fragment}\n\nПобудуй відповідь у форматі Markdown.`;
  return base;
}

function buildChatPrompt(question) {
  return (
    "Ти — пояснюєш дитині 4–6 класу. Відповідай дуже просто, українською мовою.\n\n" +
    `Питання учня:\n${question}\n\n` +
    "Структура відповіді: коротке пояснення + простий приклад (якщо доречно)."
  );
}

// ====== API ======

// health
app.get("/health", (req, res) => {
  res.json({ ok: true, mode: "smart+strict", port: PORT });
});

// список книг
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
    console.error("books error:", err);
    res.status(500).json({ error: err.message });
  }
});

// загрузка нового PDF
app.post("/api/upload-book", async (req, res) => {
  try {
    if (!req.files || !req.files.book) {
      return res.status(400).json({ error: "Файл 'book' не надіслано" });
    }
    if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

    const file = req.files.book;
    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, "_");
    const destPath = path.join(BOOKS_DIR, safeName);
    await file.mv(destPath);
    res.json({ ok: true, filename: safeName });
  } catch (err) {
    console.error("upload-book error:", err);
    res.status(500).json({ error: err.message });
  }
});

// строгий режим
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
    const aiResponse = await askGemini(prompt);

    res.json({
      mode: "strict",
      book,
      pageIndex,
      fragment,
      aiResponse
    });
  } catch (err) {
    console.error("STRICT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// умний режим + чат
app.post("/api/task/smart", async (req, res) => {
  try {
    const { book, taskNumber, details, question } = req.body;

    // 1) умный поиск задания по всей книге
    if (book && taskNumber) {
      const found = await findTaskInBook(book, taskNumber);
      if (!found) {
        return res
          .status(404)
          .json({ error: `Task ${taskNumber} not found in book ${book}` });
      }

      const { pageIndex, fragment } = found;
      const prompt = buildTaskPrompt(fragment, details, "smart");
      const aiResponse = await askGemini(prompt);

      return res.json({
        mode: "smart",
        book,
        pageIndex,
        fragment,
        aiResponse
      });
    }

    // 2) просто питання учня (додаткові питання)
    const q = (question || details || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Немає тексту питання" });
    }

    const prompt = buildChatPrompt(q);
    const aiResponse = await askGemini(prompt);
    res.json({
      mode: "chat",
      question: q,
      aiResponse
    });
  } catch (err) {
    console.error("SMART ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// заглушка для режима по изображению, чтобы не было 404
app.post("/api/image-ocr", async (req, res) => {
  res.json({
    text:
      "Режим по зображенню (OCR) буде додано окремо. Наразі скористайтесь режимом PDF або просто опишіть завдання текстом."
  });
});

// старт сервера
app.listen(PORT, () => {
  console.log(`✅ Server with AI running at http://localhost:${PORT}`);
});