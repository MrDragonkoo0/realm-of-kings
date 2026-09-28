# Realm of Kings — ROK v0.5.1

ROK v0.5.1 is a small balance/fix release for the extraction system.

- Every new kingdom starts with 1 free 🪚 sawmill and 1 free ⛏️ mine.
- Existing players from v0.5 receive a missing sawmill/mine automatically if its count is 0.
- Wood and stone/iron extraction still requires assigning workers.
- Manual resource gathering remains disabled.
- Existing SQLite data and the Railway Volume are preserved.

Keep Railway Volume mounted at `/data`, `DB_PATH=/data/rok.db`, and `BOT_TOKEN` unchanged.
