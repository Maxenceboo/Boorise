import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';

@Component({
    selector: 'app-pricing-modal',
    standalone: true,
    imports: [CommonModule, Dialog, Card, Tag],
    template: `
  <p-dialog
    [(visible)]="visible"
    header="Tarifs"
    [modal]="true"
    [draggable]="false"
    [dismissableMask]="true"
    [style]="{ width: '48rem' }"
    [breakpoints]="{ '768px': '95vw' }"
    contentStyleClass="space-y-5"
    (onHide)="close()"
  >
    <p class="text-sm text-slate-700">
      Choisissez un plan adapté à votre entreprise. Tous nos forfaits incluent l&apos;accès à
      l&apos;assistance et aux mises à jour.
    </p>

    <div class="grid gap-4 md:grid-cols-3">
      <p-card header="Gratuit" subheader="Idéal pour débuter" styleClass="border border-slate-100">
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-3xl font-bold text-emerald-600">0€</span>
          <span class="text-sm text-slate-500">/ mois</span>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-700">
          <li>Factures illimitées</li>
          <li>1 utilisateur</li>
          <li>Support par email</li>
        </ul>
      </p-card>

      <p-card header="Pro" subheader="Pour les équipes en croissance" styleClass="border border-emerald-100 space-y-2">
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-3xl font-bold text-emerald-600">29€</span>
          <span class="text-sm text-slate-500">/ mois</span>
        </div>
        <p-tag value="Populaire" severity="success"></p-tag>
        <ul class="mt-4 space-y-2 text-sm text-slate-700">
          <li>Jusqu&apos;à 10 utilisateurs</li>
          <li>Automatisations avancées</li>
          <li>Support prioritaire</li>
        </ul>
      </p-card>

      <p-card header="Entreprise" subheader="Accompagnement sur mesure" styleClass="border border-slate-100">
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-3xl font-bold text-emerald-600">Sur mesure</span>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-700">
          <li>Utilisateurs illimités</li>
          <li>Intégrations personnalisées</li>
          <li>Success manager dédié</li>
        </ul>
      </p-card>
    </div>

    <div class="flex justify-end">
      <button pButton type="button" label="Fermer" (click)="close()"></button>
    </div>
  </p-dialog>
  `
})
export class PricingModalComponent {
    visible = false;
    @Input()
    set open(value: boolean) { this.visible = !!value; }
    @Output() closeEvent = new EventEmitter<void>();
    close() {
        this.visible = false;
        this.closeEvent.emit();
    }
}
