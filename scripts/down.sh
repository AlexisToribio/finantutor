#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for name in frontend backend runtime; do
  pid_file=".local/run/$name.pid"
  [[ -f "$pid_file" ]] || continue
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    case "$name" in
      frontend) marker="vite" ;;
      backend) marker="src/main.ts" ;;
      runtime) marker=".venv/bin/python main.py" ;;
    esac
    command_line="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    if [[ "$command_line" != *"$marker"* ]]; then
      echo "El PID $pid ya no parece ser Finantutor ($name); no se detuvo." >&2
      exit 1
    fi
    process_group="$(ps -p "$pid" -o pgid= | tr -d ' ')"
    if [[ "$process_group" != "$pid" ]]; then
      echo "El proceso $name no está aislado en su propio grupo; no se detuvo." >&2
      exit 1
    fi
    kill -TERM -- "-$process_group"
    for _ in {1..10}; do
      kill -0 -- "-$process_group" 2>/dev/null || break
      sleep 1
    done
    if kill -0 -- "-$process_group" 2>/dev/null; then kill -KILL -- "-$process_group"; fi
    echo "Detenido: $name"
  fi
  rm -f "$pid_file"
done

echo "Servicios locales detenidos. Los datos y logs de .local/ se conservaron."
