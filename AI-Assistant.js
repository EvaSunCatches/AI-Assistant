// AI-Assistant.js (Головний файл логіки - ВИТРІМАНИЙ)

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

    // --- API Ініціалізація ---
    const API_KEY = window.GEMINI_API_KEY; 
    let ai = null;
    const model = "gemini-2.5-flash";
    const KEY_PLACEHOLDER = "СЮДИ_ВСТАВТЕ_НОВИЙ_СКОПІЙОВАНИЙ_КЛЮЧ"; 
    let chat = null; // Для Copilot

    // 1. ПЕРЕВІРКА КЛЮЧА ТА ІНІЦІАЛІЗАЦІЯ GEMINI API
    function initializeAI() {
        // Перевіряємо, чи завантажена бібліотека Gemini (для виправлення помилки CDN)
        if (typeof window.GoogleGenerativeAI === 'undefined') {
             const errorText = 'КРИТИЧНА ПОМИЛКА: Бібліотека Google Gen AI не завантажена. Перевірте підключення CDN. (Можливо, допоможе Ctrl+Shift+R)';
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
        // Ініціалізація чату для Copilot
        chat = ai.chats.create({ model: model });
        
        if (assistantButton) assistantButton.disabled = false;
        if (responseArea) responseArea.innerText = "Тут з'явиться детальна відповідь.";
        return true;
    }
    initializeAI();


    // 2. ЛОГІКА КНОПОК ДЖЕРЕЛА (UI/UX)
    let selectedImagePart = null; // Змінна для зберігання Base64 зображення

    // Функція для перетворення файлу в Base64 (необхідно для Gemini)
    function fileToGenerativePart(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    inlineData: {
                        data: reader.result.split(',')[1],
                        mimeType: file.type,
                    },
                });
            };
            reader.readAsDataURL(file);
        });
    }

    if (urlToggleBtn && imageToggleBtn) {
        // ВІДКЛЮЧАЄМО АСИСТЕНТА, ЯКЩО ФОТО ВИБРАНО
        function updateAssistantButtonState() {
            // Кнопка активна, якщо: 1. Режим URL; АБО 2. Режим IMAGE І фото вибрано
            const isImageMode = photoUploadSection.classList.contains('hidden') === false;
            const canCallAssistant = !isImageMode || (isImageMode && selectedImagePart !== null);
            assistantButton.disabled = !canCallAssistant;
            
            if (responseArea && !canCallAssistant && isImageMode) {
                 responseArea.innerText = "Будь ласка, завантажте фото або зробіть знімок.";
            } else if (responseArea && canCallAssistant && isImageMode) {
                 responseArea.innerText = `Фото завантажено! Очікує на запит.`;
            }
        }
        
        urlToggleBtn.addEventListener('click', () => {
            urlToggleBtn.classList.add('source-button-active');
            urlToggleBtn.classList.remove('source-button-inactive');
            imageToggleBtn.classList.remove('source-button-active');
            imageToggleBtn.classList.add('source-button-inactive');
            
            urlSection.classList.remove('hidden'); // Показати секцію URL
            photoUploadSection.classList.add('hidden'); // Приховати секцію завантаження фото
            selectedImagePart = null; // Скидаємо зображення
            updateAssistantButtonState();
        });

        imageToggleBtn.addEventListener('click', () => {
            imageToggleBtn.classList.add('source-button-active');
            imageToggleBtn.classList.remove('source-button-inactive');
            urlToggleBtn.classList.remove('source-button-active');
            urlToggleBtn.classList.add('source-button-inactive');
            
            urlSection.classList.add('hidden'); // Приховати секцію URL
            photoUploadSection.classList.remove('hidden'); // Показати секцію завантаження фото
            updateAssistantButtonState();
        });
        
        // Логіка для "Завантажити фото"
        uploadPhotoBtn.addEventListener('click', () => {
             fileInput.removeAttribute('capture'); // Відкриття галереї/папки
             fileInput.click(); 
        });
        
        // ВИПРАВЛЕНО: Логіка для "Зробити фото" (для камери, включаючи MacBook)
        takePhotoBtn.addEventListener('click', () => {
             fileInput.setAttribute('capture', 'environment'); // Запуск камери (environment для задньої)
             fileInput.click();
        });
        
        // Обробка вибраного файлу
        fileInput.addEventListener('change', async (event) => {
             const file = event.target.files[0];
             if (file) {
                 try {
                     selectedImagePart = await fileToGenerativePart(file);
                     updateAssistantButtonState();
                 } catch (e) {
                     responseArea.innerHTML = `<div class="error-message">Помилка обробки файлу: ${e.message}</div>`;
                     selectedImagePart = null;
                     updateAssistantButtonState();
                 }
             } else {
                 selectedImagePart = null;
                 updateAssistantButtonState();
             }
        });
        
        // Початкова ініціалізація кнопки
        updateAssistantButtonState();
    }


    // 3. ФУНКЦІЯ ВИКЛИКУ АСИСТЕНТА (ОСНОВНА ЛОГІКА)
    if (assistantButton) {
        assistantButton.addEventListener('click', async () => {
            if (!ai || assistantButton.disabled) return;
            
            // Скидання TTS
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (ttsControls) ttsControls.classList.add('hidden'); 
            if (playPauseIcon) playPauseIcon.innerText = 'play_arrow'; 

            responseArea.innerHTML = "Обробка запиту, чекайте...";
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


            try {
                const response = await ai.models.generateContent({
                    model: model,
                    contents: [{ role: "user", parts: promptParts }],
                });
                
                responseArea.innerText = response.text;
                
                // Активація Copilot після першої успішної відповіді
                copilotSection.classList.remove('hidden');

            } catch (error) {
                console.error("Помилка API Gemini:", error);
                responseArea.innerHTML = `<div class="error-message">Помилка при виклику Gemini API: ${error.message}. Перевірте ключ API та ліміти.</div>`;
            } finally {
                assistantButton.disabled = false;
                // Скидаємо стан кнопки, якщо це був режим зображення
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
        recognition.continuous = false; // Вимкнено постійний запис
        recognition.interimResults = false; // Тільки фінальний результат
        recognition.lang = 'uk-UA'; // Українська мова

        const initialColor = micEmojiButton.style.color; // Зберігаємо початковий колір

        // При натисканні на кнопку "мікрофон"
        micEmojiButton.addEventListener('click', () => {
            
            // Якщо вже слухаємо, ігноруємо натискання
            if (micEmojiButton.disabled) return;

            details.placeholder = 'Слухаю...';
            micEmojiButton.disabled = true;
            micEmojiButton.style.color = '#DC2626'; // Червоний колір під час запису
            
            // Очищаємо вміст для нового запису, якщо поле було порожнім
            if (details.value.trim() === '') {
                 details.value = '';
            }
            
            recognition.start();
        });

        // Коли розпізнавання успішне
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            // Додаємо новий текст до існуючого вмісту
            details.value += (details.value.trim() ? ' ' : '') + transcript; 
        };

        // При помилці або завершенні
        recognition.onend = () => {
            details.placeholder = 'Наприклад: "Поясни крок 3 детально." Або: "Знайди помилку в рішенні і виправ її."';
            micEmojiButton.disabled = false;
            micEmojiButton.style.color = initialColor; // Повертаємо початковий колір
        };
        
        recognition.onerror = (event) => {
            console.error("Помилка розпізнавання:", event.error);
            alert("Помилка розпізнавання: " + event.error + ". Переконайтеся, що ви дозволили браузеру доступ до мікрофона.");
            micEmojiButton.disabled = false;
            micEmojiButton.style.color = initialColor; // Повертаємо початковий колір
        };

    } else if (micEmojiButton) {
         // Деактивуємо, якщо STT не підтримується браузером
         micEmojiButton.disabled = true; 
         micEmojiButton.title = "Голосове введення не підтримується вашим браузером";
         micEmojiButton.style.opacity = 0.5;
    }


    // 5. ЛОГІКА COPILOT (ЧАТ) ТА STT (ГОЛОСОВИЙ ЗАПИС) - БЕЗ ЗМІН
    
    // ... (тут має бути ваша існуюча логіка Copilot, включаючи ttsControls, playTtsBtn, та логіку запису аудіо)

    // Примітка: Логіка TTS (текст-у-мовлення) та логіка запису аудіо для Copilot
    // вимагає значного обсягу коду, який залишився незмінним,
    // оскільки ви підтвердили, що вона працює.
    // Якщо потрібна повна версія, повідомте мені.

    // Забезпечуємо активацію кнопки "Надіслати" для Copilot при введенні тексту
    if (copilotTextInput) {
        copilotTextInput.addEventListener('input', () => {
            sendCopilotBtn.disabled = copilotTextInput.value.trim().length === 0;
        });
    }

    // Приклад логіки відправки Copilot
    if (sendCopilotBtn) {
         sendCopilotBtn.addEventListener('click', async () => {
             const userMessage = copilotTextInput.value.trim();
             if (!userMessage || !chat) return;

             copilotResponseArea.innerHTML = 'Завантаження...';
             copilotTextInput.value = '';
             sendCopilotBtn.disabled = true;

             try {
                 // Відправка повідомлення в чат
                 const result = await chat.sendMessage({ text: userMessage });
                 
                 // Відображення відповіді
                 copilotResponseArea.innerText = result.text; 

             } catch (error) {
                 copilotResponseArea.innerHTML = `<div class="error-message">Помилка Copilot: ${error.message}</div>`;
                 console.error("Copilot Error:", error);
             } finally {
                 sendCopilotBtn.disabled = false;
             }
         });
     }
    
    // ... (Кінець логіки Copilot)
});
