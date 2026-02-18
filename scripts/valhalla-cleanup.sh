#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
valhalla_dir="$repo_root/infra/valhalla"
releases_dir="$valhalla_dir/releases"
logs_dir="$valhalla_dir/logs"
build_lock_path="$valhalla_dir/.build.lock"
build_status_path="$valhalla_dir/build-status.json"

read_int_setting() {
  raw="$1"
  default_value="$2"
  min_value="$3"

  case "$raw" in
    ''|*[!0-9]*) value="$default_value" ;;
    *) value="$raw" ;;
  esac

  if [ "$value" -lt "$min_value" ]; then
    value="$min_value"
  fi

  echo "$value"
}

if [ ! -d "$valhalla_dir" ]; then
  echo "Valhalla cleanup: dossier infra/valhalla absent, rien a nettoyer."
  exit 0
fi

releases_to_keep=$(read_int_setting "${VALHALLA_RELEASES_TO_KEEP:-}" 0 0)
log_retention_days=$(read_int_setting "${VALHALLA_LOG_RETENTION_DAYS:-}" 7 1)
candidate_stale_hours=$(read_int_setting "${VALHALLA_STALE_CANDIDATE_HOURS:-}" 6 1)
step_script_retention_hours=$(read_int_setting "${VALHALLA_STEP_SCRIPT_RETENTION_HOURS:-}" 24 1)
stale_lock_minutes=$(read_int_setting "${VALHALLA_STALE_LOCK_MINUTES:-}" 30 5)

previous_removed=0
candidates_removed=0
logs_removed=0
step_scripts_removed=0

build_running=false
if [ -f "$build_lock_path" ]; then
  # Si le verrou est obsolète (build interrompu), le libérer pour éviter de bloquer le nettoyage indéfiniment.
  if find "$build_lock_path" -mmin +"$stale_lock_minutes" -print -quit 2>/dev/null | grep -q .; then
    rm -f "$build_lock_path"
    echo "Valhalla cleanup: verrou de build stale supprime."
  else
    build_running=true
    echo "Valhalla cleanup: build en cours, nettoyage des releases differe."
  fi
fi

if [ "$build_running" = false ] && [ -d "$releases_dir" ]; then
  set +e
  previous_dirs=$(ls -1dt "$releases_dir"/previous-* 2>/dev/null)
  set -e
  if [ -n "${previous_dirs:-}" ]; then
    index=0
    for folder in $previous_dirs; do
      if [ "$index" -ge "$releases_to_keep" ]; then
        rm -rf "$folder"
        previous_removed=$((previous_removed + 1))
      fi
      index=$((index + 1))
    done
  fi

  candidate_minutes=$((candidate_stale_hours * 60))
  set +e
  stale_candidates=$(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -name 'candidate-*' -mmin +"$candidate_minutes" -print 2>/dev/null)
  set -e
  if [ -n "${stale_candidates:-}" ]; then
    for folder in $stale_candidates; do
      rm -rf "$folder"
      candidates_removed=$((candidates_removed + 1))
    done
  fi
fi

if [ -d "$logs_dir" ]; then
  log_minutes=$((log_retention_days * 24 * 60))
  set +e
  old_logs=$(find "$logs_dir" -type f -name '*.log' -mmin +"$log_minutes" -print 2>/dev/null)
  set -e
  if [ -n "${old_logs:-}" ]; then
    for file in $old_logs; do
      rm -f "$file"
      logs_removed=$((logs_removed + 1))
    done
  fi
fi

if [ "$build_running" = false ]; then
  step_minutes=$((step_script_retention_hours * 60))
  set +e
  old_step_scripts=$(find "$valhalla_dir" -maxdepth 1 -type f -name '.build-step-*.sh' -mmin +"$step_minutes" -print 2>/dev/null)
  set -e
  if [ -n "${old_step_scripts:-}" ]; then
    for file in $old_step_scripts; do
      rm -f "$file"
      step_scripts_removed=$((step_scripts_removed + 1))
    done
  fi
fi

echo "Valhalla cleanup: previous=$previous_removed, candidates=$candidates_removed, logs=$logs_removed, step_scripts=$step_scripts_removed."
