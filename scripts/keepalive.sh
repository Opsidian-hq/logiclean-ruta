#!/bin/bash
# ============================================================
# Logiclean Ruta — Script keepalive para Supabase (plan gratuito)
#
# Supabase pausa proyectos inactivos por >7 días en el plan free.
# Este script hace un ping HTTP mínimo para mantener el proyecto activo.
#
# Uso:
#   SUPABASE_URL=https://xxx.supabase.co \
#   SUPABASE_ANON_KEY=eyJ... \
#   ./scripts/keepalive.sh
#
# Programar en cron o GitHub Actions (ver .github/workflows/keepalive.yml)
# ============================================================

set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: SUPABASE_URL y SUPABASE_ANON_KEY son requeridas."
  exit 1
fi

echo "Pinging Supabase: ${SUPABASE_URL}"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/producto_base?select=id&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "206" ]; then
  echo "Keepalive OK (HTTP $HTTP_STATUS)"
elif [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ]; then
  # Respuesta de auth esperada si tabla tiene RLS — proyecto está activo
  echo "Keepalive OK — proyecto activo (HTTP $HTTP_STATUS)"
else
  echo "ADVERTENCIA: respuesta inesperada HTTP $HTTP_STATUS"
  # No falla el script — puede ser que el proyecto esté iniciando
fi
