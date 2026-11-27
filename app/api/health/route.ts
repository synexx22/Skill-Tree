import { NextResponse } from 'next/server';
import { corsHeaders, preflight } from '../../../lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return NextResponse.json(
    {
      ok: true,
      provider: 'gemini',
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
    },
    { headers: corsHeaders(request) },
  );
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
