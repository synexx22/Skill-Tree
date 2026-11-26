import type { NextConfig } from 'next';

const day = 60 * 60 * 24;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  // Главная страница — сам интерфейс, без обёртки с iframe (меньше JS, нет вложенного скролла).
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/legacy-app.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // Картинки и иконки меняются редко: неделя в кэше + фоновое обновление.
      {
        source: '/(images|icons)/:path*',
        headers: [{ key: 'Cache-Control', value: `public, max-age=${7 * day}, stale-while-revalidate=${30 * day}` }],
      },
      // Каталог и интерфейс всегда перепроверяются (304), чтобы обновления доходили сразу.
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/(legacy-app.html|config.js|manifest.webmanifest|data/skills.json)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      // Service worker не должен кэшироваться, иначе обновления не доедут до пользователей.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
