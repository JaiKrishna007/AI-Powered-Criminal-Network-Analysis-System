import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || 'fallback_secret_for_development' });

  // Log API access for Audit & Integrity (Phase 8)
  if (request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/api/auth')) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      type: 'AUDIT_LOG',
      method: request.method,
      path: request.nextUrl.pathname,
      user_id: token?.id || 'anonymous',
      user_role: token?.role || 'none',
      ip: request.headers.get('x-forwarded-for') || request.ip || 'unknown'
    }));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
