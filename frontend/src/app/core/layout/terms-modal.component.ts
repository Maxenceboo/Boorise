import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Dialog } from 'primeng/dialog';

@Component({
    selector: 'app-terms-modal',
    standalone: true,
    imports: [CommonModule, Dialog],
    template: `
  <p-dialog
    [(visible)]="visible"
    header="Conditions d'utilisation"
    [modal]="true"
    [draggable]="false"
    [dismissableMask]="true"
    [style]="{ width: '44rem' }"
    [breakpoints]="{ '768px': '95vw' }"
    contentStyleClass="space-y-3 text-sm text-slate-700"
    (onHide)="close()"
  >
    <p>Texte d&apos;exemple des conditions d&apos;utilisation. Remplacez ce contenu par vos clauses réelles.</p>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero.
      Sed cursus ante dapibus diam.
    </p>
    <p>
      Suspendisse potenti. Donec luctus, eros at pulvinar aliquet, velit arcu cursus risus, vel
      faucibus dui magna in sapien.
    </p>

    <div class="flex justify-end pt-4">
      <button pButton type="button" label="Fermer" (click)="close()"></button>
    </div>
  </p-dialog>
  `
})
export class TermsModalComponent {
    visible = false;
    @Input()
    set open(value: boolean) { this.visible = !!value; }
    @Output() closeEvent = new EventEmitter<void>();
    close() {
        this.visible = false;
        this.closeEvent.emit();
    }
}
