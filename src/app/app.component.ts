import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Main Application Card -->
    <div class="w-full max-w-2xl bg-white shadow-xl rounded-xl p-6 md:p-8 border border-gray-100">

      <!-- Header -->
      <header class="mb-6 text-center">
        <h1 class="text-3xl font-extrabold text-blue-700 tracking-tight">
          AI Освітній Асистент
        </h1>
        <p class="text-lg font-medium text-gray-600 mt-1">
          5-й Клас | Ваш персональний помічник у навчанні
        </p>
      </header>

      <!-- Input Section -->
      <section class="space-y-6">

        <!-- Task Input -->
        <div>
          <label for="task" class="block text-sm font-medium text-gray-700 mb-1">
            Введіть ваше завдання
          </label>
          <textarea
            id="task"
            [value]="userTask()"
            (input)="userTask.set($event.target.value)"
            rows="3"
            placeholder="Наприклад: 'Розв'язати задачу 52 на сторінці 30 підручника з математики.'"
            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 resize-none">
          </textarea>
        </div>

        <!-- Subject Select -->
        <div>
          <label for="subject" class="block text-sm font-medium text-gray-700 mb-1">
            Вибрати предмет
          </label>
          <select
            id="subject"
            [value]="selectedSubject()"
            (change)="selectedSubject.set($event.target.value)"
            class="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 transition duration-150 appearance-none">
            <option value="Математика">Математика</option>
            <option value="Українська мова">Українська мова</option>
            <option value="Історія">Історія України</option>
            <option value="Географія">Географія</option>
            <option value="Інше">Інше (зазначте у завданні)</option>
          </select>
        </div>
        
        <!-- Input Method Tabs (Simplified for Layout) -->
        <div class="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            
            <!-- Input by Link -->
            <div class="flex-1 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 class="font-semibold text-gray-700 mb-2">За посиланням (URL)</h3>
                <input 
                    type="url" 
                    placeholder="Посилання на підручник..." 
                    class="w-full p-2 text-sm border border-gray-300 rounded-md mb-2"
                    [value]="bookUrl()"
                    (input)="bookUrl.set($event.target.value)"
                >
                <div class="flex space-x-2">
                    <input 
                        type="text" 
                        placeholder="Стор." 
                        class="w-1/2 p-2 text-sm border border-gray-300 rounded-md"
                        [value]="pageNumber()"
                        (input)="pageNumber.set($event.target.value)"
                    >
                    <input 
                        type="text" 
                        placeholder="№ Завдання" 
                        class="w-1/2 p-2 text-sm border border-gray-300 rounded-md"
                        [value]="taskNumber()"
                        (input)="taskNumber.set($event.target.value)"
                    >
                </div>
            </div>

            <!-- Upload Photo -->
            <div class="flex-1 p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col justify-center items-center">
                <h3 class="font-semibold text-gray-700 mb-2">Завантажити фото</h3>
                <!-- Mock file input since we handle this later with logic -->
                <label class="w-full cursor-pointer bg-blue-100 text-blue-700 font-medium py-2 px-4 rounded-lg text-center hover:bg-blue-200 transition">
                    Вибрати файл...
                    <input type="file" class="hidden" (change)="handleFileUpload($event)">
                </label>
                <p *ngIf="fileName()" class="mt-1 text-xs text-green-600 truncate max-w-full">
                    Файл завантажено: {{ fileName() }}
                </p>
                <p *ngIf="!fileName()" class="mt-1 text-xs text-gray-500">
                    Або перетягніть фото сюди.
                </p>
            </div>

        </div>

        <!-- Submit Button -->
        <button
          (click)="getAssistantHelp()"
          [disabled]="isGenerating()"
          class="w-full py-3 px-4 rounded-xl text-lg font-bold transition duration-300 transform shadow-md
                 text-white bg-green-500 hover:bg-green-600 focus:ring-4 focus:ring-green-300
                 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none">
          {{ isGenerating() ? 'Обробка запиту...' : 'Отримати допомогу асистента' }}
        </button>

      </section>

      <!-- Solution and Explanation Output -->
      <section class="mt-8 border-t pt-6">
        <h2 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          Розв'язання та пояснення
          <svg *ngIf="isGenerating()" class="animate-spin ml-2 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </h2>
        
        <div *ngIf="solutionText()" 
             class="p-4 bg-blue-50 border border-blue-200 rounded-lg whitespace-pre-wrap text-gray-700">
             <div [innerHTML]="solutionText()"></div>
        </div>
        
        <p *ngIf="!solutionText() && !isGenerating()" class="text-gray-500 italic">
          Тут з'явиться відповідь після натискання кнопки.
        </p>

      </section>
    </div>
  `,
  styles: [`
    /* Ensure the app is centered and responsive */
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // State for user inputs
  userTask = signal('');
  selectedSubject = signal('Математика');
  bookUrl = signal('');
  pageNumber = signal('');
  taskNumber = signal('');
  
  // State for application status and output
  isGenerating = signal(false);
  solutionText = signal('');
  fileName = signal('');
  
  // --- Core Logic Functions (Will be fully implemented later) ---

  handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      // We only store the file name for now to show the user that it worked
      this.fileName.set(input.files[0].name);
      console.log('File selected:', input.files[0]);
      // The actual base64 conversion and image processing logic will go here
    }
  }

  getAssistantHelp() {
    // 1. Validate inputs (Simplified validation for now)
    if (!this.userTask() && !this.bookUrl() && !this.fileName()) {
      // Using console.error instead of alert due to iFrame restrictions
      console.error('Будь ласка, введіть завдання, посилання або завантажте фото.');
      this.solutionText.set('Будь ласка, введіть завдання, посилання або завантажте фото.');
      return;
    }

    this.isGenerating.set(true);
    this.solutionText.set('');

    // 2. Construct the prompt based on all inputs
    let prompt = `Ти — освітній асистент для 5-го класу за українською програмою. Твоє завдання — надати деталізоване розв'язання та пояснення до заданого матеріалу.
    
    **Предмет:** ${this.selectedSubject()}
    **Завдання:** ${this.userTask()}
    
    `;
    
    if (this.bookUrl()) {
      prompt += `**Джерело (Посилання):** ${this.bookUrl()}`;
      if (this.pageNumber() || this.taskNumber()) {
        prompt += ` (Стор. ${this.pageNumber()}, Завдання №${this.taskNumber()})`;
      }
      prompt += `\n`;
    }
    
    if (this.fileName()) {
      prompt += `**Джерело:** Додатково завантажено зображення з назвою ${this.fileName()}.\n`;
    }

    // 3. Mock API Call for testing the UI
    setTimeout(() => {
        this.isGenerating.set(false);
        this.solutionText.set(`
            ## Пояснення до завдання
            
            Ваше завдання з предмету **${this.selectedSubject()}** було оброблено.
            
            Ми проаналізували ваш запит: *"${this.userTask() || 'Без текстового опису'}"*.

            ### Крок 1: Аналіз умови
            Тут буде детально описано, що потрібно знайти або зробити у завданні.

            ### Крок 2: Розв'язання
            Для прикладу, розв'яжемо просту математичну операцію:
            
            $$\\frac{1}{2} \\times 5^{2} + 3 = 15.5$$
            
            ### Відповідь
            Готова відповідь на завдання (наприклад, 15.5).

            **Примітка:** Наразі це тестовий вивід. Наступним кроком ми інтегруємо справжній Gemini API, щоб отримувати реальні, корисні відповіді.
        `);
    }, 2500); // Simulate network delay
  }
}
