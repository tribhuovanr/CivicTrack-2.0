# CivicTrack
Run: `npm install && npm run dev`

## Demo logins (login page has autofill)
Citizen: citizen@demo.com / demo123
Local/Station Officer: local.north@civictrack.gov or local.south@civictrack.gov / officer123 (office by ward: 1-10 North, 11+ South)
Department Officer: officer.roads|waste|water|drainage|lighting|other@civictrack.gov / officer123
Deputy Commissioner: dc@civictrack.gov / dc123
Worker links need no login: e.g. `/task/demo-task-garbage-0001`.

## SIMULATED in the frontend (LocalStorage, src/store.js)
Auth, role/department access checks, worker link tokens (stored in plain text), notifications, photo storage (base64), WhatsApp sending (opens a wa.me link).

## Backend still required
Real auth (hashed passwords, sessions/JWT); server-side authorization on every endpoint (the checks in `canAccess` and `guard`); worker links as high-entropy tokens stored hashed, expiring, revocable, scoped to one task, rate-limited, returning only task fields; file storage with validation; message delivery API (e.g. WhatsApp Business); notification delivery; audit log; AI recommendation service filling `aiDept` / `aiConfidence` (fields exist, unused). Officer provisioning is simulated in the DC "Manage Officers" section (temporary password shown once); production needs invite emails, password setup, 2FA and server-side admin APIs.
