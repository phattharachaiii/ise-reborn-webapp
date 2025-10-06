# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 1) ต้องมีทั้ง package*.json และ prisma ก่อน npm ci (เพราะ postinstall เรียก prisma generate)
COPY package*.json ./
COPY prisma ./prisma

# 2) ติดตั้ง deps (postinstall จะรัน prisma generate ได้สำเร็จเพราะมี schema แล้ว)
RUN npm ci

# 3) ค่อย copy โค้ดที่เหลือ แล้ว build
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next

EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy && npm run start"]
