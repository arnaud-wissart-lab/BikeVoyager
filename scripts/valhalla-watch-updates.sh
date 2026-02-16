#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
check_script="$repo_root/scripts/valhalla-check-update.sh"
build_script="$repo_root/scripts/valhalla-build-france.sh"
cleanup_script="$repo_root/scripts/valhalla-cleanup.sh"
valhalla_dir="$repo_root/infra/valhalla"
update_status_path="$valhalla_dir/update-status.json"
build_lock_path="$valhalla_dir/.build.lock"

if [ ! -f "$check_script" ]; then
  echo "Valhalla watch: script valhalla-check-update.sh introuvable."
  exit 1
fi

interval_minutes="${VALHALLA_UPDATE_CHECK_INTERVAL_MINUTES:-180}"
case "$interval_minutes" in
  ''|*[!0-9]*) interval_minutes=180 ;;
esac
if [ "$interval_minutes" -lt 5 ]; then
  interval_minutes=5
fi

auto_build="${VALHALLA_UPDATE_AUTO_BUILD:-}"
auto_build=$(printf '%s' "$auto_build" | tr '[:upper:]' '[:lower:]')

echo "Valhalla watch: verification toutes les $interval_minutes minutes."
if [ "$auto_build" = "1" ] || [ "$auto_build" = "true" ] || [ "$auto_build" = "yes" ]; then
  echo "Valhalla watch: auto-build active si update detectee."
fi

while true; do
  if [ -f "$cleanup_script" ]; then
    sh "$cleanup_script" || echo "Valhalla watch: nettoyage ignore."
  fi

  if ! sh "$check_script"; then
    echo "Valhalla watch: erreur de verification."
  fi

  if [ "$auto_build" = "1" ] || [ "$auto_build" = "true" ] || [ "$auto_build" = "yes" ]; then
    if [ ! -f "$build_lock_path" ] && [ -f "$update_status_path" ]; then
      if grep -q '"update_available":[[:space:]]*true' "$update_status_path"; then
        echo "Valhalla watch: update detectee, lancement du build."
        sh "$build_script" || echo "Valhalla watch: echec du build automatique."
      fi
    fi
  fi

  sleep $((interval_minutes * 60))
done
