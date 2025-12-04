#!/bin/bash

echo "============================"
echo "🚀 Автоматический деплой"
echo "============================"

echo "📁 Добавляю изменения в git..."
git add .

echo "📝 Делаю commit..."
git commit -m "auto deploy" || echo "Нет изменений — commit пропущен"

echo "⬆️ Отправляю изменения на GitHub..."
git push || { echo "❌ Ошибка git push"; exit 1; }

echo "🔄 Pull последних изменений..."
git pull

echo "🧹 Удаляю старые node_modules и package-lock.json..."
rm -rf node_modules package-lock.json

echo "📦 Устанавливаю npm зависимости..."
npm install

echo "🚀 Отправляю запрос на деплой Render..."
curl -s -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"clearCache\": false}" \
  https://api.render.com/v1/services/srv-d43gd0ili9vc73d0jf70/deploys

echo "✨ Готово! Деплой запущен."
