import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- ГЛОБАЛЬНІ ЗМІННІ ТА ІНІЦІАЛІЗАЦІЯ ---

// Конфігурація Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCy0oVEmVk4vp3c5BiVonQeDwTJdWuVLBs", // Замініть на свій ключ
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Перевірка наявності глобальних змінних Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(firebaseConfig);
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app;
let db;
let auth;
let userId = null; 
let isAuthReady = false; 

// Глобальні змінні для TTS та аудіо
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let currentPlaybackTime = 0;
let playbackStartTime = 0;
let isPlaying = false;
let currentTTSUtterance = null; // Поточний текст, який озвучується
let currentKaraokeIndex = -1; // Індекс поточного підсвіченого слова

// Глобальні змінні для STT
let recognition;
let isRecording = false;
let currentMicButton = null;

// Модель та API ключ
const API_KEY = ""; // Використовуйте порожній рядок, Canvas надасть ключ
const GENERATIVE_MODEL = "gemini-2.5-flash-preview-09-2025";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const IMAGE_MODEL = "gemini-2.5-flash-preview-tts"; // Хоча це TTS модель, ми використовуємо її для демонстрації MMI
const VOICE_NAME = "Kore"; // Обраний голос для TTS (українська)

// --- ДОПОМІЖНІ ФУНКЦІЇ FIREBASE ---

// Функція для ініціалізації Firebase та аутентифікації
async function initializeFirebase() {
    try {
        const config = JSON.parse(firebaseConfigStr);
        app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);

        // Налаштування автентифікації
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
            } else {
                // Анонімний вхід, якщо немає токена
                if (!initialAuthToken) {
                    await signInAnonymously(auth);
                }
            }
            isAuthReady = true;
            console.log("Firebase Auth Ready. User ID:", userId);

            // Після готовності аутентифікації можна підписатися на Copilot-історію
            if (userId) {
                setupCopilotListener();
            }
        });

        // Використовуємо кастомний токен, якщо він доступний
        if (initialAuthToken) {
            await auth.signInWithCustomToken(initialAuthToken);
        }
        
    } catch (error) {
        console.error("Помилка ініціалізації Firebase:", error);
        document.getElementById('error-message').textContent = `Помилка: Не вдалося ініціалізувати базу даних. ${error.message}`;
        document.getElementById('error-message').classList.remove('hidden');
    }
}

// Функція для отримання шляху до колекції Copilot
function getCopilotCollectionRef() {
    // Приватні дані користувача
    if (!userId) {
         console.error("User ID is not set. Cannot get Firestore reference.");
         return null;
    }
    return collection(db, `artifacts/${appId}/users/${userId}/copilot_history`);
}

// Функція для прослуховування історії Copilot
function setupCopilotListener() {
    const chatRef = getCopilotCollectionRef();
    if (!chatRef) return;

    // Створюємо запит: останні 50 повідомлень, сортуємо за часом
    const q = query(chatRef, orderBy('timestamp', 'desc'), limit(50));

    onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach(doc => {
            messages.push({ ...doc.data(), id: doc.id });
        });
        // Обертаємо назад, щоб найновіші були внизу
        renderCopilotHistory(messages.reverse());
    }, (error) => {
        console.error("Помилка прослуховування Copilot:", error);
        // Тут можна додати виведення помилки користувачеві
    });
}

// Функція для додавання повідомлення в історію
async function addCopilotMessage(sender, text) {
    const chatRef = getCopilotCollectionRef();
    if (!chatRef) return;

    try {
        await addDoc(chatRef, {
            sender: sender, // 'user' або 'assistant'
            text: text,
            timestamp: serverTimestamp() 
        });
    } catch (error) {
        console.error("Помилка додавання повідомлення Copilot:", error);
    }
}

// Функція для рендерингу історії Copilot
function renderCopilotHistory(messages) {
    const historyDiv = document.getElementById('copilot-chat-history');
    historyDiv.innerHTML = messages.map(msg => {
        const isUser = msg.sender === 'user';
        const bgColor = isUser ? 'bg-teal-50' : 'bg-gray-100';
        const alignClass = isUser ? 'self-end' : 'self-start';
        const roleText = isUser ? 'Ви' : 'Асистент';
        const roleColor = isUser ? 'text-teal-700' : 'text-gray-700';

        return `
            <div class="flex flex-col mb-2 ${alignClass} max-w-[90%]">
                <div class="text-xs ${roleColor} font-semibold mb-1">${roleText}</div>
                <div class="${bgColor} p-3 rounded-lg shadow-sm whitespace-pre-wrap">
                    ${msg.text}
                </div>
            </div>
        `;
    }).join('');
    // Прокрутка до низу
    historyDiv.scrollTop = historyDiv.scrollHeight;
}


// --- ФУНКЦІЇ STT (SPEECH-TO-TEXT) ---

function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'uk-UA'; // Українська мова
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            updateMicButton(currentMicButton, true);
            console.log('Голосове введення: Запис розпочато.');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (currentMicButton) {
                const targetTextarea = currentMicButton.closest('.textarea-container').querySelector('textarea');
                targetTextarea.value = transcript;
                targetTextarea.dispatchEvent(new Event('input')); // Запускаємо подію input для реакції UI
            }
        };

        recognition.onend = () => {
            isRecording = false;
            updateMicButton(currentMicButton, false);
            console.log('Голосове введення: Запис завершено.');
        };

        recognition.onerror = (event) => {
            isRecording = false;
            updateMicButton(currentMicButton, false);
            console.error('Помилка голосового введення:', event.error);
            showError(`Помилка голосового введення: ${event.error}`);
        };
    } else {
        console.warn('Speech Recognition не підтримується цим браузером.');
    }
}

function updateMicButton(button, recording) {
    if (button) {
        const icon = button.querySelector('.material-icons-outlined');
        if (recording) {
            button.classList.add('mic-button-recording');
            icon.textContent = 'mic_off'; // Змінюємо іконку на "вимкнути"
        } else {
            button.classList.remove('mic-button-recording');
            icon.textContent = 'mic'; // Змінюємо іконку назад на "мікрофон"
        }
    }
}

function toggleSpeechRecognition(event) {
    if (!recognition) return;

    const button = event.currentTarget;
    const targetTextarea = button.closest('.textarea-container').querySelector('textarea');

    if (isRecording && currentMicButton === button) {
        recognition.stop();
        currentMicButton = null;
    } else {
        if (isRecording) {
             recognition.stop(); // Зупиняємо попередній запис, якщо він був активний
        }
        currentMicButton = button;
        targetTextarea.value = ''; // Очищаємо перед новим записом
        try {
             recognition.start();
        } catch (e) {
             console.error('Помилка запуску розпізнавання мови:', e);
             showError('Помилка запуску голосового введення. Переконайтеся, що мікрофон доступний.');
             updateMicButton(button, false);
             isRecording = false;
        }
    }
}

// --- ФУНКЦІЇ TTS (TEXT-TO-SPEECH) ТА КАРАОКЕ ---

// Базові функції конвертації PCM -> WAV
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcmToWav(pcm16, sampleRate) {
    const buffer = new ArrayBuffer(44 + pcm16.byteLength);
    const view = new DataView(buffer);
    let offset = 0;

    // RIFF identifier
    writeString(view, offset, 'RIFF'); offset += 4;
    // file length
    view.setUint32(offset, 36 + pcm16.byteLength, true); offset += 4;
    // RIFF type
    writeString(view, offset, 'WAVE'); offset += 4;

    // format chunk identifier
    writeString(view, offset, 'fmt '); offset += 4;
    // format chunk length
    view.setUint32(offset, 16, true); offset += 4;
    // sample format (1 for PCM)
    view.setUint16(offset, 1, true); offset += 2;
    // channel count
    view.setUint16(offset, 1, true); offset += 2;
    // sample rate
    view.setUint32(offset, sampleRate, true); offset += 4;
    // byte rate (sample rate * block align)
    view.setUint32(offset, sampleRate * 2, true); offset += 4;
    // block align (channels * bytes per sample)
    view.setUint16(offset, 2, true); offset += 2;
    // bits per sample
    view.setUint16(offset, 16, true); offset += 2;

    // data chunk identifier
    writeString(view, offset, 'data'); offset += 4;
    // data chunk length
    view.setUint32(offset, pcm16.byteLength, true); offset += 4;

    // write the PCM data
    const pcm8 = new Int8Array(pcm16.buffer);
    for (let i = 0; i < pcm8.length; i++, offset++) {
        view.setInt8(offset, pcm8[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Функція для завантаження аудіо
async function loadAudio(data, sampleRate) {
    if (audioContext) {
        audioContext.close();
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // API повертає signed PCM16
    const pcm16 = new Int16Array(base64ToArrayBuffer(data));

    // Створюємо аудіо буфер
    const buffer = audioContext.createBuffer(
        1, // Моно
        pcm16.length, 
        sampleRate
    );

    const nowBuffering = buffer.getChannelData(0);
    for (let i = 0; i < pcm16.length; i++) {
        // Конвертуємо signed 16-bit PCM у float [-1, 1]
        nowBuffering[i] = pcm16[i] / 32768.0; 
    }
    audioBuffer = buffer;
}


// Функція для відтворення аудіо
function playTTS(textElementId, controlsId) {
    if (!audioBuffer) return;

    // Зупиняємо попереднє відтворення, якщо воно було активне
    stopTTS(); 

    const playBtn = document.getElementById(controlsId.replace('controls', 'play-tts-btn'));
    const playIcon = document.getElementById(controlsId.replace('controls', 'play-pause-icon'));
    const statusSpan = document.getElementById(controlsId.replace('controls', 'playback-status'));
    const rewindBtn = document.getElementById(controlsId.replace('controls', 'rewind-tts-btn'));
    const forwardBtn = document.getElementById(controlsId.replace('controls', 'forward-tts-btn'));

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioContext.destination);

    // Запускаємо відтворення
    playbackStartTime = audioContext.currentTime - currentPlaybackTime;
    sourceNode.start(0, currentPlaybackTime);
    isPlaying = true;

    playIcon.textContent = 'pause';
    statusSpan.textContent = 'Відтворення...';
    rewindBtn.disabled = true;
    forwardBtn.disabled = true;

    // Запуск таймера для караоке
    startKaraokeTimer(textElementId);
    
    // Обробник закінчення відтворення
    sourceNode.onended = () => {
        if (isPlaying) { // Перевірка, щоб не спрацювало при ручній зупинці
            resetTTSState(textElementId, controlsId);
        }
    };
}

// Функція для зупинки аудіо
function pauseTTS(textElementId, controlsId) {
    if (!isPlaying) return;

    if (sourceNode) {
        sourceNode.stop();
        sourceNode.onended = null; // Вимикаємо обробник onended
    }

    isPlaying = false;
    currentPlaybackTime = audioContext.currentTime - playbackStartTime;
    
    const playIcon = document.getElementById(controlsId.replace('controls', 'play-pause-icon'));
    const statusSpan = document.getElementById(controlsId.replace('controls', 'playback-status'));
    const rewindBtn = document.getElementById(controlsId.replace('controls', 'rewind-tts-btn'));
    const forwardBtn = document.getElementById(controlsId.replace('controls', 'forward-tts-btn'));

    playIcon.textContent = 'play_arrow';
    statusSpan.textContent = 'Пауза.';
    
    // Оновлюємо кнопки перемотки на паузі, якщо є лінгвістичні дані
    if (currentTTSUtterance && currentTTSUtterance.words) {
        updateRewindForwardButtons(rewindBtn, forwardBtn);
    }
    
    // Очищаємо таймер караоке
    stopKaraokeTimer();
}

// Функція для зупинки та скидання аудіо
function stopTTS() {
    if (isPlaying) {
        if (sourceNode) {
            sourceNode.stop();
            sourceNode.onended = null; 
        }
        isPlaying = false;
    }
    stopKaraokeTimer();
}

// Функція для повного скидання стану
function resetTTSState(textElementId, controlsId) {
    stopTTS();
    currentPlaybackTime = 0;
    currentKaraokeIndex = -1;
    audioBuffer = null;
    
    const playIcon = document.getElementById(controlsId.replace('controls', 'play-pause-icon'));
    const statusSpan = document.getElementById(controlsId.replace('controls', 'playback-status'));
    const rewindBtn = document.getElementById(controlsId.replace('controls', 'rewind-tts-btn'));
    const forwardBtn = document.getElementById(controlsId.replace('controls', 'forward-tts-btn'));
    const textElement = document.getElementById(textElementId);

    playIcon.textContent = 'play_arrow';
    statusSpan.textContent = 'Готово до відтворення';
    rewindBtn.disabled = true;
    forwardBtn.disabled = true;
    
    // Знімаємо підсвічування
    if (textElement) {
        textElement.querySelectorAll('.karaoke-highlight').forEach(el => {
            el.classList.remove('karaoke-highlight');
        });
    }

    // Вимикаємо кнопку TTS до наступного виклику API
    const ttsButtonId = textElementId === 'task-content' ? 'task-tts-btn' : 'copilot-tts-btn';
    const ttsButton = document.getElementById(ttsButtonId);
    if (ttsButton) {
        ttsButton.disabled = true;
    }
}

// Функція для початку таймера караоке
function startKaraokeTimer(textElementId) {
    if (!currentTTSUtterance || !currentTTSUtterance.words) return;
    
    const words = currentTTSUtterance.words;
    const textElement = document.getElementById(textElementId);
    
    // Очищаємо попередні таймери
    stopKaraokeTimer();

    // Знаходимо початковий індекс для підсвічування
    let startIndex = words.findIndex(word => word.time >= currentPlaybackTime * 1000);
    if (startIndex === -1 && currentPlaybackTime * 1000 >= words[words.length - 1].time) {
        startIndex = words.length; // Якщо відтворення закінчилося
    }
    currentKaraokeIndex = startIndex > 0 ? startIndex - 1 : -1; 
    
    function updateHighlight() {
        if (!isPlaying) return;

        const currentTime = (audioContext.currentTime - playbackStartTime) * 1000; // час у мілісекундах
        
        while (currentKaraokeIndex + 1 < words.length && currentTime >= words[currentKaraokeIndex + 1].time) {
            currentKaraokeIndex++;
            
            // Знімаємо попереднє підсвічування
            if (currentKaraokeIndex > 0) {
                 textElement.querySelector(`#word-${currentKaraokeIndex - 1}`).classList.remove('karaoke-highlight');
            }
            
            // Накладаємо нове підсвічування
            const currentWordSpan = textElement.querySelector(`#word-${currentKaraokeIndex}`);
            if (currentWordSpan) {
                currentWordSpan.classList.add('karaoke-highlight');
            }
        }
        
        if (isPlaying) {
            requestAnimationFrame(updateHighlight);
        }
    }

    requestAnimationFrame(updateHighlight);
}

// Функція для зупинки таймера караоке (використовуємо requestAnimationFrame)
function stopKaraokeTimer() {
    // Оскільки ми використовуємо requestAnimationFrame, ми просто дозволяємо йому завершитись, 
    // встановлюючи isPlaying = false у функції pauseTTS/stopTTS
}

// Оновлення кнопок перемотки
function updateRewindForwardButtons(rewindBtn, forwardBtn) {
    if (!currentTTSUtterance || !currentTTSUtterance.sentences) {
        rewindBtn.disabled = true;
        forwardBtn.disabled = true;
        return;
    }

    // Час відтворення в мс
    const currentTimeMs = currentPlaybackTime * 1000;

    // Знаходимо поточне речення
    let currentSentenceIndex = currentTTSUtterance.sentences.findIndex(
        (s, index) => currentTimeMs >= s.startTime && currentTimeMs < s.endTime
    );

    // Якщо ми на початку або до першого речення
    if (currentSentenceIndex === -1 && currentTimeMs < currentTTSUtterance.sentences[0].startTime) {
        currentSentenceIndex = 0;
    }
    
    // Якщо ми в кінці
    if (currentSentenceIndex === -1 && currentTimeMs >= currentTTSUtterance.sentences[currentTTSUtterance.sentences.length - 1].endTime) {
         currentSentenceIndex = currentTTSUtterance.sentences.length - 1;
    }


    // Rewind: переходимо на початок поточного або попереднього речення
    const canRewind = currentSentenceIndex > 0 || (currentSentenceIndex === 0 && currentTimeMs > currentTTSUtterance.sentences[0].startTime);
    rewindBtn.disabled = !canRewind;

    // Forward: переходимо до наступного речення
    const canForward = currentSentenceIndex < currentTTSUtterance.sentences.length - 1;
    forwardBtn.disabled = !canForward;
}

// Функція перемотки
function seekToSentence(direction, textElementId, controlsId) {
    if (!currentTTSUtterance || !currentTTSUtterance.sentences) return;

    const sentences = currentTTSUtterance.sentences;
    const currentTimeMs = currentPlaybackTime * 1000;
    
    let targetTimeMs = 0;
    
    // Знаходимо поточне речення (як у updateRewindForwardButtons)
    let currentSentenceIndex = sentences.findIndex(
        (s, index) => currentTimeMs >= s.startTime && currentTimeMs < s.endTime
    );
    if (currentSentenceIndex === -1 && currentTimeMs < sentences[0].startTime) {
        currentSentenceIndex = 0;
    }
    if (currentSentenceIndex === -1 && currentTimeMs >= sentences[sentences.length - 1].endTime) {
         currentSentenceIndex = sentences.length - 1;
    }


    if (direction === 'rewind') {
        if (currentSentenceIndex > 0 && currentTimeMs - sentences[currentSentenceIndex].startTime < 500) {
            // Перемотка до початку попереднього речення, якщо ми на початку поточного
            targetTimeMs = sentences[currentSentenceIndex - 1].startTime;
        } else if (currentSentenceIndex >= 0) {
             // Перемотка до початку поточного речення
            targetTimeMs = sentences[currentSentenceIndex].startTime;
        } else {
             // Вже на початку
            targetTimeMs = 0;
        }
        
    } else if (direction === 'forward') {
        if (currentSentenceIndex < sentences.length - 1) {
            // Перемотка до початку наступного речення
            targetTimeMs = sentences[currentSentenceIndex + 1].startTime;
        } else {
            // В кінці, скидаємо стан
             resetTTSState(textElementId, controlsId);
             return;
        }
    }
    
    // Оновлюємо час відтворення та відтворюємо
    currentPlaybackTime = targetTimeMs / 1000;
    pauseTTS(textElementId, controlsId); // Зупиняємо для оновлення кнопок перемотки
    playTTS(textElementId, controlsId);
}

// --- ФУНКЦІЇ API (TTS та GENERATIVE) ---

/**
 * Викликає Gemini API для генерації тексту та лінгвістичних даних (TTS)
 * @param {string} prompt - Текст для озвучення.
 * @returns {Promise<{audioData: string, mimeType: string, words: Array, sentences: Array} | null>}
 */
async function callTTSApi(prompt) {
    showLoading(true, 'Отримання аудіо та лінгвістичних даних...');
    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: VOICE_NAME }
                },
                enableLinguisticsData: true // Запит лінгвістичних даних
            }
        },
        model: TTS_MODEL
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;
        
        // Отримання лінгвістичних даних
        const linguisticsData = candidate?.linguisticsData;
        const words = linguisticsData?.words || [];
        const sentences = linguisticsData?.sentences || [];

        if (audioData && mimeType && mimeType.startsWith("audio/")) {
            const sampleRateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 16000; // За замовчуванням 16000
            
            // Зберігаємо поточний вивід TTS
            currentTTSUtterance = { text: prompt, words, sentences };
            
            // Завантажуємо аудіо
            await loadAudio(audioData, sampleRate);

            return { audioData, mimeType, words, sentences };
        } else {
            throw new Error("Не вдалося отримати аудіо або дані неповні.");
        }
    } catch (error) {
        console.error("Помилка TTS API:", error);
        showError(`Помилка TTS API: ${error.message}`);
        return null;
    } finally {
        showLoading(false);
    }
}

/**
 * Викликає Gemini API для генерації відповіді
 * @param {string} prompt - Запит для моделі.
 * @param {boolean} useGrounding - Чи використовувати Google Search grounding.
 * @returns {Promise<string>} Згенерований текст.
 */
async function callGenerativeApi(prompt, useGrounding = false) {
    showLoading(true, 'Обробка завдання асистентом...');

    const systemPrompt = `Ви - AI Освітній Асистент, спеціалізований на допомозі українським школярам. Ваші відповіді мають бути чіткими, навчальними та доброзичливими. Завжди відповідайте українською мовою. Ваша мета - пояснити, як вирішити завдання, а не просто дати відповідь. Використовуйте Markdown для форматування (жирний шрифт, списки, математичні формули у форматі LaTeX).`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: useGrounding ? [{ google_search: {} }] : undefined,
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATIVE_MODEL}:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Не вдалося отримати відповідь від моделі.";
        return text;

    } catch (error) {
        console.error("Помилка Generative API:", error);
        showError(`Помилка Generative API: ${error.message}`);
        return "Виникла помилка під час отримання відповіді. Спробуйте ще раз.";
    } finally {
        showLoading(false);
    }
}


// --- ОСНОВНА ЛОГІКА ДОДАТКУ ---

// Функція для відображення помилок
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Автоматично приховувати через 5 секунд
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// Функція для керування станом завантаження
function showLoading(isLoading, message = '') {
    const button = document.getElementById('assistant-call-button');
    const buttonIcon = button.querySelector('span:first-child');
    const buttonText = button.querySelector('span:last-child');
    
    button.disabled = isLoading;
    
    if (isLoading) {
        buttonIcon.textContent = 'hourglass_bottom';
        buttonText.textContent = message;
    } else {
        buttonIcon.textContent = 'auto_fix_high';
        buttonText.textContent = 'Отримати допомогу асистента';
    }
}

// Функція для підготовки тексту до караоке (додавання span-тегів)
function prepareTextForKaraoke(text, words, textElementId) {
    const textElement = document.getElementById(textElementId);
    textElement.innerHTML = ''; // Очищаємо

    if (!words || words.length === 0) {
        // Якщо немає лінгвістичних даних, просто відображаємо текст
        textElement.textContent = text;
        return;
    }
    
    let htmlContent = '';
    let currentTextIndex = 0;

    words.forEach((wordData, index) => {
        const wordText = wordData.word;
        const wordLength = wordText.length;
        
        // Визначаємо текст до слова (пробіли та пунктуація)
        const precedingText = text.substring(currentTextIndex, wordData.textIndex);
        if (precedingText) {
             htmlContent += precedingText;
        }

        // Додаємо слово в span
        // Використовуємо .karaoke-word для дефолтного стилю
        htmlContent += `<span id="word-${index}" class="karaoke-word">${wordText}</span>`;
        
        // Оновлюємо поточний індекс у вихідному тексті
        currentTextIndex = wordData.textIndex + wordLength;
    });

    // Додаємо залишок тексту
    const remainingText = text.substring(currentTextIndex);
    if (remainingText) {
         htmlContent += remainingText;
    }

    textElement.innerHTML = htmlContent;
}


// Обробник основної кнопки "Отримати допомогу"
async function handleAssistantCall() {
    // 1. Збір даних
    const isUrlSource = document.getElementById('url-toggle').classList.contains('source-button-active');
    const subject = document.getElementById('subject').value;
    const details = document.getElementById('task-details').value.trim();
    
    let taskDescription = `Предмет: ${subject}. Деталі завдання: ${details}. `;
    
    // 2. Валідація
    if (!details) {
        showError("Будь ласка, введіть деталі завдання (Секція: Вкажіть, що необхідно зробити).");
        return;
    }
    
    if (isUrlSource) {
        const url = document.getElementById('url').value.trim();
        const paragraph = document.getElementById('paragraph-number').value.trim();
        const page = document.getElementById('page-number').value.trim();
        const taskNum = document.getElementById('task-number').value.trim();
        
        if (!url) {
            showError("Будь ласка, введіть URL підручника.");
            return;
        }
        
        taskDescription += `Джерело: URL - ${url}, Параграф - ${paragraph}, Сторінка - ${page}, Номер завдання - ${taskNum}.`;
    } else {
        // Логіка для обробки зображення (зараз просто заглушка)
        // Для спрощення демонстрації MMI поки що не реалізовуємо повний функціонал завантаження/камери
        taskDescription += `Джерело: Зображення. (Вхідне зображення відсутнє в цьому запиті, використовуйте текстові дані).`;
    }
    
    // 3. Виклик Generative API
    const fullPrompt = `На основі наступних даних, надайте: 1) Точний текст самого завдання (TASK) і 2) Детальне покрокове рішення або пояснення (SOLUTION). Форматуйте як один блок тексту. ${taskDescription}`;
    
    const rawResponse = await callGenerativeApi(fullPrompt, true);
    
    // 4. Парсинг відповіді (простий парсинг на основі маркерів)
    let taskContent = "Не вдалося витягти завдання.";
    let solutionContent = rawResponse;

    try {
        // Модель відповідає одним текстом, ми можемо спробувати його розділити, але для надійності
        // поки що відображаємо весь текст як solution, а task беремо з введених даних.
        
        // Припускаємо, що модель відповідає у форматі: **ЗАВДАННЯ:** ... **РІШЕННЯ:** ...
        const taskMatch = rawResponse.match(/(\*\*ЗАВДАННЯ:\*\*|ЗАВДАННЯ:)([^]*?)(\*\*РІШЕННЯ:\*\*|РІШЕННЯ:)/i);
        const solutionMatch = rawResponse.match(/(\*\*РІШЕННЯ:\*\*|РІШЕННЯ:)([^]*)/i);

        if (taskMatch) {
            taskContent = taskMatch[2].trim();
        } else {
             // Якщо парсинг не вдався, використовуємо загальний опис як завдання
             taskContent = `Згенерувати рішення для: "${taskDescription.replace('На основі наступних даних, надайте: 1) Точний текст самого завдання (TASK) і 2) Детальне покрокове рішення або пояснення (SOLUTION). Форматуйте як один блок тексту.', '').trim()}"`;
        }
        
        if (solutionMatch) {
             solutionContent = solutionMatch[2].trim();
        } else {
             solutionContent = rawResponse;
        }
        
    } catch (e) {
        console.warn("Помилка парсингу відповіді моделі:", e);
        // Залишаємо solutionContent як rawResponse
    }


    // 5. Відображення відповіді
    const solutionSection = document.getElementById('solution-section');
    const taskContentDiv = document.getElementById('task-content');
    const solutionContentDiv = document.getElementById('solution-content');
    const taskTTSBtn = document.getElementById('task-tts-btn');

    // Очищаємо попередній стан TTS
    resetTTSState('solution-content', 'tts-controls');
    
    taskContentDiv.innerHTML = taskContent; 
    solutionContentDiv.innerHTML = solutionContent;
    solutionSection.classList.remove('hidden');
    
    // 6. Виклик TTS для завдання
    await prepareAndEnableTTS(taskContent, 'task-content', 'tts-controls', taskTTSBtn);

    // 7. Активація Copilot
    document.getElementById('copilot-section').classList.remove('hidden');
}


// Функція для підготовки і активації TTS
async function prepareAndEnableTTS(textToSpeak, textElementId, controlsId, ttsButton) {
    // Деактивуємо кнопку TTS на час обробки
    ttsButton.disabled = true;

    // Викликаємо TTS API для отримання аудіо та лінгвістичних даних
    const ttsResult = await callTTSApi(textToSpeak);

    if (ttsResult) {
        const { words } = ttsResult;

        // 1. Підготовка тексту до караоке
        prepareTextForKaraoke(textToSpeak, words, textElementId);

        // 2. Активація кнопки TTS та керування відтворенням
        ttsButton.disabled = false;
        
        // Прив'язка обробника до кнопки TTS
        ttsButton.onclick = () => {
             // Якщо зараз щось відтворюється (можливо Copilot), зупиняємо
             stopTTS(); 
             
             // Скидаємо стан для початкового тексту
             currentPlaybackTime = 0;
             currentKaraokeIndex = -1;
             
             // Завантажуємо аудіо знову, оскільки воно могло бути перезаписане Copilot'ом
             // В цьому місці потрібно було б зберегти буфер окремо, але для простоти
             // ми перевикликаємо loadAudio (або просто покладаємося на те, що callTTSApi 
             // вже його завантажив останнім)
             
             // Оскільки loadAudio викликається останнім у callTTSApi, просто граємо
             playTTS(textElementId, controlsId);
        };
        
        // Показуємо елементи керування відтворенням, якщо вони відносяться до основного рішення
        if (controlsId === 'tts-controls') {
             document.getElementById(controlsId).classList.remove('hidden');
        }
        
    } else {
        // Якщо TTS не вдалося, показуємо, що озвучення недоступне
        if (ttsButton) ttsButton.disabled = true;
    }
}


// Обробник відправки Copilot
async function handleCopilotSend() {
    const inputField = document.getElementById('copilot-text-input');
    const copilotResponseArea = document.getElementById('copilot-response-area');
    const text = inputField.value.trim();

    if (!text) return;

    // 1. Додавання повідомлення користувача в історію та очищення поля
    await addCopilotMessage('user', text);
    inputField.value = '';
    
    // 2. Вимкнення кнопки відправки
    document.getElementById('send-copilot-btn').disabled = true;

    // 3. Генерація відповіді (використовуємо ту ж модель, можна без grounding)
    // Додаємо контекст із основного завдання для кращої відповіді
    const taskContext = document.getElementById('task-content').textContent;
    const solutionContext = document.getElementById('solution-content').textContent;
    const fullPrompt = `Контекст основного завдання: "${taskContext}". Контекст рішення: "${solutionContext}". Додаткове питання: "${text}"`;
    
    copilotResponseArea.textContent = 'Асистент думає...';
    
    const assistantResponse = await callGenerativeApi(fullPrompt, false);
    
    // 4. Додавання відповіді асистента в історію
    await addCopilotMessage('assistant', assistantResponse);
    
    // 5. Вивід відповіді Copilot для озвучення
    copilotResponseArea.textContent = assistantResponse;
    document.getElementById('send-copilot-btn').disabled = false;
    
    // 6. Виклик TTS для відповіді Copilot
    const copilotTTSBtn = document.getElementById('copilot-play-tts-btn'); // Використовуємо play кнопку як "TTS-активатор"
    await prepareAndEnableTTS(assistantResponse, 'copilot-response-area', 'copilot-tts-controls', copilotTTSBtn);
}


// --- ІНІЦІАЛІЗАЦІЯ ОБРОБНИКІВ ПОДІЙ ---

function setupEventListeners() {
    // 1. Перемикачі джерела
    document.getElementById('url-toggle').addEventListener('click', () => {
        document.getElementById('url-toggle').classList.add('source-button-active');
        document.getElementById('url-toggle').classList.remove('source-button-inactive');
        document.getElementById('image-toggle').classList.add('source-button-inactive');
        document.getElementById('image-toggle').classList.remove('source-button-active');
        document.getElementById('url-section').classList.remove('hidden');
        document.getElementById('photo-upload-section').classList.add('hidden');
    });

    document.getElementById('image-toggle').addEventListener('click', () => {
        document.getElementById('image-toggle').classList.add('source-button-active');
        document.getElementById('image-toggle').classList.remove('source-button-inactive');
        document.getElementById('url-toggle').classList.add('source-button-inactive');
        document.getElementById('url-toggle').classList.remove('source-button-active');
        document.getElementById('url-section').classList.add('hidden');
        document.getElementById('photo-upload-section').classList.remove('hidden');
    });
    
    // 2. Основна кнопка виклику асистента
    document.getElementById('assistant-call-button').addEventListener('click', handleAssistantCall);
    
    // 3. Обробники TTS/Караоке (використовуємо один набір функцій для основного та Copilot)
    
    // Головна секція TTS
    document.getElementById('play-tts-btn').addEventListener('click', () => {
        if (isPlaying) {
             pauseTTS('task-content', 'tts-controls');
        } else {
             playTTS('task-content', 'tts-controls');
        }
    });
    document.getElementById('rewind-tts-btn').addEventListener('click', () => seekToSentence('rewind', 'task-content', 'tts-controls'));
    document.getElementById('forward-tts-btn').addEventListener('click', () => seekToSentence('forward', 'task-content', 'tts-controls'));
    
    // Copilot секція TTS
    document.getElementById('copilot-play-tts-btn').addEventListener('click', (e) => {
        if (isPlaying) {
             pauseTTS('copilot-response-area', 'copilot-tts-controls');
        } else {
             // Ми використовуємо playTTS як загальний, але перед цим треба викликати prepareAndEnableTTS
             // щоб завантажити буфер, якщо він не був завантажений
             if (!audioBuffer || currentTTSUtterance.text !== document.getElementById('copilot-response-area').textContent) {
                 // Завантажуємо, якщо аудіо буфер не відповідає поточному тексту Copilot
                 prepareAndEnableTTS(document.getElementById('copilot-response-area').textContent, 'copilot-response-area', 'copilot-tts-controls', e.currentTarget);
             } else {
                 playTTS('copilot-response-area', 'copilot-tts-controls');
             }
        }
    });
    document.getElementById('copilot-rewind-tts-btn').addEventListener('click', () => seekToSentence('rewind', 'copilot-response-area', 'copilot-tts-controls'));
    document.getElementById('copilot-forward-tts-btn').addEventListener('click', () => seekToSentence('forward', 'copilot-response-area', 'copilot-tts-controls'));

    // 4. Обробники Copilot
    document.getElementById('send-copilot-btn').addEventListener('click', handleCopilotSend);
    
    document.getElementById('copilot-text-input').addEventListener('input', (e) => {
        document.getElementById('send-copilot-btn').disabled = e.target.value.trim() === '';
    });
    
    // 5. Обробники STT (Speech-to-Text)
    document.getElementById('mic-task-details-button').addEventListener('click', toggleSpeechRecognition);
    document.getElementById('mic-copilot-input-button').addEventListener('click', toggleSpeechRecognition);
    
    // 6. Ініціалізація аудіо контексту
    if (window.AudioContext || window.webkitAudioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Функція, яка викликається при завантаженні сторінки
window.onload = () => {
    // Ініціалізація Firebase
    initializeFirebase();
    
    // Налаштування обробників подій
    setupEventListeners();
    
    // Ініціалізація голосового введення
    initializeSpeechRecognition();
    
    console.log("AI Assistant: Готовий до роботи.");
};
