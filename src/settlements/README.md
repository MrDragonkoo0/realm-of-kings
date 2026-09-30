# Settlement domain
`catalog.js` contains the 100-entry building catalog grouped by domain.
`service.js` creates additive SQLite tables, migrates existing kingdoms into a capital city, exposes owner-scoped settlement routes, and applies population milestones.
`public/js/settlements.js` contains settlement list/detail/catalog UI and the six-item home menu override.

Founding a village costs 100 gold. Building costs 35 gold, 25 wood, and 20 stone; upgrades cost 35 gold per current level. Capital creation is automatic and idempotent.
