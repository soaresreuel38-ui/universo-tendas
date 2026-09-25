#!/usr/bin/env bash
# Build usado na Vercel: aplica as migrations, grava os dados da empresa,
# cria o primeiro administrador (somente se ainda não houver nenhum) e gera o app.
set -euo pipefail

# A integração Neon da Vercel expõe a conexão direta como DATABASE_URL_UNPOOLED.
export DIRECT_URL="${DIRECT_URL:-${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}}"

npx prisma generate

if [ -n "${DATABASE_URL:-}" ]; then
  npx prisma migrate deploy
  npx tsx prisma/seed.ts
  npx tsx scripts/bootstrap-admin.ts
else
  echo "⚠ DATABASE_URL não configurada: migrations puladas. Conecte um banco PostgreSQL ao projeto e faça novo deploy."
fi

npx next build
