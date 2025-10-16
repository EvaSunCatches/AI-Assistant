import { bootstrapApplication } from '@angular/platform-browser';

// Dynamically import the component using the calculated full URL
// This dynamic import is necessary for loading TS files correctly in a browser environment
const fullUrl = new URL('./src/app/app.component.ts', import.meta.url).href;

import(fullUrl)
  .then(module => {
    // We explicitly look for the named export 'AppComponent'
    if (module.AppComponent) {
      bootstrapApplication(module.AppComponent);
    } else {
      console.error("Error: 'AppComponent' not found in the imported module.");
    }
  })
  .catch(err => {
    console.error("Error bootstrapping application:", err);
  });
