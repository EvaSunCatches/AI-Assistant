import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';

// Важно: путь должен быть полным для браузера, чтобы импопортировать главный компонент
// Этот путь ведет к файлу, который мы создадим следующим.
import { AppComponent } from './src/app/app.component.ts';

/**
 * Функция bootstrapApplication запускает наше приложение, используя автономный компонент (AppComponent)
 * и набор провайдеров, необходимых для работы.
 * * provideZonelessChangeDetection(): Улучшает производительность, отключая Zone.js.
 * provideHttpClient(): Регистрирует сервис для выполнения HTTP-запросов (например, к Gemini API).
 */
bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
  ],
});
