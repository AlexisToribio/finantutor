#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for command in node pnpm uv curl setsid; do
  command -v "$command" >/dev/null || { echo "Falta el comando requerido: $command" >&2; exit 1; }
done
node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( node_major >= 24 )) || { echo "Finantutor requiere Node 24 o superior." >&2; exit 1; }
for path in agents/.venv/bin/python ingest/.venv/bin/python backend/node_modules/.bin/tsx frontend/node_modules/.bin/vite; do
  [[ -x "$path" ]] || { echo "Falta $path. Sigue el apartado Arranque local de README.md." >&2; exit 1; }
done

mkdir -p .local/logs .local/run
for pair in "agents/.env:agents/.env.example" "backend/.env:backend/.env.example" "frontend/.env:frontend/.env.example"; do
  target="${pair%%:*}"; sample="${pair##*:}"
  [[ -e "$target" ]] || cp "$sample" "$target"
done

names=(runtime backend frontend)
for name in "${names[@]}"; do
  pid_file=".local/run/$name.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Finantutor ya tiene un proceso supervisado ($name, PID $pid). Ejecuta scripts/down.sh antes de iniciarlo de nuevo." >&2
      exit 1
    fi
    rm -f "$pid_file"
  fi
done

launched=()
stop_launched() {
  for (( index=${#launched[@]}-1; index>=0; index-- )); do
    name="${launched[index]}"; pid_file=".local/run/$name.pid"
    [[ -f "$pid_file" ]] && kill "$(cat "$pid_file")" 2>/dev/null || true
  done
}
trap stop_launched ERR INT TERM

start_service() {
  name="$1"; directory="$2"; shift 2
  nohup setsid bash -c 'cd "$1"; shift; exec "$@"' _ "$ROOT/$directory" "$@" \
    >>"$ROOT/.local/logs/$name.log" 2>&1 </dev/null &
  printf '%s\n' "$!" >"$ROOT/.local/run/$name.pid"
  launched+=("$name")
}

wait_for() {
  name="$1"; url="$2"; marker="$3"
  for _ in {1..60}; do
    pid="$(cat ".local/run/$name.pid")"
    kill -0 "$pid" 2>/dev/null || { echo "$name terminó al iniciar. Revisa .local/logs/$name.log" >&2; return 1; }
    command_line="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    if [[ "$command_line" == *"$marker"* ]] && curl --silent --fail --max-time 2 "$url" >/dev/null 2>&1; then
      echo "Listo: $name ($url)"
      return 0
    fi
    sleep 1
  done
  echo "Tiempo de espera agotado al iniciar $name. Revisa .local/logs/$name.log" >&2
  return 1
}

start_service runtime agents .venv/bin/python main.py
wait_for runtime http://127.0.0.1:8080/ping "main.py"
start_service backend backend pnpm exec tsx watch src/main.ts
wait_for backend http://127.0.0.1:8000/api/v1/health "src/main.ts"
start_service frontend frontend pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort
wait_for frontend http://127.0.0.1:5173/ "vite"
trap - ERR INT TERM
echo "Finantutor está listo: http://localhost:5173"
echo "Logs en .local/logs/. Detén los servicios con scripts/down.sh; tus datos locales se conservan."
