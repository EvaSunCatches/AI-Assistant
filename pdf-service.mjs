import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const PDF_DIR = "./books";

/**
 * Получить текст конкретной страницы из PDF
 * @param {string} filename - имя файла PDF
 * @param {number} pageIndex - номер страницы (1-based)
 */
export async function getPageText(filename, pageIndex) {
  const filePath = path.join(PDF_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Файл ${filename} не найден`);
  }

  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  // pdf-parse возвращает весь текст книги, разделенный переносами страниц
  const pages = data.text.split("\f");
  if (pageIndex < 1 || pageIndex > pages.length) {
    throw new Error(`Страница ${pageIndex} вне диапазона (1-${pages.length})`);
  }

  return {
    text: pages[pageIndex - 1],
    numPages: pages.length
  };
}

/**
 * Найти задание по номеру на странице
 * @param {string} pageText
 * @param {number} taskNumber
 */
export function extractTaskFromPageText(pageText, taskNumber) {
  const regex = new RegExp(`${taskNumber}\\..+?(?=\\n\\d+\\.|$)`, "s");
  const match = pageText.match(regex);
  return match ? match[0].trim() : null;
}

/**
 * Поиск задания по всей книге
 */
export async function findTaskInBook(filename, taskNumber) {
  const { numPages } = await getPageText(filename, 1); // узнаем количество страниц
  for (let i = 1; i <= numPages; i++) {
    const { text } = await getPageText(filename, i);
    const fragment = extractTaskFromPageText(text, taskNumber);
    if (fragment) return { pageIndex: i, fragment };
  }
  return null;
}