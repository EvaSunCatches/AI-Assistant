// app.js — фронт для strict/smart + PDF + OCR + камера + TTS + доп. вопросы + караоке

// ================== DOM LINKS ==================
const pdfToggle = document.getElementById("pdf-toggle");
const imageToggle = document.getElementById("image-toggle");
const pdfSection = document.getElementById("pdf-section");
const photoSection = document.getElementById("photo-upload-section");

const subjectSelect = document.getElementById("subject");
const bookSelect = document.getElementById("book-select");
const uploadBookBtn = document.getElementById("upload-book-btn");
const bookFileInput = document.getElementById("book-file-input");

const pageInput = document.getElementById("page-number");
const taskInput = document.getElementById("task-number");
const paragraphInput = document.getElementById("paragraph-number");
const detailsTextarea = document.getElementById("task-details");

const uploadPhotoBtn = document.getElementById("upload-photo-btn");
const takePhotoBtn = document.getElementById("take-photo-btn");
const fileInput = document.getElementById("file-input");

const micButton = document.getElementById("mic-emoji-button");
const assistantBtn = document.getElementById("assistant-call-button");
const responseBlock = document.getElementById("responseBlock");
const responseArea = document.getElementById("response-area");

const ttsControls = document.getElementById("tts-controls");
const playTtsBtn = document.getElementById("play-tts-btn");
const playPauseIcon = document.getElementById("play-pause-icon");

const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const assistantImage = document.getElementById("assistantImage");
const leftPanel = document.getElementById("leftPanel");

// extra questions
const extraSection = document.getElementById("extra-section");
const extraQuestionTextarea = document.getElementById("extra-question");
const extraMicButton = document.getElementById("extra-mic-button");
const extraSendButton = document.getElementById("extra-send-button");

// camera modal
const cameraModal = document.getElementById("camera-modal");
const cameraVideo = document.getElementById("camera-video");
const cameraCanvas = document.getElementById("camera-canvas");
const cameraCaptureBtn = document.getElementById("camera-capture-btn");
const cameraCloseBtn = document.getElementById("camera-close-btn");

// karaoke
const karaokeToggle = document.getElementById("karaoke-toggle");
const karaokeArea = document.getElementById("karaoke-area");

// ================== STATE ==================
let currentMode = "pdf"; // "pdf" | "image"
let currentAnswerText = "";
let speechUtterance = null;
let isSpeaking = false;
let cameraStream = null;

// SpeechRecognition
let recognitionMain = null;
let recognitionExtra = null;
let isRecordingMain = false;
let isRecordingExtra = false;

// Karaoke state
let karaokeSentences = [];
let karaokeIndex = 0;
let karaokeEnabled = true;
let karaokeActive = false;

// ================== HELPERS ==================
function stripMarkdownHeadings(text) {
  if (!text) return "";
  return text.replace(/^#{1,6}\s*/gm, "");
}

function stripBasicMarkdownFormatting(text) {
  if (!text) return "";
  let t = stripMarkdownHeadings(text);
  t = t.replace(/\*\*(.+?)\*\*/g, "$1");
  t = t.replace(/\*(.+?)\*/g, "$1");
  return t;
}

// Разбивка на предложения БЕЗ lookbehind и странных экранирований
function splitToSentences(text) {
  if (!text) return [];
  const clean = stripBasicMarkdownFormatting(text).replace(/\r\n/g, "\n");
  const matches = clean.match(/[^\.!\?…]+[\.!\?…]*/g); // простое деление на "предложения"
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [];
}

// ================== MARKDOWN → HTML ==================
function simpleMarkdownToHtml(text) {
  if (!text) return "";
  let html = text;

  // Escape
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Убираем ### и другие заголовки
  html = html.replace(/^#{1,6}\s*/gm, "");

  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // *italic*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  html = html.replace(/\r\n/g, "\n");
  html = html.replace(/\n{2,}/g, "\n\n");
  html = html
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return html;
}

// ================== UI: toggle modes ==================
pdfToggle?.addEventListener("click", () => {
  currentMode = "pdf";
  pdfToggle.classList.add("active");
  imageToggle.classList.remove("active");
  pdfSection.classList.remove("hidden");
  photoSection.classList.add("hidden");
});

imageToggle?.addEventListener("click", () => {
  currentMode = "image";
  imageToggle.classList.add("active");
  pdfToggle.classList.remove("active");
  photoSection.classList.remove("hidden");
  pdfSection.classList.add("hidden");
});

// ================== Load books ==================
async function loadBooks() {
  try {
    const res = await fetch("/api/books");
    const data = await res.json();
    bookSelect.innerHTML = "";

    if (!data.books || data.books.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Немає PDF у папці books";
      bookSelect.appendChild(opt);
      return;
    }

    let merzlyakFilename = null;

    for (const b of data.books) {
      const opt = document.createElement("option");
      opt.value = b.filename;
      opt.textContent = b.title;
      bookSelect.appendChild(opt);

      // Ищем Мерзляка по имени файла/тайтлу
      const name = (b.filename + " " + (b.title || "")).toLowerCase();
      if (!merzlyakFilename && name.includes("merzlyak")) {
        merzlyakFilename = b.filename;
      }
    }

    // Если нашли Мерзляка — выбираем его, иначе оставляем первый
    if (merzlyakFilename) {
      bookSelect.value = merzlyakFilename;
    } else {
      bookSelect.selectedIndex = 0;
    }
  } catch (err) {
    console.error("loadBooks error:", err);
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Помилка завантаження списку підручників";
    bookSelect.appendChild(opt);
  }
}

// ================== Upload PDF ==================
uploadBookBtn?.addEventListener("click", () => bookFileInput.click());

bookFileInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("book", file);

  try {
    progressBar.style.display = "block";
    progressFill.style.width = "20%";

    const res = await fetch("/api/upload-book", { method: "POST", body: fd });
    const data = await res.json();
    progressFill.style.width = "60%";

    if (!res.ok) {
      alert("Помилка завантаження PDF: " + (data.error || res.status));
      progressBar.style.display = "none";
      return;
    }

    await loadBooks();
    if (data.filename) bookSelect.value = data.filename;
    progressFill.style.width = "100%";
  } catch (err) {
    console.error("upload-book error:", err);
    alert("Помилка завантаження PDF");
  } finally {
    setTimeout(() => {
      progressBar.style.display = "none";
      progressFill.style.width = "0%";
    }, 500);
  }
});

// ================== Image OCR ==================
uploadPhotoBtn?.addEventListener("click", () => fileInput.click());

fileInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("image", file);

  try {
    progressBar.style.display = "block";
    progressFill.style.width = "25%";
    const res = await fetch("/api/image-ocr", { method: "POST", body: fd });
    const data = await res.json();
    progressFill.style.width = "75%";

    if (!res.ok) {
      alert("Помилка обробки зображення (OCR): " + (data.error || res.status));
      return;
    }

    const text = data.text || "";
    detailsTextarea.value =
      text.trim() || "Текст з зображення розпізнано, але він порожній або некоректний.";
  } catch (err) {
    console.error("image-ocr error:", err);
    alert("Помилка обробки зображення (OCR).");
  } finally {
    progressFill.style.width = "100%";
    setTimeout(() => {
      progressBar.style.display = "none";
      progressFill.style.width = "0%";
    }, 400);
  }
});

// ================== Camera (Instagram-style) ==================
takePhotoBtn?.addEventListener("click", async () => {
  try {
    cameraModal.classList.remove("hidden");
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Камера не підтримується цим пристроєм/браузером.");
      closeCamera();
      return;
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraVideo.srcObject = cameraStream;
  } catch (err) {
    console.error("camera error:", err);
    alert("Не вдалося отримати доступ до камери.");
    closeCamera();
  }
});

function closeCamera() {
  if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
  cameraStream = null;
  cameraModal.classList.add("hidden");
}

cameraCloseBtn?.addEventListener("click", () => closeCamera());

cameraCaptureBtn?.addEventListener("click", async () => {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) return;
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  cameraCanvas.width = w;
  cameraCanvas.height = h;
  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(cameraVideo, 0, 0, w, h);

  const blob = await new Promise((resolve) =>
    cameraCanvas.toBlob(resolve, "image/jpeg", 0.9)
  );
  if (!blob) return;

  const fd = new FormData();
  fd.append("image", blob, "camera.jpg");

  try {
    progressBar.style.display = "block";
    progressFill.style.width = "30%";

    const res = await fetch("/api/image-ocr", { method: "POST", body: fd });
    const data = await res.json();
    progressFill.style.width = "80%";

    if (!res.ok) {
      alert("Помилка обробки зображення (OCR): " + (data.error || res.status));
      return;
    }

    const text = data.text || "";
    detailsTextarea.value =
      text.trim() || "Текст з фото розпізнано, але він порожній або некоректний.";
  } catch (err) {
    console.error("image-ocr (camera) error:", err);
    alert("Помилка обробки фото.");
  } finally {
    progressFill.style.width = "100%";
    setTimeout(() => {
      progressBar.style.display = "none";
      progressFill.style.width = "0%";
    }, 400);
    closeCamera();
  }
});

// ================== SpeechRecognition ==================
function createSpeechRecognition(targetTextarea, setRecordingFlagFn, buttonEl) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "uk-UA";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    targetTextarea.value = (targetTextarea.value + " " + text).trim();
  };
  rec.onerror = (e) => {
    console.error("Speech recognition error:", e);
    setRecordingFlagFn(false);
    buttonEl?.classList.remove("recording");
  };
  rec.onend = () => {
    setRecordingFlagFn(false);
    buttonEl?.classList.remove("recording");
  };
  return rec;
}

// main mic
micButton?.addEventListener("click", () => {
  if (!recognitionMain)
    recognitionMain = createSpeechRecognition(
      detailsTextarea,
      (v) => (isRecordingMain = v),
      micButton
    );
  if (!recognitionMain)
    return alert("SpeechRecognition не підтримується цим браузером.");
  if (isRecordingMain) {
    recognitionMain.stop();
    isRecordingMain = false;
    micButton.classList.remove("recording");
  } else {
    recognitionMain.start();
    isRecordingMain = true;
    micButton.classList.add("recording");
  }
});

// extra mic
extraMicButton?.addEventListener("click", () => {
  if (!recognitionExtra)
    recognitionExtra = createSpeechRecognition(
      extraQuestionTextarea,
      (v) => (isRecordingExtra = v),
      extraMicButton
    );
  if (!recognitionExtra)
    return alert("SpeechRecognition не підтримується цим браузером.");
  if (isRecordingExtra) {
    recognitionExtra.stop();
    isRecordingExtra = false;
    extraMicButton.classList.remove("recording");
  } else {
    recognitionExtra.start();
    isRecordingExtra = true;
    extraMicButton.classList.add("recording");
  }
});

// ================== KARAOKE ==================
function clearKaraokeHighlight() {
  if (!karaokeArea) return;
  const lines = karaokeArea.querySelectorAll(".karaoke-line");
  lines.forEach((el) => el.classList.remove("active"));
}

function highlightKaraokeSentence(idx) {
  if (!karaokeArea) return;
  const lines = karaokeArea.querySelectorAll(".karaoke-line");
  lines.forEach((el) => {
    const i = Number(el.dataset.idx);
    el.classList.toggle("active", i === idx);
  });
}

function prepareKaraoke(text) {
  if (!karaokeArea || !karaokeEnabled) return;
  karaokeSentences = splitToSentences(text);
  karaokeIndex = 0;
  karaokeArea.innerHTML = "";

  if (karaokeSentences.length === 0) return;

  const frag = document.createDocumentFragment();
  karaokeSentences.forEach((sentence, idx) => {
    const span = document.createElement("span");
    span.className = "karaoke-line";
    span.dataset.idx = String(idx);
    span.textContent = sentence + " ";
    frag.appendChild(span);
  });
  karaokeArea.appendChild(frag);
}

karaokeToggle?.addEventListener("click", () => {
  karaokeEnabled = !karaokeEnabled;
  karaokeToggle.classList.toggle("active", karaokeEnabled);
  if (!karaokeEnabled && karaokeArea) {
    karaokeArea.innerHTML = "";
  } else if (karaokeEnabled && currentAnswerText) {
    prepareKaraoke(currentAnswerText);
  }
});

// ================== TTS ==================
function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  isSpeaking = false;
  karaokeActive = false;
  playPauseIcon.textContent = "play_arrow";
  clearKaraokeHighlight();
  speechUtterance = null;
}

function speakPlain(text) {
  if (!window.speechSynthesis)
    return alert("Цей браузер не підтримує синтез мовлення.");
  stopSpeaking();
  const t = stripBasicMarkdownFormatting(text);
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "uk-UA";
  u.onend = () => {
    isSpeaking = false;
    karaokeActive = false;
    playPauseIcon.textContent = "play_arrow";
  };
  speechUtterance = u;
  isSpeaking = true;
  karaokeActive = false;
  playPauseIcon.textContent = "pause";
  window.speechSynthesis.speak(u);
}

function speakKaraokeFrom(index) {
  if (!window.speechSynthesis) {
    speakPlain(currentAnswerText);
    return;
  }
  if (!karaokeArea || karaokeSentences.length === 0) {
    speakPlain(currentAnswerText);
    return;
  }
  if (index >= karaokeSentences.length) {
    isSpeaking = false;
    karaokeActive = false;
    playPauseIcon.textContent = "play_arrow";
    clearKaraokeHighlight();
    return;
  }

  stopSpeaking();
  karaokeActive = true;
  isSpeaking = true;
  karaokeIndex = index;
  highlightKaraokeSentence(karaokeIndex);

  const sentence = karaokeSentences[karaokeIndex];
  const u = new SpeechSynthesisUtterance(sentence);
  u.lang = "uk-UA";
  u.onend = () => {
    if (!karaokeActive) return;
    speakKaraokeFrom(karaokeIndex + 1);
  };
  speechUtterance = u;
  playPauseIcon.textContent = "pause";
  window.speechSynthesis.speak(u);
}

playTtsBtn?.addEventListener("click", () => {
  if (!currentAnswerText) return;
  if (isSpeaking) {
    stopSpeaking();
    return;
  }

  if (karaokeEnabled && karaokeArea) {
    prepareKaraoke(currentAnswerText);
    speakKaraokeFrom(0);
  } else {
    speakPlain(currentAnswerText);
  }
});

// ================== Parallax ассистента ==================
leftPanel?.addEventListener("scroll", () => {
  const scrollY = leftPanel.scrollTop;
  const offset = scrollY * 0.04;
  assistantImage.style.transform = `translateY(${offset}px) scale(1.02)`;
});

// ================== Main assistant ==================
assistantBtn?.addEventListener("click", async () => {
  stopSpeaking();
  ttsControls.style.display = "none";
  assistantImage.classList.add("thinking");
  assistantBtn.disabled = true;
  responseBlock.classList.add("open");
  responseArea.textContent = "Асистент думає...";

  try {
    const mode = currentMode;
    const details = (detailsTextarea.value || "").trim();
    const book = bookSelect.value || "";
    const page = (pageInput.value || "").trim();
    const task = (taskInput.value || "").trim();
    const paragraph = (paragraphInput.value || "").trim();
    const subject = subjectSelect.value || "";

    let endpoint = "/api/task/strict";
    let payload = {};

    if (mode === "pdf") {
      if (book && page && task) {
        // STRICT
        endpoint = "/api/task/strict";
        payload = {
          book,
          page: Number(page),
          taskNumber: Number(task),
          details,
          subject,
          paragraph
        };
      } else if (book && task && !page) {
        // SMART по книге
        endpoint = "/api/task/smart";
        payload = {
          book,
          taskNumber: Number(task),
          details,
          subject,
          paragraph
        };
      } else if (details) {
        // Просто вопрос
        endpoint = "/api/task/smart";
        payload = { question: details, subject };
      } else {
        responseArea.textContent =
          "Будь ласка, вкажіть хоча б номер завдання або напишіть питання в полі деталей.";
        return;
      }
    } else {
      // IMAGE MODE
      if (details) {
        endpoint = "/api/task/smart";
        payload = { question: details, subject };
      } else {
        responseArea.textContent =
          "Опишіть завдання в полі деталей, щоб асистент міг допомогти.";
        return;
      }
    }

    progressBar.style.display = "block";
    progressFill.style.width = "30%";

    let res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let data = await res.json();

    // fallback strict → smart
    if (
      !res.ok &&
      res.status === 404 &&
      book &&
      task &&
      endpoint === "/api/task/strict"
    ) {
      const fallbackPayload = {
        book,
        taskNumber: Number(task),
        details,
        subject,
        paragraph
      };
      endpoint = "/api/task/smart";
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackPayload)
      });
      data = await res.json();
    }

    progressFill.style.width = "80%";

    if (!res.ok) {
      responseArea.textContent =
        data.error || `Помилка сервера (статус ${res.status})`;
      return;
    }

    const pageInfo =
      data.pageIndex != null ? `PDF сторінка: ${data.pageIndex}\n\n` : "";
    const fragmentInfo = data.fragment
      ? `Фрагмент завдання:\n${data.fragment}\n\n`
      : "";
    const aiText =
      data.aiResponse || data.answer || JSON.stringify(data, null, 2);

    currentAnswerText = `${pageInfo}${fragmentInfo}${aiText}`;
    responseArea.innerHTML = simpleMarkdownToHtml(currentAnswerText);

    ttsControls.style.display = "flex";
    extraSection.classList.remove("hidden");

    if (karaokeEnabled && karaokeArea) {
      prepareKaraoke(currentAnswerText);
    }
  } catch (err) {
    console.error("assistant error:", err);
    responseArea.textContent = "Сталася помилка: " + err.message;
  } finally {
    assistantBtn.disabled = false;
    assistantImage.classList.remove("thinking");
    progressFill.style.width = "100%";
    setTimeout(() => {
      progressBar.style.display = "none";
      progressFill.style.width = "0%";
    }, 400);
  }
});

// ================== Extra questions ==================
extraSendButton?.addEventListener("click", async () => {
  stopSpeaking();
  const q = (extraQuestionTextarea.value || "").trim();
  if (!q) return alert("Спочатку введіть додаткове запитання.");
  extraQuestionTextarea.value = "";

  try {
    progressBar.style.display = "block";
    progressFill.style.width = "25%";
    assistantImage.classList.add("thinking");

    const res = await fetch("/api/task/smart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    progressFill.style.width = "75%";

    if (!res.ok)
      return alert(data.error || `Помилка сервера (статус ${res.status})`);

    const aiText =
      data.aiResponse || data.answer || JSON.stringify(data, null, 2);
    currentAnswerText = aiText;
    responseArea.innerHTML = simpleMarkdownToHtml(aiText);
    ttsControls.style.display = "flex";

    if (karaokeEnabled && karaokeArea) {
      prepareKaraoke(currentAnswerText);
    }
  } catch (err) {
    console.error("extra question error:", err);
    alert("Сталася помилка при відправленні додаткового запитання.");
  } finally {
    progressFill.style.width = "100%";
    setTimeout(() => {
      progressBar.style.display = "none";
      progressFill.style.width = "0%";
    }, 400);
    assistantImage.classList.remove("thinking");
  }
});

// старт
loadBooks();