import { NextRequest } from 'next/server';

export type ServiceAuthResult =
  | { ok: true; email: string }
  | { ok: false; status: number; error: string };

export function authenticateServiceRequest(request: NextRequest): ServiceAuthResult {
  const expectedToken = process.env.MENU_SERVICE_TOKEN;
  if (!expectedToken) {
    return { ok: false, status: 500, error: 'MENU_SERVICE_TOKEN is not configured' };
  }

  const token =
    request.headers.get('x-service-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || token !== expectedToken) {
    return { ok: false, status: 401, error: 'Unauthorized service token' };
  }

  const email = request.headers.get('x-user-email')?.trim().toLowerCase();
  if (!email) {
    return { ok: false, status: 400, error: 'Missing X-User-Email header' };
  }

  return { ok: true, email };
}
