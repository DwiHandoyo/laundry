import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <View style={styles.container}><Text variant="headlineSmall">Detail Pesanan</Text><Text>{id}</Text></View>
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 12 } })
