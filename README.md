# ROK v0.3.1

Realm of Kings Telegram Mini App.

## Що виправлено
- прибрано `better-sqlite3`, через який Railway міг падати на Build;
- використовується вбудований `node:sqlite` у Node 22.5+;
- SQLite-файл залишається на Railway Volume через `DB_PATH=/data/rok.db`;
- додані ресурси та їх списання при будівництві;
- одна активна будівля одночасно;
- завершені будівлі зберігаються в SQLite;
- дані старих гравців зберігаються.

## Railway
Залиш:
- `BOT_TOKEN`
- `DB_PATH=/data/rok.db`
- Volume mounted at `/data`

Не видаляй існуючий Volume.
