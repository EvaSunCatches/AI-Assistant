#!/usr/bin/env node

/**
 * AI Educational Assistant — OCR backend
 * Version: v6.8-STABLE
 * Node.js server for image-to-text recognition with bounding boxes (HOCR/TSV)
 */

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const morgan = require("morgan");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

// Paths
const PUBLIC_DIR = path.join(__dirname, "public");
const DRAWINGS_DIR = path.join(PUBLIC_DIR, "drawings");
const LOGS_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOGS_DIR, "ocr.json");

// Ensure directories exist
fs.ensureDirSync(DRAWINGS_DIR);
fs.ensureDirSync(LOGS_DIR);

// Middleware
app.use(express.static(PUBLIC_DIR));
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));

// Multer setup for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DRAWINGS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const name = `ocr-${Date.now()}-${base}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// Utility: append to OCR log file
async function appendLog(entry) {
  try {
    let arr = [];
    if (await fs.pathExists(LOG_FILE)) {
      const content = await fs.readFile(LOG_FILE, "utf-8");
      arr = JSON.parse(content || "[]");
      if (!Array.isArray(arr)) arr = [];
    }
    arr.push(entry);
    await fs.writeFile(LOG_FILE, JSON.stringify(arr, null, 2));
  } catch (err) {
    console.error("appendLog error:", err);
  }
}

// Main OCR route
app.post("/api/vision", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const lang = "eng+ukr";
    const baseCmd = `tesseract "${filePath}" stdout -l ${lang} --oem 1 --psm 3`;

    // Run three passes: plain text, HOCR, TSV
    const cmdText = `${baseCmd}`;
    const cmdHOCR = `${baseCmd} hocr`;
    const cmdTSV = `${baseCmd} tsv`;

    const runCommand = (cmd) =>
      new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) return reject(stderr || err);
          resolve(stdout);
        });
      });

    const [text, hocr, tsv] = await Promise.all([
      runCommand(cmdText),
      runCommand(cmdHOCR),
      runCommand(cmdTSV),
    ]);

    // Extract words and coordinates from TSV
    const words = [];
    const lines = tsv.split("\n").slice(1);
    for (const line of lines) {
      const cols = line.split("\t");
      if (cols.length > 11 && cols[11].trim()) {
        words.push({
          text: cols[11].trim(),
          confidence: parseFloat(cols[10]),
          bbox: {
            x: parseInt(cols[6]),
            y: parseInt(cols[7]),
            w: parseInt(cols[8]),
            h: parseInt(cols[9]),
          },
        });
      }
    }

    const result = {
      status: "✅ Завдання розпізнано",
      text: text.trim(),
      words,
      file: `/drawings/${path.basename(filePath)}`,
      timestamp: Date.now(),
    };

    await appendLog(result);
    res.json(result);
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ status: "❌ OCR error", error: String(err) });
  }
});

// Clear drawings & logs
app.post("/api/clear", async (req, res) => {
  try {
    await fs.emptyDir(DRAWINGS_DIR);
    await fs.writeFile(LOG_FILE, "[]");
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: "Clear failed", details: String(err) });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "✅ OK",
    version: "v6.8-STABLE",
    endpoints: ["/api/vision", "/api/clear", "/health"],
  });
});

// Auto-cleaner
setInterval(async () => {
  try {
    await fs.emptyDir(DRAWINGS_DIR);
  } catch (err) {
    console.warn("Auto-clean error:", err);
  }
}, 180 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`✅ server.cjs v6.8-STABLE running on http://localhost:${PORT}`);
  console.log(`📁 Drawings: ${DRAWINGS_DIR}`);
  console.log(`📁 Logs: ${LOGS_DIR}`);
  console.log("🕒 Auto-cleanup: 180 sec");
});