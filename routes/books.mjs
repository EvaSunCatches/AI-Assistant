import express from "express";
import fs from "fs";
import path from "path";
import { BOOKS_DIR } from "../config.mjs";

export const booksRouter = express.Router();

booksRouter.get("/", (req, res) => {
  try {
    if (!fs.existsSync(BOOKS_DIR)) {
      return res.json({ books: [] });
    }

    const files = fs
      .readdirSync(BOOKS_DIR)
      .filter(name => name.toLowerCase().endsWith(".pdf"))
      .map(name => ({
        id: name,
        filename: name,
        title: name
          .replace(/\.pdf$/i, "")
          .replace(/[-_]/g, " ")
      }));

    res.json({ books: files });
  } catch (err) {
    console.error("BOOKS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});