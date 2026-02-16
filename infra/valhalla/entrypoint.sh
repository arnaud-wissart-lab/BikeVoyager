#!/bin/sh
set -eu

LIVE_DIR="/custom_files/live"
LEGACY_DIR="/custom_files"

if [ -f "$LIVE_DIR/valhalla.json" ]; then
  DATA_DIR="$LIVE_DIR"
else
  DATA_DIR="$LEGACY_DIR"
fi

CONFIG="$DATA_DIR/valhalla.json"
READY="$DATA_DIR/tiles/.valhalla_ready"
RUNTIME_CONFIG="/tmp/valhalla.runtime.json"

if [ ! -f "$CONFIG" ]; then
  echo "Valhalla: configuration absente."
  exit 1
fi

if [ ! -f "$READY" ]; then
  echo "Valhalla: donnees absentes."
  exit 1
fi

cp "$CONFIG" "$RUNTIME_CONFIG"

# Normalise la config pour eviter les chemins candidats persistants
# apres promotion blue/green (ex: /custom_files/releases/candidate-...).
sed -i \
  -e "s#\"tile_dir\"[[:space:]]*:[[:space:]]*\"[^\"]*\"#\"tile_dir\": \"$DATA_DIR/tiles\"#" \
  -e "s#\"admin\"[[:space:]]*:[[:space:]]*\"[^\"]*\"#\"admin\": \"$DATA_DIR/admins.sqlite\"#" \
  -e "s#\"timezone\"[[:space:]]*:[[:space:]]*\"[^\"]*\"#\"timezone\": \"$DATA_DIR/timezones.sqlite\"#" \
  "$RUNTIME_CONFIG"

echo "Valhalla: demarrage du service (data: $DATA_DIR, config: $RUNTIME_CONFIG)."
exec valhalla_service "$RUNTIME_CONFIG" 1
