import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div class="text-center bg-white p-8 rounded-xl shadow-2xl border border-blue-200">
        <h1 class="text-4xl font-extrabold text-blue-600 mb-4">
          ✅ УСПІШНИЙ ЗАПУСК! (УСПЕШНЫЙ ЗАПУСК!)
        </h1>
        <p class="text-lg text-gray-700">
          Ваше Angular-приложение успешно развернуто.
        </p>
        <p class="text-sm text-gray-500 mt-2">
          Наступний крок: додаємо конфігураційні файли.
        </p>
      </div>
    </div>
  `,
  styles: [`
    /* Стили Tailwind используются напрямую в template */
  `]
})
export class AppComponent {
  // Этот компонент пока пуст и служит для проверки работоспособности
}
