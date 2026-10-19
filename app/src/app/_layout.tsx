import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { purgeFinishedRoutes } from '@/db';

export default function RootLayout() {
  useEffect(() => {
    // LGPD: garante limpeza de rotas finalizadas ao abrir o app.
    purgeFinishedRoutes().catch(() => {});
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Rota atual' }} />
      <Stack.Screen name="add-stop" options={{ title: 'Adicionar parada', presentation: 'modal' }} />
    </Stack>
  );
}
