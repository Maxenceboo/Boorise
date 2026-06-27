import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { cleanOptionalString, logActivity, requireBusinessWrite } from "./app";

declare const process: {
  env: {
    DOCUMENT_EMAIL_DOMAIN?: string;
    DOCUMENT_EMAIL_FROM?: string;
    RESEND_API_KEY?: string;
    SITE_URL?: string;
  };
};

const attachmentValidator = {
  filename: v.string(),
  contentBase64: v.string(),
};

export const sendQuoteEmail = action({
  args: {
    quoteId: v.id("quotes"),
    attachment: v.object(attachmentValidator),
  },
  handler: async (ctx, args) => {
    const payload: QuoteEmailPayload = await ctx.runMutation(internal.documentEmails.prepareQuoteEmail, {
      quoteId: args.quoteId,
    });
    const publicUrl = `${siteUrl()}/public/quote/${encodeURIComponent(payload.publicToken)}`;

    await sendDocumentEmail({
      from: documentSender(payload.organization),
      to: payload.to,
      replyTo: payload.organization.email,
      subject: `Devis ${payload.quote.number} - ${payload.organization.name}`,
      text: [
        `Bonjour ${payload.clientName},`,
        "",
        `Tu trouveras le devis ${payload.quote.number} en piece jointe.`,
        `Tu peux aussi le consulter et le signer ici : ${publicUrl}`,
        "",
        `Montant TTC : ${formatCurrency(payload.quote.totalTtc)}`,
        "",
        "Cordialement,",
        payload.organization.name,
      ].join("\n"),
      html: documentEmailHtml({
        kind: "Devis",
        organizationName: payload.organization.name,
        clientName: payload.clientName,
        number: payload.quote.number,
        title: payload.quote.title,
        totalTtc: payload.quote.totalTtc,
        ctaLabel: "Consulter et signer le devis",
        ctaUrl: publicUrl,
      }),
      attachment: args.attachment,
    });

    await ctx.runMutation(internal.documentEmails.markQuoteEmailSent, {
      quoteId: args.quoteId,
      recipient: payload.to,
    });

    return { sent: true, recipient: payload.to, publicUrl };
  },
});

export const sendInvoiceEmail = action({
  args: {
    invoiceId: v.id("invoices"),
    attachment: v.object(attachmentValidator),
  },
  handler: async (ctx, args) => {
    const payload: InvoiceEmailPayload = await ctx.runMutation(internal.documentEmails.prepareInvoiceEmail, {
      invoiceId: args.invoiceId,
    });

    await sendDocumentEmail({
      from: documentSender(payload.organization),
      to: payload.to,
      replyTo: payload.organization.email,
      subject: `Facture ${payload.invoice.number} - ${payload.organization.name}`,
      text: [
        `Bonjour ${payload.clientName},`,
        "",
        `Tu trouveras la facture ${payload.invoice.number} en piece jointe.`,
        `Montant TTC : ${formatCurrency(payload.invoice.totalTtc)}`,
        `Echeance : ${formatDate(payload.invoice.dueDate)}`,
        "",
        "Cordialement,",
        payload.organization.name,
      ].join("\n"),
      html: documentEmailHtml({
        kind: "Facture",
        organizationName: payload.organization.name,
        clientName: payload.clientName,
        number: payload.invoice.number,
        title: payload.quoteTitle ?? "Facture",
        totalTtc: payload.invoice.totalTtc,
        dueDate: payload.invoice.dueDate,
      }),
      attachment: args.attachment,
    });

    await ctx.runMutation(internal.documentEmails.markInvoiceEmailSent, {
      invoiceId: args.invoiceId,
      recipient: payload.to,
    });

    return { sent: true, recipient: payload.to };
  },
});

export const sendInvoiceReminder = action({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const payload: InvoiceEmailPayload = await ctx.runMutation(internal.documentEmails.prepareInvoiceReminder, {
      invoiceId: args.invoiceId,
    });

    await sendDocumentEmail({
      from: documentSender(payload.organization),
      to: payload.to,
      replyTo: payload.organization.email,
      subject: `Relance facture ${payload.invoice.number} - ${payload.organization.name}`,
      text: [
        `Bonjour ${payload.clientName},`,
        "",
        `Je me permets de vous relancer concernant la facture ${payload.invoice.number}.`,
        `Montant TTC : ${formatCurrency(payload.invoice.totalTtc)}`,
        `Echeance : ${formatDate(payload.invoice.dueDate)}`,
        "",
        "Pouvez-vous me confirmer la date de reglement ?",
        "",
        "Cordialement,",
        payload.organization.name,
      ].join("\n"),
      html: documentEmailHtml({
        kind: "Relance facture",
        organizationName: payload.organization.name,
        clientName: payload.clientName,
        number: payload.invoice.number,
        title: payload.quoteTitle ?? "Facture en attente de reglement",
        totalTtc: payload.invoice.totalTtc,
        dueDate: payload.invoice.dueDate,
      }),
    });

    await ctx.runMutation(internal.documentEmails.markInvoiceReminderSent, {
      invoiceId: args.invoiceId,
      recipient: payload.to,
    });

    return { sent: true, recipient: payload.to };
  },
});

export const prepareQuoteEmail = internalMutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.organizationId !== organization._id) {
      throw new Error("Devis introuvable");
    }
    if (quote.status === "void") {
      throw new Error("Un devis annule ne peut pas etre envoye");
    }
    if (quote.totalHt <= 0) {
      throw new Error("Ajoute au moins une ligne avant d'envoyer le devis");
    }
    const client = quote.clientId ? await ctx.db.get(quote.clientId) : null;
    const to = cleanOptionalString(client?.email);
    if (!to) {
      throw new Error("Email client manquant pour envoyer le devis");
    }

    const publicToken = generatePublicToken();
    const now = Date.now();
    await ctx.db.patch(args.quoteId, {
      publicTokenHash: await sha256Hex(publicToken),
      publicTokenCreatedAt: now,
      publicTokenRevokedAt: undefined,
      updatedAt: now,
    });

    return {
      organization,
      quote,
      clientName: formatClientName(client),
      to,
      publicToken,
    };
  },
});

export const markQuoteEmailSent = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization, user } = await requireBusinessWrite(ctx);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.organizationId !== organization._id) {
      throw new Error("Devis introuvable");
    }
    const now = Date.now();
    await ctx.db.patch(args.quoteId, {
      status: quote.status === "draft" || quote.status === "refused" ? "sent" : quote.status,
      sentAt: now,
      finalizedAt: quote.finalizedAt ?? now,
      updatedAt: now,
    });
    await ctx.db.insert("documentEmailEvents", {
      organizationId: organization._id,
      documentKind: "quote",
      eventKind: "send",
      quoteId: args.quoteId,
      recipient: args.recipient,
      senderUserId: user._id,
      senderName: cleanOptionalString(user.name),
      senderEmail: cleanOptionalString(user.email),
      createdAt: now,
    });
    await logActivity(ctx, "quote.email_sent", "quote", args.quoteId, `Devis envoye par email a ${args.recipient}`);
    return args.quoteId;
  },
});

export const prepareInvoiceEmail = internalMutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organization._id) {
      throw new Error("Facture introuvable");
    }
    if (invoice.status === "void") {
      throw new Error("Une facture annulee ne peut pas etre envoyee");
    }
    const client = invoice.clientId ? await ctx.db.get(invoice.clientId) : null;
    const quote = invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null;
    const to = cleanOptionalString(client?.email);
    if (!to) {
      throw new Error("Email client manquant pour envoyer la facture");
    }

    return {
      organization,
      invoice,
      quoteTitle: quote?.title,
      clientName: formatClientName(client),
      to,
    };
  },
});

export const prepareInvoiceReminder = internalMutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organization._id) {
      throw new Error("Facture introuvable");
    }
    if (invoice.status === "draft") {
      throw new Error("Envoie la facture avant de relancer le client");
    }
    if (invoice.status === "paid") {
      throw new Error("Cette facture est deja reglee");
    }
    if (invoice.status === "void") {
      throw new Error("Une facture annulee ne peut pas etre relancee");
    }
    if (invoice.invoiceKind === "credit") {
      throw new Error("Un avoir ne se relance pas comme une facture");
    }
    const client = invoice.clientId ? await ctx.db.get(invoice.clientId) : null;
    const quote = invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null;
    const to = cleanOptionalString(client?.email);
    if (!to) {
      throw new Error("Email client manquant pour envoyer la relance");
    }

    return {
      organization,
      invoice,
      quoteTitle: quote?.title,
      clientName: formatClientName(client),
      to,
    };
  },
});

export const markInvoiceEmailSent = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization, user } = await requireBusinessWrite(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organization._id) {
      throw new Error("Facture introuvable");
    }
    const now = Date.now();
    await ctx.db.patch(args.invoiceId, {
      status: invoice.status === "draft" ? "sent" : invoice.status,
      sentAt: now,
      finalizedAt: invoice.finalizedAt ?? now,
      updatedAt: now,
    });
    if (invoice.invoiceKind === "credit" && invoice.creditedInvoiceId) {
      await ctx.db.patch(invoice.creditedInvoiceId, {
        status: "void",
        creditInvoiceId: args.invoiceId,
        voidedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("documentEmailEvents", {
      organizationId: organization._id,
      documentKind: "invoice",
      eventKind: "send",
      invoiceId: args.invoiceId,
      recipient: args.recipient,
      senderUserId: user._id,
      senderName: cleanOptionalString(user.name),
      senderEmail: cleanOptionalString(user.email),
      createdAt: now,
    });
    await logActivity(ctx, "invoice.email_sent", "invoice", args.invoiceId, `Facture envoyee par email a ${args.recipient}`);
    return args.invoiceId;
  },
});

export const markInvoiceReminderSent = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization, user } = await requireBusinessWrite(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organization._id) {
      throw new Error("Facture introuvable");
    }
    const now = Date.now();
    await ctx.db.insert("documentEmailEvents", {
      organizationId: organization._id,
      documentKind: "invoice",
      eventKind: "reminder",
      invoiceId: args.invoiceId,
      recipient: args.recipient,
      senderUserId: user._id,
      senderName: cleanOptionalString(user.name),
      senderEmail: cleanOptionalString(user.email),
      createdAt: now,
    });
    await logActivity(ctx, "invoice.reminder_sent", "invoice", args.invoiceId, `Relance facture envoyee a ${args.recipient}`);
    return args.invoiceId;
  },
});

type QuoteEmailPayload = {
  organization: Doc<"organizations">;
  quote: Doc<"quotes">;
  clientName: string;
  to: string;
  publicToken: string;
};

type InvoiceEmailPayload = {
  organization: Doc<"organizations">;
  invoice: Doc<"invoices">;
  quoteTitle?: string;
  clientName: string;
  to: string;
};

async function sendDocumentEmail(input: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachment?: { filename: string; contentBase64: string };
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY est requis pour envoyer un document");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      reply_to: cleanOptionalString(input.replyTo),
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachment
        ? [
            {
              filename: input.attachment.filename,
              content: input.attachment.contentBase64,
            },
          ]
        : undefined,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend n'a pas pu envoyer le document: ${detail}`);
  }
}

function documentSender(organization: Doc<"organizations">) {
  if (process.env.DOCUMENT_EMAIL_FROM) {
    return process.env.DOCUMENT_EMAIL_FROM;
  }
  const domain = process.env.DOCUMENT_EMAIL_DOMAIN ?? "boorise.fr";
  return `${organization.name} <${organizationSlug(organization.name)}.entreprise@${domain}>`;
}

function siteUrl() {
  const url = process.env.SITE_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error("SITE_URL est requis pour envoyer un document");
  }
  return url;
}

function documentEmailHtml(input: {
  kind: "Devis" | "Facture" | "Relance facture";
  organizationName: string;
  clientName: string;
  number: string;
  title: string;
  totalTtc: number;
  dueDate?: number;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const cta = input.ctaUrl && input.ctaLabel
    ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;border-radius:10px;background:#e54715;color:#fffaf3;padding:12px 18px;text-decoration:none;font-weight:800">${escapeHtml(input.ctaLabel)}</a>`
    : "";
  const dueDate = input.dueDate
    ? `<p style="margin:8px 0 0;color:#7a5f6c;line-height:1.6">Echeance : <strong>${formatDate(input.dueDate)}</strong></p>`
    : "";

  return `
    <div style="margin:0;background:#f7efe4;padding:32px;font-family:Inter,Arial,sans-serif;color:#2a1235">
      <div style="max-width:620px;margin:0 auto;border:1px solid #ddc6aa;border-radius:16px;background:#fffaf3;padding:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:#491474;color:#fffaf3;font-weight:900">${escapeHtml(input.organizationName.slice(0, 1).toUpperCase())}</div>
        <h1 style="margin:24px 0 8px;font-size:24px;line-height:1.2;color:#491474">${escapeHtml(input.kind)} ${escapeHtml(input.number)}</h1>
        <p style="margin:0 0 18px;color:#7a5f6c;line-height:1.6">Bonjour ${escapeHtml(input.clientName)},</p>
        <p style="margin:0 0 18px;color:#7a5f6c;line-height:1.6">Le document <strong>${escapeHtml(input.title)}</strong> est disponible en piece jointe.</p>
        <p style="margin:0 0 8px;color:#491474;font-size:20px;font-weight:900">${formatCurrency(input.totalTtc)}</p>
        ${dueDate}
        <div style="margin-top:22px">${cta}</div>
        <p style="margin:24px 0 0;color:#7a5f6c;line-height:1.6">Cordialement,<br>${escapeHtml(input.organizationName)}</p>
      </div>
    </div>
  `;
}

function formatClientName(client: Doc<"clients"> | null) {
  if (!client) {
    return "Client";
  }
  return client.companyName || [client.firstName, client.name].filter(Boolean).join(" ") || client.name;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp));
}

function organizationSlug(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 48);
  return normalized || "entreprise";
}

function generatePublicToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
