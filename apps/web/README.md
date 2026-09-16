Запуск

```bash
# установить зависимости в монорепо
npm ci

# запустить API (если ещё не запущен)
npm run dev -w @checkout/api

# запустить фронтенд
npm run dev -w @checkout/web
```

Сборка

```bash
npm run build -w @checkout/web
npm run preview -w @checkout/web
```

Конфигурация

- Базовый URL API можно задать через `VITE_API_BASE_URL` (по умолчанию `http://127.0.0.1:4000`).
- Сессия сохраняет `token` в `localStorage` автоматически.
