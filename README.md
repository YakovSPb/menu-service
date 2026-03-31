# menu-service

Общий API меню для `diabalance` и `health-diary` при `SHARED_MENU_SOURCE=service`.

## Переменные окружения

- `DATABASE_URL` — PostgreSQL (Neon и т.п.)
- `SHARED_MENU_SERVICE_TOKEN` — секрет `X-Service-Token` (тот же, что в клиентских приложениях)

## Запросы

Все маршруты `/api/menu` требуют заголовков:

- `X-Service-Token` — токен из `SHARED_MENU_SERVICE_TOKEN`
- `X-User-Email` — email пользователя (нижний регистр)

## Миграции

```bash
npx prisma migrate deploy
```

Локально при первом развертывании:

```bash
npx prisma db push
```

## Разработка

```bash
npm install
npm run dev
```
