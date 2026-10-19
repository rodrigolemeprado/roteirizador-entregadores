import { StyleSheet, Text, View } from 'react-native';

export default function AddStopScreen() {
  // TODO: câmera + OCR da etiqueta (ML Kit, no aparelho) e leitura de código de barras
  //       (só para conferir o pacote).
  // TODO: entrada por voz (ditado do endereço).
  // TODO: digitação manual + geocodificação (CEP / Nominatim) e gravação via addStop().
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adicionar parada</Text>
      <Text>Em breve: câmera (OCR da etiqueta), voz e digitação.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
});
