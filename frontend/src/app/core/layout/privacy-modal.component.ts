import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Dialog } from 'primeng/dialog';

@Component({
    selector: 'app-privacy-modal',
    standalone: true,
    imports: [CommonModule, Dialog],
    template: `
  <p-dialog
    [(visible)]="visible"
    header="Confidentialité"
    [modal]="true"
    [draggable]="false"
    [dismissableMask]="true"
    [style]="{ width: '44rem' }"
    [breakpoints]="{ '768px': '95vw' }"
    contentStyleClass="space-y-3 text-sm text-slate-700"
    (onHide)="close()"
  >
    <p>
      Notre politique de confidentialité décrit comment nous traitons vos données. Mettez à jour ces
      sections avec vos engagements précis.
    </p>
    <p>
      Remplacez ce texte par la politique réelle couvrant la collecte, l&apos;utilisation et le
      stockage des informations.
    </p>

    <div class="flex justify-end pt-4">
      <button pButton type="button" label="Fermer" (click)="close()"></button>
    </div>
  </p-dialog>
  `
})
export class PrivacyModalComponent {
    visible = false;
    @Input()
    set open(value: boolean) { this.visible = !!value; }
    @Output() closeEvent = new EventEmitter<void>();
    close() {
        this.visible = false;
        this.closeEvent.emit();
    }
}
