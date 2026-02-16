#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
valhalla_dir="$repo_root/infra/valhalla"
data_dir="$valhalla_dir/data"
active_dir="$valhalla_dir/live"
releases_dir="$valhalla_dir/releases"
legacy_tiles_dir="$valhalla_dir/tiles"
legacy_config_path="$valhalla_dir/valhalla.json"
legacy_admins_path="$valhalla_dir/admins.sqlite"
legacy_timezones_path="$valhalla_dir/timezones.sqlite"
pbf_path="$data_dir/osm.pbf"
logs_dir="$valhalla_dir/logs"
status_path="$valhalla_dir/build-status.json"
cleanup_script="$repo_root/scripts/valhalla-cleanup.sh"
france_url="https://download.geofabrik.de/europe/france-latest.osm.pbf"
valhalla_image="ghcr.io/valhalla/valhalla:latest"

mkdir -p "$data_dir"
mkdir -p "$logs_dir"
mkdir -p "$releases_dir"

artifact_reason="ok"

run_cleanup() {
  if [ ! -f "$cleanup_script" ]; then
    return
  fi

  if ! sh "$cleanup_script"; then
    echo "Valhalla: nettoyage automatique ignore."
  fi
}

write_status() {
  state="$1"
  phase="$2"
  progress="$3"
  message="$4"
  updated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[build:${progress}%] ${phase} - ${message}"
  cat > "$status_path" <<EOF
{"state":"$state","phase":"$phase","progress_pct":$progress,"message":"$message","updated_at":"$updated_at"}
EOF
}

validate_artifacts_dir() {
  base_dir="$1"
  tiles_dir="$base_dir/tiles"
  config_path="$base_dir/valhalla.json"
  admins_path="$base_dir/admins.sqlite"

  artifact_reason="ok"

  if [ ! -d "$tiles_dir" ]; then
    artifact_reason="dossier des tuiles absent"
    return 1
  fi

  if [ ! -s "$config_path" ]; then
    artifact_reason="fichier valhalla.json absent ou vide"
    return 1
  fi

  if [ ! -s "$admins_path" ]; then
    artifact_reason="fichier admins.sqlite absent ou trop petit"
    return 1
  fi

  if ! find "$tiles_dir" -name '*.gph' -type f -print -quit 2>/dev/null | grep -q .; then
    artifact_reason="aucune tuile .gph detectee"
    return 1
  fi

  return 0
}

migrate_legacy_to_live() {
  if validate_artifacts_dir "$active_dir"; then
    return 0
  fi

  if ! validate_artifacts_dir "$valhalla_dir"; then
    return 0
  fi

  echo "Valhalla: migration des artefacts legacy vers le dossier live."
  mkdir -p "$active_dir"

  if [ -e "$legacy_tiles_dir" ]; then
    rm -rf "$active_dir/tiles"
    mv "$legacy_tiles_dir" "$active_dir/tiles"
  fi

  if [ -f "$legacy_config_path" ]; then
    rm -f "$active_dir/valhalla.json"
    mv "$legacy_config_path" "$active_dir/valhalla.json"
  fi

  if [ -f "$legacy_admins_path" ]; then
    rm -f "$active_dir/admins.sqlite"
    mv "$legacy_admins_path" "$active_dir/admins.sqlite"
  fi

  if [ -f "$legacy_timezones_path" ]; then
    rm -f "$active_dir/timezones.sqlite"
    mv "$legacy_timezones_path" "$active_dir/timezones.sqlite"
  fi
}

run_docker_step() {
  phase="$1"
  progress="$2"
  status_message="$3"
  label="$4"
  log_prefix="$5"
  command="$6"

  stdout_log="$logs_dir/${log_prefix}.stdout.log"
  stderr_log="$logs_dir/${log_prefix}.stderr.log"
  rm -f "$stdout_log" "$stderr_log"

  write_status "running" "$phase" "$progress" "$status_message"
  echo "Valhalla: $label (logs: $stdout_log, $stderr_log)."

  docker run --rm \
    -v "$valhalla_dir:/custom_files" \
    "$valhalla_image" \
    /bin/bash -lc "$command" \
    >"$stdout_log" 2>"$stderr_log" &
  pid=$!
  started_at="$(date +%s)"
  next_heartbeat=$((started_at + 30))

  while kill -0 "$pid" 2>/dev/null; do
    now="$(date +%s)"
    if [ "$now" -ge "$next_heartbeat" ]; then
      elapsed_minutes=$(((now - started_at) / 60))
      bytes_out=0
      bytes_err=0
      if [ -f "$stdout_log" ]; then
        bytes_out=$(wc -c < "$stdout_log")
      fi
      if [ -f "$stderr_log" ]; then
        bytes_err=$(wc -c < "$stderr_log")
      fi
      bytes_total=$((bytes_out + bytes_err))
      megabytes=$(awk "BEGIN { printf \"%.2f\", $bytes_total / 1048576 }")
      write_status "running" "$phase" "$progress" "$status_message En cours (${elapsed_minutes} min, logs ${megabytes} Mo)."
      next_heartbeat=$((now + 30))
    fi
    sleep 5
  done

  if ! wait "$pid"; then
    echo "Valhalla: echec de l'etape '$label'."
    if [ -f "$stdout_log" ]; then
      echo "----- $label stdout (40 dernieres lignes) -----"
      tail -n 40 "$stdout_log"
    fi
    if [ -f "$stderr_log" ]; then
      echo "----- $label stderr (40 dernieres lignes) -----"
      tail -n 40 "$stderr_log"
    fi
    exit 1
  fi
}

write_status "running" "initialisation" "0" "Initialisation du build Valhalla."
run_cleanup

trap 'code=$?; if [ $code -ne 0 ]; then write_status "failed" "error" "0" "Echec du build Valhalla."; fi' EXIT

force_rebuild="${VALHALLA_FORCE_REBUILD:-}"
force_rebuild=$(printf '%s' "$force_rebuild" | tr '[:upper:]' '[:lower:]')

migrate_legacy_to_live

already_ready=false
if validate_artifacts_dir "$active_dir" && [ -f "$active_dir/tiles/.valhalla_ready" ] && [ -f "$pbf_path" ]; then
  already_ready=true
fi

if [ "$already_ready" = true ] && [ "$force_rebuild" != "1" ] && [ "$force_rebuild" != "true" ] && [ "$force_rebuild" != "yes" ]; then
  echo "Valhalla: donnees deja pretes, aucun rebuild."
  write_status "completed" "ready" "100" "Donnees Valhalla deja pretes."
  run_cleanup
  exit 0
fi

if [ ! -f "$pbf_path" ]; then
  write_status "running" "download" "10" "Telechargement du fichier OSM France."
  echo "Valhalla: telechargement de france-latest.osm.pbf (plusieurs Go)."
  if command -v curl >/dev/null 2>&1; then
    curl -L "$france_url" -o "$pbf_path"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$pbf_path" "$france_url"
  else
    echo "Valhalla: curl ou wget requis pour telecharger l'OSM."
    exit 1
  fi
else
  echo "Valhalla: OSM France deja present, pas de telechargement."
fi

write_status "running" "preparation" "20" "Preparation des dossiers de build."

if [ "$force_rebuild" = "1" ] || [ "$force_rebuild" = "true" ] || [ "$force_rebuild" = "yes" ]; then
  echo "Valhalla: rebuild force demande."
elif ! validate_artifacts_dir "$active_dir"; then
  echo "Valhalla: rebuild requis ($artifact_reason)."
fi

release_id="$(date -u +%Y%m%dT%H%M%SZ)"
candidate_name="candidate-$release_id"
candidate_dir="$releases_dir/$candidate_name"
candidate_tiles="$candidate_dir/tiles"
candidate_ready="$candidate_tiles/.valhalla_ready"
candidate_container_dir="/custom_files/releases/$candidate_name"

rm -rf "$candidate_dir"
mkdir -p "$candidate_tiles"

echo "Valhalla: generation des tuiles et bases dans candidate (service actif preserve)."

run_docker_step \
  "config" \
  "30" \
  "Generation de la configuration Valhalla." \
  "generation configuration" \
  "10-config" \
  "valhalla_build_config --mjolnir-tile-dir $candidate_container_dir/tiles --mjolnir-admin $candidate_container_dir/admins.sqlite --mjolnir-timezone $candidate_container_dir/timezones.sqlite > $candidate_container_dir/valhalla.json"

run_docker_step \
  "tiles" \
  "45" \
  "Generation des tuiles Valhalla." \
  "generation tuiles" \
  "20-tiles" \
  "valhalla_build_tiles -c $candidate_container_dir/valhalla.json /custom_files/data/osm.pbf"

run_docker_step \
  "admins" \
  "80" \
  "Generation de admins.sqlite." \
  "generation admins" \
  "30-admins" \
  "valhalla_build_admins -c $candidate_container_dir/valhalla.json /custom_files/data/osm.pbf"

run_docker_step \
  "timezones" \
  "90" \
  "Generation de timezones.sqlite." \
  "generation timezones" \
  "40-timezones" \
  "valhalla_build_timezones -c $candidate_container_dir/valhalla.json /custom_files/data/osm.pbf"

if ! validate_artifacts_dir "$candidate_dir"; then
  echo "Valhalla: build termine mais artefacts invalides ($artifact_reason)."
  exit 1
fi

echo "Valhalla: nettoyage des artefacts temporaires."
write_status "running" "cleanup" "95" "Nettoyage des artefacts temporaires."
find "$candidate_tiles" -name '*.tmp' -delete 2>/dev/null || true
touch "$candidate_ready"

write_status "running" "promotion" "97" "Promotion atomique des donnees Valhalla."
previous_dir="$releases_dir/previous-$release_id"

if [ -d "$active_dir" ]; then
  mv "$active_dir" "$previous_dir"
fi

if ! mv "$candidate_dir" "$active_dir"; then
  echo "Valhalla: echec de promotion, tentative de rollback."
  if [ -d "$active_dir" ]; then
    rm -rf "$active_dir"
  fi
  if [ -d "$previous_dir" ]; then
    mv "$previous_dir" "$active_dir"
  fi
  exit 1
fi

# Stabilise les chemins de config apres promotion.
active_config="$active_dir/valhalla.json"
if [ -f "$active_config" ]; then
  sed -i "s#/custom_files/releases/$candidate_name#/custom_files/live#g" "$active_config"
fi

run_cleanup
write_status "completed" "ready" "100" "Build Valhalla termine."

echo "Valhalla: generation terminee."
echo "Release active: $active_dir"
echo "Config: $active_dir/valhalla.json"
echo "Ready: $active_dir/tiles/.valhalla_ready"
