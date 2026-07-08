# Family Media

Private family social network — mobile-first app for sharing photos, chatting, and exploring your family tree.

## Project structure

```
Family-Media/
├── api/          # NestJS backend (PostgreSQL + Redis)
├── mobile/       # Expo React Native app (iOS + Android)
├── docs/         # Design docs
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+ (LTS recommended)
- Docker Desktop
- iOS Simulator (Mac) or Android Emulator for mobile dev

## Quick start

### 1. Start databases

```bash
docker compose up -d
```

This starts PostgreSQL (`localhost:5432`) and Redis (`localhost:6379`).

### 2. Configure environment

```bash
cp .env.example api/.env
cp mobile/.env.example mobile/.env
```

### 3. API setup

```bash
cd api
npm install
npm run prisma:migrate:deploy
npm run start:dev
```

API runs at **http://localhost:3000**

- `GET /` — API info
- `GET /health` — health check (database + redis)

### 4. Mobile app

```bash
cd mobile
npm install
npm run start
```

Press `i` for iOS simulator or `a` for Android emulator.

The **Home** tab pings `GET /health` and shows OK when the API and databases are up.

### Android emulator note

The app defaults to `http://10.0.2.2:3000` on Android. For a physical device, set your machine's LAN IP in `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

## Root scripts

From the repo root:

| Command | Description |
|---------|-------------|
| `npm run docker:up` | Start Postgres + Redis |
| `npm run docker:down` | Stop containers |
| `npm run api:dev` | Start API in watch mode |
| `npm run mobile:dev` | Start Expo dev server |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:deploy` | Deploy migrations (prod/CI) |

## Phase 0 exit criteria

- [x] `docker compose up` starts Postgres + Redis
- [x] `GET /health` returns database + redis status
- [x] Mobile Home tab shows API health
- [x] Empty Prisma migration runs cleanly

## Roadmap

See [`family_app_schema_design_a780f16f.plan.md`](family_app_schema_design_a780f16f.plan.md) for the full phased roadmap.

**Next:** Phase 1 — phone auth, family creation, invites.
