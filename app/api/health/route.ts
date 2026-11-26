import { NextResponse } from 'next/server';
import { corsHeaders, preflight } from '../../../lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return NextResponse.json(
    {
      ok: true,
      provider: 'deepseek',
      aiConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    },
    { headers: corsHeaders(request) },
  );
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
