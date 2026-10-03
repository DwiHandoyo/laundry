import { FlatList, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper'
import { Link } from 'expo-router'
import { useOrders } from '@/hooks/useOrders'
import { formatRupiah, formatTanggal } from '@/lib/format'
import { orderStatusLabel } from '@/lib/i18n'

export default function OrdersScreen() {
  const orders = useOrders()
  if (orders.isLoading) return <ActivityIndicator style={styles.center} />
  if (orders.isError) return <View style={styles.center}><Text>Gagal memuat pesanan.</Text><Button onPress={() => orders.refetch()}>Coba Lagi</Button></View>

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={orders.data?.data ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text>Belum ada pesanan.</Text>}
      renderItem={({ item }) => (
        <Link href={`/orders/${item.id}`} asChild>
          <Card style={styles.card}>
            <Card.Title title={item.orderNumber} subtitle={`${item.customer.name} · ${formatTanggal(item.receivedAt)}`} />
            <Card.Content>
              <Text>{orderStatusLabel(item.status)} · {formatRupiah(item.total)}</Text>
            </Card.Content>
          </Card>
        </Link>
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: { marginBottom: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
})
