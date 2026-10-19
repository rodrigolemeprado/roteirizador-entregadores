# Backend de otimização (OSRM + VROOM)

Serviço próprio, sem chaves de API e sem dados pessoais: recebe apenas coordenadas.

- **OSRM** calcula tempos/distâncias sobre o mapa OSM (algoritmo MLD).
- **VROOM** define a ordem das paradas usando o OSRM. Expõe `POST /` na porta 8080.

## Requisitos

- Docker e Docker Compose
- `curl`; opcional: `osmium-tool` para recortar uma cidade

## Subir localmente

1. Prepare o mapa (use um extrato pequeno; o do Sudeste inteiro é grande):

   ```bash
   cd backend
   # Opção A: baixar um .osm.pbf de região e recortar sua cidade (bbox: lon_min,lat_min,lon_max,lat_max)
   PBF_URL=<url do .osm.pbf no Geofabrik> BBOX=-46.83,-23.78,-46.36,-23.36 ./scripts/prepare-map.sh
   # Opção B: colocar manualmente backend/data/source.osm.pbf e rodar sem PBF_URL
   ./scripts/prepare-map.sh
   ```

   Isso gera `data/map.osrm*` (ignorados pelo git).

2. Suba os serviços:

   ```bash
   docker compose up -d
   ```

3. Teste:

   ```bash
   curl -s localhost:8080/ -H 'Content-Type: application/json' -d '{
     "vehicles":[{"id":1,"start":[-46.63,-23.55]}],
     "jobs":[{"id":1,"location":[-46.64,-23.56]},{"id":2,"location":[-46.62,-23.54]}]
   }'
   ```

   (as coordenadas precisam estar dentro do recorte preparado).

4. No app, configure `EXPO_PUBLIC_API_URL` (ver `app/.env.example`). Em aparelho físico use o IP da máquina na rede local.

## Trocar o perfil (bicicleta / moto)

Rode `PROFILE=bicycle ./scripts/prepare-map.sh` e ajuste `vroom-conf/config.yml` (chave do perfil) e o `profile` dos veículos no app. O OSRM não traz perfil de moto: use `car` ou crie um perfil Lua próprio.

## Notas

- Produção: coloque um proxy reverso com HTTPS e limite de taxa na frente do VROOM; não exponha o OSRM.
- Atualize o mapa periodicamente repetindo o passo 1.
