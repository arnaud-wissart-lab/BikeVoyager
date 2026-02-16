#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
valhalla_dir="$repo_root/infra/valhalla"
data_dir="$valhalla_dir/data"
pbf_path="$data_dir/osm.pbf"
source_meta_path="$valhalla_dir/source-meta.json"
update_status_path="$valhalla_dir/update-status.json"
update_marker_path="$valhalla_dir/.valhalla_update_available"
france_url="https://download.geofabrik.de/europe/france-latest.osm.pbf"

mkdir -p "$data_dir"

interval_minutes="${VALHALLA_UPDATE_CHECK_INTERVAL_MINUTES:-180}"
case "$interval_minutes" in
  ''|*[!0-9]*) interval_minutes=180 ;;
esac
if [ "$interval_minutes" -lt 5 ]; then
  interval_minutes=5
fi

now_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

next_check_utc() {
  date -u -d "+${interval_minutes} minutes" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || now_utc
}

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

extract_json_value() {
  file="$1"
  key="$2"
  if [ ! -f "$file" ]; then
    return 1
  fi

  line=$(grep -m1 "\"$key\"" "$file" 2>/dev/null || true)
  if [ -z "$line" ]; then
    return 1
  fi

  printf '%s' "$line" | sed -E "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"?([^\",}]*)\"?.*/\\1/"
}

remote_available=false
remote_error=""
remote_etag=""
remote_last_modified=""
remote_content_length=""

if command -v curl >/dev/null 2>&1; then
  headers=$(curl -fsSI "$france_url" 2>/dev/null || true)
  if [ -n "$headers" ]; then
    remote_available=true
    remote_etag=$(printf '%s\n' "$headers" | awk 'BEGIN{IGNORECASE=1}/^etag:/{sub("\r",""); sub(/^etag:[[:space:]]*/,""); print; exit}')
    remote_last_modified=$(printf '%s\n' "$headers" | awk 'BEGIN{IGNORECASE=1}/^last-modified:/{sub("\r",""); sub(/^last-modified:[[:space:]]*/,""); print; exit}')
    remote_content_length=$(printf '%s\n' "$headers" | awk 'BEGIN{IGNORECASE=1}/^content-length:/{sub("\r",""); sub(/^content-length:[[:space:]]*/,""); print; exit}')
  else
    remote_error="curl_head_failed"
  fi
else
  remote_error="curl_absent"
fi

local_etag=$(extract_json_value "$source_meta_path" "etag" || true)
local_last_modified=$(extract_json_value "$source_meta_path" "last_modified" || true)
local_content_length=$(extract_json_value "$source_meta_path" "content_length" || true)

state="up_to_date"
reason="ok"
message="Donnees OSM a jour."
update_available=false

if [ "$remote_available" != "true" ]; then
  if [ -f "$update_marker_path" ]; then
    update_available=true
  fi
  state="remote_unreachable"
  reason="remote_unreachable"
  message="Source OSM injoignable pendant la verification."
elif [ ! -f "$pbf_path" ]; then
  state="update_available"
  reason="pbf_absent"
  message="Fichier osm.pbf absent, telechargement requis."
  update_available=true
else
  local_file_size=$(wc -c < "$pbf_path" | tr -d ' ')
  if [ -n "$remote_content_length" ] && [ "$remote_content_length" != "$local_file_size" ]; then
    state="update_available"
    reason="taille_locale_differe"
    message="Le fichier OSM local ne correspond plus a la source distante."
    update_available=true
  elif [ -n "$remote_etag" ] && [ -n "$local_etag" ] && [ "$remote_etag" != "$local_etag" ]; then
    state="update_available"
    reason="etag_modifie"
    message="La source OSM a change (ETag)."
    update_available=true
  elif [ -n "$remote_content_length" ] && [ -n "$local_content_length" ] && [ "$remote_content_length" != "$local_content_length" ]; then
    state="update_available"
    reason="content_length_modifie"
    message="La source OSM a change (taille)."
    update_available=true
  elif [ -n "$remote_last_modified" ] && [ -n "$local_last_modified" ] && [ "$remote_last_modified" != "$local_last_modified" ]; then
    state="update_available"
    reason="last_modified_modifie"
    message="La source OSM est plus recente."
    update_available=true
  fi
fi

if [ "$update_available" = true ]; then
  echo "$(now_utc)" > "$update_marker_path"
  echo "Valhalla update: disponible ($reason)."
elif [ -f "$update_marker_path" ]; then
  rm -f "$update_marker_path"
  echo "Valhalla update: aucune mise a jour en attente."
fi

checked_at=$(now_utc)
next_check_at=$(next_check_utc)

cat > "$update_status_path" <<EOF
{"state":"$(escape_json "$state")","update_available":$update_available,"reason":"$(escape_json "$reason")","message":"$(escape_json "$message")","checked_at":"$checked_at","next_check_at":"$next_check_at","remote":{"etag":"$(escape_json "$remote_etag")","last_modified":"$(escape_json "$remote_last_modified")","content_length":${remote_content_length:-null},"checked_at":"$checked_at","available":$remote_available,"error":"$(escape_json "$remote_error")"}}
EOF
