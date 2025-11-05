import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ContactModalComponent } from './contact-modal.component';
import { PricingModalComponent } from './pricing-modal.component';
import { PrivacyModalComponent } from './privacy-modal.component';
import { TermsModalComponent } from './terms-modal.component';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [CommonModule, PricingModalComponent, ContactModalComponent, TermsModalComponent, PrivacyModalComponent],
    template: `
  <footer id="footer" class="border-t border-slate-200 text-sm text-slate-600">
    <div id="footer-inner" class="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div id="footer-left" class="text-center md:text-left">
        <div id="footer-brand" class="font-semibold text-slate-900">Boorise</div>
        <div id="footer-sub" class="text-xs text-slate-600">© {{year}} Boorise — Tous droits réservés.</div>
      </div>

      <div id="footer-links" class="flex items-center gap-4">
          @for (link of links; track link.key) {
          <button type="button" class="btn btn--link" (click)="open(link.key)">{{ link.label }}</button>
        }
      </div>
    </div>

    <app-pricing-modal [open]="showPricing" (closeEvent)="showPricing = false"></app-pricing-modal>
    <app-contact-modal [open]="showContact" (closeEvent)="showContact = false"></app-contact-modal>
    <app-terms-modal [open]="showTerms" (closeEvent)="showTerms = false"></app-terms-modal>
    <app-privacy-modal [open]="showPrivacy" (closeEvent)="showPrivacy = false"></app-privacy-modal>
  </footer>`
})
export class FooterComponent {
    year = new Date().getFullYear();
    showPricing = false;
    showContact = false;
    showTerms = false;
    showPrivacy = false;

    links = [
        { key: 'pricing', label: 'Tarifs' },
        { key: 'contact', label: 'Contact' },
        { key: 'terms', label: 'Conditions' },
        { key: 'privacy', label: 'Confidentialité' }
    ];

    open(key: string) {
        switch (key) {
            case 'pricing': this.showPricing = true; break;
            case 'contact': this.showContact = true; break;
            case 'terms': this.showTerms = true; break;
            case 'privacy': this.showPrivacy = true; break;
        }
    }
}
