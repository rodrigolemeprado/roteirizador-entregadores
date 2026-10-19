#!/usr/bin/env bash
# Baixa um extrato OSM, (opcionalmente) recorta uma cidade e prepara os dados do OSRM (MLD).
# Uso:
#   REGION=itupeva-jundiai ./scripts/prepare-map.sh            # região pronta (abaixo)
#   PBF_URL=<url do .osm.pbf> ./scripts/prepare-map.sh
#   BBOX=-46.83,-23.78,-46.36,-23.36 ./scripts/prepare-map.sh   # recorta uma área
# Requer: docker, curl. osmium é usado se instalado; senão roda via container.
set -euo pipefail

cd "$(dirname "$0")/.."
DATA_DIR="$PWD/data"
mkdir -p "$DATA_DIR"

# O Geofabrik só tem extratos por região (o Sudeste tem ~1 GB). O download é feito uma vez
# e reaproveitado; o recorte por BBOX deixa o OSRM pequeno e rápido de preparar.
REGION="${REGION:-}"
case "$REGION" in
  "") ;;
  itupeva-jundiai)
    # Itupeva + Jundiaí (SP), com margem para Louveira, Cabreúva e Várzea Paulista.
    DEFAULT_PBF_URL="https://download.geofabrik.de/south-america/brazil/sudeste-latest.osm.pbf"
    DEFAULT_BBOX="-47.20,-23.35,-46.78,-23.03"
    ;;
  *) echo "REGION desconhecida: $REGION" >&2; exit 1 ;;
esac
PBF_URL="${PBF_URL:-${DEFAULT_PBF_URL:-}}"
BBOX="${BBOX:-${DEFAULT_BBOX:-}}"  # lon_min,lat_min,lon_max,lat_max
PROFILE="${PROFILE:-car}"        # car | bicycle | foot
OSRM_IMAGE="${OSRM_IMAGE:-ghcr.io/project-osrm/osrm-backend:latest}"

if [[ -z "$PBF_URL" && ! -f "$DATA_DIR/source.osm.pbf" ]]; then
  echo "Defina PBF_URL (ou coloque backend/data/source.osm.pbf manualmente)." >&2
  exit 1
fi

if [[ -n "$PBF_URL" && -f "$DATA_DIR/source.osm.pbf" && -n "$REGION" ]]; then
  echo ">> source.osm.pbf já existe; reutilizando (apague para baixar de novo)"
  PBF_URL=""
fi

if [[ -n "$PBF_URL" ]]; then
  echo ">> Baixando $PBF_URL"
  curl -fL --retry 3 -o "$DATA_DIR/source.osm.pbf" "$PBF_URL"
fi

SRC="source.osm.pbf"
if [[ -n "$BBOX" ]]; then
  echo ">> Recortando bbox $BBOX"
  if command -v osmium >/dev/null; then
    osmium extract --bbox "$BBOX" --overwrite -o "$DATA_DIR/map.osm.pbf" "$DATA_DIR/source.osm.pbf"
  else
    # Sem osmium local: roda num container descartável. Copia o .pbf para o disco do
    # container antes: no WSL, ler o arquivo grande direto de /mnt/c falha com
    # "Cannot allocate memory".
    docker run --rm -v "$DATA_DIR:/data" debian:stable-slim bash -euc \
      "apt-get update -qq && apt-get install -y -qq osmium-tool >/dev/null && \
       cp /data/source.osm.pbf /tmp/source.osm.pbf && \
       osmium extract --bbox '$BBOX' --overwrite -o /tmp/map.osm.pbf /tmp/source.osm.pbf && \
       cp /tmp/map.osm.pbf /data/map.osm.pbf"
  fi
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
