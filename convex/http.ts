import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/public/quotes/respond",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse(null, 204)),
});

http.route({
  path: "/public/quotes/respond",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();
      const result = await ctx.runMutation(internal.publicQuotes.recordDecision, {
        token: String(body.token ?? ""),
        decision: body.decision === "refused" ? "refused" : "accepted",
        signature: String(body.signature ?? ""),
        ip: requestIp(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
      return corsResponse(JSON.stringify({ ok: true, result }), 200);
    } catch (error) {
      return corsResponse(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Action impossible" }), 400);
    }
  }),
});

export default http;

function corsResponse(body: BodyInit | null, status: number) {
  return new Response(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function requestIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}
