// Собирает папку mobile-www для Capacitor из public/.
/* global console */
// Использование: SKILLTREE_API_BASE=https://твой-проект.vercel.app npm run mobile:prepare
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const apiBase = (process.env.SKILLTREE_API_BASE ?? '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[^\s/]+$/.test(apiBase)) {
  console.error('Укажи SKILLTREE_API_BASE — https-адрес задеплоенного сайта, например https://skilltree.vercel.app');
  process.exit(1);
}

const out = 'mobile-www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('public', out, { recursive: true });

// Capacitor открывает index.html; service worker в приложении не нужен (файлы лежат внутри).
renameSync(`${out}/legacy-app.html`, `${out}/index.html`);
rmSync(`${out}/sw.js`, { force: true });
writeFileSync(`${out}/config.js`, `window.SKILLTREE_API_BASE = ${JSON.stringify(apiBase)};\n`);

if (!existsSync(`${out}/index.html`)) process.exit(1);
console.log(`mobile-www готов, API: ${apiBase}`);
