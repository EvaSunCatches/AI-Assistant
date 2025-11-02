# 🧠 AI Educational Assistant — OCR Backend

**Version:** v6.9-STABLE  
**Author:** EvaSunCatches  
**License:** MIT

---

## 📖 Описание

Этот проект — локальный OCR-анализатор (на Node.js + Express), который:
- принимает изображения (`.png`, `.jpg`);
- распознаёт текст с помощью **Tesseract (eng+ukr)**;
- возвращает JSON с координатами (bbox);
- визуализирует слова и границы прямо в интерфейсе браузера.

---

## 🚀 Функционал
✅ Поддержка украинского и английского языков  
✅ Визуализация рамок (`bbox`) поверх изображений  
✅ Автоочистка папки `/public/drawings` каждые 3 минуты  
✅ Совместимость с macOS / Linux / Windows  
✅ Простая интеграция для обучения, тестов, OCR-анализа

---

## ⚙️ Установка

```bash
git clone git@github.com:EvaSunCatches/AI-Assistant.git
cd AI-Assistant
npm install
npm start