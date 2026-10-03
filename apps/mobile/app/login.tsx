import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, HelperText, Text, TextInput } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth'
import { id } from '@/lib/i18n'

export default function LoginScreen() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      router.replace('/(tabs)')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : id.auth.loginFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>{id.app.name}</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>{id.auth.subtitle}</Text>
      <TextInput label={id.auth.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput label={id.auth.password} value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
      <Button mode="contained" loading={loading} disabled={loading || !email || !password} onPress={submit}>
        {id.auth.login}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 24 },
  input: { marginTop: 12 },
})
