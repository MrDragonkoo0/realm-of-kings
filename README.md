# ROK v0.2 — SQLite

Realm of Kings Telegram Mini App.

Збереження зроблено через SQLite, як у Farm+.

## Railway
1. Створити сервіс із цього GitHub репозиторію.
2. Додати Railway Volume.
3. Підключити Volume до `/data`.
4. Variables:
   - `BOT_TOKEN` = токен Telegram-бота
   - `DB_PATH` = `/data/rok.db`
5. Deploy.

SQLite-файл `rok.db` буде лежати на Railway Volume і не зникатиме при звичайному redeploy.

## Важливо
Не записуй BOT_TOKEN у GitHub. Зберігай його тільки в Railway Variables.

## Версія
ROK v0.2
