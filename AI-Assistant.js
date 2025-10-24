// Імпорти Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setDoc, doc, collection, query, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Глобальні змінні Firebase (Надаються середовищем Canvas) ---

// __app_id - Ідентифікатор додатку
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// __firebase_config - JSON рядок з конфігурацією Firebase. ВИКОРИСТОВУЄМО ТІЛЬКИ ЙОГО.
const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
let firebaseConfig = null;

try {
    if (firebaseConfigStr) {
        firebaseConfig = JSON.parse(firebaseConfigStr);
    }
} catch (e) {
    console.error("Помилка парсингу Firebase Config: переконайтеся, що __firebase_config є дійсним JSON.", e);
}

// __initial_auth_token - Токен для аутентифікації
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Змінні для зберігання екземплярів сервісів
let app;
let db;
let auth;
let userId = null;
let isAuthReady = false; 

// --- Ініціалізація та Аутентифікація ---
async function initializeFirebase() {
    if (!firebaseConfig) {
        console.error("Firebase не ініціалізовано: Конфігурація відсутня або недійсна.");
        return;
    }
    
    // Ініціалізація
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // Установка слухача стану аутентифікації
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            console.log("Користувач успішно аутентифікований:", userId);
        } else {
            console.log("Користувач вийшов або анонімний.");
            // Якщо токена немає, використовуємо випадковий ID для тимчасових запитів
            userId = crypto.randomUUID(); 
        }
        isAuthReady = true;
        document.getElementById('assistant-call-button').disabled = false;
    });

    // Аутентифікація (використання токена або анонімний вхід)
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Успішний вхід через кастомний токен.");
        } else {
            // Анонімний вхід, якщо токен не надано
            await signInAnonymously(auth);
            console.log("Успішний анонімний вхід.");
        }
    } catch (error) {
        console.error("Помилка Firebase аутентифікації:", error);
    }
}

// --- Gemini API Call Function Setup ---

// УВАГА: Ключ API для Gemini надається автоматично середовищем
// для моделей gemini-2.5-flash-preview-09-2025.
const GEMINI_API_KEY = ""; // Залишаємо порожнім
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";

async function callGemini(prompt, isGrounded = false) {
    // 1. Отримання ключа API (автоматично надається)
    const apiKey = GEMINI_API_KEY || window.apiKey; 
    if (!apiKey) {
        console.error("API Key для Gemini відсутній.");
        return "Помилка: API Key для Gemini відсутній.";
    }

    const apiUrl = GEMINI_API_URL + apiKey;
    const systemInstruction = "Ти — досвідчений освітній асистент. Твоє завдання — пояснити учневі розв'язання завдання з підручника, пояснюючи кожен крок детально, зважаючи на його запит.";

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        // Для пошуку інформації в Інтернеті (наприклад, для перевірки URL-посилань):
        tools: isGrounded ? [{ "google_search": {} }] : undefined, 
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Помилка HTTP: ${response.status}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            return candidate.content.parts[0].text;
        } else {
            console.error("Неочікувана структура відповіді Gemini:", result);
            return "Не вдалося отримати відповідь від Асистента.";
        }
    } catch (error) {
        console.error("Помилка виклику Gemini API:", error);
        return `Помилка: Не вдалося з'єднатися з Gemini API. ${error.message}`;
    }
}


// --- Приклад використання функцій (викликається після завантаження DOM) ---
document.addEventListener('DOMContentLoaded', () => {
    // Деактивуємо кнопку до готовності аутентифікації
    const button = document.getElementById('assistant-call-button');
    button.disabled = true;

    // 1. Ініціалізуємо Firebase
    initializeFirebase();

    // 2. Логіка обробки кнопки 'Отримати допомогу асистента'
    button.addEventListener('click', async () => {
        const details = document.getElementById('task-details').value;
        const responseArea = document.getElementById('response-area');
        
        responseArea.textContent = "Завантаження відповіді (це може зайняти до 15 секунд)...";
        button.disabled = true; // Вимкнути кнопку під час очікування

        // Перевірка готовності
        if (!isAuthReady) {
            responseArea.textContent = "Система не готова. Спробуйте ще раз за секунду.";
            button.disabled = false;
            return;
        }

        const prompt = `Предмет: ${document.getElementById('subject').value}. URL: ${document.getElementById('url').value}. Параграф: ${document.getElementById('paragraph-number').value}. Сторінка: ${document.getElementById('page-number').value}. Номер завдання: ${document.getElementById('task-number').value}. Деталі завдання: ${details}`;
        
        // Викликаємо функцію, яка використовує Gemini API (з увімкненим пошуком)
        const geminiResponse = await callGemini(prompt, true); 
        
        responseArea.textContent = geminiResponse;
        button.disabled = false; // Увімкнути кнопку після відповіді

        // Приклад збереження запиту у Firestore
        if (db && userId) {
            try {
                // Шлях для приватних даних: artifacts/{appId}/users/{userId}/...
                await setDoc(doc(db, `artifacts/${appId}/users/${userId}/assistant_requests`, Date.now().toString()), {
                    prompt: prompt,
                    response: geminiResponse,
                    timestamp: serverTimestamp()
                });
                console.log("Запит успішно збережено у Firestore.");
            } catch (e) {
                console.error("Помилка збереження у Firestore:", e);
            }
        }
    });
});
