import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { groupQuoteItemsByQuoteId, summarizeQuoteItems } from "./businessMetrics";

declare const process: {
  env: {
    AUTH_EMAIL_FROM?: string;
    INVITATION_EMAIL_FROM?: string;
    RESEND_API_KEY?: string;
    SITE_URL?: string;
  };
};

const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;
const teamRoles = v.union(v.literal("admin"), v.literal("sales"), v.literal("readonly"));
const operationTypeValidator = v.union(v.literal("goods"), v.literal("services"), v.literal("mixed"));
const organizationDetailsValidator = {
  name: v.string(),
  legalName: v.optional(v.string()),
  legalForm: v.optional(v.string()),
  shareCapital: v.optional(v.string()),
  siren: v.optional(v.string()),
  siret: v.optional(v.string()),
  vatNumber: v.optional(v.string()),
  apeCode: v.optional(v.string()),
  registerNumber: v.optional(v.string()),
  registerCity: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  defaultVatRate: v.number(),
  defaultHourlyRate: v.optional(v.number()),
  defaultMarginRate: v.optional(v.number()),
  quotePrefix: v.optional(v.string()),
  invoicePrefix: v.optional(v.string()),
  paymentTermsDays: v.optional(v.number()),
  quoteValidityDays: v.optional(v.number()),
  paymentTermsText: v.optional(v.string()),
  latePenaltyText: v.optional(v.string()),
  discountTermsText: v.optional(v.string()),
  taxExemptionText: v.optional(v.string()),
  quotePricingText: v.optional(v.string()),
  legalNotice: v.optional(v.string()),
  bankDetails: v.optional(v.string()),
  defaultOperationType: v.optional(operationTypeValidator),
  taxDebitOption: v.optional(v.boolean()),
  professionalInsurance: v.optional(v.string()),
  mediatorInfo: v.optional(v.string()),
  acceptanceText: v.optional(v.string()),
  accountingClientAccount: v.optional(v.string()),
  accountingBankAccount: v.optional(v.string()),
  accountingVatCollectedAccount: v.optional(v.string()),
  accountingSalesGoodsAccount: v.optional(v.string()),
  accountingSalesServicesAccount: v.optional(v.string()),
};
type TeamRole = "owner" | "admin" | "sales" | "readonly" | "member";
type LoginMethods = {
  exists: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
};
type OrganizationDetailsArgs = {
  name: string;
  legalName?: string;
  legalForm?: string;
  shareCapital?: string;
  siren?: string;
  siret?: string;
  vatNumber?: string;
  apeCode?: string;
  registerNumber?: string;
  registerCity?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  defaultVatRate: number;
  defaultHourlyRate?: number;
  defaultMarginRate?: number;
  quotePrefix?: string;
  invoicePrefix?: string;
  paymentTermsDays?: number;
  quoteValidityDays?: number;
  paymentTermsText?: string;
  latePenaltyText?: string;
  discountTermsText?: string;
  taxExemptionText?: string;
  quotePricingText?: string;
  legalNotice?: string;
  bankDetails?: string;
  defaultOperationType?: "goods" | "services" | "mixed";
  taxDebitOption?: boolean;
  professionalInsurance?: string;
  mediatorInfo?: string;
  acceptanceText?: string;
  accountingClientAccount?: string;
  accountingBankAccount?: string;
  accountingVatCollectedAccount?: string;
  accountingSalesGoodsAccount?: string;
  accountingSalesServicesAccount?: string;
};

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  if (!user) {
    throw new Error("Authentification requise");
  }

  return user;
}

async function getCurrentMembership(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();

  if (!membership) {
    return null;
  }

  const organization = await ctx.db.get(membership.organizationId);
  if (!organization) {
    throw new Error("Organisation introuvable");
  }

  return { user, membership, organization };
}

export function cleanOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function cleanRequiredString(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} est obligatoire`);
  }
  return trimmed;
}

export async function requireCurrentMembership(ctx: QueryCtx | MutationCtx) {
  const currentMembership = await getCurrentMembership(ctx);
  if (!currentMembership) {
    throw new Error("Organisation requise");
  }
  return currentMembership;
}

export async function requireAdminOrOwner(ctx: QueryCtx | MutationCtx) {
  const currentMembership = await requireCurrentMembership(ctx);
  if (currentMembership.membership.role !== "owner" && currentMembership.membership.role !== "admin") {
    throw new Error("Droits administrateur requis");
  }
  return currentMembership;
}

export async function requireBusinessWrite(ctx: QueryCtx | MutationCtx) {
  const currentMembership = await requireCurrentMembership(ctx);
  if (normalizedRole(currentMembership.membership.role) === "readonly") {
    throw new Error("Droits en lecture seule: modification impossible");
  }
  return currentMembership;
}

export async function requireCatalogWrite(ctx: QueryCtx | MutationCtx) {
  const currentMembership = await requireCurrentMembership(ctx);
  const role = normalizedRole(currentMembership.membership.role);
  if (role !== "owner" && role !== "admin") {
    throw new Error("Droits administrateur requis pour modifier le catalogue");
  }
  return currentMembership;
}

export async function logActivity(
  ctx: MutationCtx,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  summary: string,
  metadata?: string,
) {
  const { user, organization } = await requireCurrentMembership(ctx);
  await writeActivity(ctx, {
    organizationId: organization._id,
    actorUserId: user._id,
    actorName: user.name,
    actorEmail: user.email,
    action,
    resourceType,
    resourceId,
    summary,
    metadata,
  });
}

async function writeActivity(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    actorUserId?: Id<"users">;
    actorName?: string;
    actorEmail?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    summary: string;
    metadata?: string;
  },
) {
  await ctx.db.insert("activityLogs", {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorName: cleanOptionalString(input.actorName),
    actorEmail: cleanOptionalString(input.actorEmail),
    action: cleanRequiredString(input.action, "Action"),
    resourceType: cleanRequiredString(input.resourceType, "Ressource"),
    resourceId: cleanOptionalString(input.resourceId),
    summary: cleanRequiredString(input.summary, "Resume"),
    metadata: cleanOptionalString(input.metadata),
    createdAt: Date.now(),
  });
}

export async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const currentMembership = await requireCurrentMembership(ctx);
  if (currentMembership.membership.role !== "owner") {
    throw new Error("Droits proprietaire requis");
  }
  return currentMembership;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { user: null, organization: null, membership: null };
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const organization = membership ? await ctx.db.get(membership.organizationId) : null;

    return { user, organization, membership };
  },
});

export const activityLog = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireCurrentMembership(ctx);
    return await ctx.db
      .query("activityLogs")
      .withIndex("by_organizationId_and_createdAt", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(80);
  },
});

export const createOrganization = mutation({
  args: organizationDetailsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existingMembership) {
      return existingMembership.organizationId;
    }

    const now = Date.now();
    const details = normalizeOrganizationDetails(args, undefined, { requireLegalIdentity: true });
    const organizationId = await ctx.db.insert("organizations", {
      ...details,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: user._id,
      role: "owner",
      createdAt: now,
    });

    const year = new Date(now).getFullYear();
    await ctx.db.insert("documentSequences", {
      organizationId,
      kind: "quotes",
      year,
      nextNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("documentSequences", {
      organizationId,
      kind: "invoices",
      year,
      nextNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await writeActivity(ctx, {
      organizationId,
      actorUserId: user._id,
      action: "organization.created",
      resourceType: "organization",
      resourceId: organizationId,
      summary: `Entreprise creee: ${details.name}`,
    });

    return organizationId;
  },
});

export const updateOrganization = mutation({
  args: organizationDetailsValidator,
  handler: async (ctx, args) => {
    const { organization } = await requireAdminOrOwner(ctx);
    const now = Date.now();

    await ctx.db.patch(organization._id, {
      ...normalizeOrganizationDetails(args, organization.defaultOperationType, { requireLegalIdentity: false }),
      updatedAt: now,
    });
    await logActivity(ctx, "organization.updated", "organization", organization._id, "Informations entreprise modifiees");

    return organization._id;
  },
});

export const team = query({
  args: {},
  handler: async (ctx) => {
    const { organization, membership } = await requireCurrentMembership(ctx);
    const [members, invitations] = await Promise.all([
      ctx.db
        .query("organizationMembers")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
        .take(100),
      ctx.db
        .query("organizationInvitations")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
        .order("desc")
        .take(100),
    ]);

    return {
      currentRole: membership.role,
      currentNormalizedRole: normalizedRole(membership.role),
      members: await Promise.all(
        members.map(async (member) => ({
          ...member,
          user: await ctx.db.get(member.userId),
        })),
      ),
      invitations: invitations.filter((invitation) => invitation.status !== "accepted"),
    };
  },
});

export const createInvitationForEmail = internalMutation({
  args: {
    email: v.string(),
    role: teamRoles,
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, organization, membership } = await requireAdminOrOwner(ctx);
    if (membership.role !== "owner" && args.role === "admin") {
      throw new Error("Seul le proprietaire peut inviter un administrateur");
    }

    const email = normalizeEmail(args.email);
    const existingInvitation = await findOpenInvitation(ctx, organization._id, email);
    const now = Date.now();
    if (existingInvitation) {
      await ctx.db.patch(existingInvitation._id, {
        role: args.role,
        tokenHash: args.tokenHash,
        status: "pending",
        invitedByUserId: user._id,
        expiresAt: now + invitationTtlMs,
        revokedAt: undefined,
        updatedAt: now,
      });
      await logActivity(ctx, "invitation.resent", "invitation", existingInvitation._id, `Invitation renvoyee a ${email}`);
      return {
        invitationId: existingInvitation._id,
        email,
        role: args.role,
        organizationName: organization.name,
      };
    }

    const invitationId = await ctx.db.insert("organizationInvitations", {
      organizationId: organization._id,
      email,
      role: args.role,
      tokenHash: args.tokenHash,
      status: "pending",
      invitedByUserId: user._id,
      expiresAt: now + invitationTtlMs,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, "invitation.created", "invitation", invitationId, `Invitation envoyee a ${email}`);

    return { invitationId, email, role: args.role, organizationName: organization.name };
  },
});

export const inviteMember = action({
  args: {
    email: v.string(),
    role: teamRoles,
  },
  handler: async (ctx, args) => {
    const token = createInvitationToken();
    const tokenHash = await hashToken(token);
    const invitation = await ctx.runMutation(internal.app.createInvitationForEmail, {
      email: args.email,
      role: args.role,
      tokenHash,
    });
    const inviteUrl = `${siteUrl()}/?invite=${encodeURIComponent(token)}`;
    await sendInvitationEmail(invitation.email, invitation.organizationName, inviteUrl, invitation.role);
    return { ok: true };
  },
});

export const resendInvitation = action({
  args: {
    invitationId: v.id("organizationInvitations"),
  },
  handler: async (ctx, args) => {
    const token = createInvitationToken();
    const tokenHash = await hashToken(token);
    const invitation = await ctx.runMutation(internal.app.refreshInvitationToken, {
      invitationId: args.invitationId,
      tokenHash,
    });
    const inviteUrl = `${siteUrl()}/?invite=${encodeURIComponent(token)}`;
    await sendInvitationEmail(invitation.email, invitation.organizationName, inviteUrl, invitation.role);
    return { ok: true };
  },
});

export const refreshInvitationToken = internalMutation({
  args: {
    invitationId: v.id("organizationInvitations"),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireAdminOrOwner(ctx);
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.organizationId !== organization._id) {
      throw new Error("Invitation introuvable");
    }
    if (invitation.status === "accepted") {
      throw new Error("Invitation deja acceptee");
    }
    const now = Date.now();
    await ctx.db.patch(args.invitationId, {
      tokenHash: args.tokenHash,
      status: "pending",
      expiresAt: now + invitationTtlMs,
      revokedAt: undefined,
      updatedAt: now,
    });
    await logActivity(ctx, "invitation.resent", "invitation", args.invitationId, `Invitation renvoyee a ${invitation.email}`);
    return {
      email: invitation.email,
      role: normalizedInvitationRole(invitation.role),
      organizationName: organization.name,
    };
  },
});

export const accountLoginMethodsByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!user) {
      return { exists: false, hasPassword: false, hasGoogle: false };
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .take(20);

    return {
      exists: true,
      hasPassword: accounts.some((account) => account.provider === "password"),
      hasGoogle: accounts.some((account) => account.provider === "google"),
    };
  },
});

export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const loginMethods: LoginMethods = await ctx.runQuery(internal.app.accountLoginMethodsByEmail, { email });

    if (loginMethods.hasPassword) {
      try {
        await ctx.runAction(api.auth.signIn, {
          provider: "password",
          params: {
            flow: "reset",
            email,
            redirectTo: "/?flow=reset",
          },
        });
      } catch {
        // Keep a neutral response so the reset endpoint does not leak account state.
      }
      return { ok: true };
    }

    if (loginMethods.hasGoogle) {
      await sendOAuthOnlyResetEmail(email);
    }

    return { ok: true };
  },
});

export const acceptInvitation = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (existingMembership) {
      throw new Error("Ce compte appartient deja a une entreprise");
    }

    const tokenHash = await hashToken(args.token);
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invitation || invitation.status !== "pending") {
      throw new Error("Invitation invalide ou deja utilisee");
    }

    const now = Date.now();
    if (invitation.expiresAt < now) {
      await ctx.db.patch(invitation._id, { status: "expired", updatedAt: now });
      throw new Error("Invitation expiree");
    }

    const userEmail = normalizeEmail((user as Doc<"users"> & { email?: string }).email);
    if (userEmail && userEmail !== invitation.email) {
      throw new Error("Cette invitation est reservee a une autre adresse email");
    }

    await ctx.db.insert("organizationMembers", {
      organizationId: invitation.organizationId,
      userId: user._id,
      role: normalizedInvitationRole(invitation.role),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedAt: now,
      updatedAt: now,
    });
    await writeActivity(ctx, {
      organizationId: invitation.organizationId,
      actorUserId: user._id,
      actorName: user.name,
      actorEmail: userEmail,
      action: "invitation.accepted",
      resourceType: "member",
      resourceId: user._id,
      summary: `Invitation acceptee par ${userEmail}`,
    });

    return invitation.organizationId;
  },
});

export const updateMemberRole = mutation({
  args: {
    memberId: v.id("organizationMembers"),
    role: teamRoles,
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOwner(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member || member.organizationId !== organization._id) {
      throw new Error("Membre introuvable");
    }
    if (member.role === "owner") {
      throw new Error("Le role du proprietaire ne peut pas etre modifie ici");
    }
    await ctx.db.patch(args.memberId, { role: args.role, updatedAt: Date.now() });
    await logActivity(ctx, "member.role_updated", "member", args.memberId, `Role membre modifie: ${roleLabel(args.role)}`);
    return args.memberId;
  },
});

export const removeMember = mutation({
  args: {
    memberId: v.id("organizationMembers"),
  },
  handler: async (ctx, args) => {
    const { user, organization } = await requireOwner(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member || member.organizationId !== organization._id) {
      throw new Error("Membre introuvable");
    }
    if (member.userId === user._id || member.role === "owner") {
      throw new Error("Le proprietaire ne peut pas etre retire");
    }
    await ctx.db.delete(args.memberId);
    await logActivity(ctx, "member.removed", "member", args.memberId, "Membre retire de l'equipe");
    return args.memberId;
  },
});

export const revokeInvitation = mutation({
  args: {
    invitationId: v.id("organizationInvitations"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireAdminOrOwner(ctx);
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.organizationId !== organization._id) {
      throw new Error("Invitation introuvable");
    }
    await ctx.db.patch(args.invitationId, {
      status: "revoked",
      revokedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "invitation.revoked", "invitation", args.invitationId, `Invitation revoquee: ${invitation.email}`);
    return args.invitationId;
  },
});

export async function requireCurrentOrganizationId(ctx: QueryCtx | MutationCtx): Promise<Id<"organizations">> {
  const currentMembership = await requireCurrentMembership(ctx);
  return currentMembership.organization._id;
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const [clients, materials, quotes, invoices, quoteItems] = await Promise.all([
      ctx.db
        .query("clients")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(200),
      ctx.db
        .query("materials")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(300),
      ctx.db
        .query("quotes")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(200),
      ctx.db
        .query("invoices")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(100),
      ctx.db
        .query("quoteItems")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(500),
    ]);

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const activeClients = clients.filter((client) => client.active !== false);
    const activeMaterials = materials.filter((material) => material.active);
    const totalQuotesHt = quotes.reduce((sum, quote) => sum + quote.totalHt, 0);
    const totalQuotesTtc = quotes.reduce((sum, quote) => sum + quote.totalTtc, 0);
    const acceptedQuotesTtc = quotes
      .filter((quote) => quote.status === "accepted" || quote.status === "invoiced")
      .reduce((sum, quote) => sum + quote.totalTtc, 0);
    const openQuotes = quotes.filter((quote) => quote.status === "draft" || quote.status === "sent");
    const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void");
    const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.dueDate < now);
    const dueSoonInvoices = unpaidInvoices.filter((invoice) => invoice.dueDate >= now && invoice.dueDate <= now + sevenDaysMs);
    const quotesToFollowUp = quotes.filter((quote) => quote.status === "sent" && now - quote.updatedAt >= sevenDaysMs);
    const expiredQuotes = quotes.filter((quote) => (quote.status === "draft" || quote.status === "sent" || quote.status === "refused") && quote.validUntil !== undefined && quote.validUntil < now);
    const materialCostHt = quoteItems.reduce((sum, item) => sum + (item.realCostHt ?? 0), 0);
    const itemsTotalHt = quoteItems.reduce((sum, item) => sum + item.totalHt, 0);
    const estimatedMarginHt = Math.max(0, itemsTotalHt - materialCostHt);
    const quoteItemsByQuoteId = groupQuoteItemsByQuoteId(quoteItems);
    const signedQuoteIds = new Set(
      quotes
        .filter((quote) => quote.status === "accepted" || quote.status === "invoiced")
        .map((quote) => quote._id),
    );
    const signedItems = quoteItems.filter((item) => signedQuoteIds.has(item.quoteId));
    const signedSummary = summarizeQuoteItems(signedItems);
    const conversionBase = quotes.filter((quote) => quote.status !== "draft").length;
    const wonQuotes = quotes.filter((quote) => quote.status === "accepted" || quote.status === "invoiced").length;
    const conversionRate = conversionBase > 0 ? Math.round((wonQuotes / conversionBase) * 10000) / 100 : 0;
    const clientsWithoutEmail = activeClients.filter((client) => !client.email);
    const incompleteMaterials = activeMaterials.filter(isMaterialIncomplete);

    return {
      counts: {
        clients: activeClients.length,
        materials: activeMaterials.length,
        quotes: quotes.length,
        invoices: invoices.length,
      },
      totals: {
        quotesHt: roundMoney(totalQuotesHt),
        quotesTtc: roundMoney(totalQuotesTtc),
        acceptedQuotesTtc: roundMoney(acceptedQuotesTtc),
        unpaidInvoicesTtc: roundMoney(unpaidInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        overdueInvoicesTtc: roundMoney(overdueInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        paidInvoicesTtc: roundMoney(invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        estimatedMarginHt: roundMoney(estimatedMarginHt),
        estimatedMarginRate: itemsTotalHt > 0 ? Math.round((estimatedMarginHt / itemsTotalHt) * 10000) / 100 : 0,
        realMarginHt: signedSummary.marginHt,
        realMarginRate: signedSummary.marginRate,
        signedCostHt: signedSummary.realCostHt,
        conversionRate,
      },
      pipeline: {
        draft: quotes.filter((quote) => quote.status === "draft").length,
        sent: quotes.filter((quote) => quote.status === "sent").length,
        accepted: quotes.filter((quote) => quote.status === "accepted").length,
        refused: quotes.filter((quote) => quote.status === "refused").length,
        invoiced: quotes.filter((quote) => quote.status === "invoiced").length,
        unpaidInvoices: unpaidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        dueSoonInvoices: dueSoonInvoices.length,
        quotesToFollowUp: quotesToFollowUp.length,
        expiredQuotes: expiredQuotes.length,
      },
      latestQuotes: await Promise.all(
        quotes.slice(0, 6).map(async (quote) => ({
          ...quote,
          client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
          business: summarizeQuoteItems(quoteItemsByQuoteId.get(quote._id) ?? []),
        })),
      ),
      latestInvoices: await Promise.all(
        invoices.slice(0, 6).map(async (invoice) => ({
          ...invoice,
          client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
          quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
        })),
      ),
      latestClients: activeClients.slice(0, 6),
      priorities: {
        overdueInvoices: await Promise.all(
          overdueInvoices
            .sort((a, b) => a.dueDate - b.dueDate)
            .slice(0, 5)
            .map(async (invoice) => ({
              ...invoice,
              client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
              quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
            })),
        ),
        dueSoonInvoices: await Promise.all(
          dueSoonInvoices
            .sort((a, b) => a.dueDate - b.dueDate)
            .slice(0, 5)
            .map(async (invoice) => ({
              ...invoice,
              client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
              quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
            })),
        ),
        quotesToFollowUp: await Promise.all(
          quotesToFollowUp
            .sort((a, b) => a.updatedAt - b.updatedAt)
            .slice(0, 5)
            .map(async (quote) => ({
              ...quote,
              client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
            })),
        ),
        expiredQuotes: await Promise.all(
          expiredQuotes
            .sort((a, b) => (a.validUntil ?? 0) - (b.validUntil ?? 0))
            .slice(0, 5)
            .map(async (quote) => ({
              ...quote,
              client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
            })),
        ),
        clientsWithoutEmail: clientsWithoutEmail.slice(0, 5),
        incompleteMaterials: incompleteMaterials.slice(0, 5),
      },
      alerts: {
        openQuotes: openQuotes.length,
        unpaidInvoices: unpaidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        dueSoonInvoices: dueSoonInvoices.length,
        quotesToFollowUp: quotesToFollowUp.length,
        expiredQuotes: expiredQuotes.length,
        clientsWithoutEmail: clientsWithoutEmail.length,
        incompleteMaterials: incompleteMaterials.length,
        lowCatalogDetail: incompleteMaterials.length,
      },
    };
  },
});

export const businessStats = query({
  args: {
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const [quotes, invoices, quoteItems] = await Promise.all([
      ctx.db
        .query("quotes")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(500),
      ctx.db
        .query("invoices")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(300),
      ctx.db
        .query("quoteItems")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(1500),
    ]);

    const startAt = args.startAt ?? 0;
    const endAt = args.endAt ?? Number.MAX_SAFE_INTEGER;
    const issuedQuotes = quotes.filter((quote) => inPeriod(quote.issueDate, startAt, endAt));
    const decidedQuotes = issuedQuotes.filter((quote) => quote.status === "accepted" || quote.status === "invoiced" || quote.status === "refused");
    const signedQuotes = quotes.filter((quote) =>
      (quote.status === "accepted" || quote.status === "invoiced")
      && inPeriod(quote.acceptedAt ?? quote.finalizedAt ?? quote.issueDate, startAt, endAt)
    );
    const billedInvoices = invoices.filter((invoice) =>
      invoice.status !== "draft"
      && invoice.status !== "void"
      && inPeriod(invoice.issueDate, startAt, endAt)
    );
    const paidInvoices = invoices.filter((invoice) =>
      invoice.status === "paid"
      && invoice.paidAt !== undefined
      && inPeriod(invoice.paidAt, startAt, endAt)
    );
    const wonCount = decidedQuotes.filter((quote) => quote.status === "accepted" || quote.status === "invoiced").length;
    const acceptedRate = decidedQuotes.length > 0 ? roundRate((wonCount / decidedQuotes.length) * 100) : 0;
    const signedIds = new Set(signedQuotes.map((quote) => quote._id));
    const signedSummary = summarizeQuoteItems(quoteItems.filter((item) => signedIds.has(item.quoteId)));
    const signedRevenueTtc = roundMoney(signedQuotes.reduce((sum, quote) => sum + quote.totalTtc, 0));

    return {
      period: { startAt, endAt },
      counts: {
        issuedQuotes: issuedQuotes.length,
        decidedQuotes: decidedQuotes.length,
        signedQuotes: signedQuotes.length,
        billedInvoices: billedInvoices.length,
        paidInvoices: paidInvoices.length,
      },
      totals: {
        signedRevenueHt: roundMoney(signedQuotes.reduce((sum, quote) => sum + quote.totalHt, 0)),
        signedRevenueTtc,
        billedRevenueHt: roundMoney(billedInvoices.reduce((sum, invoice) => sum + invoice.totalHt, 0)),
        billedRevenueTtc: roundMoney(billedInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        paidRevenueTtc: roundMoney(paidInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        averageBasketTtc: signedQuotes.length > 0 ? roundMoney(signedRevenueTtc / signedQuotes.length) : 0,
        acceptanceRate: acceptedRate,
        realCostHt: signedSummary.realCostHt,
        realMarginHt: signedSummary.marginHt,
        realMarginRate: signedSummary.marginRate,
      },
    };
  },
});

function inPeriod(timestamp: number | undefined, startAt: number, endAt: number) {
  return timestamp !== undefined && timestamp >= startAt && timestamp <= endAt;
}

function isMaterialIncomplete(material: Doc<"materials">) {
  return (
    !material.reference
    || !material.category
    || !material.supplier
    || (!material.divisible && (!material.quantityPerLot || material.quantityPerLot <= 0))
  );
}

function clampRate(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} doit être compris entre 0 et 100`);
  }
  return Math.round(value * 100) / 100;
}

function normalizeOrganizationDetails(
  args: OrganizationDetailsArgs,
  currentOperationType: "goods" | "services" | "mixed" | undefined,
  options: { requireLegalIdentity: boolean },
) {
  const defaultVatRate = clampRate(args.defaultVatRate, "TVA");
  const siren = cleanOptionalString(args.siren);
  const siret = cleanOptionalString(args.siret);
  const address = cleanOptionalString(args.address);
  const postalCode = cleanOptionalString(args.postalCode);
  const city = cleanOptionalString(args.city);
  const country = cleanOptionalString(args.country);
  const legalForm = cleanOptionalString(args.legalForm);
  const shareCapital = cleanOptionalString(args.shareCapital);
  const registerNumber = cleanOptionalString(args.registerNumber);
  const registerCity = cleanOptionalString(args.registerCity);
  const vatNumber = cleanOptionalString(args.vatNumber);
  const taxExemptionText = cleanOptionalString(args.taxExemptionText);
  const paymentTermsText = cleanOptionalString(args.paymentTermsText);
  const latePenaltyText = cleanOptionalString(args.latePenaltyText);
  const discountTermsText = cleanOptionalString(args.discountTermsText);
  const quotePricingText = cleanOptionalString(args.quotePricingText);

  if (options.requireLegalIdentity) {
    requireClean(siren, "Le SIREN");
    requireClean(siret, "Le SIRET");
    requireClean(address, "L'adresse");
    requireClean(postalCode, "Le code postal");
    requireClean(city, "La ville");
    requireClean(country, "Le pays");
    requireClean(paymentTermsText, "Les conditions de reglement");
    requireClean(latePenaltyText, "Les penalites de retard");
    requireClean(discountTermsText, "L'escompte");
    requireClean(quotePricingText, "Le prix du devis");
    if (defaultVatRate > 0) {
      requireClean(vatNumber, "Le numero de TVA");
    } else {
      requireClean(taxExemptionText, "La mention de franchise TVA");
    }
  }

  if ((legalForm && !shareCapital) || (!legalForm && shareCapital)) {
    throw new Error("La forme juridique et le capital social doivent etre renseignes ensemble");
  }
  if ((registerNumber && !registerCity) || (!registerNumber && registerCity)) {
    throw new Error("Le registre et la ville du registre doivent etre renseignes ensemble");
  }
  if (defaultVatRate > 0 && !vatNumber && options.requireLegalIdentity) {
    throw new Error("Le numero de TVA est obligatoire si l'entreprise est assujettie a la TVA");
  }
  if (defaultVatRate === 0 && !taxExemptionText && options.requireLegalIdentity) {
    throw new Error("La mention de franchise TVA est obligatoire si la TVA est a 0%");
  }

  return {
    name: cleanRequiredString(args.name, "Le nom de l'entreprise"),
    legalName: cleanOptionalString(args.legalName),
    legalForm,
    shareCapital,
    siren,
    siret,
    vatNumber: defaultVatRate > 0 ? vatNumber : undefined,
    apeCode: cleanOptionalString(args.apeCode),
    registerNumber,
    registerCity,
    email: cleanOptionalString(args.email),
    phone: cleanOptionalString(args.phone),
    address,
    postalCode,
    city,
    country,
    logoUrl: cleanOptionalString(args.logoUrl),
    defaultVatRate,
    defaultHourlyRate: args.defaultHourlyRate === undefined ? undefined : roundPositive(args.defaultHourlyRate, "Taux horaire"),
    defaultMarginRate: args.defaultMarginRate === undefined ? undefined : clampRate(args.defaultMarginRate, "Marge"),
    quotePrefix: cleanOptionalString(args.quotePrefix) ?? "D",
    invoicePrefix: cleanOptionalString(args.invoicePrefix) ?? "F",
    paymentTermsDays: clampDays(args.paymentTermsDays ?? 30, "Delai de paiement", 0),
    quoteValidityDays: clampDays(args.quoteValidityDays ?? 30, "Validite du devis", 1),
    paymentTermsText,
    latePenaltyText,
    discountTermsText,
    taxExemptionText: defaultVatRate === 0 ? taxExemptionText : undefined,
    quotePricingText,
    legalNotice: cleanOptionalString(args.legalNotice),
    bankDetails: cleanOptionalString(args.bankDetails),
    defaultOperationType: args.defaultOperationType ?? currentOperationType ?? "mixed",
    taxDebitOption: args.taxDebitOption ?? false,
    professionalInsurance: cleanOptionalString(args.professionalInsurance),
    mediatorInfo: cleanOptionalString(args.mediatorInfo),
    acceptanceText: cleanOptionalString(args.acceptanceText) ?? "Bon pour accord, date et signature precedees de la mention manuscrite.",
    accountingClientAccount: cleanAccount(args.accountingClientAccount, "Compte client") ?? "411000",
    accountingBankAccount: cleanAccount(args.accountingBankAccount, "Compte banque") ?? "512000",
    accountingVatCollectedAccount: cleanAccount(args.accountingVatCollectedAccount, "Compte TVA collectee") ?? "445710",
    accountingSalesGoodsAccount: cleanAccount(args.accountingSalesGoodsAccount, "Compte ventes de biens") ?? "707000",
    accountingSalesServicesAccount: cleanAccount(args.accountingSalesServicesAccount, "Compte prestations") ?? "706000",
  };
}

function requireClean(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} est obligatoire`);
  }
}

function clampDays(value: number, label: string, min: number) {
  if (!Number.isFinite(value) || value < min || value > 365) {
    throw new Error(`${label} doit etre compris entre ${min} et 365 jours`);
  }
  return Math.round(value);
}

function roundPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} doit etre positif`);
  }
  return Math.round(value * 100) / 100;
}

function cleanAccount(value: string | undefined, label: string) {
  const cleaned = cleanOptionalString(value)?.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) {
    return undefined;
  }
  if (!/^[0-9A-Z]{3,20}$/.test(cleaned)) {
    throw new Error(`${label} invalide`);
  }
  return cleaned;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeEmail(value: string | undefined) {
  return cleanRequiredString(value ?? "", "Email").toLowerCase();
}

function normalizedRole(role: TeamRole): "owner" | "admin" | "sales" | "readonly" {
  return role === "member" ? "sales" : role;
}

function normalizedInvitationRole(role: Exclude<TeamRole, "owner">): "admin" | "sales" | "readonly" {
  return role === "member" ? "sales" : role;
}

async function findOpenInvitation(ctx: MutationCtx, organizationId: Id<"organizations">, email: string) {
  const invitations = await ctx.db
    .query("organizationInvitations")
    .withIndex("by_organizationId_and_email", (q) => q.eq("organizationId", organizationId).eq("email", email))
    .take(20);
  return invitations.find((invitation) => invitation.status === "pending" || invitation.status === "expired") ?? null;
}

function createInvitationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function siteUrl() {
  const url = process.env.SITE_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error("SITE_URL est requis pour envoyer un email");
  }
  return url;
}

async function sendInvitationEmail(email: string, organizationName: string, inviteUrl: string, role: Exclude<TeamRole, "owner">) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY est requis pour envoyer une invitation");
  }
  const from = process.env.INVITATION_EMAIL_FROM ?? "Boorise <equipe@boorise.fr>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: `Invitation a rejoindre ${organizationName} sur Boorise`,
      text: [
        "Bonjour,",
        "",
        `Tu as ete invite a rejoindre ${organizationName} sur Boorise avec le role ${roleLabel(role)}.`,
        `Ouvre ce lien pour accepter l'invitation : ${inviteUrl}`,
        "",
        "Ce lien expire dans 7 jours.",
        "",
        "Boorise",
      ].join("\n"),
      html: invitationEmailHtml(organizationName, inviteUrl, role),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend n'a pas pu envoyer l'invitation: ${detail}`);
  }
}

async function sendOAuthOnlyResetEmail(email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY est requis pour envoyer un email de securite");
  }
  const from = process.env.AUTH_EMAIL_FROM ?? "Boorise <onboarding@resend.dev>";
  const loginUrl = siteUrl();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Connexion a ton compte Boorise",
      text: [
        "Bonjour,",
        "",
        "Tu as demande a reinitialiser ton mot de passe Boorise.",
        "Ton compte utilise actuellement la connexion Google et n'a pas de mot de passe Boorise a reinitialiser.",
        `Connecte-toi avec Google ici : ${loginUrl}`,
        "",
        "Si tu n'es pas a l'origine de cette demande, tu peux ignorer cet email.",
        "",
        "Boorise",
      ].join("\n"),
      html: oauthOnlyResetEmailHtml(loginUrl),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend n'a pas pu envoyer l'email de connexion Google: ${detail}`);
  }
}

function invitationEmailHtml(organizationName: string, inviteUrl: string, role: Exclude<TeamRole, "owner">) {
  const escapedUrl = escapeHtml(inviteUrl);
  const escapedName = escapeHtml(organizationName);
  return `
    <div style="margin:0;background:#f7efe4;padding:32px;font-family:Inter,Arial,sans-serif;color:#2a1235">
      <div style="max-width:560px;margin:0 auto;border:1px solid #ddc6aa;border-radius:16px;background:#fffaf3;padding:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:#491474;color:#fffaf3;font-weight:900">B</div>
        <h1 style="margin:24px 0 8px;font-size:24px;line-height:1.2;color:#491474">Invitation Boorise</h1>
        <p style="margin:0 0 18px;color:#7a5f6c;line-height:1.6">Tu as ete invite a rejoindre <strong>${escapedName}</strong> avec le role ${roleLabel(role)}.</p>
        <a href="${escapedUrl}" style="display:inline-block;border-radius:10px;background:#e54715;color:#fffaf3;padding:12px 18px;text-decoration:none;font-weight:800">Accepter l'invitation</a>
        <p style="margin:22px 0 0;color:#7a5f6c;line-height:1.6">Ce lien expire dans 7 jours.</p>
        <p style="margin:18px 0 0;color:#7a5f6c;font-size:13px;line-height:1.5">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br><span style="word-break:break-all;color:#491474">${escapedUrl}</span></p>
      </div>
    </div>
  `;
}

function oauthOnlyResetEmailHtml(loginUrl: string) {
  const escapedUrl = escapeHtml(loginUrl);
  return `
    <div style="margin:0;background:#f7efe4;padding:32px;font-family:Inter,Arial,sans-serif;color:#2a1235">
      <div style="max-width:560px;margin:0 auto;border:1px solid #ddc6aa;border-radius:16px;background:#fffaf3;padding:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:#491474;color:#fffaf3;font-weight:900">B</div>
        <h1 style="margin:24px 0 8px;font-size:24px;line-height:1.2;color:#491474">Connexion avec Google</h1>
        <p style="margin:0 0 18px;color:#7a5f6c;line-height:1.6">Tu as demande a reinitialiser ton mot de passe Boorise. Ton compte utilise actuellement la connexion Google et n'a pas de mot de passe Boorise a reinitialiser.</p>
        <a href="${escapedUrl}" style="display:inline-block;border-radius:10px;background:#e54715;color:#fffaf3;padding:12px 18px;text-decoration:none;font-weight:800">Se connecter avec Google</a>
        <p style="margin:22px 0 0;color:#7a5f6c;line-height:1.6">Si tu n'es pas a l'origine de cette demande, tu peux ignorer cet email.</p>
      </div>
    </div>
  `;
}

function roleLabel(role: Exclude<TeamRole, "owner">) {
  const normalized = normalizedInvitationRole(role);
  if (normalized === "admin") {
    return "administrateur";
  }
  if (normalized === "readonly") {
    return "lecture seule";
  }
  return "commercial";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
