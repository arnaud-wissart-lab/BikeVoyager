#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[deploy-home] %s\n' "$1"
}

require_env() {
  local var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    printf '[deploy-home] Variable requise absente: %s\n' "$var_name" >&2
    exit 1
  fi
}

DEBUG_ENABLED=0
debug() {
  if [ "$DEBUG_ENABLED" -eq 1 ]; then
    printf '[deploy-home][debug] %s\n' "$1"
  fi
}

# Variables d'environnement avec valeurs par défaut pour un lancement workflow_dispatch.
: "${SSH_PORT:=22}"
: "${DEPLOY_REF:=main}"
: "${DEPLOY_ENVIRONMENT:=home}"
: "${DEPLOY_DEBUG:=0}"
: "${GITHUB_TOKEN:=}"

require_env "SSH_HOST"
require_env "SSH_USER"
require_env "SSH_PRIVATE_KEY"
require_env "GITHUB_REPOSITORY"
require_env "SSH_PORT"
require_env "DEPLOY_REF"
require_env "DEPLOY_ENVIRONMENT"
require_env "DEPLOY_DEBUG"
require_env "GITHUB_TOKEN"

case "$DEPLOY_DEBUG" in
  1 | true)
    DEBUG_ENABLED=1
    ;;
  0 | false)
    DEBUG_ENABLED=0
    ;;
  *)
    log "Valeur DEPLOY_DEBUG invalide: '${DEPLOY_DEBUG}' (attendu: 0, 1, true, false)."
    exit 1
    ;;
esac

REPO_SLUG="${GITHUB_REPOSITORY}"
REPO_TOKEN="${GITHUB_TOKEN}"

if [ "$DEPLOY_ENVIRONMENT" != "home" ]; then
  log "Environnement '${DEPLOY_ENVIRONMENT}' non reconnu pour ce script (attendu: home)."
  exit 1
fi

log "Déploiement de ${REPO_SLUG}@${DEPLOY_REF} vers ${SSH_USER}@${SSH_HOST}:${SSH_PORT}."
debug "Mode debug activé."
debug "Contexte: environnement=${DEPLOY_ENVIRONMENT}, ref=${DEPLOY_REF}, hôte=${SSH_HOST}, port=${SSH_PORT}."

ssh_key_file="$(mktemp)"
cleanup() {
  rm -f "$ssh_key_file"
}
trap cleanup EXIT

umask 077
printf '%s\n' "$SSH_PRIVATE_KEY" >"$ssh_key_file"
chmod 600 "$ssh_key_file"

ssh_opts=(
  -i "$ssh_key_file"
  -p "$SSH_PORT"
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
)
debug "Options SSH actives: BatchMode=yes, StrictHostKeyChecking=accept-new, ConnectTimeout=10."

ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" \
  bash -se -- "$DEPLOY_REF" "$REPO_SLUG" "$REPO_TOKEN" "$DEBUG_ENABLED" <<'REMOTE_SCRIPT'
set -euo pipefail

log() {
  printf '[remote] %s\n' "$1"
}

DEPLOY_DEBUG_MODE="${4:-0}"
debug() {
  if [ "$DEPLOY_DEBUG_MODE" -eq 1 ]; then
    printf '[remote][debug] %s\n' "$1"
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Commande requise introuvable sur la machine cible: ${cmd}"
    exit 1
  fi
}

DEPLOY_REF="$1"
REPO_SLUG="$2"
REPO_TOKEN="${3:-}"
REPO_URL="https://github.com/${REPO_SLUG}.git"

# Paramètres centralisés du déploiement home.
APP_DIR="/home/arnaud/apps/bikevoyager"
COMPOSE_FILE="deploy/home.compose.yml"
FRONT_URL_HEALTHCHECK="http://127.0.0.1:5081"
CONTAINER_NAMES=("bikevoyager-front" "bikevoyager-api")

APP_PARENT_DIR="$(dirname "$APP_DIR")"
COMPOSE_FILE_PATH="${APP_DIR}/${COMPOSE_FILE}"
COMPOSE_PROJECT="bikevoyager-home"

git_with_auth() {
  if [ -n "$REPO_TOKEN" ]; then
    local auth_header
    auth_header="$(printf 'x-access-token:%s' "$REPO_TOKEN" | base64 | tr -d '\n')"
    git -c "http.extraheader=AUTHORIZATION: basic ${auth_header}" "$@"
    return
  fi

  git "$@"
}

require_cmd git
require_cmd docker
require_cmd curl

compose_cmd=()
if docker compose version >/dev/null 2>&1; then
  compose_cmd=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd=(docker-compose)
else
  log "docker compose est introuvable (ni plugin Docker, ni binaire docker-compose)."
  exit 1
fi

log "Préparation du dossier ${APP_DIR}"
debug "Config remote: compose=${COMPOSE_FILE}, healthcheck=${FRONT_URL_HEALTHCHECK}, conteneurs=${CONTAINER_NAMES[*]}."
mkdir -p "$APP_PARENT_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  log "Repository absent, clonage initial."
  if ! git_with_auth clone "$REPO_URL" "$APP_DIR"; then
    log "Clonage impossible. Si le repo est privé, vérifier que GITHUB_TOKEN est transmis."
    exit 1
  fi
fi

cd "$APP_DIR"
git remote set-url origin "$REPO_URL"

log "Mise à jour Git et résolution de la référence ${DEPLOY_REF}"
git_with_auth fetch --prune --tags origin

# Même stratégie que Tetrigular: SHA -> tag -> branche.
if [[ "$DEPLOY_REF" =~ ^[0-9a-f]{7,40}$ ]]; then
  log "Référence détectée comme SHA, checkout détaché."
  git checkout --detach "$DEPLOY_REF"
elif git rev-parse -q --verify "refs/tags/${DEPLOY_REF}" >/dev/null; then
  log "Référence détectée comme tag, checkout détaché."
  git checkout --detach "refs/tags/${DEPLOY_REF}"
else
  log "Référence détectée comme branche, alignement sur origin/${DEPLOY_REF}."
  git checkout -B "$DEPLOY_REF" "origin/${DEPLOY_REF}"
  git reset --hard "origin/${DEPLOY_REF}"
fi

deployed_commit="$(git rev-parse --short HEAD)"
deployed_date_utc="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
deployed_host="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo "unknown-host")"
log "Commit déployé: ${deployed_commit}"
log "Contexte déploiement: host=${deployed_host}, date_utc=${deployed_date_utc}, ref=${DEPLOY_REF}"
debug "Commit complet: $(git rev-parse HEAD)"

if [ ! -f "$COMPOSE_FILE_PATH" ]; then
  log "Fichier compose introuvable: ${COMPOSE_FILE_PATH}"
  exit 1
fi

log "Build et démarrage de la stack home via docker compose"
"${compose_cmd[@]}" -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE_PATH" up -d --build --remove-orphans

log "Vérification HTTP locale sur ${FRONT_URL_HEALTHCHECK} (attente max 60s)"
max_attempts=30
sleep_seconds=2
http_status=""

for ((attempt=1; attempt<=max_attempts; attempt+=1)); do
  http_status="$(curl -sS -o /dev/null -I -w '%{http_code}' --connect-timeout 2 --max-time 5 "$FRONT_URL_HEALTHCHECK" || true)"

  if [ "$http_status" = "200" ]; then
    log "Healthcheck OK (tentative ${attempt}/${max_attempts})"
    break
  fi

  log "Service pas encore prêt (tentative ${attempt}/${max_attempts}, code: ${http_status:-n/a})"
  sleep "$sleep_seconds"
done

if [ "$http_status" != "200" ]; then
  log "La vérification HTTP a échoué après ${max_attempts} tentatives (dernier code: ${http_status:-n/a})"
  log "Etat des conteneurs suivis:"
  for container_name in "${CONTAINER_NAMES[@]}"; do
    docker ps -a --filter "name=^/${container_name}$" || true
  done
  log "Etat compose:"
  "${compose_cmd[@]}" -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE_PATH" ps || true
  for container_name in "${CONTAINER_NAMES[@]}"; do
    log "Derniers logs du conteneur ${container_name}:"
    docker logs --tail 120 "$container_name" || true
  done
  exit 1
fi

log "Déploiement terminé avec succès (HTTP ${http_status})"
REMOTE_SCRIPT

log "Script terminé."
