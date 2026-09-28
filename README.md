# ROK v0.2

Realm of Kings Telegram Mini App.

## Що додано
- Telegram ID для кожного гравця.
- PostgreSQL база даних.
- Реєстрація зберігається на сервері.
- Кожен Telegram-гравець має окреме королівство.
- Дані більше не залежать від localStorage.
- Будівництво зберігається на сервері.
- Одночасно будується максимум одна будівля.
- Після повторного входу дані завантажуються з бази.

## Потрібні змінні Railway
- `BOT_TOKEN` — токен бота, зберігати тільки в Railway Variables.
- `DATABASE_URL` — URL PostgreSQL.
- `PORT` — Railway задає його сам, можна не вказувати.

## Запуск
```bash
npm install
npm run db:init
npm start
```

Для Telegram Mini App URL треба використовувати URL сервера Railway, а не GitHub Pages.

Не записуй BOT_TOKEN у код або GitHub.
