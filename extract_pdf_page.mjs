// extract_pdf_page.mjs
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs";

// Встановлюємо воркер pdf.js
GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfPageText(pdfPath, pageNumber) {
  const loadingTask = getDocument(pdfPath);
  const pdf = await loadingTask.promise;

  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Сторінки ${pageNumber} не існує. У документі ${pdf.numPages} сторінок.`);
  }

  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();

  const text = content.items.map(item => item.str).join(" ");
  return text;
}