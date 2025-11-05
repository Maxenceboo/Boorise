import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

@Component({
    selector: 'app-contact-modal',
    standalone: true,
    imports: [CommonModule, Dialog, InputText, Textarea],
    template: `
  <p-dialog
    [(visible)]="visible"
    header="Contact"
    [modal]="true"
    [draggable]="false"
    [dismissableMask]="true"
    [style]="{ width: '32rem' }"
    [breakpoints]="{ '768px': '90vw' }"
    (onHide)="close()"
    contentStyleClass="flex flex-col gap-4"
  >
    <p class="text-sm text-slate-700">
      Envoyez-nous un message — nous vous répondrons rapidement.
    </p>

    <div class="grid gap-3">
      <input pInputText type="text" placeholder="Votre nom" autocomplete="name" />
      <input pInputText type="email" placeholder="Votre email" autocomplete="email" />
      <textarea pTextarea rows="4" [autoResize]="true" placeholder="Votre message"></textarea>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <button pButton type="button" label="Annuler" severity="'secondary'" (click)="close()"></button>
      <button pButton type="button" label="Envoyer" icon="pi pi-send"></button>
    </div>
  </p-dialog>
  `
})
export class ContactModalComponent {
    visible = false;
    @Input()
    set open(value: boolean) { this.visible = !!value; }
    @Output() closeEvent = new EventEmitter<void>();
    close() {
        this.visible = false;
        this.closeEvent.emit();
    }
}
