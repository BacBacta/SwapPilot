#!/usr/bin/env bash
# =============================================================================
# deploy-vercel-env.sh — Déploie config/env.vercel.json sur Vercel via REST API
#
# Usage :
#   export VERCEL_TOKEN="your_token"          # vercel.com/account/tokens
#   export VERCEL_PROJECT="your-project-name" # nom du projet Vercel (ou ID)
#   bash scripts/deploy-vercel-env.sh
#
# Optionnel :
#   export VERCEL_TEAM_SLUG="your-team"       # si le projet est dans une team
# =============================================================================
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
TOKEN="${VERCEL_TOKEN:?'VERCEL_TOKEN est requis — vercel.com/account/tokens'}"
PROJECT="${VERCEL_PROJECT:?'VERCEL_PROJECT est requis (nom ou ID du projet Vercel)'}"
TEAM="${VERCEL_TEAM_SLUG:-}"
ENV_FILE="$(dirname "$0")/../config/env.vercel.json"
API="https://api.vercel.com"

# ── Helpers ──────────────────────────────────────────────────────────────────
team_param() {
  if [[ -n "$TEAM" ]]; then
    echo "?teamSlug=${TEAM}"
  else
    echo ""
  fi
}

upsert_env() {
  local key="$1"
  local value="$2"
  local type="$3"   # plain | encrypted | secret
  local targets="$4" # JSON array string, e.g. '["production","preview"]'

  local payload
  payload=$(jq -n \
    --arg key "$key" \
    --arg value "$value" \
    --arg type "$type" \
    --argjson target "$targets" \
    '{key: $key, value: $value, type: $type, target: $target}')

  local url="${API}/v10/projects/${PROJECT}/env$(team_param)"

  local response
  response=$(curl -sf -X POST "$url" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1) && {
    echo "  ✅  ${key} → ${targets}"
  } || {
    # Si la variable existe déjà (409), on la met à jour via PATCH
    local env_id
    env_id=$(curl -sf "${API}/v9/projects/${PROJECT}/env$(team_param)" \
      -H "Authorization: Bearer ${TOKEN}" \
      | jq -r --arg k "$key" '.envs[] | select(.key == $k) | .id' 2>/dev/null | tr '\n' ' ' | tr -s ' ')

    if [[ -z "$env_id" ]]; then
      echo "  ❌  ${key} — impossible de créer ou trouver l'entrée"
      return
    fi

    for id in $env_id; do
      curl -sf -X PATCH "${API}/v9/projects/${PROJECT}/env/${id}$(team_param)" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1 \
        && echo "  🔄  ${key} (id=${id}) mis à jour → ${targets}" \
        || echo "  ❌  ${key} (id=${id}) — échec PATCH"
    done
  }
}

# ── Main ─────────────────────────────────────────────────────────────────────
echo ""
echo "=== SwapPilot — Deploy Vercel env vars ==="
echo "    Projet  : ${PROJECT}"
echo "    Team    : ${TEAM:-<aucune>}"
echo "    Fichier : ${ENV_FILE}"
echo ""

# Vérifie que jq et curl sont disponibles
command -v jq  >/dev/null 2>&1 || { echo "❌  jq requis (brew install jq)"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "❌  curl requis"; exit 1; }

# Vérifie que le projet existe
echo "→ Vérification du projet..."
PROJECT_INFO=$(curl -sf "${API}/v9/projects/${PROJECT}$(team_param)" \
  -H "Authorization: Bearer ${TOKEN}" 2>&1) || {
  echo "❌  Projet '${PROJECT}' introuvable ou token invalide."
  echo "    Vérifiez VERCEL_PROJECT et VERCEL_TOKEN."
  exit 1
}
PROJECT_ID=$(echo "$PROJECT_INFO" | jq -r '.id')
PROJECT_NAME=$(echo "$PROJECT_INFO" | jq -r '.name')
echo "   ✅  ${PROJECT_NAME} (${PROJECT_ID})"
echo ""

# Parse et déploie chaque entrée du JSON
echo "→ Déploiement des variables..."
jq -c '.[] | select(.key != null and .value != null)' "$ENV_FILE" | while IFS= read -r entry; do
  KEY=$(echo "$entry" | jq -r '.key')
  VALUE=$(echo "$entry" | jq -r '.value')
  TYPE=$(echo "$entry" | jq -r '.type // "plain"')
  TARGET=$(echo "$entry" | jq -c '.target // ["production","preview","development"]')

  # Skip les variables vides (à remplir manuellement)
  if [[ -z "$VALUE" ]]; then
    echo "  ⏭️   ${KEY} — valeur vide, ignoré (à définir manuellement)"
    continue
  fi

  upsert_env "$KEY" "$VALUE" "$TYPE" "$TARGET"
done

echo ""
echo "=== Terminé ==="
echo "    Vérifiez sur : https://vercel.com/${TEAM:-}/${PROJECT_NAME}/settings/environment-variables"
echo ""
