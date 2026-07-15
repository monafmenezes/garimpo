#!/bin/sh
# Entrypoint pro Azure Container Apps Job.
#
# Problema: SQLite não funciona direto sobre Azure Files (SMB/CIFS), porque
# depende de file locking (fcntl) que o mount de rede não suporta.
#
# Solução: o banco "mora" no file share pra persistir entre execuções, mas o
# app trabalha numa CÓPIA no disco local (/tmp). Copiamos pra dentro no início
# e de volta no fim — cópia de arquivo é leitura/escrita simples, sem locking.
set -e

# Só faz a dança de cópia quando SYNC_DB_TO_SHARE=true (job efêmero no Azure).
# Em VPS/local, o banco fica num volume de disco normal — roda direto.
if [ "$SYNC_DB_TO_SHARE" != "true" ]; then
  exec npm run start
fi

SHARE_DIR="${SHARE_DIR:-/app/data}"   # onde o Azure File Share é montado
LOCAL_DB="/tmp/garimpo.db"
SHARE_DB="$SHARE_DIR/garimpo.db"

# 1) Restaura o banco do file share (se já existir de execuções anteriores)
if [ -f "$SHARE_DB" ]; then
  cp "$SHARE_DB" "$LOCAL_DB"
  echo "🗃️  banco restaurado do file share ($(wc -c < "$SHARE_DB") bytes)"
else
  echo "🗃️  primeiro run — nenhum banco anterior no file share"
fi

# 2) Roda o app usando o banco LOCAL
export DB_PATH="$LOCAL_DB"
set +e
npm run start
CODE=$?
set -e

# 3) Persiste de volta no file share (sempre — mesmo se falhar no meio, o que
#    já foi notificado fica salvo e não repete na próxima execução)
if [ -f "$LOCAL_DB" ]; then
  mkdir -p "$SHARE_DIR"
  cp "$LOCAL_DB" "$SHARE_DB"
  echo "🗃️  banco salvo no file share ($(wc -c < "$LOCAL_DB") bytes)"
fi

exit $CODE
