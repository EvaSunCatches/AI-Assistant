// AI-Assistant.js (Головний файл логіки - ПОВНИЙ І ВИПРАВЛЕНИЙ)

document.addEventListener('DOMContentLoaded', () => {

    // --- Змінні DOM-елементів ---
    const responseArea = document.getElementById('response-area');
    const assistantButton = document.getElementById('assistant-call-button');
    const details = document.getElementById('task-details'); // Поле для STT
    
    // ... інші поля вводу
    const subject = document.getElementById('subject');
    const url = document.getElementById('url');
    const paragraph = document.getElementById('paragraph-number'); 
    const page = document.getElementById('page-number');         
    const task = document.getElementById('task-number');          

    // --- Елементи керування STT/TTS ---
    const micEmojiButton = document.getElementById('mic-emoji-button'); // Мікрофон для Деталей
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
    
    // --- Анімація обробки ---
    const processingAnimation = document.getElementById('processing-animation'); // ID для анімації (див. index.html)

    // --- API Ініціалізація ---
    const API_KEY = window.GEMINI_API_KEY; 
    let ai = null;
    const model = "gemini-2.5-flash";
    const KEY_PLACEHOLDER = "СЮДИ_ВСТАВТЕ_ВАШ_НОВИЙ_РЕАЛЬНИЙ_КЛЮЧ"; 
    let chat = null; // Для Copilot

    // TTS Control Variables
    let currentUtterance = null;
    let ttsSpeaking = false;
    let ttsPaused = false;

    // STT/Audio Recording Variables
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let audioContext = null;
    let audioStream = null;


    // 0. ФУНКЦІЇ ДЛЯ КЕРУВАННЯ АНІМАЦІЄЮ (Пульсація/Дихання)
    function showProcessingAnimation(message = "Обробка запиту, чекайте...", isSpeaking = false) {
        if (responseArea) responseArea.innerHTML = `<div class="loading-message">${message}</div>`;
        if (processingAnimation) {
            processingAnimation.classList.remove('hidden', 'pulse-speaking');
            if (isSpeaking) {
                 processingAnimation.classList.add('pulse-speaking'); // Дихання під час мовлення
            } else {
                 processingAnimation.classList.add('pulse-default');  // Пульсація
            }
        }
    }

    function hideProcessingAnimation(message = "Тут з'явиться детальна відповідь.") {
        if (processingAnimation) {
            processingAnimation.classList.add('hidden');
            processingAnimation.classList.remove('pulse-default', 'pulse-speaking');
        }
        if (responseArea && !responseArea.innerText.includes('Помилка')) {
            responseArea.innerText = message;
        }
    }


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

        // КЛЮЧОВЕ ВИПРАВЛЕННЯ: Якщо ключ має заглушку або менше 30 символів
        if (typeof API_KEY === 'undefined' || !API_KEY || API_KEY === KEY_PLACEHOLDER || API_KEY.length < 30) {
            const errorText = 'КРИТИЧНА ПОМИЛКА: Ключ Gemini API не знайдено, недійсний, або не вставлений коректно. Перевірте <strong>assets/api_config.js</strong>!';
            if (responseArea) responseArea.innerHTML = `<div class="error-message">${errorText}</div>`;
            if (assistantButton) assistantButton.disabled = true;
            console.error("КРИТИЧНА ПОМИЛКА: Ключ GEMINI_API_KEY не знайдено або недійсний.");
            return false;
        }

        const { GoogleGenerativeAI } = window; 
        ai = new GoogleGenerativeAI(API_KEY);
        // Ініціалізація чату для Copilot
        chat = ai.chats.create({ model: model });
        
        if (assistantButton) assistantButton.disabled = false;
        hideProcessingAnimation(); // Скидаємо повідомлення про помилку ключа, якщо все добре
        return true;
    }
    // Запускаємо ініціалізацію одразу
    initializeAI();


    // 2. ЛОГІКА КНОПОК ДЖЕРЕЛА (UI/UX)
    let selectedImagePart = null; // Змінна для зберігання Base64 зображення

    // Функція для перетворення файлу в Base64 (необхідно для Gemini)
    function fileToGenerativePart(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    inlineData: {
                        data: reader.result.split(',')[1],
                        mimeType: file.type,
                    },
                });
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }

    if (urlToggleBtn && imageToggleBtn) {
        // ВІДКЛЮЧАЄМО АСИСТЕНТА, ЯКЩО ФОТО ВИБРАНО
        function updateAssistantButtonState() {
            // Перевіряємо також, чи пройшла ініціалізація AI
            const isAIReady = ai !== null; 
            const isImageMode = photoUploadSection.classList.contains('hidden') === false;
            // !!! Логіка активації кнопки !!!
            const canCallAssistant = isAIReady && (!isImageMode || (isImageMode && selectedImagePart !== null));
            
            if (assistantButton) assistantButton.disabled = !canCallAssistant;
            
            if (responseArea) {
                if (!isAIReady) {
                     // Не змінюємо текст, якщо там вже є повідомлення про помилку ключа/CDN
                     return; 
                } else if (!canCallAssistant && isImageMode) {
                     responseArea.innerText = "Будь ласка, завантажте фото або зробіть знімок.";
                } else if (canCallAssistant && isImageMode) {
                     responseArea.innerText = `Фото завантажено! Очікує на запит.`;
                } else if (!isImageMode && isAIReady) {
                     responseArea.innerText = "Тут з'явиться детальна відповідь.";
                }
            }
        }
        
        urlToggleBtn.addEventListener('click', () => {
            urlToggleBtn.classList.add('source-button-active');
            urlToggleBtn.classList.remove('source-button-inactive');
            imageToggleBtn.classList.remove('source-button-active');
            imageToggleBtn.classList.add('source-button-inactive');
            
            if (urlSection) urlSection.classList.remove('hidden'); 
            if (photoUploadSection) photoUploadSection.classList.add('hidden'); 
            selectedImagePart = null; 
            updateAssistantButtonState();
        });

        imageToggleBtn.addEventListener('click', () => {
            imageToggleBtn.classList.add('source-button-active');
            imageToggleBtn.classList.remove('source-button-inactive');
            urlToggleBtn.classList.remove('source-button-active');
            urlToggleBtn.classList.add('source-button-inactive');
            
            if (urlSection) urlSection.classList.add('hidden'); 
            if (photoUploadSection) photoUploadSection.classList.remove('hidden'); 
            updateAssistantButtonState();
        });
        
        // Логіка для "Завантажити фото"
        if (uploadPhotoBtn && fileInput) {
            uploadPhotoBtn.addEventListener('click', () => {
                 fileInput.removeAttribute('capture'); 
                 fileInput.click(); 
            });
        }
        
        // Логіка для "Зробити фото"
        if (takePhotoBtn && fileInput) {
            takePhotoBtn.addEventListener('click', () => {
                 fileInput.setAttribute('capture', 'environment'); 
                 fileInput.click();
            });
        }
        
        // Обробка вибраного файлу
        if (fileInput) {
            fileInput.addEventListener('change', async (event) => {
                 const file = event.target.files[0];
                 if (file) {
                     if (!file.type.startsWith('image/')) {
                          if (responseArea) responseArea.innerHTML = `<div class="error-message">Будь ласка, виберіть файл зображення.</div>`;
                          selectedImagePart = null;
                          updateAssistantButtonState();
                          return;
                     }
                     try {
                         // Показуємо анімацію обробки фото
                         showProcessingAnimation("Обробка зображення...", false);
                         selectedImagePart = await fileToGenerativePart(file);
                         
                     } catch (e) {
                         if (responseArea) responseArea.innerHTML = `<div class="error-message">Помилка обробки файлу: ${e.message}</div>`;
                         selectedImagePart = null;
                         
                     } finally {
                         hideProcessingAnimation();
                         updateAssistantButtonState();
                     }
                 } else {
                     selectedImagePart = null;
                     updateAssistantButtonState();
                 }
            });
        }
        
        // Початкова ініціалізація кнопки
        updateAssistantButtonState();
    }


    // 3. ФУНКЦІЯ ВИКЛИКУ АСИСТЕНТА (ОСНОВНА ЛОГІКА)
    if (assistantButton) {
        assistantButton.addEventListener('click', async () => {
            if (!ai || assistantButton.disabled) return;
            
            // Скидання TTS
            window.speechSynthesis.cancel();
            if (ttsControls) ttsControls.classList.add('hidden'); 
            if (playPauseIcon) playPauseIcon.innerText = 'play_arrow'; 
            ttsSpeaking = false;
            ttsPaused = false;

            showProcessingAnimation(); // Вмикаємо пульсацію
            assistantButton.disabled = true;
            
            const isImageMode = photoUploadSection.classList.contains('hidden') === false;
            let promptParts = [];

            if (isImageMode && selectedImagePart) {
                 // Режим: По зображенню
                 promptParts.push(selectedImagePart);
                 promptParts.push({ 
                    text: `Предмет: ${subject.value}. Користувач просить: ${details.value}. Сформуй деталізовану, покрокову відповідь українською мовою, ґрунтуючись на наданому зображенні.` 
                 });

            } else {
                 // Режим: По URL
                 const promptText = `Предмет: ${subject.value}. Джерело: ${url.value}. Параграф: ${paragraph.value}. Сторінка: ${page.value}. Номер завдання: ${task.value}. 
                 Деталі завдання: ${details.value}. 
                 Сформуй деталізовану, покрокову відповідь українською мовою.`;
                 promptParts.push({ text: promptText });
            }

            // Очищення Copilot
            if (copilotResponseArea) copilotResponseArea.innerText = '';
            if (copilotTextInput) copilotTextInput.value = '';
            if (sendCopilotBtn) sendCopilotBtn.disabled = true;
            if (chat) chat.history = []; // Скидаємо історію чату

            try {
                const response = await ai.models.generateContent({
                    model: model,
                    contents: [{ role: "user", parts: promptParts }],
                });
                
                if (responseArea) responseArea.innerText = response.text;
                
                // Активація Copilot після першої успішної відповіді
                if (copilotSection) copilotSection.classList.remove('hidden');

            } catch (error) {
                console.error("Помилка API Gemini:", error);
                if (responseArea) responseArea.innerHTML = `<div class="error-message">Помилка при виклику Gemini API: ${error.message}. Перевірте ключ API та ліміти.</div>`;
            } finally {
                hideProcessingAnimation(); // Вимикаємо пульсацію
                assistantButton.disabled = false;
                if (isImageMode) {
                   updateAssistantButtonState();
                }
            }
        });
    }

    // 4. ЛОГІКА SPEECH-TO-TEXT (STT) ДЛЯ ДЕТАЛЕЙ ЗАВДАННЯ (ВИПРАВЛЕНО)
    
    // Перевірка підтримки STT
    if (micEmojiButton && typeof window.webkitSpeechRecognition !== 'undefined') {
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = false; 
        recognition.interimResults = false; 
        recognition.lang = 'uk-UA'; 

        const initialColor = micEmojiButton.style.color; 

        micEmojiButton.addEventListener('click', () => {
            
            if (micEmojiButton.disabled) return;

            // Змінюємо placeholder
            if (details) details.placeholder = 'Слухаю...';
            micEmojiButton.disabled = true;
            micEmojiButton.style.color = '#DC2626'; 
            
            recognition.start();
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (details) details.value += (details.value.trim() ? ' ' : '') + transcript; 
        };

        recognition.onend = () => {
            // Повертаємо початковий placeholder
            if (details) details.placeholder = "Наприклад: 'Поясни крок 3 детально.' Або: 'Знайди помилку в рішенні і виправ її.'";
            micEmojiButton.disabled = false;
            micEmojiButton.style.color = initialColor; 
        };
        
        recognition.onerror = (event) => {
            console.error("Помилка розпізнавання:", event.error);
            // Повертаємо placeholder після помилки
            if (details) details.placeholder = "Наприклад: 'Поясни крок 3 детально.' Або: 'Знайди помилку в рішенні і виправ її.'";
            micEmojiButton.disabled = false;
            micEmojiButton.style.color = initialColor; 
        };

    } else if (micEmojiButton) {
         micEmojiButton.disabled = true; 
         micEmojiButton.title = "Голосове введення не підтримується вашим браузером";
         micEmojiButton.style.opacity = 0.5;
    }


    // 5. ЛОГІКА COPILOT (ЧАТ) ТА STT (ГОЛОСОВИЙ ЗАПИС)

    // A. TTS Controls Logic (для відповіді асистента)
    if (playTtsBtn) {
        playTtsBtn.addEventListener('click', () => {
            if (!responseArea.innerText || responseArea.innerText.includes('Помилка')) return;

            if (!ttsSpeaking) {
                // Start speaking
                const text = responseArea.innerText;
                currentUtterance = new SpeechSynthesisUtterance(text);
                currentUtterance.lang = 'uk-UA'; // Українська мова
                currentUtterance.onstart = () => {
                    ttsSpeaking = true;
                    ttsPaused = false;
                    if (playPauseIcon) playPauseIcon.innerText = 'pause';
                    if (ttsControls) ttsControls.classList.remove('hidden');
                    showProcessingAnimation("Асистент говорить...", true); // Вмикаємо "дихання"
                };
                currentUtterance.onend = () => {
                    ttsSpeaking = false;
                    ttsPaused = false;
                    if (playPauseIcon) playPauseIcon.innerText = 'play_arrow';
                    currentUtterance = null;
                    hideProcessingAnimation(responseArea.innerText); // Вимикаємо "дихання"
                };
                window.speechSynthesis.speak(currentUtterance);

            } else if (ttsPaused) {
                // Resume
                window.speechSynthesis.resume();
                ttsPaused = false;
                if (playPauseIcon) playPauseIcon.innerText = 'pause';
                showProcessingAnimation("Асистент говорить...", true); // Вмикаємо "дихання"
            } else {
                // Pause
                window.speechSynthesis.pause();
                ttsPaused = true;
                if (playPauseIcon) playPauseIcon.innerText = 'play_arrow';
                hideProcessingAnimation(responseArea.innerText); // Вимикаємо "дихання"
            }
        });
    }

    // B. Copilot Chat Logic
    if (copilotTextInput && sendCopilotBtn) {
        copilotTextInput.addEventListener('input', () => {
            sendCopilotBtn.disabled = copilotTextInput.value.trim().length === 0;
        });
    }

    if (sendCopilotBtn) {
         sendCopilotBtn.addEventListener('click', async () => {
             const userMessage = copilotTextInput.value.trim();
             if (!userMessage || !chat) return;

             if (copilotResponseArea) copilotResponseArea.innerHTML = '<div class="loading-message">Завантаження...</div>';
             if (copilotTextInput) copilotTextInput.value = '';
             sendCopilotBtn.disabled = true;

             try {
                 const result = await chat.sendMessage({ text: userMessage });
                 if (copilotResponseArea) copilotResponseArea.innerText = result.text; 

             } catch (error) {
                 if (copilotResponseArea) copilotResponseArea.innerHTML = `<div class="error-message">Помилка Copilot: ${error.message}</div>`;
                 console.error("Copilot Error:", error);
             } finally {
                 sendCopilotBtn.disabled = false;
             }
         });
     }
    
    // C. Copilot Audio Recording Logic (заглушка)
    if (startRecordingBtn) {
        startRecordingBtn.addEventListener('click', async () => {
            if (isRecording) {
                // STOP RECORDING
                mediaRecorder.stop();
                isRecording = false;
                startRecordingBtn.classList.remove('!bg-red-500', 'hover:!bg-red-600');
                startRecordingBtn.classList.add('!bg-green-500', 'hover:!bg-green-600');
                if (recordingIcon) recordingIcon.innerText = 'mic';
                if (recordingStatus) recordingStatus.innerText = 'Обробка...';

            } else {
                // START RECORDING
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(audioStream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = event => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        // Очистка потоку
                        audioStream.getTracks().forEach(track => track.stop()); 

                        startRecordingBtn.classList.remove('!bg-green-500', 'hover:!bg-green-600');
                        startRecordingBtn.classList.add('!bg-red-500', 'hover:!bg-red-600');
                        if (recordingStatus) recordingStatus.innerText = 'Натисніть для початку...';
                        
                        await processAudio(audioBlob); // Викликаємо заглушку
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    startRecordingBtn.classList.add('!bg-red-500', 'hover:!bg-red-600');
                    startRecordingBtn.classList.remove('!bg-green-500', 'hover:!bg-green-600');
                    if (recordingIcon) recordingIcon.innerText = 'stop';
                    if (recordingStatus) recordingStatus.innerText = 'Запис... Натисніть для зупинки';

                } catch (err) {
                    console.error('Помилка доступу до мікрофона:', err);
                    if (recordingStatus) recordingStatus.innerText = 'Помилка мікрофона. Дозвольте доступ.';
                }
            }
        });
    }

    // Function to process the audio blob (ЗАГЛУШКА)
    async function processAudio(audioBlob) {
        if (copilotResponseArea) copilotResponseArea.innerHTML = `
            <div class="error-message">Аудіозапис успішно створено (${Math.round(audioBlob.size / 1024)} KB).
            <br>
            **Для фактичної транскрипції та відправки до Gemini потрібен окремий API.**
            <br>
            Введіть питання вручну.
            </div>`;
    }

    // D. Copilot Text Input Microphone (STT) - ВИПРАВЛЕНО
    if (micCopilotButton && typeof window.webkitSpeechRecognition !== 'undefined') {
        const recognitionCopilot = new window.webkitSpeechRecognition();
        recognitionCopilot.continuous = false;
        recognitionCopilot.interimResults = false;
        recognitionCopilot.lang = 'uk-UA';
        
        // Перевіряємо, чи існує кнопка перед доступом до style.color
        const initialCopilotColor = micCopilotButton.style.color; 

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
             // !!! ВИПРАВЛЕННЯ: Використовуємо збережений колір !!!
             if (micCopilotButton) micCopilotButton.style.color = initialCopilotColor; 
        };

        recognitionCopilot.onerror = (event) => {
             if (copilotTextInput) copilotTextInput.placeholder = "Введіть додаткове питання або використовуйте мікрофон";
             console.error("Помилка розпізнавання Copilot:", event.error);
             micCopilotButton.disabled = false;
             // !!! ВИПРАВЛЕННЯ: Використовуємо збережений колір !!!
             if (micCopilotButton) micCopilotButton.style.color = initialCopilotColor;
        };
    } else if (micCopilotButton) {
         micCopilotButton.disabled = true; 
         micCopilotButton.style.opacity = 0.5;
    }


}); // <--- Тільки так, без зайвих дужок!
