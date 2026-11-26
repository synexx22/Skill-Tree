# SkillTree на телефонах

Есть два пути. Оба используют один и тот же код.

## 1. PWA (без магазинов, работает уже сейчас)
После деплоя на Vercel открой сайт на телефоне:
- **Android (Chrome):** меню → «Установить приложение».
- **iPhone (Safari):** «Поделиться» → «На экран Домой».

Интерфейс кэшируется service worker'ом и открывается без интернета. Для AI-ответов нужна сеть,
без неё включается локальный помощник.

## 2. Нативное приложение (Capacitor → Google Play / App Store)
API остаётся на Vercel, а приложение содержит интерфейс внутри и ходит на твой сайт за AI.

```bash
npm install @capacitor/core
npm install -D @capacitor/cli @capacitor/android @capacitor/ios @capacitor/assets

# один раз: создать проекты платформ
SKILLTREE_API_BASE=https://твой-проект.vercel.app npm run mobile:prepare
npx cap add android
npx cap add ios            # только на macOS с Xcode

# иконки и сплэш из assets/icon-only.png
npx @capacitor/assets generate --iconBackgroundColor '#0b0813'

# каждый раз после изменений интерфейса
SKILLTREE_API_BASE=https://твой-проект.vercel.app npm run mobile:android   # или mobile:ios
```

Что важно:
- `SKILLTREE_API_BASE` — только `https://`-адрес задеплоенного сайта, без слэша на конце.
- Ключ DeepSeek в приложение **не попадает**, он хранится только в переменных Vercel.
- Сервер уже разрешает запросы с `capacitor://localhost` (iOS) и `https://localhost` (Android).
  Если сменишь `androidScheme` или `appId` — проверь `lib/cors.ts` / `ALLOWED_ORIGINS`.
- Идентификатор `com.skilltree.app` и название меняются в `capacitor.config.json` до `cap add`.
- Для публикации понадобятся аккаунты Google Play ($25 разово) и Apple Developer ($99/год),
  а также политика конфиденциальности (приложение отправляет тексты запросов в DeepSeek).
- Прогресс хранится в `localStorage` приложения; кнопка «Экспорт прогресса» в настройках делает резервную копию.
