import { NextResponse } from 'next/server';

/**
 * Тот же секрет, что `SHARED_MENU_SERVICE_TOKEN` в diabalance / health-diary.
 */
export function getExpectedServiceToken(): string | null {
  return process.env.SHARED_MENU_SERVICE_TOKEN ?? process.env.MENU_SERVICE_TOKEN ?? null;
}

export type ServiceAuthOk = { email: string };

export function requireServiceAuth(request: Request): ServiceAuthOk | NextResponse {
  const expected = getExpectedServiceToken();
  if (!expected) {
    console.error('[menu-service] SHARED_MENU_SERVICE_TOKEN is not set');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const token = request.headers.get('x-service-token');
  if (token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = request.headers.get('x-user-email')?.trim().toLowerCase();
  if (!raw) {
    return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
  }

  return { email: raw };
}
