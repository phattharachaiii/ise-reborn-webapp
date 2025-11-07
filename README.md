# REBORN — Secondhand Marketplace (Frontend + Backend)

*A full-stack app for student-verified trading. Built with **SvelteKit + Tailwind + Flowbite** on the frontend and **Next.js + Prisma + PostgreSQL** on the backend.*

> **Tip:** This `README.md` uses GitHub-friendly Markdown styling (headings `#..######`, **bold**, *italic*, ~~strikethrough~~, inline ``code``, lists, and task lists).

---

## Table of Contents

1. [Tech Stack](#tech-stack)  
2. [Monorepo Layout](#monorepo-layout)  
3. [Quick Start](#quick-start)  
4. [Environment Variables](#environment-variables)  
   - [Frontend `.env`](#frontend-env)  
   - [Backend `.env`](#backend-env)  
5. [Development](#development)  
6. [Build & Deploy](#build--deploy)  
7. [API Basics](#api-basics)  
8. [CORS & “Fail to fetch” Checklist](#cors--fail-to-fetch-checklist)  
9. [Database & Prisma](#database--prisma)  
10. [Scripts](#scripts)  
11. [Troubleshooting](#troubleshooting)  
12. [License](#license)

---

## Tech Stack

- **Frontend:** *SvelteKit*, Tailwind CSS, Flowbite, `flowbite-svelte-icons`
- **Backend:** *Next.js* (App Router, ``runtime: 'nodejs'``)
- **Database:** *PostgreSQL* (Supabase/Neon/Railway or local)
- **Auth:** *JWT* (Bearer)
- **Hosting:** Vercel (both FE & BE) or any Node host for BE

---

## Monorepo Layout

```
.
├─ frontend/                      # SvelteKit app (Tailwind + Flowbite)
│  ├─ src/
│  │  ├─ lib/
│  │  │  ├─ api/client.ts        # apiJson helper using PUBLIC_BACKEND_ORIGIN
│  │  │  ├─ components/          # UI components (AuthModal, etc.)
│  │  │  └─ stores/              # auth, toast, etc.
│  │  ├─ routes/
│  │  │  ├─ +layout.svelte
│  │  │  ├─ +page.svelte
│  │  │  └─ offers/+page.svelte
│  │  └─ app.css                 # tailwind + theme tokens
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  └─ package.json
│
├─ backend/                       # Next.js API + Prisma
│  ├─ app/api/
│  │  ├─ auth/login/route.ts
│  │  ├─ auth/register/route.ts
│  │  ├─ offers/mine/route.ts
│  │  └─ history/purchases/route.ts
│  ├─ prisma/schema.prisma
│  ├─ src/lib/auth.ts            # JWT helpers
│  ├─ src/lib/prisma.ts          # PrismaClient singleton
│  └─ package.json
│
└─ README.md
```

---

## Quick Start

1. **Install deps**
   ```bash
   pnpm -C frontend install
   pnpm -C backend  install
   ```
2. **Environment files**
   ```bash
   cp frontend/.env.example frontend/.env
   cp backend/.env.example  backend/.env
   ```
3. **Database schema**
   ```bash
   pnpm -C backend prisma:generate
   pnpm -C backend prisma:push      # or: pnpm -C backend prisma:migrate
   ```
4. **Run dev (two terminals)**
   ```bash
   pnpm -C frontend dev   # http://localhost:5173
   pnpm -C backend  dev   # http://localhost:3000 (API)
   ```

---

## Environment Variables

### Frontend `.env`

```env
# Base URL for the backend (must be HTTPS in production)
PUBLIC_BACKEND_ORIGIN="https://your-backend-domain.example.com"
```

*Usage in code* (`frontend/src/lib/api/client.ts`):

```ts
import { PUBLIC_BACKEND_ORIGIN } from '$env/static/public';

const API_BASE = PUBLIC_BACKEND_ORIGIN;

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

### Backend `.env`

```env
# PostgreSQL
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"

# JWT secret for signing tokens
JWT_SECRET="replace-with-strong-random"

# CORS: exact origin of the Frontend
FE_ORIGIN="https://your-frontend-domain.example.com"
```

*CORS helper* (wrap every response, not only `OPTIONS`):

```ts
import { NextResponse } from 'next/server';

const FE_ALLOW = process.env.FE_ORIGIN || 'http://localhost:5173';

export function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', FE_ALLOW);
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Max-Age', '600');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}
```

---

## Development

- **SvelteKit**
  - Avoid `window`/`history` on the server. Wrap with ``if (typeof window !== 'undefined')``.
  - Keep requests `fetch(API_BASE + path)` using `PUBLIC_BACKEND_ORIGIN`.
  - Tailwind + Flowbite: ensure `tailwind.config.js` `content` includes `src/**/*.{svelte,ts}` and Flowbite paths.

- **Next.js + Prisma**
  - Use `runtime = 'nodejs'` for DB access in App Router routes.
  - Singleton Prisma client to avoid too many connections on hot reload.

---

## Build & Deploy

### Frontend → Vercel
- **Framework:** SvelteKit  
- **Env:**  
  - `PUBLIC_BACKEND_ORIGIN = https://<your-backend-domain>`
- **Build:** SvelteKit adapter handles `build/preview`

### Backend → Vercel (or Node host)
- **Framework:** Next.js (App Router)  
- **Env:**  
  - `DATABASE_URL`  
  - `JWT_SECRET`  
  - `FE_ORIGIN = https://<your-frontend-domain>`  
- **Prisma:** run `prisma generate` on build; `nodejs` runtime recommended for DB.

---

## API Basics

**Example:** `GET /api/offers/mine?role=buyer|seller|all&status=...&q=...`  
**Auth:** `Authorization: Bearer <JWT>`  
**Returns:** `{ items: OfferLite[] }`  
**CORS:** responses include `Access-Control-Allow-Origin: <FE_ORIGIN>`

Other sample routes:
- `/api/history/purchases`
- `/api/auth/login` (POST)
- `/api/auth/register` (POST)

---

## CORS & “Fail to fetch” Checklist

- **Frontend**
  - `PUBLIC_BACKEND_ORIGIN` is the **exact** API origin (scheme + host + port).
  - Use `credentials: 'include'` if cookies are involved.

- **Backend**
  - Every **actual** response (GET/POST/PUT/…) is wrapped with `withCORS(...)`.  
  - `FE_ORIGIN` matches FE origin exactly.

- **Browser**
  - In **Network** tab, confirm:
    - Preflight `OPTIONS` → `204` with CORS headers.
    - Actual request → `200` with the **same** CORS headers.
  - Mixed content? Use `https` everywhere in production.

---

## Database & Prisma

- Edit models in `backend/prisma/schema.prisma`.
- Common commands:
  ```bash
  pnpm -C backend prisma:generate
  pnpm -C backend prisma:migrate      # create & apply a new migration
  pnpm -C backend prisma:push         # push schema without creating migrations
  pnpm -C backend prisma:studio       # open Prisma Studio GUI
  ```

---

## Scripts

**Frontend `package.json`**
```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier -w ."
  }
}
```

**Backend `package.json`**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "prisma:generate": "prisma generate",
    "prisma:studio": "prisma studio",
    "prisma:migrate": "prisma migrate dev",
    "prisma:push": "prisma db push",
    "seed": "tsx prisma/seed.ts"
  }
}
```

---

## Troubleshooting

- **CORS 204 OK but GET blocked**
  - Ensure the **GET** handler also returns via `withCORS()`.
  - Re-check `FE_ORIGIN` vs real FE origin (including `https`).

- **`history is not defined`**
  - You’re touching browser APIs during SSR. Guard with ``if (typeof window !== 'undefined')``.

- **Prisma `P1001`** (*database unreachable*)
  - Verify `DATABASE_URL`, network allowlist (managed DB), and that the DB is up.

- **JWT invalid/expired**
  - Check server time skew and ensure `JWT_SECRET` is consistent across environments.

---

