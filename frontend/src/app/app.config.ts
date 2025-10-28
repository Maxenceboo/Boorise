// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

// ⚠️ encore requis par PrimeNG aujourd’hui
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
// (ou à défaut) import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    providePrimeNG({ theme: { preset: Aura } }),
    provideAnimationsAsync(), // ou provideAnimations()
  ],
};
