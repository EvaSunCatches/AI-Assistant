console.log("🚀 AI Assistant UI loaded");

const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const fileInput = document.getElementById("fileInput");
const outputDiv = document.getElementById("output");
const imagePreview = document.getElementById("imagePreview");
const bboxCanvas = document.getElementById("bboxCanvas");
const bboxCtx = bboxCanvas.getContext("2d");

let currentImage = null;
let ocrData = null;

// 🧠 Отправка изображения на сервер
analyzeBtn.onclick = async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("📁 Обери файл для аналізу!");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  outputDiv.textContent = "⏳ Обробка...";

  try {
    // ✅ Використовуємо відносний шлях для Render
    const response = await fetch("/api/vision", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    ocrData = data;
    console.log("📜 OCR result:", data);

    if (data.status && data.status.startsWith("✅")) {
      outputDiv.textContent = JSON.stringify(data, null, 2);
      showImageWithBoxes(data);
    } else {
      outputDiv.textContent = `❌ Помилка OCR: ${data.error || "невідома"}`;
    }
  } catch (err) {
    console.error("❌ Помилка запиту:", err);
    outputDiv.textContent = `❌ Помилка запиту: ${err.message}`;
  }
};

// 🧹 Очищення
clearBtn.onclick = async () => {
  outputDiv.textContent = "";
  imagePreview.src = "";
  bboxCtx.clearRect(0, 0, bboxCanvas.width, bboxCanvas.height);
  fileInput.value = "";

  try {
    await fetch("/api/clear", { method: "POST" });
  } catch (e) {
    console.warn("Помилка при очищенні:", e);
  }
};

// 🖼️ Попередній перегляд зображення
fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreview.onload = () => {
        bboxCanvas.width = imagePreview.width;
        bboxCanvas.height = imagePreview.height;
      };
    };
    reader.readAsDataURL(file);
  }
};

// 📦 Відображення рамок
function showImageWithBoxes(data) {
  if (!data.words || data.words.length === 0) return;
  const img = imagePreview;
  if (!img.complete) {
    img.onload = () => drawBoxes(data);
  } else {
    drawBoxes(data);
  }
}

function drawBoxes(data) {
  bboxCtx.clearRect(0, 0, bboxCanvas.width, bboxCanvas.height);
  bboxCtx.strokeStyle = "rgba(255, 0, 0, 0.6)";
  bboxCtx.lineWidth = 2;

  const scaleX = bboxCanvas.width / 3584;
  const scaleY = bboxCanvas.height / 5376;

  data.words.forEach((word) => {
    if (!word.bbox) return;
    const { x, y, w, h } = word.bbox;
    bboxCtx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
  });
}