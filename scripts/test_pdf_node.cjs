const fs = require('fs');
const path = require('path');

// Подключаем Node-совместимую (legacy) сборку pdfjs
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Устанавливаем workerSrc на bundlded worker (Node не использует worker, но pdfjs ожидает путь)
pdfjsLib.GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions || {};
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

// Параметры: node scripts/test_pdf_node.cjs <путь_к_pdf> <номер_страницы>
(async () => {
  try {
    const pdfPath = process.argv[2] || path.join(__dirname, '..', 'books', '5-klas-matematyka-merzlyak.pdf');
    const pageNum = parseInt(process.argv[3] || '154', 10);

    if (!fs.existsSync(pdfPath)) {
      console.error('ERROR: PDF not found at', pdfPath);
      process.exit(2);
    }

    const raw = fs.readFileSync(pdfPath);
    const data = new Uint8Array(raw);

    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    if (pageNum < 1 || pageNum > pdf.numPages) {
      console.error(`ERROR: page ${pageNum} out of range (1..${pdf.numPages})`);
      process.exit(3);
    }

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(i => (i.str || '')).join(' ');

    console.log('--- PAGE', pageNum, 'TEXT START ---');
    console.log(text.slice(0, 16000)); // вывод первых 16k символов (пригодно для проверки)
    console.log('--- PAGE END ---');
    process.exit(0);
  } catch (err) {
    console.error('PDF processing error:', err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
})();
