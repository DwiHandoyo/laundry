import { PropsWithChildren, useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useSegments, useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth'

export function AuthGate({ children }: PropsWithChildren) {
  const router = useRouter()
  const segments = useSegments()
  const { hydrated, user, restore } = useAuthStore()

  useEffect(() => { void restore() }, [restore])

  useEffect(() => {
    if (!hydrated) return
    const inLogin = segments[0] === 'login'
    if (!user && !inLogin) router.replace('/login')
    if (user && inLogin) router.replace('/(tabs)')
  }, [hydrated, router, segments, user])

  if (!hydrated) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
  return children
}
