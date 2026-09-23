import { NextRequest, NextResponse } from "next/server";

// This is a fast, cookie-presence-only check -- it keeps signed-out visitors
// from ever reaching a dashboard page. The actual signature verification
// (is this cookie genuine, has it expired) happens in lib/session.ts's
// getSession(), which every dashboard page and API route calls itself.
// Two layers on purpose: this proxy for "don't bother rendering," the page
// for "actually prove it." (Next.js renamed "middleware" to "proxy" --
// same concept, this file just has to be named and export it accordingly.)
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("cms_session");

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
