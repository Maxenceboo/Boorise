const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const explicitSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;

export function convexSiteUrl() {
  if (explicitSiteUrl) {
    return explicitSiteUrl.replace(/\/$/, "");
  }
  if (!convexUrl) {
    return "";
  }
  if (convexUrl.includes("127.0.0.1:3210")) {
    return convexUrl.replace("3210", "3211").replace(/\/$/, "");
  }
  if (convexUrl.includes("localhost:3210")) {
    return convexUrl.replace("3210", "3211").replace(/\/$/, "");
  }
  if (convexUrl.endsWith(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site").replace(/\/$/, "");
  }
  return convexUrl.replace(/\/$/, "");
}
