import { Component } from '@angular/core';
@Component({
    selector: 'app-footer',
    standalone: true,
    template: `
  <footer id="footer" class="border-t border-slate-800 text-sm text-slate-400">
    <div id="footer-inner" class="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div id="footer-left" class="text-center md:text-left">
        <div id="footer-brand" class="font-semibold">Boorise</div>
        <div id="footer-sub" class="text-xs opacity-80">© {{year}} Boorise — Tous droits réservés.</div>
      </div>

      <div id="footer-links" class="flex items-center gap-4">
        <a id="footer-terms" class="text-xs opacity-80 hover:opacity-100" href="#">Terms</a>
        <a id="footer-privacy" class="text-xs opacity-80 hover:opacity-100" href="#">Privacy</a>
        <a id="footer-contact" class="text-xs opacity-80 hover:opacity-100" href="#">Contact</a>
      </div>
    </div>
  </footer>`
})
export class FooterComponent { year = new Date().getFullYear(); }
