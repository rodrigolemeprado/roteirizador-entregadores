import * as Location from 'expo-location';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { applyOptimization, finishRoute, getOrCreateActiveRoute, listStops, setStopStatus } from '@/db';
import type { Stop } from '@/db/schema';
import { openNavigation } from '@/services/navigation';
import { optimize } from '@/services/optimizer';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface Summary {
  total: number;
  km: number;
  durationS: number;
}

function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CurrentRouteScreen() {
  const [routeId, setRouteId] = useState<number | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    const route = await getOrCreateActiveRoute();
    setRouteId(route.id);
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

  const runOptimize = async () => {
    const pending = stops.filter((s) => s.status === 'pending' && s.lat != null && s.lng != null);
    if (pending.length === 0) {
      Alert.alert('Nada para otimizar', 'Não há paradas pendentes com localização.');
      return;
    }
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita a localização para usar sua posição como ponto de partida.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const now = Date.now();

      let res;
      try {
        res = await optimize({
          vehicles: [{ id: 1, profile: 'car', start: [pos.coords.longitude, pos.coords.latitude] }],
          jobs: pending.map((s) => ({ id: s.id, location: [s.lng!, s.lat!], service: 120 })),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // fetch de rede falha com TypeError ("Network request failed").
        if (e instanceof TypeError) {
          Alert.alert('Erro de rede', `Backend indisponível em ${API_URL ?? '(URL não configurada)'}.`);
        } else {
          Alert.alert('Erro na otimização', msg);
        }
        return;
      }

      const route = res.routes[0];
      const jobSteps = (route?.steps ?? []).filter((st) => st.type === 'job' && st.id != null);
      await applyOptimization(
        routeId!,
        jobSteps.map((st) => ({ stopId: st.id!, eta: hhmm(new Date(now + st.arrival * 1000)) })),
      );
      setSummary({
        total: jobSteps.length,
        km: (route?.distance ?? res.summary.distance ?? 0) / 1000,
        durationS: route?.duration ?? res.summary.duration,
      });
      if (res.unassigned.length > 0) {
        const labels = res.unassigned
          .map((u) => pending.find((s) => s.id === u.id)?.label_number)
          .filter((n) => n != null)
          .join(', ');
        Alert.alert('Paradas fora da rota', `Não foi possível incluir as etiquetas: ${labels}.`);
      }
      await load();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmFinish = () => {
    if (routeId == null) return;
    Alert.alert('Finalizar rota', 'Os dados das paradas serão apagados do aparelho. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar',
        style: 'destructive',
        onPress: async () => {
          await finishRoute(routeId);
          setSummary(null);
          await load(); // cria nova rota ativa
        },
      },
    ]);
  };

  const hasOrder = stops.some((s) => s.seq != null);

  return (
    <View style={styles.container}>
      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={runOptimize} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{hasOrder ? 'Reotimizar' : 'Otimizar rota'}</Text>}
      </Pressable>
      {summary && (
        <Text style={styles.summary}>
          {summary.total} paradas · {summary.km.toFixed(1)} km · {formatDuration(summary.durationS)}
        </Text>
      )}
      <FlatList
        data={stops}
        keyExtractor={(s) => String(s.id)}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma parada ainda. Toque em “Adicionar parada”.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, item.status !== 'pending' && styles.done]}>
            <View style={styles.order}>
              <Text style={styles.orderNum}>{item.seq ?? '–'}</Text>
              <Text style={styles.orderLabel}>ordem</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>Etiqueta nº {item.label_number}</Text>
              <Text style={styles.address}>{item.address ?? item.raw_text ?? 'Sem endereço'}</Text>
              <Text style={styles.meta}>
                {item.status === 'pending' ? 'Pendente' : item.status === 'delivered' ? 'Entregue' : 'Ausente'}
                {item.eta && item.status === 'pending' ? ` · previsão ${item.eta}` : ''}
              </Text>
              <View style={styles.actions}>
                {item.lat != null && item.lng != null && (
                  <>
                    <Pressable onPress={() => openNavigation('waze', item.lat!, item.lng!)}>
                      <Text style={styles.link}>Waze</Text>
                    </Pressable>
                    <Pressable onPress={() => openNavigation('gmaps', item.lat!, item.lng!)}>
                      <Text style={styles.link}>Google Maps</Text>
                    </Pressable>
                  </>
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
      <Link href="/add-stop" style={styles.add}>
        Adicionar parada
      </Link>
      <Pressable style={styles.finish} onPress={confirmFinish}>
        <Text style={styles.finishText}>Finalizar rota</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  primary: { backgroundColor: '#15803d', padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  summary: { fontWeight: '600', textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 48, color: '#666' },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', marginBottom: 8 },
  done: { opacity: 0.55 },
  order: { alignItems: 'center', minWidth: 44 },
  orderNum: { fontSize: 26, fontWeight: '700' },
  orderLabel: { fontSize: 11, color: '#666' },
  body: { flex: 1, gap: 4 },
  label: { fontWeight: '700', color: '#0a66c2' },
  address: { fontSize: 16 },
  meta: { color: '#555' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  link: { color: '#0a66c2', fontWeight: '600' },
  add: { textAlign: 'center', padding: 14, backgroundColor: '#0a66c2', color: '#fff', borderRadius: 8, overflow: 'hidden', fontWeight: '700' },
  finish: { padding: 12, alignItems: 'center' },
  finishText: { color: '#b91c1c', fontWeight: '700' },
});
