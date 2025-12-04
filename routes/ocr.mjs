import express from "express";
import Tesseract from "tesseract.js";

export const ocrRouter = express.Router();

/**
 * POST /api/ocr/image
 * form-data: image=@screenshot.png
 */
ocrRouter.post("/image", async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res
        .status(400)
        .json({ error: "Файл зображення не надіслано (поле: image)" });
    }

    const imageFile = req.files.image;

    const { data } = await Tesseract.recognize(
      imageFile.data,
      "ukr+eng"
    );

    const text = (data?.text || "").replace(/\s+/g, " ").trim();

    res.json({ text });
  } catch (err) {
    console.error("OCR ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});