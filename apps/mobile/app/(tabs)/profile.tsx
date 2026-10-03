import { StyleSheet, View } from 'react-native'
import { Button, Text } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth'
import { id } from '@/lib/i18n'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">{user?.name}</Text>
      <Text>{user?.email}</Text>
      <Text>{user?.role === 'OWNER' ? id.roles.owner : id.roles.staff}</Text>
      <Button onPress={() => { logout(); router.replace('/login') }}>{id.auth.logout}</Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
})
