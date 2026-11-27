# SkillTree — Next.js

Интерфейс SkillTree лежит в `public/legacy-app.html` и отдаётся прямо на `/` (rewrite в `next.config.ts`, без iframe). AI (Gemini) и health-эндпоинты — Route Handlers в `app/api`. Сайт работает как PWA (манифест + service worker) и упаковывается в приложения для телефонов через Capacitor — см. `MOBILE.md`.

## Структура
```
app/
  layout.tsx, page.tsx, globals.css
  api/ai/route.ts       POST /api/ai  (Gemini)
  api/health/route.ts   GET  /api/health
public/legacy-app.html, config.js, manifest.webmanifest, sw.js, icons/
lib/cors.ts             политика Origin/CORS для сайта и мобильного приложения
scripts/prepare-mobile.mjs, capacitor.config.json   сборка для телефонов
.github/workflows/ci.yml, .github/dependabot.yml
vercel.json, next.config.ts, tsconfig.json, eslint.config.mjs
```

## Локально
1. Node 26 (`.nvmrc`)
2. `npm install` (создаст `package-lock.json` — закоммить его)
3. `cp .env.example .env.local` и впиши `GEMINI_API_KEY`
4. `npm run dev` → http://localhost:3000

## Деплой на Vercel
1. Запушь на GitHub **содержимое** этой папки (`package.json` должен лежать в корне репозитория) вместе с `package-lock.json`.
2. Vercel → Add New → Project → импортируй репозиторий (Framework Preset: **Next.js**, Root Directory: `./`).
3. Settings → Environment Variables добавь: `GEMINI_API_KEY`, `GEMINI_MODEL` (опц., по умолчанию `gemini-3.8-flash`), `GEMINI_THINKING_LEVEL` (опц., `LOW`/`MEDIUM`/`HIGH`), `GEMINI_API_BASE` (опц.), `ALLOWED_ORIGINS` (опц.) для Production/Preview.
4. Deploy. Проверка: `/api/health` → `{"ok":true,"aiConfigured":true}`.

## Ограничения
Rate limit в `/api/ai` хранится в памяти инстанса и на serverless работает приблизительно. Для строгого лимита используй Upstash/Vercel KV или Vercel WAF.

## Заметки по версии
- Модель из `GEMINI_MODEL` (по умолчанию `gemini-3.8-flash`). Для моделей Gemini 3 отправляется `thinkingLevel` (по умолчанию `LOW` ради скорости), `temperature` не передаётся, а лимит токенов утраивается, потому что токены размышлений входят в `maxOutputTokens`. Для моделей 2.x отправляется `temperature` без `thinkingConfig`. Ключ передаётся заголовком `x-goog-api-key`.
- `/api/ai` отклоняет запросы с чужим `Origin` (разрешены свой домен, `capacitor://localhost`, `https://localhost`, `http://localhost` и `ALLOWED_ORIGINS`), ограничивает размер тела (32 КБ) и лимит запросов считает по IP.
- Тесты: `npm test` проверяет целостность `public/data/skills.json` и базовую целостность `legacy-app.html`.
- Версия Node: `26.x` (в `package.json`, `.nvmrc` и CI одна и та же).

- Картинки навыков подбираются по предмету (`THEMES` в `legacy-app.html`): `public/images/t-<тема>.svg`; фото-баннер `history.jpg` — только для истории. Чтобы заменить картинку, положи файл с тем же именем (880×400).
- Школьные предметы изучаются в своих классах (`SCHOOL_GRADES` в `legacy-app.html`): Математика 1–6; Алгебра, Геометрия, Вероятность и статистика, Физика 7–11; Химия 8–11; Обществознание 9–11; География, Биология, История 5–11. От этого зависят темы на ментальной карте, фильтр классов и выбор класса в тестах. Остальные навыки доступны для 1–11 классов. Сохранённый прогресс при первом запуске переносится на новую нумерацию тем (`gradeMapV`).
- AI-саммари: на шаге «Теория и конспект» кнопка «Сделать саммари» сжимает теорию или личные заметки (кратко / обычное / подробное). Запрос идёт в `/api/ai` с `mode: "summary"` (текст до 12 000 символов, до 1400 токенов); результат кэшируется в `save.summaries`. Без AI показывается локальная выжимка по заголовкам.
- Подробная теория и конспект запрашиваются у `/api/ai` (режим `detailed`, до 3500 токенов) и кэшируются в localStorage; без `GEMINI_API_KEY` показывается базовая локальная версия.
