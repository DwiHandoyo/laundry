import { StyleSheet, View } from 'react-native'
import { Button, Card, Text } from 'react-native-paper'
import { Link } from 'expo-router'
import { id } from '@/lib/i18n'
import { useAuthStore } from '@/store/auth'

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user)
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">{id.home.greeting(user?.name ?? '')}</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>{id.home.subtitle}</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">{id.home.readyOrders}</Text>
          <Text variant="bodyMedium">{id.home.readyOrdersHint}</Text>
        </Card.Content>
      </Card>
      <Link href="/orders/new" asChild>
        <Button mode="contained" icon="plus">{id.order.create}</Button>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  subtitle: { color: '#666' },
  card: { marginBottom: 8 },
})
