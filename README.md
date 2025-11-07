# REBORN — Secondhand Marketplace (Frontend + Backend)

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
- **Backend:** *Next.js* (App Router)
- **Database:** *PostgreSQL by Prisma* (Supabase)
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
   /frontend npm install
   /backend npm install
   ```
2. **Environment files**
   ```bash
   cp frontend/.env.example frontend/.env
   cp backend/.env.example  backend/.env
   ```
3. **Database schema**
   ```bash
   npx prisma generate
   npx prisma db push  
   ```
4. **Run dev (two terminals)**
   ```bash
   /frontend : npm run dev   # http://localhost:5173
   /backend : npm run dev    # http://localhost:3000 (API)
   ```

---

## Environment Variables

### Frontend `.env`

```env
# Base URL for the backend (must be HTTPS in production)
PUBLIC_BACKEND_ORIGIN="https://your-backend-domain.example.com"
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

## Build & Deploy

### Frontend → Vercel
- **Framework:** SvelteKit  
- **Env:**  
  - `PUBLIC_BACKEND_ORIGIN = https://<your-backend-domain>`
- **Build:** SvelteKit adapter handles `build/preview`
- **Edit svelte.config.js :** `import adapter from '@sveltejs/adapter-auto';` 

### Backend → Vercel (or Node host)
- **Framework:** Next.js (App Router)  
- **Env:**  
  - `DATABASE_URL`
  - `DIRECT_URL`  
  - `JWT_SECRET`  
  - `FE_ORIGIN = https://<your-frontend-domain>`
  - `CLOUDINARY_CLOUD_NAME="xxx"`
  - `CLOUDINARY_API_KEY="xxx"`
  - `CLOUDINARY_API_SECRET="xxx"`
  - `CLOUDINARY_UPLOAD_PRESET="xxx"`
  - `ALLOWED_EMAIL_DOMAINS=kmitl.ac.th`  
- **Prisma:** run `prisma generate` on build; `nodejs` runtime recommended for DB.

---

## Database & Prisma

- Edit models in `backend/prisma/schema.prisma`.
- Common commands:
  ```bash
  npx prisma generate 
  npx prisma migrate # create & apply a new migration
  npx prisma db push # push schema without creating migrations
  npx prisma studio # open Prisma Studio GUI
  ```

---






