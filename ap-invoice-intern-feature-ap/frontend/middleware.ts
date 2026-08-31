import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/session-expired"];

const roleAccessMap: Record<string, string[]> = {
  "Super Admin": ["/super-admin", "/organizations", "/audit-logs", "/settings"],
  "Admin": [
    "/dashboard",
    "/document-intake",
    "/invoices",
    "/purchase-orders",
    "/vendors",
    "/enterprise",
    "/queue-management",
    "/exceptions",
    "/users-roles",
    "/analytics",
    "/payment-queue",
    "/audit-logs",
    "/settings",
  ],
  "Reviewer": ["/dashboard", "/my-queue", "/invoices", "/exceptions", "/purchase-orders", "/vendors", "/settings"],
  "Approver": ["/dashboard", "/approval-queue", "/invoices", "/purchase-orders", "/vendors", "/analytics", "/payment-queue", "/settings"],
  "Auditor": ["/dashboard", "/invoices", "/payment-queue", "/audit-logs", "/settings"],
};

/**
 * Decode a JWT payload without verifying the signature.
 * Signature verification happens on the backend for every API call.
 * Here we only use the claims for routing decisions — a tampered token
 * would be rejected by the API and result in a 401/403, so routing
 * based on unverified claims is safe for UX (not for authz enforcement).
 *
 * IMPORTANT: never use this for server-side data access decisions.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64-URL decode the payload segment (edge runtime compatible)
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, api routes, Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/session-expired") {
    const response = NextResponse.next();
    response.cookies.set("access_token", "", { path: "/", maxAge: 0 });
    response.cookies.set("refresh_token", "", { path: "/", maxAge: 0 });
    response.cookies.set("role", "", { path: "/", maxAge: 0 });
    return response;
  }

  const token = request.cookies.get("access_token")?.value;
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Decode JWT claims for routing — NEVER read role from a plain cookie
  const payload = token ? decodeJwtPayload(token) : null;
  const role = typeof payload?.role === "string" ? payload.role : "";
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  const isExpired = exp ? (Date.now() / 1000) > exp : false;

  if (!token || isExpired) {
    if (!isPublicRoute && pathname !== "/") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.cookies.delete("access_token");
      redirectResponse.cookies.delete("refresh_token");
      redirectResponse.cookies.delete("role");
      return redirectResponse;
    }
    return NextResponse.next();
  }

  // User is authenticated
  const mustChangePassword = payload?.must_change_password === true;

  if (mustChangePassword && pathname !== "/settings") {
    // Force redirect to settings page for password update
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  if (isPublicRoute || pathname === "/") {
    // Redirect away from login if already authenticated
    const allowed = roleAccessMap[role] || ["/dashboard"];
    return NextResponse.redirect(new URL(allowed[0] || "/dashboard", request.url));
  }

  // Check RBAC for protected routes
  const allowedPaths = roleAccessMap[role] || ["/dashboard"];
  const isAuthorized = allowedPaths.some(
    (allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
  );

  if (!isAuthorized) {
    // If not authorized, redirect to their default allowed path
    return NextResponse.redirect(new URL(allowedPaths[0] || "/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (e.g., .svg, .png)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
