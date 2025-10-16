import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './src/app/app.component.ts'; // Используем локальный импорт

// Запуск (бутстраппинг) приложения с помощью импортированного AppComponent
bootstrapApplication(AppComponent)
  .catch((err) => console.error(err));
