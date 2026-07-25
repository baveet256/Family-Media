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

## Phase 1 exit criteria

- [x] Phone OTP auth (`POST /auth/otp/send`, `POST /auth/otp/verify`) — OTP stored in Redis; `OTP_DEV_MODE` returns `devOtp`
- [x] Profile `GET/PATCH /users/me`
- [x] Create family + invite code / QR (`POST /families`, invite screen)
- [x] Admin invite by phone stub (`POST /families/:id/invites`)
- [x] Join via code → pending `join_requests` visible to admin (`POST /join-requests`, `GET /families/:id/join-requests`)

## Phase 2 exit criteria

- [x] Founding admin becomes root `person` on family create
- [x] Placement onboarding (`POST /join-requests/:id/onboarding`) — parent required; spouse/siblings optional; placeholders supported
- [x] Admin approve/reject (`POST /join-requests/:id/approve|reject`) commits tree edges
- [x] `GET /families/:id/tree` + `GET /persons/:id` lineage summary
- [x] Mobile Tree tab + join-request approve UI

## Phase 3 exit criteria

- [x] Create post with caption + media (`POST /posts`)
- [x] Family feed reverse-chronological (`GET /families/:id/feed`) with cursor pagination
- [x] Reactions + comments (`POST /posts/:id/reactions`, `POST /posts/:id/comments`)
- [x] Local media upload pipeline (`POST /media/presign`, `POST /media/upload`) — swap for S3/R2 later
- [x] Mobile Home feed, compose, and post detail

## Phase 4 exit criteria

- [x] Create story (`POST /stories`) — image/video, expires in 24h
- [x] Family story rings (`GET /families/:id/stories`) with unseen highlight
- [x] Mark viewed + author viewers list (`POST /stories/:id/view`, `GET /stories/:id/viewers`)
- [x] Mobile story ring, composer, fullscreen viewer

## Phase 5 exit criteria

- [x] 1:1 DM + named group chats (`POST /chats`, `GET /chats?familyId=`)
- [x] Family-wide "Family" group auto-created; members synced on list
- [x] Text + image messages (`GET/POST /chats/:id/messages`) via media upload pipeline
- [x] Chat list with last message preview + unread counts
- [x] Near-real-time via polling (`?after=` cursor) — WebSocket deferred
- [x] Mobile Chat inbox, thread, new DM/group picker

## Phase 6 exit criteria

- [x] Admin invite by family invite code (`POST /connection-invites`) + accept/decline
- [x] Connection with memberships; Nth family can join existing connection
- [x] Bridge links (`POST /connections/:id/bridge-links`) + side-by-side tree (`GET /connections/:id/tree`)
- [x] Feed policies: unified vs separate (`GET /connections/:id/feed`)
- [x] Posts can share to connection (`visibility=connection` + `connectionId`)
- [x] Context switcher (`PATCH /users/me/context`) — family + optional connection lens
- [x] Multi-connection (A↔B and A↔C) + multi-family create allowed
- [x] Mobile: connections screens, context chip, connection feed/tree, share toggle

## Phase 7 exit criteria

- [x] In-app notifications + Expo device token registration (`GET /notifications`, `POST /users/me/devices`)
- [x] Push fan-out on chat message, join request, connection invite, relationship requests
- [x] Offline read cache for feed + tree (AsyncStorage)
- [x] Relationship correction flow (`/relationship-change-requests`) with audit trail
- [x] Selective post share toggle (`PATCH /posts/:id/share`)
- [x] Account export (`GET /users/me/export`) + soft-delete PII scrub (`DELETE /users/me`)
- [x] Admin audit log (`GET /families/:id/audit`)

## Roadmap

See [`family_app_schema_design_a780f16f.plan.md`](family_app_schema_design_a780f16f.plan.md) for the full phased roadmap.

**Next:** Production hardening (EAS push credentials, cloud media, App Store polish).
