import { Component } from '@angular/core';
import { CtaComponent } from './components/cta/cta.component';
import { FeaturesComponent } from './components/features/features.component';
import { HeroComponent } from './components/hero/hero.component';
import { MockupComponent } from './components/mockup/mockup.component';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [HeroComponent, FeaturesComponent, MockupComponent, CtaComponent],
  templateUrl: './home.page.html'
})
export class HomePage { }
