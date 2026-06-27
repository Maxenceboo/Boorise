import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

const decisionValidator = v.union(v.literal("accepted"), v.literal("refused"));

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await sha256Hex(args.token);
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_publicTokenHash", (q) => q.eq("publicTokenHash", tokenHash))
      .unique();

    if (!quote || quote.publicTokenRevokedAt || quote.status === "draft" || quote.status === "void") {
      return null;
    }

    const [organization, client, items] = await Promise.all([
      ctx.db.get(quote.organizationId),
      quote.clientId ? ctx.db.get(quote.clientId) : null,
      ctx.db.query("quoteItems").withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", quote._id)).take(300),
    ]);

    if (!organization) {
      return null;
    }

    return { quote, organization, client, items };
  },
});

export const recordDecision = internalMutation({
  args: {
    token: v.string(),
    decision: decisionValidator,
    signature: v.string(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const signature = args.signature.trim();
    if (signature.length < 2) {
      throw new Error("Signature obligatoire");
    }

    const tokenHash = await sha256Hex(args.token);
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_publicTokenHash", (q) => q.eq("publicTokenHash", tokenHash))
      .unique();

    if (!quote || quote.publicTokenRevokedAt || quote.status === "draft" || quote.status === "void") {
      throw new Error("Lien devis invalide ou expire");
    }
    if (quote.clientDecision) {
      return { quoteId: quote._id, status: quote.status, alreadyDecided: true };
    }
    if (quote.status !== "sent") {
      throw new Error("Ce devis ne peut plus recevoir de decision client");
    }

    const now = Date.now();
    await ctx.db.patch(quote._id, {
      status: args.decision === "accepted" ? "accepted" : "refused",
      clientDecision: args.decision,
      clientDecisionAt: now,
      clientSignature: signature,
      clientDecisionIp: args.ip,
      clientDecisionUserAgent: args.userAgent,
      acceptedAt: args.decision === "accepted" ? now : quote.acceptedAt,
      refusedAt: args.decision === "refused" ? now : quote.refusedAt,
      finalizedAt: quote.finalizedAt ?? now,
      updatedAt: now,
    });

    return { quoteId: quote._id, status: args.decision, alreadyDecided: false };
  },
});

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
