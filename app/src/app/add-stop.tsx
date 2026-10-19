import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { addStop, getOrCreateActiveRoute } from '@/db';

export default function AddStopScreen() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);

  const submit = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      Alert.alert('Endereço vazio', 'Digite ou cole ao menos um endereço.');
      return;
    }
    setBusy(true);
    try {
      // No Android o geocoder exige a permissão de localização.
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à localização para localizar os endereços.');
        return;
      }
      const route = await getOrCreateActiveRoute();
      const notFound: string[] = [];
      let ok = 0;
      for (const address of lines) {
        try {
          const results = await Location.geocodeAsync(address);
          if (results.length === 0) {
            notFound.push(address);
            continue;
          }
          await addStop(route.id, { address, lat: results[0].latitude, lng: results[0].longitude });
          ok++;
        } catch {
          notFound.push(address);
        }
      }
      setAdded((n) => n + ok);
      setFailed(notFound);
      // Mantém no campo apenas o que não foi encontrado, para corrigir.
      setText(notFound.join('\n'));
      if (notFound.length > 0) {
        Alert.alert('Endereço não encontrado', `Não consegui localizar ${notFound.length} endereço(s). Eles não foram salvos; corrija e tente de novo.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Endereço (um por linha para colar vários)</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Rua, número, bairro, cidade"
        editable={!busy}
      />
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Adicionar</Text>}
      </Pressable>
      <Text style={styles.info}>Paradas adicionadas nesta sessão: {added}</Text>
      {failed.length > 0 && <Text style={styles.warn}>Não encontrados: {failed.length} (mantidos no campo acima)</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, minHeight: 100, textAlignVertical: 'top', fontSize: 16 },
  button: { backgroundColor: '#0a66c2', padding: 14, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700' },
  info: { color: '#333' },
  warn: { color: '#b45309' },
});
