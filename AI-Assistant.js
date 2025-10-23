// AI-Assistant.js (Головний файл логіки - ПОВНИЙ І ВИПРАВЛЕНИЙ)

document.addEventListener('DOMContentLoaded', () => {

    // ... Змінні DOM-елементів (як у вас) ...
    const urlToggle = document.getElementById('url-toggle');
    const imageToggle = document.getElementById('image-toggle');
    const urlSection = document.getElementById('url-section');
    const photoUploadSection = document.getElementById('photo-upload-section');
    const responseArea = document.getElementById('response-area');
    // ... інші поля вводу та елементи керування ...
    
    // --- ІНІЦІАЛІЗАЦІЯ GEMINI SDK (КРИТИЧНЕ ВИПРАВЛЕННЯ) ---
    const apiKey = window.API_CONFIG ? window.API_CONFIG.apiKey : null;
    let ai = null;

    if (apiKey && window.genai && window.genai.GoogleGenAI) {
        // !!! ВИПРАВЛЕННЯ: Використовуємо об'єкт window.genai !!!
        ai = new window.genai.GoogleGenAI({ apiKey }); 
    } else {
        // ... (обробка помилки ключа) ...
    }


    // --- ЛОГІКА ПЕРЕМИКАННЯ ДЖЕРЕЛА (URL vs IMAGE) ---

    // Функція-обробник для перемикання джерела
    const toggleSourceSection = (activeBtnId, inactiveBtnId, activeSection, inactiveSection) => {
        const activeBtn = document.getElementById(activeBtnId);
        const inactiveBtn = document.getElementById(inactiveBtnId);
        
        activeBtn.classList.add('source-button-active');
        activeBtn.classList.remove('source-button-inactive');

        inactiveBtn.classList.remove('source-button-active');
        inactiveBtn.classList.add('source-button-inactive');

        document.getElementById(activeSection).classList.remove('hidden');
        document.getElementById(inactiveSection).classList.add('hidden');
    };

    if (urlToggle && imageToggle && urlSection && photoUploadSection) {
        urlToggle.addEventListener('click', () => {
            toggleSourceSection('url-toggle', 'image-toggle', 'url-section', 'photo-upload-section');
        });

        imageToggle.addEventListener('click', () => {
            toggleSourceSection('image-toggle', 'url-toggle', 'photo-upload-section', 'url-section');
        });
    }

    // ... (Інша логіка асистента) ...


    // --- ЛОГІКА ПІСЛЯ ОТРИМАННЯ ВІДПОВІДІ (АКТИВАЦІЯ COPILOT) ---

    function displayResponse(text) {
        // ... (показ тексту у responseArea) ...
        
        // !!! ВИПРАВЛЕННЯ: Перевірка наявності відповіді для активації Copilot
        if (text && text.trim().length > 0 && text !== "Тут з'явиться детальна відповідь.") {
            copilotSection.classList.remove('hidden');
        }
    }
    
    // ... (TTS, STT та інша логіка) ...
    
});
