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
    // const rewindTtsBtn = document.getElementById('rewind-tts-btn'); // Видалено/не використовується
    // const forwardTtsBtn = document.getElementById('forward-tts-btn'); // Видалено/не використовується

    // --- Елементи керування Copilot ---
    const copilotSection = document.getElementById('copilot-section');
    const micCopilotButton = document.getElementById('mic-copilot-button');
    const sendCopilotBtn = document.getElementById('send-copilot-btn');
    const copilotTextInput = document.getElementById('copilot-text-input');
    const copilotResponseArea = document.getElementById('copilot-response-area');

    // --- Глобальні змінні для TTS ---
    let speechSynthesisUtterance = null;
    let isPaused = false;

    // --- Допоміжні функції інтерфейсу ---
    
    // Встановлює статус для головного асистента
    const setAssistantStatus = (message, isLoading = false) => {
        responseArea.innerHTML = isLoading ? `
            <div class="flex items-center space-x-2 text-blue-600">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>${message}</span>
            </div>
        ` : message;
        ttsControls.classList.add('hidden'); // Приховуємо TTS при зміні статусу/відповіді
        if (speechSynthesisUtterance) {
            window.speechSynthesis.cancel();
            speechSynthesisUtterance = null;
            isPaused = false;
        }
    };

    // Встановлює статус для Copilot
    const setCopilotStatus = (message, isLoading = false) => {
        copilotResponseArea.innerHTML = isLoading ? `
            <div class="flex items-center space-x-2 text-blue-600">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>${message}</span>
            </div>
        ` : message;
    };


    // --- Логіка TTS (Text-to-Speech) ---
    const speakText = (text) => {
        if (!('speechSynthesis' in window)) {
            console.error("Ваш браузер не підтримує Text-to-Speech.");
            return;
        }

        window.speechSynthesis.cancel(); // Зупиняємо попереднє відтворення

        speechSynthesisUtterance = new SpeechSynthesisUtterance(text);
        speechSynthesisUtterance.lang = 'uk-UA'; // Українська мова
        
        // Знайти український голос, якщо є
        const voices = window.speechSynthesis.getVoices();
        const ukrainianVoice = voices.find(voice => voice.lang === 'uk-UA');
        if (ukrainianVoice) {
            speechSynthesisUtterance.voice = ukrainianVoice;
        }

        // Початок/Кінець відтворення
        speechSynthesisUtterance.onstart = () => {
            playPauseIcon.textContent = 'pause';
            isPaused = false;
        };
        speechSynthesisUtterance.onend = () => {
            playPauseIcon.textContent = 'play_arrow';
            isPaused = false;
            ttsControls.classList.remove('hidden'); // Залишаємо елементи керування після закінчення
        };
        speechSynthesisUtterance.onerror = (event) => {
            console.error('Помилка TTS:', event);
            playPauseIcon.textContent = 'play_arrow';
            isPaused = false;
        };

        window.speechSynthesis.speak(speechSynthesisUtterance);
        ttsControls.classList.remove('hidden');
    };

    // Керування TTS
    if (playTtsBtn) {
        playTtsBtn.addEventListener('click', () => {
            if (!speechSynthesisUtterance) {
                // Якщо немає Utterance, беремо текст з responseArea
                const text = responseArea.textContent.trim();
                if (text && text !== "Тут з'являться відповіді Асистента.") {
                    speakText(text);
                }
            } else if (window.speechSynthesis.speaking && !isPaused) {
                window.speechSynthesis.pause();
                playPauseIcon.textContent = 'play_arrow';
                isPaused = true;
            } else if (window.speechSynthesis.paused && isPaused) {
                window.speechSynthesis.resume();
                playPauseIcon.textContent = 'pause';
                isPaused = false;
            } else if (!window.speechSynthesis.speaking && !isPaused) {
                // Якщо закінчилося, але Utterance існує, запускаємо знову
                speakText(speechSynthesisUtterance.text);
            }
        });
    }

    // --- Логіка STT (Speech-to-Text) для поля "Деталі" ---
    if ('webkitSpeechRecognition' in window && micEmojiButton && details) {
        const recognitionDetails = new window.webkitSpeechRecognition();
        recognitionDetails.continuous = false;
        recognitionDetails.interimResults = false;
        recognitionDetails.lang = 'uk-UA';

        micEmojiButton.addEventListener('click', () => {
            if (micEmojiButton.disabled) return;
            micEmojiButton.disabled = true;
            micEmojiButton.style.color = '#DC2626'; 
            details.placeholder = 'Слухаю...';
            recognitionDetails.start();
        });

        recognitionDetails.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            details.value += (details.value.trim() ? ' ' : '') + transcript;
            assistantButton.disabled = false;
        };

        recognitionDetails.onend = () => {
             details.placeholder = "Введіть деталі завдання (або використовуйте мікрофон)";
             micEmojiButton.disabled = false;
             micEmojiButton.style.color = '#6B7280';
        };

        recognitionDetails.onerror = (event) => {
             details.placeholder = "Введіть деталі завдання (або використовуйте мікрофон)";
             console.error("Помилка розпізнавання Деталі:", event.error);
             micEmojiButton.disabled = false;
             micEmojiButton.style.color = '#6B7280';
        };
    } else if (micEmojiButton) {
         micEmojiButton.disabled = true; 
         micEmojiButton.style.opacity = 0.5;
    }

    // --- Логіка Головного Асистента (використання API) ---
    assistantButton.addEventListener('click', async () => {
        const subjectValue = subject ? subject.value.trim() : '';
        const urlValue = url ? url.value.trim() : '';
        const paragraphValue = paragraph ? paragraph.value.trim() : '';
        const pageValue = page ? page.value.trim() : '';
        const taskValue = task ? task.value.trim() : '';
        const detailsValue = details ? details.value.trim() : '';

        if (!detailsValue) {
            setAssistantStatus('Будь ласка, введіть деталі завдання.', false);
            return;
        }

        // --- Формування Prompt для моделі ---
        let prompt = `Ти - AI Освітній Асистент. Твоє завдання - надати максимально точну та вичерпну відповідь на навчальне завдання користувача. 
Користувач надав наступні дані:
- **Предмет**: ${subjectValue || 'Не вказано'}
- **URL/Джерело**: ${urlValue || 'Не вказано'}
- **Номер параграфа**: ${paragraphValue || 'Не вказано'}
- **Номер сторінки**: ${pageValue || 'Не вказано'}
- **Номер завдання**: ${taskValue || 'Не вказано'}
- **Деталі/Суть завдання (ОБОВ'ЯЗКОВО)**: ${detailsValue}

Сформуй свою відповідь у вигляді навчального матеріалу, пояснення або прямої відповіді на питання, виходячи з наданих деталей. Намагайся бути лаконічним, але інформативним.`;

        setAssistantStatus('Очікування відповіді від Асистента...', true);
        assistantButton.disabled = true;

        try {
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash", 
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });

            const responseText = result.text;
            setAssistantStatus(responseText, false);
            speakText(responseText); // Запускаємо TTS автоматично

        } catch (error) {
            console.error("Помилка при виклику Gemini API для Асистента:", error);
            setAssistantStatus('Виникла помилка під час отримання відповіді. Спробуйте ще раз.', false);
        } finally {
            assistantButton.disabled = false;
        }
    });

    // --- Логіка Copilot (Chat) ---
    const initialCopilotColor = micCopilotButton ? micCopilotButton.style.color : '#6B7280'; // Зберігаємо початковий колір

    if (sendCopilotBtn) {
        sendCopilotBtn.addEventListener('click', async () => {
            const question = copilotTextInput ? copilotTextInput.value.trim() : '';
            if (!question) return;

            setCopilotStatus('Очікування відповіді від Copilot...', true);
            sendCopilotBtn.disabled = true;
            copilotTextInput.disabled = true;
            if (micCopilotButton) micCopilotButton.disabled = true;

            try {
                // Використовуємо chat-сесію для збереження контексту
                const result = await chat.sendMessage({ message: question }); 
                const responseText = result.text;

                // Додаємо попереднє питання та нову відповідь до історії чату (для відображення)
                copilotResponseArea.innerHTML += `
                    <div class="mt-2 p-2 bg-blue-100 rounded-md text-sm">
                        <span class="font-bold">Ви:</span> ${question}
                    </div>
                    <div class="mt-1 p-2 bg-gray-100 rounded-md text-sm whitespace-pre-wrap">
                        <span class="font-bold">Copilot:</span> ${responseText}
                    </div>
                `;
                copilotTextInput.value = ''; // Очищаємо поле вводу
                setCopilotStatus('Тут з\'являться відповіді Copilot.', false); // Повертаємо початковий текст
                copilotResponseArea.scrollTop = copilotResponseArea.scrollHeight; // Прокручуємо вниз

            } catch (error) {
                console.error("Помилка при виклику Gemini API для Copilot:", error);
                setCopilotStatus('Виникла помилка під час отримання відповіді Copilot.', false);
            } finally {
                sendCopilotBtn.disabled = false;
                copilotTextInput.disabled = false;
                if (micCopilotButton) micCopilotButton.disabled = false;
            }
        });
    }

    // --- Логіка STT для Copilot ---
    if ('webkitSpeechRecognition' in window && micCopilotButton && copilotTextInput) {
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
    // ----------------------------------------------------------------

    // --- Media Recorder Logic for audio upload/processing, if needed later ---
    // (Start Recording logic should go here if you decide to implement it)

});
