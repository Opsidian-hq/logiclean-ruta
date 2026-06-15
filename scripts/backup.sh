#!/bin/bash
# ============================================================
# Logiclean Ruta — Script de respaldo de base de datos
#
# Uso:
#   SUPABASE_DB_URL=postgres://... ./scripts/backup.sh
#
# La URL de conexión está en:
#   Supabase Dashboard → Settings → Database → Connection string (URI)
#
# IMPORTANTE: nunca commitees la URL real. Usar .env.local o
# secretos de GitHub Actions.
# ============================================================

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: La variable SUPABASE_DB_URL no está definida."
  echo "Uso: SUPABASE_DB_URL=postgres://... ./scripts/backup.sh"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_logiclean_${TIMESTAMP}.sql"

echo "Iniciando backup: ${BACKUP_FILE}"

pg_dump "$SUPABASE_DB_URL" \
  -f "$BACKUP_FILE" \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=auth \
  --if-exists \
  --clean

if [ $? -eq 0 ]; then
  echo "Backup creado exitosamente: $BACKUP_FILE"
  echo "Tamaño: $(du -sh "$BACKUP_FILE" | cut -f1)"
else
  echo "ERROR: Falló el backup."
  exit 1
fi
