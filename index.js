import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './src/app/app.component.ts';

// We use the full URL to ensure proper module loading in GitHub Pages environment
const fullUrl = new URL('./src/app/app.component.ts', import.meta.url).href;

// Dynamically import the component using the calculated full URL
import(fullUrl).then(module => {
  bootstrapApplication(module.AppComponent);
}).catch(err => console.error("Error bootstrapping application:", err));
