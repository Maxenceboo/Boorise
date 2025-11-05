import { Component } from '@angular/core';
import { InputText } from 'primeng/inputtext';

@Component({
    standalone: true,
    selector: 'home-cta',
    imports: [InputText],
    templateUrl: './cta.component.html'
})
export class CtaComponent { }
