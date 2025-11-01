/**
 * AI Educational Assistant — OCR Analyzer (v5.9-STABLE)
 * CommonJS backend, minimal functional version
 */

const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const multer = require("multer");
const morgan = require("morgan");
const tesseract = require("node-tesseract-ocr");

const app = express();
const PORT = process.env.PORT || 3000;

// === Paths ===
const PUBLIC_DIR = path.join(__dirname, "public");
const DRAWINGS_DIR = path.join(PUBLIC_DIR, "drawings");
const LOG_FILE = path.join(__dirname, "logs", "ocr.json");
const LOGS_DIR = path.join(__dirname, "logs");

// === Ensure folders exist ===
fs.ensureDirSync(DRAWINGS_DIR);
fs.ensureDirSync(LOGS_DIR);

// === Multer config ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DRAWINGS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now();
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `ocr-${unique}-${safe}`);
  },
});
const upload = multer({ storage });

// === Middlewares ===
app.use(morgan("dev"));
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// === Create index.html if missing ===
const indexPath = path.join(PUBLIC_DIR, "index.html");
if (!fs.existsSync(indexPath)) {
  const html = `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <title>OCR Аналізатор (AI Educational Assistant)</title>
  <style>
    body { font-family: sans-serif; margin: 2em; background: #fafafa; }
    h1 { color: #333; }
    #output { white-space: pre-wrap; background: #fff; padding: 1em; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>🧠 OCR Аналізатор</h1>
  <input type="file" id="fileInput" />
  <button id="btn">Розпізнати</button>
  <button id="clear">Очистити все</button>
  <pre id="output"></pre>
  <script>
    document.getElementById('btn').onclick = async () => {
      const f = document.getElementById('fileInput').files[0];
      if (!f) return alert('Оберіть файл!');
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/vision', { method: 'POST', body: fd });
      const txt = await res.text();
      try {
        document.getElementById('output').textContent = JSON.stringify(JSON.parse(txt), null, 2);
      } catch(e) {
        document.getElementById('output').textContent = txt;
      }
    };
    document.getElementById('clear').onclick = async () => {
      await fetch('/api/clear', { method: 'POST' });
      document.getElementById('output').textContent = '✅ Очищено';
    };
  </script>
</body>
</html>`;
  fs.writeFileSync(indexPath, html);
}

// === Helpers ===
const readLogs = async () => {
  try {
    const data = await fs.readFile(LOG_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch {
    return [];
  }
};

const saveLogs = async (entries) =>
  fs.writeFile(LOG_FILE, JSON.stringify(entries.slice(-50), null, 2));

// === OCR endpoint ===
app.post("/api/vision", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Файл не завантажено" });

    const filePath = req.file.path;
    const text = await tesseract.recognize(filePath, { lang: "ukr+eng" });

    // Автоопределение задания (по шаблону "312.", "313." и т.д.)
    const taskMatch = text.match(/\b\d{3,4}\./);
    const task = taskMatch ? taskMatch[0].replace(".", "") : null;

    // Извлечение рисунков
    const drawings = [...text.matchAll(/Рис\.?\s?(\d+)/gi)].map((m) => m[1]);

    const entry = {
      status: task ? "✅ Завдання розпізнано" : "ℹ️ Текст розпізнано, завдання не визначено",
      task,
      drawings,
      text: text.trim(),
      file: `/public/drawings/${path.basename(filePath)}`,
      timestamp: new Date().toISOString(),
    };

    const logs = await readLogs();
    logs.push(entry);
    await saveLogs(logs);

    res.json(entry);
  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({ error: "Помилка OCR або некоректний формат файлу" });
  }
});

// === Очистка логов и рисунков ===
app.post("/api/clear", async (_req, res) => {
  try {
    await fs.writeFile(LOG_FILE, "[]");
    await fs.emptyDir(DRAWINGS_DIR);
    res.json({ cleared: true });
  } catch (err) {
    console.error("Clear error:", err);
    res.status(500).json({ error: "Помилка очищення" });
  }
});

// === Health check ===
app.get("/health", (_req, res) => {
  res.json({
    status: "✅ OK",
    version: "v5.9-STABLE",
    endpoints: ["/api/vision", "/api/clear", "/health"],
  });
});

// === Auto-cleanup every 3 min ===
setInterval(async () => {
  try {
    await fs.emptyDir(DRAWINGS_DIR);
    await saveLogs(await readLogs());
  } catch {}
}, 180000);

// === Start server ===
app.listen(PORT, () => {
  console.log(`✅ server.cjs v5.9-STABLE running on http://localhost:${PORT}`);
  console.log(`📁 Drawings: ${DRAWINGS_DIR}`);
  console.log(`📁 Logs: ${LOG_FILE}`);
  console.log(`🕒 Auto-cleanup: 180 sec`);
});

// export (for tests)
module.exports = app;