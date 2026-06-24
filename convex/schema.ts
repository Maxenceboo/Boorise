import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  organizations: defineTable({
    name: v.string(),
    legalName: v.optional(v.string()),
    siret: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    defaultVatRate: v.number(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_userId", ["organizationId", "userId"]),

  clients: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  materials: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    unit: v.union(
      v.literal("piece"),
      v.literal("metre"),
      v.literal("m2"),
      v.literal("m3"),
      v.literal("litre"),
      v.literal("kilogramme"),
      v.literal("lot"),
    ),
    purchasePriceHt: v.number(),
    divisible: v.boolean(),
    quantityPerLot: v.optional(v.number()),
    defaultWasteRate: v.number(),
    supplier: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  quotes: defineTable({
    organizationId: v.id("organizations"),
    clientId: v.optional(v.id("clients")),
    number: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("refused"),
      v.literal("invoiced"),
    ),
    totalHt: v.number(),
    totalTtc: v.number(),
    vatRate: v.number(),
    createdAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_number", ["organizationId", "number"]),
});
