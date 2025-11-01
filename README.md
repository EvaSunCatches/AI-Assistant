# AI Educational Assistant — OCR backend

Минимальная инструкция по установке, запуску и пушу в GitHub.

---

## 🚀 Требования (macOS)
1. Node.js 18+ (LTS)
2. npm
3. Tesseract OCR — установить:
   ```bash
   brew install tesseract
   ```

---

## ⚙️ Установка зависимостей

```bash
npm install
```

---

## ▶️ Быстрый запуск (освобождает порт и запускает сервер)

```bash
lsof -tiTCP:3000 -sTCP:LISTEN | xargs -r kill -9 && rm -f server.pid && npm start
```

После запуска:
```
✅ server.cjs v5.9-STABLE running on http://localhost:3000
```

---

## 🔍 Проверка API

**Health:**
```bash
curl -s http://localhost:3000/health | jq .
```

**OCR (пример):**
```bash
curl -s -X POST http://localhost:3000/api/vision \
  -F "file=@/full/path/to/your/image.png" \
  -F "task=312" | jq .
```

> ⚠️ Обязательно: поле файла должно называться `file`.

---

## 🧹 Очистка временных данных

```bash
rm -rf public/drawings/* uploads/* || true
echo "[]" > logs/ocr.json
```

---

## 🧠 GitHub (инициализация и первый push)

### 1️⃣ Создай git-репозиторий:
```bash
git init
```

### 2️⃣ Добавь `.gitignore`:
```bash
echo "node_modules/" > .gitignore
cat >> .gitignore <<'EOF'
logs/
uploads/
public/drawings/
.DS_Store
.env
npm-debug.log*
EOF
```

### 3️⃣ Добавь файлы и сделай коммит:
```bash
git add .gitignore server.cjs public/index.html package.json README.md
git commit -m "feat: v5.9-STABLE + OCR + index.html"
```

### 4️⃣ Подключи GitHub-репозиторий:
(у тебя — `EvaSunCatches/AI-Assistant`)
```bash
git remote add origin git@github.com:EvaSunCatches/AI-Assistant.git
git branch -M main
git push -u origin main
```

> Если выдаст ошибку SSH — значит не подключён ключ.  
> Тогда используй HTTPS:
> ```bash
> git remote set-url origin https://github.com/EvaSunCatches/AI-Assistant.git
> git push -u origin main
> ```

---

## ✅ Готово
После этого репозиторий будет в GitHub и сервер можно тестировать онлайн (через Codespaces или локальный запуск).

---

## 🔜 Следующий этап: v6.0 (HOCR/TSV детекция)

- Будет добавлена точная локализация областей (`bbox`) из Tesseract.
- Приоритет — **точность** (не скорость).
- Поддержка HOCR/TSV форматов.
- Возможность визуализировать координаты распознанных объектов.

---

Автор: **Andrey Spodarenko**  
Лицензия: MIT  
Версия: `v5.9-STABLE`