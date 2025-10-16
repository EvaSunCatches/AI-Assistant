import { bootstrapApplication } from '@angular/platform-browser';

// Динамический импорт, чтобы избежать циклической зависимости (Uncaught ReferenceError)
// Этот метод гарантирует, что AppComponent будет доступен после инициализации Angular.
import('./src/app/app.component.ts')
  .then(module => {
    // В случае динамического импорта, компонент находится в .AppComponent
    bootstrapApplication(module.AppComponent)
      .catch((err) => console.error('Ошибка бутстраппинга:', err));
  })
  .catch((err) => console.error('Ошибка загрузки компонента:', err));
