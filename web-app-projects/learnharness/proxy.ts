import { NextResponse, type NextRequest } from "next/server";
import { desktopAPIAuthorized } from "./src/server/desktop-access.ts";

/** Applies to every API method, including SSE and spending/settings routes.
 * No public callback or worker bypass: internal jobs call server functions,
 * and any legitimate self-HTTP request must carry the private capability. */
export function proxy(request: NextRequest) {
	if (!desktopAPIAuthorized(request.headers)) {
		return NextResponse.json(
			{ error: "Desktop API access requires the trusted LearnHarness window." },
			{ status: 403, headers: { "Cache-Control": "no-store" } },
		);
	}
	if (process.env.LH_AETHER === "1") {
		const path = request.nextUrl.pathname;
		if (path === "/api/models" && request.method === "GET") {
			return NextResponse.json({ models: [], defaults: null, rolePins: {}, slots: { strong: null, cheap: null, vision: null }, providers: [] }, { headers: { "Cache-Control": "no-store" } });
		}
		// Do not turn a missing app inference API into a new login/backend.
		const unsupported = path === "/api/chat" ||
			/^\/api\/(keys|custom-provider|subscriptions|claude-code|stt)(\/|$)/.test(path) ||
			["/api/graph/import", "/api/graph/coverage/extract"].includes(path) ||
			(path === "/api/settings/models" && request.method !== "GET");
		if (unsupported) return NextResponse.json({
			code: "aether_inference_unavailable",
			error: "Aether Script API v2 does not expose authenticated app inference.",
			message: "Learning generation, extraction and native dictation are unavailable in this adaptation. No alternative provider or login is configured.",
		}, { status: 503, headers: { "Cache-Control": "no-store" } });
	}
	return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
