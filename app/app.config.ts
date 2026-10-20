import type { ConfigContext, ExpoConfig } from 'expo/config';

// HTTP sem TLS só nos builds de teste (backend na rede local). Produção exige HTTPS.
const allowCleartext = process.env.EAS_BUILD_PROFILE !== 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', { android: { usesCleartextTraffic: allowCleartext } }],
  ],
});
