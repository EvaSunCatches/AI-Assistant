// AI-Assistant.js (Головний файл логіки)

document.addEventListener('DOMContentLoaded', () => {

    // --- Змінні DOM-елементів ---
    const responseArea = document.getElementById('response-area');
    const assistantButton = document.getElementById('assistant-call-button');
    const details = document.getElementById('task-details');
    // ... інші поля вводу
    const subject = document.getElementById('subject');
    const url = document.getElementById('url');
    const paragraph = document.getElementById('paragraph-number'); 
    const page = document.getElementById('page-number');         
    const task = document.getElementById('task-number');          

    // --- Елементи керування STT/TTS ---
    const micEmojiButton = document.getElementById('mic-emoji-button'); 
    const ttsControls = document.getElementById('tts-controls');
    const playTtsBtn = document.getElementById('play-tts-btn');
    const playPauseIcon = document.getElementById('play-pause-icon');
    const rewindTtsBtn = document.getElementById('rewind-tts-btn');
    const forwardTtsBtn = document.getElementById('forward-tts-btn');

    // --- Елементи керування Copilot ---
    const copilotSection = document.getElementById('copilot-section');
    const micCopilotButton = document.getElementById('mic-copilot-button');
    const startRecordingBtn = document.getElementById('start-recording-btn');
    const recordingStatus = document.getElementById('recording-status');
    const recordingIcon = document.getElementById('recording-icon');
    const copilotTextInput = document.getElementById('copilot-text-input');
    const sendCopilotBtn = document.getElementById('send-copilot-btn');
    const copilotResponseArea = document.getElementById('copilot-response-area'); 
    
    // --- Елементи керування Photo/Camera UI ---
    const urlToggleBtn = document.getElementById('url-toggle');
    const imageToggleBtn = document.getElementById('image-toggle'); 
    const photoUploadSection = document.getElementById('photo-upload-section'); 
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');
    const takePhotoBtn = document.getElementById('take-photo-btn');
    const fileInput = document.getElementById('file-input');
    const urlSection = document.getElementById('url-section'); 

    // --- API Ініціалізація ---
    const API_KEY = window.GEMINI_API_KEY; 
    let ai = null;
    const model = "gemini-2.5-flash";
    const KEY_PLACEHOLDER = "ВАШ_ДІЙСНИЙ_КЛЮЧ_GEMINI_API"; 

    // 1. ПЕРЕВІРКА КЛЮЧА ТА ІНІЦІАЛІЗАЦІЯ GEMINI API
    function initializeAI() {
        // Перевіряємо, чи завантажена бібліотека Gemini (для виправлення помилки CDN)
        if (typeof window.GoogleGenerativeAI === 'undefined') {
             const errorText = 'КРИТИЧНА ПОМИЛКА: Бібліотека Google Gen AI не завантажена. Перевірте підключення CDN.';
             if (responseArea) responseArea.innerHTML = `<div class="error-message">${errorText}</div>`;
             if (assistantButton) assistantButton.disabled = true;
             console.error(errorText);
             return false;
        }

        if (typeof API_KEY === 'undefined' || !API_KEY || API_KEY === KEY_PLACEHOLDER || API_KEY.length < 30) {
            const errorText = 'КРИТИЧНА ПОМИЛКА: Ключ Gemini API не знайдено або недійсний. Перевірте, чи коректно він вставлений у <strong>assets/api_config.js</strong>!';
            if (responseArea) responseArea.innerHTML = `<div class="error-message">${errorText}</div>`;
            if (assistantButton) assistantButton.disabled = true;
            console.error("КРИТИЧНА ПОМИЛКА: Ключ GEMINI_API_KEY не знайдено або недійсний.");
            return false;
        }

        const { GoogleGenerativeAI } = window; 
        ai = new GoogleGenerativeAI(API_KEY);
        if (assistantButton) assistantButton.disabled = false;
        if (responseArea) responseArea.innerText = "Тут з'явиться детальна відповідь.";
        return true;
    }
    initializeAI();


    // 2. ЛОГІКА КНОПОК ДЖЕРЕЛА (UI/UX)
    if (urlToggleBtn && imageToggleBtn) {
        urlToggleBtn.addEventListener('click', () => {
            urlToggleBtn.classList.add('source-button-active');
            urlToggleBtn.classList.remove('source-button-inactive');
            imageToggleBtn.classList.remove('source-button-active');
            imageToggleBtn.classList.add('source-button-inactive');
            
            urlSection.classList.remove('hidden'); // Показати секцію URL
            photoUploadSection.classList.add('hidden'); // Приховати секцію завантаження фото
        });

        imageToggleBtn.addEventListener('click', () => {
            imageToggleBtn.classList.add('source-button-active');
            imageToggleBtn.classList.remove('source-button-inactive');
            urlToggleBtn.classList.remove('source-button-active');
            urlToggleBtn.classList.add('source-button-inactive');
            
            urlSection.classList.add('hidden'); // Приховати секцію URL
            photoUploadSection.classList.remove('hidden'); // Показати секцію завантаження фото
        });
        
        // Логіка для "Завантажити фото"
        uploadPhotoBtn.addEventListener('click', () => {
             // ВИПРАВЛЕНО: Примусово видаляємо атрибут capture для відкриття папки
             fileInput.removeAttribute('capture');
             fileInput.click(); 
        });
        
        // Логіка для "Зробити фото" (відкриває камеру)
        takePhotoBtn.addEventListener('click', () => {
             // ВИПРАВЛЕНО: Примусово встановлюємо атрибут capture для запуску камери
             fileInput.setAttribute('capture', 'environment'); // 'environment' для задньої камери
             fileInput.click();
        });
    }

    // 3. ФУНКЦІЯ ВИКЛИКУ АСИСТЕНТА (ОСНОВНА ЛОГІКА)
    if (assistantButton) {
        assistantButton.addEventListener('click', async () => {
            if (!ai || assistantButton.disabled) return;
            
            // Скидання TTS
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (ttsControls) ttsControls.classList.add('hidden'); 
            if (playPauseIcon) playPauseIcon.innerText = 'play_arrow'; // Іконка Material Icons

            responseArea.innerHTML = "Обробка запиту, чекайте...";
            assistantButton.disabled = true;
            
            // Формування промпта
            const prompt = `Предмет: ${subject.value}. Джерело: ${url.value}. Параграф: ${paragraph.value}. Сторінка: ${page.value}. Номер завдання: ${task.value}. 
            Деталі завдання: ${details.value}. 
            Сформуй деталізовану, покрокову відповідь українською мовою.`;

            try {
                const response = await ai.models.generateContent({
                    model: model,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });
                
                responseArea.innerText = response.text;
                if (ttsControls) ttsControls.classList.remove('hidden'); 
            } catch (error) {
                // Виводимо більш конкретне повідомлення про помилку API
                let errorMessage = error.message.includes('API_KEY_INVALID') || error.message.includes('API key is not valid')
                    ? "Недійсний ключ API. **Спробуйте створити новий ключ!** Перевірте <strong>assets/api_config.js</strong>." 
                    : `Помилка API: Не вдалося отримати відповідь. Деталі: ${error.message}.`;
                    
                responseArea.innerHTML = `<div class="error-message">${errorMessage}</div>`;
                console.error("Gemini API Error:", error);
                if (ttsControls) ttsControls.classList.add('hidden');
            } finally {
                assistantButton.disabled = false;
            }
        });
    }


    // 4. ЛОГІКА TEXT-TO-SPEECH (TTS) - Озвучення відповіді
    const synth = window.speechSynthesis;
    let utterance = null;

    function getUkrainianVoice() {
        return synth.getVoices().find(voice => voice.lang.startsWith('uk') || voice.name.includes('Ukrainian'));
    }

    if (synth && 'SpeechSynthesisUtterance' in window) {
        
        synth.onvoiceschanged = () => {
             if (!utterance) {
                 utterance = new SpeechSynthesisUtterance();
                 utterance.lang = 'uk-UA';
             }
        };

        playTtsBtn.addEventListener('click', () => {
            const textToSpeak = responseArea.innerText;

            if (synth.speaking && synth.paused) {
                synth.resume();
                playPauseIcon.innerText = 'pause'; 
            } else if (synth.speaking && !synth.paused) {
                synth.pause();
                playPauseIcon.innerText = 'play_arrow'; 
            } else if (textToSpeak && !textToSpeak.includes("Обробка запиту") && !textToSpeak.includes("КРИТИЧНА ПОМИЛКА")) {
                synth.cancel(); 
                
                utterance = new SpeechSynthesisUtterance(textToSpeak);
                const voice = getUkrainianVoice();
                if (voice) utterance.voice = voice;
                utterance.lang = 'uk-UA';
                utterance.rate = 1.0; 

                synth.speak(utterance); 
                playPauseIcon.innerText = 'pause';

                utterance.onend = () => {
                    playPauseIcon.innerText = 'play_arrow';
                };
            } 
        });

        rewindTtsBtn.addEventListener('click', () => alert("Функція перемотки назад поки що не підтримується на рівні браузера TTS API."));
        forwardTtsBtn.addEventListener('click', () => alert("Функція перемотки вперед поки що не підтримується на рівні браузера TTS API."));

    } else if (ttsControls) {
        ttsControls.innerHTML = '<span class="text-sm text-gray-500">Озвучення тексту (TTS) не підтримується цим браузером.</span>';
    }


    // 5. ЛОГІКА ВІДКРИТТЯ COPILOT
    if (micEmojiButton && copilotSection) {
        micEmojiButton.addEventListener('click', () => {
            copilotSection.classList.toggle('hidden'); 
            copilotTextInput.value = ''; 
            copilotResponseArea.innerText = "Тут з'являться відповіді Copilot."; 
            sendCopilotBtn.disabled = true;
        });
    }

    // Активація кнопки "Надіслати" для Copilot
    if (copilotTextInput && sendCopilotBtn) {
        copilotTextInput.addEventListener('input', () => {
            sendCopilotBtn.disabled = copilotTextInput.value.trim().length === 0;
        });
    }


    // 6. ФУНКЦІЯ SPEECH-TO-TEXT (STT) - Голосове введення
    let recognition = null;
    let isRecording = false;

    if ('webkitSpeechRecognition' in window && startRecordingBtn) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false; 
        recognition.interimResults = true;
        recognition.lang = 'uk-UA';

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                copilotTextInput.value = finalTranscript.trim();
                sendCopilotBtn.disabled = false;
            }
        };

        recognition.onerror = (event) => {
            isRecording = false;
            recordingStatus.innerText = `Помилка: ${event.error}.`;
            recordingIcon.innerText = 'mic'; 
            startRecordingBtn.classList.remove('!bg-gray-500'); 
            startRecordingBtn.classList.add('!bg-red-500'); 
        };

        recognition.onend = () => {
            isRecording = false;
            recordingStatus.innerText = 'Натисніть для початку...';
            recordingIcon.innerText = 'mic';
            startRecordingBtn.classList.remove('!bg-gray-500'); 
            startRecordingBtn.classList.add('!bg-red-500');
        };

        // Кнопка початку запису для Copilot
        startRecordingBtn.addEventListener('click', () => {
            if (!isRecording) {
                 try {
                    recognition.start();
                    isRecording = true;
                    recordingStatus.innerText = 'Запис... Говоріть.';
                    recordingIcon.innerText = 'stop';
                    startRecordingBtn.classList.remove('!bg-red-500');
                    startRecordingBtn.classList.add('!bg-gray-500'); 
                } catch (e) {
                    if (e.name !== 'InvalidStateError') console.error('STT Start Error:', e);
                }
            } else {
                recognition.stop();
            }
        });
        
        // Кнопка мікрофона в полі Copilot
        if (micCopilotButton) {
            micCopilotButton.addEventListener('click', (e) => {
                e.preventDefault();
                startRecordingBtn.click(); // Імітуємо клік на кнопці запису
            });
        }

    } else if (micEmojiButton) {
        micEmojiButton.style.opacity = 0.5;
        if (startRecordingBtn) startRecordingBtn.disabled = true;
        if (recordingStatus) recordingStatus.innerText = 'STT не підтримується.';
    }
    
    // 7. ЛОГІКА COPILOT (НАДСИЛАННЯ ПИТАНЬ)
    sendCopilotBtn.addEventListener('click', async () => {
        const copilotQuestion = copilotTextInput.value.trim();
        if (!copilotQuestion || !ai) return;

        copilotResponseArea.innerHTML = "Обробка запиту Copilot, чекайте...";
        sendCopilotBtn.disabled = true;

        const previousResponse = responseArea.innerText;

        const copilotPrompt = `Ось основна відповідь асистента: "${previousResponse}". 
        Будь ласка, дай розгорнуту відповідь на додаткове питання: "${copilotQuestion}".`;

        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: [{ role: "user", parts: [{ text: copilotPrompt }] }],
            });
            
            copilotResponseArea.innerText = response.text;
        } catch (error) {
            copilotResponseArea.innerHTML = `<div class="error-message">Помилка Copilot API: ${error.message}.</div>`;
            console.error("Copilot API Error:", error);
        } finally {
            sendCopilotBtn.disabled = false;
        }
    });

});
