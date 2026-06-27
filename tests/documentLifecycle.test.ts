import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanChangeQuoteStatus,
  assertCanConvertQuoteToInvoice,
  assertCanCreateQuoteRevision,
  assertCanCreateInvoiceCreditNote,
  assertCanDeleteQuote,
  assertCanEditQuote,
  assertCanRecordInvoicePayment,
  assertCanUpdateInvoiceStatus,
  assertValidPaymentAmount,
  type MutableQuoteStatus,
} from "../convex/documentLifecycle";

function expectAllowed(action: () => void) {
  assert.doesNotThrow(action);
}

function expectBlocked(action: () => void, message: RegExp) {
  assert.throws(action, message);
}

describe("quote lifecycle rules", () => {
  it("allows real quote workflow transitions", () => {
    expectAllowed(() => assertCanChangeQuoteStatus("draft", "sent"));
    expectAllowed(() => assertCanChangeQuoteStatus("draft", "accepted"));
    expectAllowed(() => assertCanChangeQuoteStatus("sent", "accepted"));
    expectAllowed(() => assertCanChangeQuoteStatus("sent", "refused"));
    expectAllowed(() => assertCanChangeQuoteStatus("sent", "void"));
    expectAllowed(() => assertCanChangeQuoteStatus("refused", "sent"));
    expectAllowed(() => assertCanChangeQuoteStatus("refused", "void"));
  });

  it("blocks unsafe quote workflow transitions", () => {
    expectBlocked(() => assertCanChangeQuoteStatus("draft", "void"), /Supprime le brouillon/);
    expectBlocked(() => assertCanChangeQuoteStatus("draft", "refused"), /Transition de devis/);
    expectBlocked(() => assertCanChangeQuoteStatus("accepted", "sent"), /Transition de devis/);
    expectBlocked(() => assertCanChangeQuoteStatus("accepted", "void"), /Transition de devis/);
    expectBlocked(() => assertCanChangeQuoteStatus("invoiced", "sent"), /facture/);
    expectBlocked(() => assertCanChangeQuoteStatus("void", "sent"), /annule/);
    expectBlocked(() => assertCanChangeQuoteStatus("accepted", "invoiced" as MutableQuoteStatus), /Transition de devis/);
  });

  it("only deletes draft quotes", () => {
    expectAllowed(() => assertCanDeleteQuote("draft"));
    expectBlocked(() => assertCanDeleteQuote("sent"), /brouillon/);
    expectBlocked(() => assertCanDeleteQuote("accepted"), /brouillon/);
    expectBlocked(() => assertCanDeleteQuote("invoiced"), /brouillon/);
    expectBlocked(() => assertCanDeleteQuote("void"), /brouillon/);
  });

  it("only edits draft quotes", () => {
    expectAllowed(() => assertCanEditQuote("draft"));
    expectBlocked(() => assertCanEditQuote("sent"), /brouillon/);
    expectBlocked(() => assertCanEditQuote("accepted"), /brouillon/);
    expectBlocked(() => assertCanEditQuote("refused"), /brouillon/);
    expectBlocked(() => assertCanEditQuote("invoiced"), /brouillon/);
    expectBlocked(() => assertCanEditQuote("void"), /brouillon/);
  });

  it("creates revisions only from accepted or invoiced quotes", () => {
    expectAllowed(() => assertCanCreateQuoteRevision("accepted"));
    expectAllowed(() => assertCanCreateQuoteRevision("invoiced"));
    expectBlocked(() => assertCanCreateQuoteRevision("draft"), /revision/);
    expectBlocked(() => assertCanCreateQuoteRevision("sent"), /revision/);
    expectBlocked(() => assertCanCreateQuoteRevision("refused"), /revision/);
    expectBlocked(() => assertCanCreateQuoteRevision("void"), /revision/);
  });

  it("only invoices accepted non-empty quotes", () => {
    expectAllowed(() => assertCanConvertQuoteToInvoice("accepted", 100));
    expectBlocked(() => assertCanConvertQuoteToInvoice("draft", 100), /accepte/);
    expectBlocked(() => assertCanConvertQuoteToInvoice("sent", 100), /accepte/);
    expectBlocked(() => assertCanConvertQuoteToInvoice("refused", 100), /accepte/);
    expectBlocked(() => assertCanConvertQuoteToInvoice("void", 100), /accepte/);
    expectBlocked(() => assertCanConvertQuoteToInvoice("accepted", 0), /devis vide/);
  });
});

describe("invoice lifecycle rules", () => {
  it("allows invoice status changes that keep accounting history safe", () => {
    expectAllowed(() => assertCanUpdateInvoiceStatus("draft", "sent", false));
    expectAllowed(() => assertCanUpdateInvoiceStatus("draft", "void", false));
    expectAllowed(() => assertCanUpdateInvoiceStatus("sent", "void", false));
    expectAllowed(() => assertCanUpdateInvoiceStatus("partially_paid", "partially_paid", true));
  });

  it("blocks unsafe invoice status changes", () => {
    expectBlocked(() => assertCanUpdateInvoiceStatus("draft", "paid", false), /encaissement/);
    expectBlocked(() => assertCanUpdateInvoiceStatus("sent", "overdue", false), /calcule automatiquement/);
    expectBlocked(() => assertCanUpdateInvoiceStatus("sent", "draft", false), /Transition de facture/);
    expectBlocked(() => assertCanUpdateInvoiceStatus("paid", "void", true), /payee/);
    expectBlocked(() => assertCanUpdateInvoiceStatus("void", "sent", false), /annulee/);
    expectBlocked(() => assertCanUpdateInvoiceStatus("sent", "void", true), /encaissee/);
    expectBlocked(() => assertCanUpdateInvoiceStatus("partially_paid", "void", true), /encaissee/);
  });

  it("encashes only valid non-void invoices", () => {
    expectAllowed(() => assertCanRecordInvoicePayment("sent", Date.now()));
    expectAllowed(() => assertCanRecordInvoicePayment("overdue", Date.now()));
    expectAllowed(() => assertCanRecordInvoicePayment("partially_paid", Date.now()));
    expectBlocked(() => assertCanRecordInvoicePayment("draft", Date.now()), /envoyee/);
    expectBlocked(() => assertCanRecordInvoicePayment("paid", Date.now()), /deja payee/);
    expectBlocked(() => assertCanRecordInvoicePayment("void", Date.now()), /annulee/);
    expectBlocked(() => assertCanRecordInvoicePayment("sent", -1), /date de paiement/);
    expectBlocked(() => assertCanRecordInvoicePayment("sent", Number.NaN), /date de paiement/);
  });

  it("accepts only realistic partial payment amounts", () => {
    expectAllowed(() => assertValidPaymentAmount(50, 100));
    expectAllowed(() => assertValidPaymentAmount(100, 100));
    expectAllowed(() => assertValidPaymentAmount(100.005, 100));
    expectBlocked(() => assertValidPaymentAmount(0, 100), /superieur a 0/);
    expectBlocked(() => assertValidPaymentAmount(-1, 100), /superieur a 0/);
    expectBlocked(() => assertValidPaymentAmount(Number.NaN, 100), /superieur a 0/);
    expectBlocked(() => assertValidPaymentAmount(101, 100), /depasse le solde/);
  });

  it("creates credit notes only for finalized invoice documents", () => {
    expectAllowed(() => assertCanCreateInvoiceCreditNote("sent", "standard"));
    expectAllowed(() => assertCanCreateInvoiceCreditNote("partially_paid", "standard"));
    expectAllowed(() => assertCanCreateInvoiceCreditNote("paid", "balance"));
    expectBlocked(() => assertCanCreateInvoiceCreditNote("draft", "standard"), /brouillon/);
    expectBlocked(() => assertCanCreateInvoiceCreditNote("void", "standard"), /annulee/);
    expectBlocked(() => assertCanCreateInvoiceCreditNote("sent", "credit"), /autre avoir/);
  });
});
