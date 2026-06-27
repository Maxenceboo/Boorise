export type QuoteLifecycleStatus = "draft" | "sent" | "accepted" | "refused" | "invoiced" | "void";
export type MutableQuoteStatus = Exclude<QuoteLifecycleStatus, "invoiced">;
export type InvoiceLifecycleStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
export type MutableInvoiceStatus = InvoiceLifecycleStatus;

const quoteTransitions: Record<QuoteLifecycleStatus, MutableQuoteStatus[]> = {
  draft: ["draft", "sent", "accepted"],
  sent: ["sent", "accepted", "refused", "void"],
  accepted: ["accepted"],
  refused: ["refused", "sent", "void"],
  invoiced: [],
  void: [],
};

const invoiceTransitions: Record<InvoiceLifecycleStatus, MutableInvoiceStatus[]> = {
  draft: ["draft", "sent", "void"],
  sent: ["sent", "void"],
  partially_paid: ["partially_paid", "void"],
  paid: ["paid"],
  overdue: ["overdue", "void"],
  void: ["void"],
};

export function assertCanChangeQuoteStatus(current: QuoteLifecycleStatus, next: MutableQuoteStatus) {
  if (current === "invoiced") {
    throw new Error("Un devis facture ne peut pas revenir en arriere");
  }
  if (current === "void") {
    throw new Error("Un devis annule ne peut plus changer de statut");
  }
  if (next === "void" && current === "draft") {
    throw new Error("Supprime le brouillon au lieu de l'annuler");
  }
  if (!quoteTransitions[current].includes(next)) {
    throw new Error("Transition de devis non autorisee");
  }
}

export function isDraftEditableQuote(status: QuoteLifecycleStatus) {
  return status === "draft";
}

export function assertCanEditQuote(status: QuoteLifecycleStatus) {
  if (!isDraftEditableQuote(status)) {
    throw new Error("Seul un devis brouillon peut etre modifie. Cree une revision pour retravailler un devis deja envoye.");
  }
}

export function assertCanDeleteQuote(status: QuoteLifecycleStatus) {
  if (status !== "draft") {
    throw new Error("Seul un devis brouillon peut etre supprime. Annule le devis si un client l'a deja vu.");
  }
}

export function assertCanCreateQuoteRevision(status: QuoteLifecycleStatus) {
  if (status !== "accepted" && status !== "invoiced") {
    throw new Error("Une revision se cree depuis un devis accepte ou facture.");
  }
}

export function assertCanConvertQuoteToInvoice(status: QuoteLifecycleStatus, totalHt: number) {
  if (status !== "accepted") {
    throw new Error("Seul un devis accepte peut etre facture");
  }
  if (totalHt <= 0) {
    throw new Error("Impossible de facturer un devis vide");
  }
}

export function assertCanUpdateInvoiceStatus(current: InvoiceLifecycleStatus, next: MutableInvoiceStatus, hasPayment: boolean) {
  if (next === "paid") {
    throw new Error("Utilise l'encaissement pour marquer une facture payee");
  }
  if (next === "overdue") {
    throw new Error("Le retard est calcule automatiquement depuis l'echeance");
  }
  if (current === "paid") {
    throw new Error("Une facture payee ne peut pas etre annulee sans avoir comptable");
  }
  if (current === "void") {
    throw new Error("Une facture annulee ne peut plus changer de statut");
  }
  if (next === "void" && hasPayment) {
    throw new Error("Une facture encaissee ne peut pas etre annulee");
  }
  if (!invoiceTransitions[current].includes(next)) {
    throw new Error("Transition de facture non autorisee");
  }
}

export function isFinalInvoiceStatus(status: InvoiceLifecycleStatus) {
  return status === "sent" || status === "paid" || status === "void";
}

export function assertCanRecordInvoicePayment(status: InvoiceLifecycleStatus, paidAt: number) {
  if (status === "draft") {
    throw new Error("Une facture brouillon doit etre envoyee avant encaissement");
  }
  if (status === "paid") {
    throw new Error("Cette facture est deja payee");
  }
  if (status === "void") {
    throw new Error("Une facture annulee ne peut pas etre encaissee");
  }
  if (!Number.isFinite(paidAt) || paidAt < 0) {
    throw new Error("La date de paiement est invalide");
  }
}

export function assertCanCreateInvoiceCreditNote(status: InvoiceLifecycleStatus, invoiceKind?: "standard" | "deposit" | "balance" | "credit") {
  if (invoiceKind === "credit") {
    throw new Error("Un avoir ne peut pas generer un autre avoir");
  }
  if (status === "draft") {
    throw new Error("Supprime ou annule le brouillon au lieu de creer un avoir");
  }
  if (status === "void") {
    throw new Error("Une facture annulee ne peut pas generer d'avoir");
  }
}

export function assertValidPaymentAmount(amountTtc: number, remainingTtc: number) {
  if (!Number.isFinite(amountTtc) || amountTtc <= 0) {
    throw new Error("Le montant encaisse doit etre superieur a 0");
  }
  if (amountTtc > remainingTtc + 0.01) {
    throw new Error("Le montant encaisse depasse le solde restant de la facture");
  }
}
