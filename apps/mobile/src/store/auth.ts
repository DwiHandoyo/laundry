import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import type { AuthResponse, UserResponse } from '@laundry/shared'
import { api, setAccessToken } from '@/lib/api'

const refreshKey = 'laundry.refreshToken'

type AuthState = {
  hydrated: boolean
  user: AuthResponse['user'] | UserResponse | null
  restore: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  user: null,
  restore: async () => {
    const refreshToken = await SecureStore.getItemAsync(refreshKey)
    if (!refreshToken) return set({ hydrated: true })
    try {
      const result = await api.post<AuthResponse>('/auth/refresh', { refreshToken })
      setAccessToken(result.accessToken)
      await SecureStore.setItemAsync(refreshKey, result.refreshToken)
      set({ user: result.user, hydrated: true })
    } catch {
      await SecureStore.deleteItemAsync(refreshKey)
      set({ user: null, hydrated: true })
    }
  },
  login: async (email, password) => {
    const result = await api.post<AuthResponse>('/auth/login', { email, password })
    setAccessToken(result.accessToken)
    await SecureStore.setItemAsync(refreshKey, result.refreshToken)
    set({ user: result.user, hydrated: true })
  },
  logout: async () => {
    setAccessToken(null)
    await SecureStore.deleteItemAsync(refreshKey)
    set({ user: null })
  },
}))
