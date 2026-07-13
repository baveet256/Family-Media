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

## Troubleshooting

### Both terminals stuck / nothing happens

**Root cause:** You're on **Node 23** (`node -v`). React Native and NestJS watch mode hang on Node 23. Your `nvm` command is a Python package, not Node Version Manager.

**Fix — install Node 22 with fnm:**

```bash
brew install fnm
echo 'eval "$(fnm env)"' >> ~/.zshrc
source ~/.zshrc
fnm install 22
fnm use 22
node -v   # must show v22.x
```

**Then nuclear reset:**

```bash
cd Family-Media
npm run kill:dev          # kill stuck processes

# Terminal 1 — API (fast, no watch mode)
npm run api:fast

# Terminal 2 — Web browser
cd mobile && npm run web:clear
```

`api:fast` runs the pre-built API instantly (no `nest watch` compile hang).

### Expo Go says "incompatible" or app keeps loading

1. **Update Expo Go** on your phone from the App Store / Play Store (SDK 57 needs the latest version).
2. **Kill old dev servers** — only one Expo process at a time:
   ```bash
   lsof -ti :8081 | xargs kill -9
   ```
3. **Restart with clean cache:**
   ```bash
   cd mobile && npm run start:clear
   ```
4. **First bundle is slow** — can take 2–5 minutes on first load. Wait until the terminal shows `Bundled` before refreshing.
5. **Use Node 22** (not Node 23):
   ```bash
   nvm install 22 && nvm use 22
   ```

### Phone can't reach API

`localhost` on your phone refers to the phone itself, not your Mac. Use your Mac's LAN IP in `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.0.78:3000
```

### Browser preview (recommended — Expo web is broken on this machine)

Expo `npm run web` hangs on SDK 57. Use the **Vite web app** instead:

```bash
# Terminal 1 — API (keep running)
npm run api:fast

# Terminal 2 — Browser app
npm run web:install   # first time only
npm run web:dev
```

Open **http://localhost:5173** — should show OK with database + redis up.

### Expo / mobile (phone — optional for now)

## Roadmap

See [`family_app_schema_design_a780f16f.plan.md`](family_app_schema_design_a780f16f.plan.md) for the full phased roadmap.

**Next:** Phase 1 — phone auth, family creation, invites.
