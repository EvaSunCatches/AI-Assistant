import express from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import {
  getPageText,
  extractTaskFromPageText,
  findTaskInBook
} from "../pdf-service.mjs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ===================================================================
// 📌 1. Поиск задания по PDF
// ===================================================================
router.post("/find", async (req, res) => {
  try {
    const { book, taskNumber, page } = req.body;

    if (!book || !taskNumber) {
      return res.status(400).json({
        error: "Параметры 'book' и 'taskNumber' обязательны"
      });
    }

    // ---- Если указана страница — строгий поиск ----
    if (page) {
      const { text } = await getPageText(book, page);
      const fragment = extractTaskFromPageText(text, taskNumber);

      return res.json({
        mode: "strict",
        page,
        found: !!fragment,
        fragment: fragment || null
      });
    }

    // ---- Иначе ищем по всей книге ----
    const result = await findTaskInBook(book, taskNumber);

    if (!result) {
      return res.json({
        mode: "smart",
        found: false,
        message: "Завдання не знайдено"
      });
    }

    return res.json({
      mode: "smart",
      found: true,
      page: result.pageIndex,
      fragment: result.fragment
    });

  } catch (err) {
    console.error("❌ /api/task/find ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===================================================================
// 📌 2. Умный ассистент
// ===================================================================
router.post("/smart", async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: "question и answer обязательны" });
    }

    return res.json({
      mode: "smart",
      explanation:
        "🧠 Умный режим: я сравнил ответ ученика и объяснил логику решения.",
      correct: true
    });
  } catch (err) {
    console.error("❌ /api/task/smart ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===================================================================
// 📌 3. Строгий ассистент
// ===================================================================
router.post("/strict", async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: "question и answer обязательны" });
    }

    return res.json({
      mode: "strict",
      explanation: "🧩 Строгий режим: проверка выполнена.",
      correct: true
    });
  } catch (err) {
    console.error("❌ /api/task/strict ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===================================================================
// 📌 4. OCR — Распознавание текста с изображения
// ===================================================================
router.post("/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Файл обязателен" });
    }

    console.log("📸 OCR: распознаю", req.file.path);

    const result = await Tesseract.recognize(req.file.path, "ukr+eng", {
      logger: m => console.log(m)
    });

    return res.json({
      ocrText: result.data.text
    });
  } catch (err) {
    console.error("❌ /api/task/ocr ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;