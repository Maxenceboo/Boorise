import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="min-h-dvh grid place-items-center bg-gray-50">
      <div class="text-center">
        <h1 class="text-3xl font-bold mb-4">Boorise Front (Angular 20 + PrimeNG 20)</h1>
        <p-button label="PrimeNG + Tailwind OK" icon="pi pi-check"></p-button>
      </div>
    </div>
  `,
})
export class AppComponent {}
