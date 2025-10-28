import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';

// choisis un preset : Aura / Lara / Material / Nora
import Aura from '@primeuix/themes/aura';
// Si tu préfères Lara :
// import Lara from '@primeuix/themes/lara';

import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: Aura,   // ou Lara, Material, Nora
      },
    }),
  ],
}).catch(console.error);
