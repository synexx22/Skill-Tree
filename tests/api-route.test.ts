import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, OPTIONS } from '../app/api/ai/route';
import { GET } from '../app/api/health/route';

const url = 'https://skilltree.test/api/ai';

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'skilltree.test', ...headers },
    body: JSON.stringify(body),
  });
}

describe('/api/ai (Gemini)', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', '');
    vi.stubEnv('GEMINI_THINKING_LEVEL', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls Gemini with the API key header and returns the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: ' Привет! ' }] } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(post({ message: 'Объясни дроби', context: { skill: 'Математика' } }, { 'x-forwarded-for': '10.0.0.1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: 'Привет!' });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const sent = JSON.parse(init.body as string);
    expect(sent.contents[0].parts[0].text).toBe('Объясни дроби');
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(sent.generationConfig.maxOutputTokens).toBe(2700);
    expect(sent.generationConfig.temperature).toBeUndefined();
  });

  it('skips thought parts and joins the visible text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'скрыто', thought: true }, { text: 'Ответ ' }, { text: 'готов' }] } }] }),
          { status: 200 },
        ),
      ),
    );
    const res = await POST(post({ message: 'привет' }, { 'x-forwarded-for': '10.0.0.5' }));
    expect(await res.json()).toEqual({ reply: 'Ответ готов' });
  });

  it('older models keep temperature and get no thinkingConfig', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await POST(post({ message: 'привет' }, { 'x-forwarded-for': '10.0.0.6' }));
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/models/gemini-2.5-flash:generateContent');
    const sent = JSON.parse(init.body as string);
    expect(sent.generationConfig.thinkingConfig).toBeUndefined();
    expect(sent.generationConfig.temperature).toBe(0.65);
    expect(sent.generationConfig.maxOutputTokens).toBe(900);
  });

  it('forwards the status and message when the provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 429, message: 'Quota exceeded' } }), { status: 429 }),
      ),
    );
    const res = await POST(post({ message: 'привет' }, { 'x-forwarded-for': '10.0.0.7' }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'AI provider request failed (429: Quota exceeded).' });
  });

  it('summary mode uses a dedicated prompt and accepts long texts', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '## Суть\nКоротко.' }] } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const longText = 'Теория. '.repeat(1000);
    const res = await POST(
      post({ message: longText, mode: 'summary', context: { skill: 'Алгебра' } }, { 'x-forwarded-for': '10.0.1.1' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: '## Суть\nКоротко.' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.generationConfig.maxOutputTokens).toBe(1400);
    expect(sent.generationConfig.temperature).toBe(0.3);
    expect(sent.systemInstruction.parts[0].text).toContain('саммари');
    expect(sent.contents[0].parts[0].text).toBe(longText.trim());
  });

  it('long messages are rejected in chat mode but not in summary mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }))));
    const text = 'a'.repeat(8000);
    const chat = await POST(post({ message: text }, { 'x-forwarded-for': '10.0.1.2' }));
    expect(chat.status).toBe(400);
    const summary = await POST(post({ message: text, mode: 'summary' }, { 'x-forwarded-for': '10.0.1.3' }));
    expect(summary.status).toBe(200);
    const tooLong = await POST(post({ message: 'a'.repeat(12_001), mode: 'summary' }, { 'x-forwarded-for': '10.0.1.4' }));
    expect(tooLong.status).toBe(400);
  });

  it('returns 503 without a key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = await POST(post({ message: 'привет' }, { 'x-forwarded-for': '10.0.0.2' }));
    expect(res.status).toBe(503);
  });

  it('rejects foreign origins and allows the mobile app origin', async () => {
    const foreign = await POST(post({ message: 'x' }, { origin: 'https://evil.example', 'x-forwarded-for': '10.0.0.3' }));
    expect(foreign.status).toBe(403);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }))));
    const app = await POST(post({ message: 'x' }, { origin: 'capacitor://localhost', 'x-forwarded-for': '10.0.0.4' }));
    expect(app.status).toBe(200);
    expect(app.headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
  });

  it('answers CORS preflight for the app and refuses it for others', () => {
    const ok = OPTIONS(new Request(url, { method: 'OPTIONS', headers: { origin: 'https://localhost', host: 'skilltree.test' } }));
    expect(ok.status).toBe(204);
    const bad = OPTIONS(new Request(url, { method: 'OPTIONS', headers: { origin: 'https://evil.example', host: 'skilltree.test' } }));
    expect(bad.status).toBe(403);
  });

  it('health reports the Gemini key state', async () => {
    const res = GET(new Request('https://skilltree.test/api/health'));
    expect(await res.json()).toEqual({ ok: true, provider: 'gemini', aiConfigured: true, model: 'gemini-3.8-flash' });
  });
});
