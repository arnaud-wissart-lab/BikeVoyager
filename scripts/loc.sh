#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/loc.sh [patterns...] [--scope backend/frontend/docs] [--threshold N] [--top N] [--out docs/LOC_REPORT.md]

Examples:
  ./scripts/loc.sh --top 30 --threshold 400 --scope backend/frontend/docs --out docs/LOC_REPORT.md
  ./scripts/loc.sh --top 20 --threshold 400 --scope backend/frontend
  ./scripts/loc.sh 'frontend/src/**/*.tsx' --top 10
  ./scripts/loc.sh '*.cs' '*.md' --top 20

Par defaut:
  Si aucun pattern n'est fourni, les patterns par defaut sont: *.cs, *.ts, *.tsx, *.md
EOF
}

if ! command -v wc >/dev/null 2>&1; then
  echo "Erreur: 'wc' est requis pour scripts/loc.sh." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

declare -a patterns=()
declare -a default_patterns=('*.cs' '*.ts' '*.tsx' '*.md')
declare -a scopes=()
top=""
threshold=""
out_path=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --top)
      [[ $# -ge 2 ]] || { echo "Option --top: valeur manquante." >&2; exit 1; }
      top="$2"
      [[ "$top" =~ ^[0-9]+$ ]] && [[ "$top" -ge 1 ]] || { echo "Option --top: entier positif attendu." >&2; exit 1; }
      shift 2
      ;;
    --threshold)
      [[ $# -ge 2 ]] || { echo "Option --threshold: valeur manquante." >&2; exit 1; }
      threshold="$2"
      [[ "$threshold" =~ ^[0-9]+$ ]] || { echo "Option --threshold: entier >= 0 attendu." >&2; exit 1; }
      shift 2
      ;;
    --scope)
      [[ $# -ge 2 ]] || { echo "Option --scope: valeur manquante." >&2; exit 1; }
      IFS=' ,;/' read -r -a parsed_scopes <<< "$2"
      for scope in "${parsed_scopes[@]}"; do
        [[ -n "$scope" ]] && scopes+=("$scope")
      done
      shift 2
      ;;
    --out)
      [[ $# -ge 2 ]] || { echo "Option --out: chemin manquant." >&2; exit 1; }
      out_path="$2"
      shift 2
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        patterns+=("$1")
        shift
      done
      ;;
    *)
      patterns+=("$1")
      shift
      ;;
  esac
done

if [[ ${#patterns[@]} -eq 0 ]]; then
  patterns=("${default_patterns[@]}")
fi

if [[ ${#scopes[@]} -eq 0 ]]; then
  scopes=(backend frontend docs)
fi

for scope in "${scopes[@]}"; do
  case "$scope" in
    backend|frontend|docs) ;;
    *)
      echo "Scope inconnu: '$scope'. Valeurs autorisees: backend, frontend, docs." >&2
      exit 1
      ;;
  esac
done

is_excluded_path() {
  local rel="$1"
  case "$rel" in
    */.git/*|*/node_modules/*|*/bin/*|*/obj/*|*/dist/*|*/coverage/*|*/.next/*|*/.turbo/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

matches_patterns() {
  local rel="$1"
  local base="${rel##*/}"

  if [[ ${#patterns[@]} -eq 0 ]]; then
    return 0
  fi

  for raw_pattern in "${patterns[@]}"; do
    local pattern="${raw_pattern//\\//}"
    if [[ "$rel" == "$pattern" || "$rel" == $pattern || "$base" == $pattern ]]; then
      return 0
    fi
  done

  return 1
}

count_lines_editor_style() {
  local file="$1"
  if [[ ! -s "$file" ]]; then
    echo "0"
    return
  fi

  local lf_count
  lf_count="$(wc -l < "$file")"
  echo $((lf_count + 1))
}

tmp_rows="$(mktemp)"
tmp_work="$(mktemp)"
trap 'rm -f "$tmp_rows" "$tmp_work"' EXIT

for scope in "${scopes[@]}"; do
  scope_dir="$repo_root/$scope"
  [[ -d "$scope_dir" ]] || continue

  while IFS= read -r -d '' file; do
    rel="${file#$repo_root/}"
    rel="${rel//\\//}"

    is_excluded_path "$rel" && continue
    matches_patterns "$rel" || continue

    loc="$(count_lines_editor_style "$file")"
    printf '%s\t%s\n' "$loc" "$rel" >> "$tmp_rows"
  done < <(find "$scope_dir" -type f -print0)
done

if [[ -s "$tmp_rows" ]]; then
  sort -t $'\t' -k1,1nr -k2,2 "$tmp_rows" | awk -F '\t' '!seen[$2]++' > "$tmp_work"
else
  : > "$tmp_work"
fi

if [[ -n "$threshold" ]]; then
  awk -F '\t' -v t="$threshold" '$1 >= t' "$tmp_work" > "${tmp_work}.threshold"
  mv "${tmp_work}.threshold" "$tmp_work"
fi

if [[ -n "$top" ]]; then
  head -n "$top" "$tmp_work" > "${tmp_work}.top"
  mv "${tmp_work}.top" "$tmp_work"
fi

table='| Fichier | LOC |
|---|---:|'

while IFS=$'\t' read -r loc rel; do
  [[ -n "${loc:-}" && -n "${rel:-}" ]] || continue
  table+=$'\n'"| \`$rel\` | $loc |"
done < "$tmp_work"

if [[ -n "$out_path" ]]; then
  if [[ "$out_path" = /* ]]; then
    out_abs="$out_path"
  else
    out_abs="$repo_root/$out_path"
  fi

  mkdir -p "$(dirname "$out_abs")"

  report_date="$(date '+%Y-%m-%d %H:%M:%S %z')"
  commit_sha="$(git -C "$repo_root" rev-parse --short HEAD 2>/dev/null || true)"
  [[ -n "$commit_sha" ]] || commit_sha="N/A"

  scope_label="$(IFS=', '; echo "${scopes[*]}")"
  threshold_label="${threshold:-"(none)"}"
  top_label="${top:-"(none)"}"
  pattern_label="$(IFS=', '; echo "${patterns[*]}")"

  {
    echo "# LOC Report"
    echo
    echo "- Date: $report_date"
    echo "- Commit: \`$commit_sha\`"
    echo "- Methode: wc -l pour compter les LF, puis conversion editeur (lignes = LF + 1, 0 si fichier vide)."
    echo "- Scope: \`$scope_label\`"
    echo "- Threshold: \`$threshold_label\`"
    echo "- Top: \`$top_label\`"
    echo "- Patterns: \`$pattern_label\`"
    echo
    printf '%s\n' "$table"
  } > "$out_abs"
fi

printf '%s\n' "$table"
