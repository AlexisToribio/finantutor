#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="dev"
REGION="us-east-1"
while (($#)); do
  case "$1" in
    dev|prod) ENV="$1" ;;
    --region)
      (($# >= 2)) || { echo "Falta el valor de --region" >&2; exit 2; }
      REGION="$2"; shift ;;
    -h|--help)
      echo "Uso: $0 [dev|prod] [--region REGION]"
      exit 0 ;;
    *) echo "Argumento no reconocido: $1" >&2; echo "Uso: $0 [dev|prod] [--region REGION]" >&2; exit 2 ;;
  esac
  shift
done

for command in terraform aws docker pnpm; do
  command -v "$command" >/dev/null || { echo "Falta el comando requerido: $command" >&2; exit 1; }
done
[[ -x "$ROOT/agents/.venv/bin/python" ]] || {
  echo "Falta agents/.venv/bin/python. Sigue los requisitos de README.md." >&2
  exit 1
}
exec "$ROOT/agents/.venv/bin/python" "$ROOT/scripts/deploy.py" "$ENV" --region "$REGION" --yes
