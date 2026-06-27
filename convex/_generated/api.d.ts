/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as app from "../app.js";
import type * as auth from "../auth.js";
import type * as businessMetrics from "../businessMetrics.js";
import type * as clients from "../clients.js";
import type * as documentEmails from "../documentEmails.js";
import type * as documentLifecycle from "../documentLifecycle.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as materialCalculation from "../materialCalculation.js";
import type * as materials from "../materials.js";
import type * as publicQuotes from "../publicQuotes.js";
import type * as quoteTemplates from "../quoteTemplates.js";
import type * as quotes from "../quotes.js";
import type * as search from "../search.js";
import type * as services from "../services.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  app: typeof app;
  auth: typeof auth;
  businessMetrics: typeof businessMetrics;
  clients: typeof clients;
  documentEmails: typeof documentEmails;
  documentLifecycle: typeof documentLifecycle;
  http: typeof http;
  invoices: typeof invoices;
  materialCalculation: typeof materialCalculation;
  materials: typeof materials;
  publicQuotes: typeof publicQuotes;
  quoteTemplates: typeof quoteTemplates;
  quotes: typeof quotes;
  search: typeof search;
  services: typeof services;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
