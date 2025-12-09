// server.mjs — сервер PDF + AI (OpenRouter по умолчанию)

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
  return await loadingTask.promise;
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

async function findTaskInBook(bookFile, taskNumber) {
  const pdf = await loadPdf(bookFile);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const tokens = textContent.items.map((it) => String(it.str || "").trim());
    const text = tokens.join(" ").replace(/-\s+/g, "").replace(/\s+/g, " ").trim();

    const fragment = extractTaskFragment(text, taskNumber);
    if (fragment) return { pageIndex: i, fragment };
  }
  return null;
}

// ===== AI PROMPTS =====

function buildTaskPrompt(fragment, details, mode) {
  let base =
    "Ти — доброзичливий репетитор для учня 5 класу. Пояснюй просто, українською.\n" +
    "Структура:\n" +
    "— 'Правило'\n" +
    "— 'Розв'язання' кроками\n" +
    "— 'Відповідь'\n\n";

  if (details) base += `Додаткове прохання учня: "${details.trim()}"\n\n`;
  if (mode === "strict") base += "Режим: строгий.\n\n";
  else base += "Режим: розумний.\n\n";

  base += `Текст завдання:\n${fragment}\n`;

  return base;
}

function buildChatPrompt(question) {
  return (
    "Ти — пояснюєш матеріал учню 4–6 класу простими словами.\n\n" +
    `Питання учня:\n${question}\n\n` +
    "Відповідь: коротке пояснення + приклад."
  );
}

// ===== API ENDPOINTS =====

// health
app.get("/health", (req, res) => {
  res.json({ ok: true, ai: "OpenRouter", port: PORT });
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
    res.status(500).json({ error: err.message });
  }
});

// загрузка PDF
app.post("/api/upload-book", async (req, res) => {
  try {
    if (!req.files?.book) {
      return res.status(400).json({ error: "Файл 'book' не надіслано" });
    }

    if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

    const file = req.files.book;
    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, "_");
    const dest = path.join(BOOKS_DIR, safeName);
    await file.mv(dest);

    res.json({ ok: true, filename: safeName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// strict mode
app.post("/api/task/strict", async (req, res) => {
  try {
    const { book, page, taskNumber, details } = req.body;

    const pageIndex = Number(page);
    const { text } = await readPdfPageText(book, pageIndex);
    const fragment = extractTaskFragment(text, taskNumber);

    if (!fragment) {
      return res.status(404).json({
        error: `Task ${taskNumber} not found`,
        pageIndex
      });
    }

    const prompt = buildTaskPrompt(fragment, details, "strict");
    const aiResponse = await askAssistant("Ти — репетитор.", prompt);

    res.json({
      ok: true,
      mode: "strict",
      pageIndex,
      fragment,
      aiResponse
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// smart mode
app.post("/api/task/smart", async (req, res) => {
  try {
    const { book, taskNumber, details, question } = req.body;

    if (book && taskNumber) {
      const found = await findTaskInBook(book, taskNumber);

      if (!found)
        return res.status(404).json({ error: "Task not found in book" });

      const prompt = buildTaskPrompt(found.fragment, details, "smart");
      const aiResponse = await askAssistant("Ти — репетитор.", prompt);

      return res.json({
        ok: true,
        mode: "smart",
        pageIndex: found.pageIndex,
        fragment: found.fragment,
        aiResponse
      });
    }

    // чатовый режим
    const q = (question || details || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Empty question" });
    }

    const prompt = buildChatPrompt(q);
    const aiResponse = await askAssistant("Ти — вчитель.", prompt);

    res.json({
      ok: true,
      mode: "chat",
      question: q,
      aiResponse
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// старт сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running with OpenRouter AI on http://localhost:${PORT}`);
});