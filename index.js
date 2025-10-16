import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './src/app/app.component.ts'; 

// Самый чистый и надежный статический бутстрап, обернутый в setTimeout(0).
// Это критически важно для обхода циклической зависимости, которая мешает компилятору
// найти AppComponent и запустить приложение в этой среде.
setTimeout(() => {
    bootstrapApplication(AppComponent)
      .catch((err) => console.error('Ошибка бутстраппинга:', err));
}, 0);
