// AI-Assistant.js (Головний файл логіки - ПОВНИЙ І ВИПРАВЛЕНИЙ з GEMINI)

// --- Ініціалізація Gemini SDK ---
// Припускаємо, що GEMINI_API_KEY визначено в assets/api_config.js
if (typeof google === 'undefined' || typeof GEMINI_API_KEY === 'undefined') {
    console.error("Gemini SDK або API ключ не завантажено. Перевірте index.html та assets/api_config.js.");
}

// Створюємо клієнт для взаємодії з API
const ai = new google.genai.GoogleGenAI({ apiKey: GEMINI_API_KEY });
const chat = ai.chats.create({ model: "gemini-2.5-flash" }); // Використовуємо chat-сесію для контексту

// --- Допоміжна функція для конвертації Blob в Base64 ---
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Отримуємо рядок Base64 (видаляємо префікс "data:audio/webm;base64,")
            const base64String = reader.result.split(',')[1]; 
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

document.addEventListener('DOMContentLoaded', () => {

    // --- Змінні DOM-елементів ---
    // ... (залишаємо всі ваші змінні DOM-елементів)
    const responseArea = document.getElementById('response-area');
    const assistantButton = document.getElementById('assistant-call-button');
    const details = document.getElementById('task-details'); 
    
    const subject = document.getElementById('subject');
    const url = document.getElementById('url');
    const paragraph = document.getElementById('paragraph-number'); 
    const page = document.getElementById('page-number');         
    const task = document.getElementById('task-number');          

    // --- Елементи керування STT/TTS (Основна секція) ---
    const micEmojiButton = document.getElementById('mic-emoji-button'); 
    const ttsControls = document.getElementById('tts-controls');
    const playTtsBtn = document.getElementById('play-tts-btn');
    const playPauseIcon = document.getElementById('play-pause-icon');
    const rewindTtsBtn = document.getElementById('rewind-tts-btn');
    const forwardTtsBtn = document.getElementById('forward-tts-btn');

    // --- Елементи керування Copilot ---
    const copilotSection = document.getElementById('copilot-section');
    const micCopilotButton = document.getElementById('mic-copilot-button');
    const copilotTextInput = document.getElementById('copilot-text-input');
    const sendCopilotBtn = document.getElementById('send-copilot-btn');
    const copilotResponseArea = document.getElementById('copilot-response-area');
    
    // --- Змінні для запису (Copilot) ---
    const startRecordingBtn = document.getElementById('start-recording-btn');
    const recordingIcon = document.getElementById('recording-icon');
    const recordingStatus = document.getElementById('recording-status');
    
    let mediaRecorder;
    let audioChunks = [];
    let initialRecordingColor; 
    let isRecording = false;

    if (startRecordingBtn) {
        initialRecordingColor = startRecordingBtn.style.backgroundColor;
    }

    /**
     * Надсилає аудіо-блоб до Gemini API для транскрипції та відповіді.
     * @param {Blob} audioBlob - Аудіофайл у форматі Blob.
     */
    const sendAudioToGemini = async (audioBlob) => {
        try {
            copilotResponseArea.textContent = 'Транскрибування та генерація відповіді...';
            
            // 1. Конвертуємо Blob у Base64
            const base64Audio = await blobToBase64(audioBlob);
            const mimeType = audioBlob.type; // Наприклад, 'audio/webm'
            
            // 2. Створюємо частину для аудіо
            const audioPart = {
                inlineData: {
                    data: base64Audio,
                    mimeType: mimeType,
                }
            };
            
            // 3. Створюємо текстову частину (промпт)
            const textPart = "Транскрибуй цей аудіозапис і дай змістовну відповідь, підтримуючи наш діалог. Якщо транскрипція не вдалася, попроси повторити питання.";

            // 4. Надсилаємо запит до чату
            const response = await chat.sendMessage({
                parts: [audioPart, textPart],
            });

            copilotResponseArea.textContent = response.text; // Відображаємо відповідь
        } catch (error) {
            console.error("Помилка при надсиланні аудіо до Gemini:", error);
            copilotResponseArea.textContent = 'Помилка: не вдалося отримати відповідь від AI. Перевірте ключ API та консоль.';
        } finally {
            // Завершення обробки
            recordingStatus.textContent = 'Натисніть для початку...';
            startRecordingBtn.disabled = false;
        }
    };
    
    // ----------------------------------------------------------------
    // --- MediaRecorder Функціонал для кнопки "Натисніть для початку..." ---

    const startMediaRecording = async () => {
        if (isRecording) {
            // ЗУПИНКА ЗАПИСУ
            mediaRecorder.stop();
            isRecording = false;
            recordingIcon.textContent = 'mic'; 
            recordingStatus.textContent = 'Обробка...'; 
            startRecordingBtn.style.backgroundColor = initialRecordingColor; 
            startRecordingBtn.classList.remove('animate-pulse'); 
            startRecordingBtn.disabled = true; 
        } else {
            try {
                // ПОЧАТОК ЗАПИСУ
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Встановлюємо mimeType для кращої сумісності з Gemini (можна залишити 'audio/webm' якщо браузер підтримує)
                const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus') ? 'audio/webm; codecs=opus' : 'audio/webm';
                mediaRecorder = new MediaRecorder(stream, { mimeType });
                audioChunks = []; 
                
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: mimeType });
                    
                    // !!! РЕАЛЬНА ЛОГІКА GEMINI !!!
                    await sendAudioToGemini(audioBlob);
                    
                    // Зупиняємо всі треки, щоб звільнити мікрофон
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                isRecording = true;
                recordingIcon.textContent = 'stop'; 
                recordingStatus.textContent = 'Запис... Натисніть для зупинки'; 
                startRecordingBtn.style.backgroundColor = '#DC2626'; 
                startRecordingBtn.classList.add('animate-pulse'); 
                
            } catch (err) {
                console.error('Помилка доступу до мікрофона:', err);
                copilotResponseArea.textContent = 'Помилка: Необхідний дозвіл на використання мікрофона.';
                recordingStatus.textContent = 'Помилка мікрофона. Натисніть для початку...';
                startRecordingBtn.style.backgroundColor = initialRecordingColor;
            }
        }
    };

    if (startRecordingBtn) {
        startRecordingBtn.addEventListener('click', startMediaRecording);
    }
    
    // ----------------------------------------------------------------
    // --- ФУНКЦІЯ ВІДПРАВКИ КОПІЛОТА (для текстового введення) ---
    
    const sendCopilotMessage = async () => {
        const prompt = copilotTextInput.value.trim();
        if (!prompt) return;

        copilotTextInput.value = ''; // Очищуємо поле введення
        sendCopilotBtn.disabled = true;
        
        copilotResponseArea.textContent = 'Генерація відповіді...';
        
        try {
            // Надсилаємо текстовий запит до чат-сесії
            const response = await chat.sendMessage({
                message: prompt
            });

            copilotResponseArea.textContent = response.text; // Відображаємо відповідь
        } catch (error) {
            console.error("Помилка при надсиланні текстового запиту до Gemini:", error);
            copilotResponseArea.textContent = 'Помилка: не вдалося отримати відповідь від AI.';
        } finally {
            sendCopilotBtn.disabled = false;
        }
    };

    if (sendCopilotBtn) {
        sendCopilotBtn.addEventListener('click', sendCopilotMessage);
    }
    
    // Дозволяємо надсилати повідомлення по Enter
    if (copilotTextInput) {
        copilotTextInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && copilotTextInput.value.trim() && !sendCopilotBtn.disabled) {
                sendCopilotMessage();
            }
        });
        copilotTextInput.addEventListener('input', () => {
            sendCopilotBtn.disabled = !copilotTextInput.value.trim();
        });
    }

    // ----------------------------------------------------------------
    // --- STT (Speech-to-Text) для Copilot Input (Web Speech API) ---
    // (Логіка залишається без змін, але додано перевірку на copilotTextInput)
    if (micCopilotButton && window.webkitSpeechRecognition) {
        const initialCopilotColor = micCopilotButton.style.color; 
        const recognitionCopilot = new window.webkitSpeechRecognition();
        recognitionCopilot.continuous = false;
        recognitionCopilot.interimResults = false;
        recognitionCopilot.lang = 'uk-UA';

        micCopilotButton.addEventListener('click', () => {
            if (micCopilotButton.disabled) return;
            micCopilotButton.disabled = true;
            micCopilotButton.style.color = '#DC2626'; 
            if (copilotTextInput) copilotTextInput.placeholder = 'Слухаю...';
            recognitionCopilot.start();
        });

        recognitionCopilot.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (copilotTextInput) copilotTextInput.value += (copilotTextInput.value.trim() ? ' ' : '') + transcript;
            if (sendCopilotBtn) sendCopilotBtn.disabled = false;
        };

        recognitionCopilot.onend = () => {
             if (copilotTextInput) copilotTextInput.placeholder = "Введіть додаткове питання або використовуйте мікрофон";
             micCopilotButton.disabled = false;
             if (micCopilotButton) micCopilotButton.style.color = initialCopilotColor; 
        };

        recognitionCopilot.onerror = (event) => {
             if (copilotTextInput) copilotTextInput.placeholder = "Введіть додаткове питання або використовуйте мікрофон";
             console.error("Помилка розпізнавання Copilot:", event.error);
             micCopilotButton.disabled = false;
             if (micCopilotButton) micCopilotButton.style.color = initialCopilotColor;
        };
    } else if (micCopilotButton) {
         micCopilotButton.disabled = true; 
         micCopilotButton.style.opacity = 0.5;
    }
    // ----------------------------------------------------------------


    // --- ТУТ МАЮТЬ БУТИ ІНШІ ФУНКЦІЇ (like callAssistant(), tts/stt for details etc.) ---
    // ...
    
});
