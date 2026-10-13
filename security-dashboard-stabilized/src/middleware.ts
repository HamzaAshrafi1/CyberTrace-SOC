import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRateLimiter } from "./lib/dashboard/rate-limiter";

const isDashboardRoute = createRouteMatcher([
    "/overview(.*)",
    "/flows(.*)",
    "/threats(.*)",
    "/incidents(.*)",
    "/compliance(.*)",
    "/reports(.*)",
    "/chat(.*)",
    "/settings(.*)",
    "/team(.*)",
    "/soc(.*)",
    "/hunt(.*)",
    "/lab(.*)",
    "/cases(.*)",
    "/vault(.*)",
    "/mitre(.*)",
    "/analytics(.*)",
    "/automation(.*)",
    "/playbooks(.*)",
    "/ingestion(.*)",
    "/threat-map(.*)",
]);

const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.aegis.com https://challenges.cloudflare.com https://*.protect.clerk.com",
    "connect-src 'self' https://*.clerk.accounts.dev https://clerk.aegis.com https://clerk-telemetry.com https://challenges.cloudflare.com https://*.protect.clerk.com:* http://localhost:8000",
    "img-src 'self' data: https://img.clerk.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com",
    "font-src 'self' https://fonts.gstatic.com https://fonts.cdnfonts.com",
    "worker-src 'self' blob:",
    "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com",
    "object-src 'none'",
    "base-uri 'self'",
].join("; ");

function applySecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()"
    );
    response.headers.set("Content-Security-Policy", cspHeader);

    return response;
}

function isSuspiciousRequest(url: string): boolean {
    let decoded: string;

    try {
        decoded = decodeURIComponent(url).toLowerCase();
    } catch {
        return true;
    }

    const signatures = [
        "<script",
        "javascript:",
        "union select",
        "select * from",
        "insert into",
        "delete from",
        "drop table",
        "or 1=1",
        "or '1'='1",
    ];

    return signatures.some((signature) => decoded.includes(signature));
}

function logSecurityEvent(
    origin: string,
    event: {
        ipAddress: string;
        eventType: string;
        userId?: string;
        details: Record<string, unknown>;
    }
): void {
    void fetch(`${origin}/api/security-log`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Aegis-Internal-Key": process.env.AEGIS_INTERNAL_KEY || "",
        },
        body: JSON.stringify(event),
    }).catch((error) => {
        console.error("Security log request failed:", error);
    });
}

export default clerkMiddleware(async (auth, req) => {
    const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "127.0.0.1";

    const { pathname, search, origin } = req.nextUrl;

    if (isSuspiciousRequest(pathname + search)) {
        logSecurityEvent(origin, {
            ipAddress: ip,
            eventType: "suspicious",
            details: {
                path: pathname,
                query: search,
                reason: "XSS_SQL_Injection_Signature",
            },
        });

        return applySecurityHeaders(
            NextResponse.json(
                { error: "Malicious payload signature detected." },
                { status: 400 }
            )
        );
    }

    const rateLimiter = getRateLimiter();
    const isLimited = await rateLimiter.isRateLimited(
        `rl:${ip}`,
        120,
        60 * 1000
    );

    if (isLimited) {
        logSecurityEvent(origin, {
            ipAddress: ip,
            eventType: "rate_limit",
            details: {
                path: pathname,
                limit: 120,
            },
        });

        return applySecurityHeaders(
            NextResponse.json(
                { error: "Too many requests. Limit exceeded." },
                { status: 429 }
            )
        );
    }

    if (process.env.PLAYWRIGHT_TEST === "true") {
        if (process.env.NODE_ENV === "production") {
            return applySecurityHeaders(
                NextResponse.json(
                    { error: "Test authentication is disabled in production." },
                    { status: 503 }
                )
            );
        }

        return applySecurityHeaders(NextResponse.next());
    }

    const { userId, orgId } = await auth();

    if (!userId && isDashboardRoute(req)) {
        logSecurityEvent(origin, {
            ipAddress: ip,
            eventType: "auth_failure",
            details: {
                path: pathname,
                reason: "Unauthenticated dashboard access attempt",
            },
        });

        return applySecurityHeaders(
            NextResponse.redirect(new URL("/sign-in", req.url))
        );
    }

    if (userId && !orgId && isDashboardRoute(req)) {
        logSecurityEvent(origin, {
            ipAddress: ip,
            eventType: "authz_failure",
            userId,
            details: {
                path: pathname,
                reason: "Missing active Clerk organization",
            },
        });

        return applySecurityHeaders(
            NextResponse.redirect(new URL("/onboarding", req.url))
        );
    }

    return applySecurityHeaders(NextResponse.next());
});

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|json|png|jpg|jpeg|gif|svg|ico)).*)",
        "/(api|trpc)(.*)",
    ],
};