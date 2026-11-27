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

describe('/api/ai (DeepSeek)', () => {
  beforeEach(() => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    vi.stubEnv('DEEPSEEK_MODEL', '');
    vi.stubEnv('DEEPSEEK_THINKING', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls DeepSeek with the bearer key and returns the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: ' Привет! ' } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(post({ message: 'Объясни дроби', context: { skill: 'Математика' } }, { 'x-forwarded-for': '10.0.0.1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: 'Привет!' });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://api.deepseek.com/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe('deepseek-v4-flash');
    expect(sent.thinking).toEqual({ type: 'disabled' });
    expect(sent.max_tokens).toBe(900);
  });

  it('summary mode uses a dedicated prompt, a low temperature and accepts long texts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '## Суть\nКоротко.' } }] }), { status: 200 }),
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
    expect(sent.max_tokens).toBe(1400);
    expect(sent.temperature).toBe(0.3);
    expect(sent.messages[0].content).toContain('саммари');
    expect(sent.messages[1].content).toBe(longText.trim());
  });

  it('long messages are rejected in chat mode but not in summary mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))));
    const text = 'a'.repeat(8000);
    const chat = await POST(post({ message: text }, { 'x-forwarded-for': '10.0.1.2' }));
    expect(chat.status).toBe(400);
    const summary = await POST(post({ message: text, mode: 'summary' }, { 'x-forwarded-for': '10.0.1.3' }));
    expect(summary.status).toBe(200);
    const tooLong = await POST(post({ message: 'a'.repeat(12_001), mode: 'summary' }, { 'x-forwarded-for': '10.0.1.4' }));
    expect(tooLong.status).toBe(400);
  });

  it('returns 503 without a key', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    const res = await POST(post({ message: 'привет' }, { 'x-forwarded-for': '10.0.0.2' }));
    expect(res.status).toBe(503);
  });

  it('rejects foreign origins and allows the mobile app origin', async () => {
    const foreign = await POST(post({ message: 'x' }, { origin: 'https://evil.example', 'x-forwarded-for': '10.0.0.3' }));
    expect(foreign.status).toBe(403);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))));
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

  it('health reports the DeepSeek key state', async () => {
    const res = GET(new Request('https://skilltree.test/api/health'));
    expect(await res.json()).toEqual({ok:true,provider: 'deepseek',aiConfigured: true,model: 'deepseek-v4-flash'})
  });
});
