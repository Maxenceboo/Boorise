import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';

// choisis un preset : Aura / Lara / Material / Nora
import Aura from '@primeuix/themes/aura';

import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserAnimationsModule),
    providePrimeNG({
      theme: {
        preset: Aura,   // ou Lara, Material, Nora
      },
    }),
  ],
}).catch(console.error);
