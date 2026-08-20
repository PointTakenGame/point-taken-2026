# point-taken-2026

The rebuilt Point Taken game: Next on Vercel, Supabase for Postgres + Auth + Realtime, Resend for
mail. Replaces the Nuxt frontend / Express backend / DynamoDB stack in `../point-taken-frontend`
and `../point-taken-backend`.

**This folder is not yet a GitHub repo.** It has local git history only, waiting on Steve's
permission to create `PointTakenGame/point-taken-2026` and push. Adding a remote is the only step
between here and there, which is why the history starts clean rather than living inside the brain
agent's repo.

Supabase project `point-taken-2026`, ref `tvtmltchotkzviqaywdy`, us-east-1. Credentials live in
`../../../point-taken-biz/api-keys/supabase-point-taken-2026.env`, which is gitignored and outside
this tree. Nothing in here holds a secret.

## Layout

```
supabase/migrations/    ordered SQL, applied in filename order
```

## The one thing to read first

`supabase/migrations/0001_event_log.sql` and its prose half,
`../../docs/reference/materials/spec/2026-08-19_event-log-contract.md` (registry row
`BRAIN-T260819-18`). Every projection, badge criterion, analytic, and replay reads that table, so
its shape is the hardest thing here to change later.
