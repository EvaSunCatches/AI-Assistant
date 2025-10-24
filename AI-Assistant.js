// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (ПРЕДОСТАВЛЯЮТСЯ СРЕДОЙ) ---
// Эти переменные теперь доступны в AI-Assistant.js, загруженном как модуль.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase Imports (Firestore и Auth)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Gemini API configuration (Placeholder - API Key is managed by Canvas environment)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";
const TTS_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=";
const API_KEY = ""; // Будет предоставлен Canvas во время выполнения

// --- Элементы DOM ---
const urlToggle = document.getElementById('url-toggle');
const imageToggle = document.getElementById('image-toggle');
const urlSection = document.getElementById('url-section');
const photoUploadSection = document.getElementById('photo-upload-section');
const assistantCallButton = document.getElementById('assistant-call-button');
const responseArea = document.getElementById('response-area');
const taskDetailsInput = document.getElementById('task-details');
const imagePreviewDiv = document.getElementById('image-preview');
const previewImage = document.getElementById('preview-image');
const imageStatus = document.getElementById('image-status');
const fileInput = document.getElementById('file-input');
const uploadPhotoBtn = document.getElementById('upload-photo-btn');
const ttsControls = document.getElementById('tts-controls');
const playPauseIcon = document.getElementById('play-pause-icon');
const playTtsBtn = document.getElementById('play-tts-btn');

let isImageMode = false;
let selectedFileBase64 = null;
let isTtsPlaying = false;
let audioContext = null;
let audioSource = null;
let currentAudioBuffer = null;
let playbackStartTime = 0;
let currentPauseTime = 0;

// --- Инициализация Firebase ---
let auth, db, userId;

const initializeFirebase = async () => {
    if (firebaseConfig) {
        try {
            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);

            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
            userId = auth.currentUser?.uid || crypto.randomUUID();
            console.log("Firebase initialized. User ID:", userId);
            
            // Сохранение ID пользователя (пример)
            await setDoc(doc(db, `/artifacts/${appId}/users/${userId}/config/session`), { 
                lastLogin: new Date().toISOString(),
                appVersion: '1.0'
            }, { merge: true });

        } catch (error) {
            console.error("Firebase Auth or Init error:", error);
            userId = crypto.randomUUID(); // Fallback to a random ID
        }
    } else {
         console.error("Firebase config is missing. Application will run without persistence.");
         userId = crypto.randomUUID();
    }
};

// --- Вспомогательные функции для UI и Логики ---

/**
 * Переключает режимы "По ссылке" и "По изображению".
 * @param {boolean} toImageMode - true, если переключаемся на режим изображения.
 */
const toggleMode = (toImageMode) => {
    isImageMode = toImageMode;
    if (isImageMode) {
        urlToggle.classList.remove('source-button-active');
        urlToggle.classList.add('source-button-inactive');
        imageToggle.classList.add('source-button-active');
        imageToggle.classList.remove('source-button-inactive');
        urlSection.classList.add('hidden');
        photoUploadSection.classList.remove('hidden');
        imagePreviewDiv.style.display = 'block'; // Показываем блок предпросмотра
    } else {
        urlToggle.classList.add('source-button-active');
        urlToggle.classList.remove('source-button-inactive');
        imageToggle.classList.remove('source-button-active');
        imageToggle.classList.add('source-button-inactive');
        urlSection.classList.remove('hidden');
        photoUploadSection.classList.add('hidden');
        // Сброс данных изображения
        selectedFileBase64 = null;
        previewImage.src = "#";
        imageStatus.textContent = "";
        imagePreviewDiv.style.display = 'none'; // Скрываем блок предпросмотра
    }
    // Сброс ответа и Copilot
    responseArea.innerHTML = "Тут з'явиться детальна відповідь.";
    document.getElementById('copilot-section').classList.add('hidden');
};

/**
 * Конвертирует Base64-encoded PCM16 в WAV Blob.
 * (Функции скопированы из предыдущей версии для самодостаточности)
 */
const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const pcmToWav = (pcm16, sampleRate) => {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm16.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    let offset = 0;

    // RIFF chunk
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + dataSize, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;

    // fmt sub-chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2; // PCM format
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2; // Bits per sample (16-bit)

    // data sub-chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, dataSize, true); offset += 4;

    // Write PCM data
    for (let i = 0; i < pcm16.length; i++, offset += 2) {
        view.setInt16(offset, pcm16[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
};

// --- Обработка событий ---

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация при загрузке DOM
    initializeFirebase(); 
    
    urlToggle.addEventListener('click', () => toggleMode(false));
    imageToggle.addEventListener('click', () => toggleMode(true));

    uploadPhotoBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            imageStatus.textContent = `Завантажено: ${file.name}`;
            imagePreviewDiv.style.display = 'block';
            
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                // Сохраняем только base64 часть (без префикса data:image/...)
                selectedFileBase64 = e.target.result.split(',')[1];
            };
            reader.onerror = () => {
                 imageStatus.textContent = "Помилка при зчитуванні файлу.";
                 selectedFileBase64 = null;
                 previewImage.src = "#";
                 imagePreviewDiv.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
             imageStatus.textContent = "";
             selectedFileBase64 = null;
             imagePreviewDiv.style.display = 'none';
        }
    });

    assistantCallButton.addEventListener('click', handleAssistantCall);
    playTtsBtn.addEventListener('click', toggleTtsPlayback);

    // Сообщение, если камера не поддерживается в iframe
    document.getElementById('take-photo-btn').addEventListener('click', () => {
        responseArea.textContent = "Функція 'Зробити фото' може не працювати у цьому середовищі. Використовуйте 'Завантажити фото'.";
    });

});


// --- Основная логика: Запрос к Gemini и TTS ---

async function handleAssistantCall() {
    // 1. Сбор данных
    const subject = document.getElementById('subject').value;
    const taskDetails = taskDetailsInput.value;
    let promptParts = [];
    let imagePart = null;

    if (!taskDetails.trim()) {
        responseArea.textContent = "Будь ласка, введіть деталі завдання.";
        return;
    }

    if (isImageMode && selectedFileBase64) {
        // Режим "По изображению"
        const mimeType = previewImage.src.split(':')[1].split(';')[0];
        imagePart = {
            inlineData: {
                mimeType: mimeType,
                data: selectedFileBase64
            }
        };
        promptParts.push({ text: `Предмет: ${subject}. Деталі завдання: ${taskDetails}. Проаналізуй надане зображення та дай повну і розгорнуту відповідь.` });
        promptParts.push(imagePart);
    } else if (!isImageMode) {
        // Режим "По ссылке"
        const url = document.getElementById('url').value;
        const paragraph = document.getElementById('paragraph-number').value;
        const page = document.getElementById('page-number').value;
        const taskNumber = document.getElementById('task-number').value;

        if (!url.trim()) {
             responseArea.textContent = "Будь ласка, введіть URL підручника.";
             return;
        }

        const fullPrompt = `Предмет: ${subject}. Посилання на підручник: ${url}. Параграф: ${paragraph}. Сторінка: ${page}. Номер завдання: ${taskNumber}. Деталі завдання: ${taskDetails}. Використовуючи інформацію з джерела, дай розгорнуте та зрозуміле пояснення, керуючись рівнем 5-го класу.`;

        promptParts.push({ text: fullPrompt });
    } else {
         responseArea.textContent = "Будь ласка, завантажте зображення або переключіться на режим посилання.";
         return;
    }

    // 2. Визуальная обратная связь
    assistantCallButton.disabled = true;
    responseArea.textContent = "Асистент генерує відповідь... Це може зайняти кілька секунд.";
    ttsControls.classList.add('hidden'); // Скрываем управление TTS

    try {
        // 3. Вызов Gemini API
        const payload = {
            contents: [{ parts: promptParts }],
            tools: [{ "google_search": {} }],
            systemInstruction: {
                parts: [{ text: "Ти — українськомовний освітній асистент. Твої відповіді мають бути деталізовані, дружні, навчальні та відповідати шкільному рівню (зокрема 5-му класу), якщо інше не вказано." }]
            },
        };

        const response = await fetch(GEMINI_API_URL + API_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Помилка: не вдалося отримати відповідь від асистента.";
        responseArea.textContent = text;
        document.getElementById('copilot-section').classList.remove('hidden');

        // 4. Генерация TTS после успешного ответа
        await generateTts(text);

    } catch (error) {
        console.error("Помилка при виклику Gemini API:", error);
        responseArea.textContent = "Помилка з'єднання або обробки запиту. Спробуйте ще раз.";
    } finally {
        assistantCallButton.disabled = false;
    }
}

async function generateTts(textToSpeak) {
     ttsControls.classList.add('hidden'); 

     try {
        const payload = {
            contents: [{ parts: [{ text: textToSpeak }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: "Kore" } 
                    }
                }
            },
            model: "gemini-2.5-flash-preview-tts"
        };

        const ttsResponse = await fetch(TTS_API_URL + API_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const ttsResult = await ttsResponse.json();
        const part = ttsResult?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
            const rateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 16000;

            const pcmData = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, sampleRate);

            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sampleRate });
            const arrayBuffer = await wavBlob.arrayBuffer();

            audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                currentAudioBuffer = buffer;
                isTtsPlaying = false;
                currentPauseTime = 0;
                playPauseIcon.textContent = 'play_arrow';
                ttsControls.classList.remove('hidden');
                playTtsBtn.disabled = false;
            }, (e) => {
                console.error("Error decoding audio data", e);
                responseArea.textContent += "\n[Помилка TTS: Не вдалося відтворити аудіо.]";
            });

        } else {
            console.error("TTS failed or audio data missing:", ttsResult);
            responseArea.textContent += "\n[Помилка TTS: Не вдалося згенерувати аудіо.]";
        }

     } catch (error) {
         console.error("Помилка при виклику TTS API:", error);
         responseArea.textContent += "\n[Помилка TTS: Помилка з'єднання.]";
     }
}

function toggleTtsPlayback() {
    if (!currentAudioBuffer) return;

    if (isTtsPlaying) {
        // Пауза
        audioSource.stop();
        currentPauseTime += audioContext.currentTime - playbackStartTime;
        isTtsPlaying = false;
        playPauseIcon.textContent = 'play_arrow';
    } else {
        // Воспроизведение / Продолжение
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        audioSource = audioContext.createBufferSource();
        audioSource.buffer = currentAudioBuffer;
        audioSource.connect(audioContext.destination);

        const offset = currentPauseTime % currentAudioBuffer.duration;
        audioSource.start(0, offset);
        playbackStartTime = audioContext.currentTime;

        isTtsPlaying = true;
        playPauseIcon.textContent = 'pause';

        // Сброс состояния по окончании
        audioSource.onended = () => {
            if (isTtsPlaying) { 
                isTtsPlaying = false;
                currentPauseTime = 0;
                playPauseIcon.textContent = 'play_arrow';
            }
        };
    }
}
