import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

export const createOrganization = mutation({
  args: {
    name: v.string(),
  },
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
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name.trim(),
      defaultVatRate: 20,
      createdAt: now,
    });

    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: user._id,
      role: "owner",
      createdAt: now,
    });

    return organizationId;
  },
});

export async function requireCurrentOrganizationId(ctx: QueryCtx | MutationCtx): Promise<Id<"organizations">> {
  const currentMembership = await getCurrentMembership(ctx);
  if (!currentMembership) {
    throw new Error("Organisation requise");
  }
  return currentMembership.organization._id;
}
