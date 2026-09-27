#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="dev"
REGION="us-east-1"
INCLUDING_STATE=0
while (($#)); do
  case "$1" in
    dev|prod) ENV="$1" ;;
    --region)
      (($# >= 2)) || { echo "Falta el valor de --region" >&2; exit 2; }
      REGION="$2"; shift ;;
    --including-state) INCLUDING_STATE=1 ;;
    -h|--help)
      echo "Uso: $0 [dev|prod] [--region REGION] [--including-state]"
      exit 0 ;;
    *) echo "Argumento no reconocido: $1" >&2; echo "Uso: $0 [dev|prod] [--region REGION] [--including-state]" >&2; exit 2 ;;
  esac
  shift
done

command -v terraform >/dev/null || { echo "Falta terraform" >&2; exit 1; }
[[ -x "$ROOT/agents/.venv/bin/python" ]] || {
  echo "Falta agents/.venv/bin/python. Sigue los requisitos de README.md." >&2
  exit 1
}
ARGS=("$ENV" --region "$REGION" --yes)
((INCLUDING_STATE)) && ARGS+=(--including-state)
exec "$ROOT/agents/.venv/bin/python" "$ROOT/scripts/destroy-all.py" "${ARGS[@]}"
