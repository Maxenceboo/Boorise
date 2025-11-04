import { Component } from '@angular/core';
@Component({
  selector: 'app-header',
  standalone: true,
  template: `
  <header id="header" class="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-30">
    <div id="header-inner" class="container mx-auto px-4 h-16 flex items-center justify-between">
      <div id="brand" class="flex items-center gap-3">
        <div id="brand-logo" class="w-8 h-8 rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold">B</div>
        <div id="brand-name" class="font-semibold text-lg">Boorise</div>
      </div>

      <nav id="main-nav" class="flex items-center gap-6">
        <a id="nav-product" class="text-sm opacity-80 hover:opacity-100" href="#features">Produit</a>
        <a id="nav-pricing" class="text-sm opacity-80 hover:opacity-100" href="#pricing">Tarifs</a>
        <a id="nav-contact" class="text-sm opacity-80 hover:opacity-100" href="#contact">Contact</a>
        <a id="nav-cta" class="ml-3 inline-block bg-sky-500 hover:bg-sky-600 text-white text-sm px-3 py-2 rounded-md" href="#">Essai gratuit</a>
      </nav>
    </div>
  </header>`
})
export class HeaderComponent { }
