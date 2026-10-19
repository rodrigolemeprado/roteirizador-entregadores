# Roteirizador para Entregadores

App de roteirização para entregadores independentes no Brasil (Shopee, Mercado Livre Flex, TikTok Shop). Android primeiro.

O entregador fotografa (ou dita/digita) o endereço de cada etiqueta, o app calcula a melhor ordem de entrega com previsão por parada e abre a navegação no Waze ou Google Maps.

## MVP v1

1. Adicionar parada por câmera (OCR da etiqueta), voz ou digitação.
2. Otimizar a ordem de até ~150 paradas, com previsão de chegada por parada.
3. Marcar entregue/ausente e reotimizar o restante.
4. Número da parada para escrever no pacote; bipar o código de barras para localizar o pacote.
5. Funcionar com sinal ruim (dados no aparelho; só a otimização usa rede).

## Fora da v1

- Integração com as plataformas (Shopee, ML Flex, TikTok Shop)
- Navegação própria (usamos Waze/Google Maps)
- Prova de entrega
- Gestão de frota

## Stack

- **App:** React Native + Expo (SDK 58), TypeScript, Expo Router, SQLite (`expo-sqlite`).
- **OCR:** ML Kit, executado no aparelho. O código de barras só confere o pacote; o endereço vem do OCR.
- **Backend:** VROOM + OSRM próprios sobre mapa OpenStreetMap (Docker).
- **Navegação:** deep links para Waze / Google Maps.
- **Assinatura (futuro):** RevenueCat.

## Estrutura

```
app/        App Expo (src/app telas, src/db SQLite, src/services otimizador e navegação)
backend/    docker-compose (OSRM + VROOM), scripts/prepare-map.sh
```

## Como rodar

Backend (ver [backend/README.md](backend/README.md)):

```bash
cd backend
PBF_URL=<url .osm.pbf> BBOX=<lon_min,lat_min,lon_max,lat_max> ./scripts/prepare-map.sh
docker compose up -d
```

App:

```bash
cd app
cp .env.example .env
npm install
npx expo start      # abrir no Android (emulador ou Expo Go)
npx tsc --noEmit    # checagem de tipos
```

## LGPD

Os dados do destinatário (endereço, texto da etiqueta, código de barras) ficam apenas no SQLite do aparelho. O backend recebe somente coordenadas. As paradas de uma rota finalizada são apagadas (`purgeFinishedRoutes()`), ao finalizar e na abertura do app. Nenhuma chave de API no código.

## Roadmap

- **Fase 0 – Validação:** entrevistas com 10 entregadores; teste de OCR em etiquetas reais; teste de geocodificação OSM/Nominatim + CEP; definir o nome do app.
- **Fase 1 – MVP Android:** itens da v1 acima.
- **Fase 2 – Teste fechado no Google Play:** 15–20 testadores por 14 dias.
- **Fase 3 – Lançamento:** assinatura via RevenueCat, R$ 9,90–14,90/mês, plano anual, 7 dias grátis.
- **Fase 4 – iOS:** após ~100 assinantes.
