import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getOrCreateActiveRoute, listStops, setStopStatus } from '@/db';
import type { Stop } from '@/db/schema';
import { openNavigation } from '@/services/navigation';

export default function CurrentRouteScreen() {
  const [stops, setStops] = useState<Stop[]>([]);

  const load = useCallback(async () => {
    const route = await getOrCreateActiveRoute();
    setStops(await listStops(route.id));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  const mark = async (id: number, status: Stop['status']) => {
    await setStopStatus(id, status);
    await load();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={stops}
        keyExtractor={(s) => String(s.id)}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma parada ainda. Toque em “Adicionar parada”.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.number}>{item.label_number}</Text>
            <View style={styles.body}>
              <Text style={styles.address}>{item.address ?? item.raw_text ?? 'Sem endereço'}</Text>
              <Text style={styles.meta}>
                {item.status === 'pending' ? 'Pendente' : item.status === 'delivered' ? 'Entregue' : 'Ausente'}
                {item.eta ? ` · previsão ${item.eta}` : ''}
              </Text>
              <View style={styles.actions}>
                {item.lat != null && item.lng != null && (
                  <Pressable onPress={() => openNavigation('waze', item.lat!, item.lng!)}>
                    <Text style={styles.link}>Waze</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => mark(item.id, 'delivered')}>
                  <Text style={styles.link}>Entregue</Text>
                </Pressable>
                <Pressable onPress={() => mark(item.id, 'absent')}>
                  <Text style={styles.link}>Ausente</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
      {/* TODO: botão "Otimizar rota" chamando services/optimizer e gravando seq/eta. */}
      <Link href="/add-stop" style={styles.add}>
        Adicionar parada
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  empty: { textAlign: 'center', marginTop: 48, color: '#666' },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', marginBottom: 8 },
  number: { fontSize: 24, fontWeight: '700', minWidth: 36 },
  body: { flex: 1, gap: 4 },
  address: { fontSize: 16 },
  meta: { color: '#555' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  link: { color: '#0a66c2', fontWeight: '600' },
  add: { textAlign: 'center', padding: 14, backgroundColor: '#0a66c2', color: '#fff', borderRadius: 8, overflow: 'hidden', fontWeight: '700' },
});
