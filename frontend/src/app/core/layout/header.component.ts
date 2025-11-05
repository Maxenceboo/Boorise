import { Component } from '@angular/core';
@Component({
  selector: 'app-header',
  standalone: true,
  template: `
  <header id="header" class="border-b border-slate-200 backdrop-blur sticky top-0 z-30 text-slate-900">
    <div id="header-inner" class="container mx-auto px-4 h-16 flex items-center justify-between">
      <div id="brand" class="flex items-center gap-3">
        <div id="brand-logo" class="w-8 h-8 rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold">B</div>
        <div id="brand-name" class="font-semibold text-lg">Boorise</div>
      </div>

      <nav id="main-nav" class="flex items-center gap-6">
        <a id="nav-product" class="btn btn--secondary text-sm text-slate-700 hover:opacity-100" href="#features">Produit</a>
  <a id="nav-cta" class="ml-3 inline-block btn btn--primary" href="#">Essai gratuit</a>
      </nav>
    </div>
  </header>`
})
export class HeaderComponent { }
