#!/usr/bin/env bash
# Baixa um extrato OSM, (opcionalmente) recorta uma cidade e prepara os dados do OSRM (MLD).
# Uso:
#   PBF_URL=<url do .osm.pbf> ./scripts/prepare-map.sh
#   BBOX=-46.83,-23.78,-46.36,-23.36 ./scripts/prepare-map.sh   # recorta (requer osmium-tool)
# Requer: docker, curl. Opcional: osmium (apt install osmium-tool).
set -euo pipefail

cd "$(dirname "$0")/.."
DATA_DIR="$PWD/data"
mkdir -p "$DATA_DIR"

# Padrão: extrato PEQUENO apenas para teste (Geofabrik: Brasil por região é grande,
# ex.: sudeste-latest.osm.pbf tem GBs). Sugestão: baixe um extrato de região
# (https://download.geofabrik.de/south-america/brazil.html) e recorte sua cidade com BBOX.
# TODO: confirmar um extrato pequeno de teste; até lá defina PBF_URL explicitamente.
PBF_URL="${PBF_URL:-}"
BBOX="${BBOX:-}"                 # lon_min,lat_min,lon_max,lat_max
PROFILE="${PROFILE:-car}"        # car | bicycle | foot
OSRM_IMAGE="${OSRM_IMAGE:-ghcr.io/project-osrm/osrm-backend:latest}"

if [[ -z "$PBF_URL" && ! -f "$DATA_DIR/source.osm.pbf" ]]; then
  echo "Defina PBF_URL (ou coloque backend/data/source.osm.pbf manualmente)." >&2
  exit 1
fi

if [[ -n "$PBF_URL" ]]; then
  echo ">> Baixando $PBF_URL"
  curl -fL --retry 3 -o "$DATA_DIR/source.osm.pbf" "$PBF_URL"
fi

SRC="source.osm.pbf"
if [[ -n "$BBOX" ]]; then
  command -v osmium >/dev/null || { echo "osmium não encontrado (apt install osmium-tool)." >&2; exit 1; }
  echo ">> Recortando bbox $BBOX"
  osmium extract --bbox "$BBOX" --overwrite -o "$DATA_DIR/map.osm.pbf" "$DATA_DIR/source.osm.pbf"
else
  cp -f "$DATA_DIR/source.osm.pbf" "$DATA_DIR/map.osm.pbf"
fi

run() { docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" "$@"; }

echo ">> osrm-extract (perfil $PROFILE)"
run osrm-extract -p "/opt/$PROFILE.lua" /data/map.osm.pbf
echo ">> osrm-partition"
run osrm-partition /data/map.osrm
echo ">> osrm-customize"
run osrm-customize /data/map.osrm

echo "Pronto. Suba o backend com: docker compose up -d"
