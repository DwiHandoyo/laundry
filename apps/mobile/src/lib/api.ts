import * as SecureStore from 'expo-secure-store'

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

let accessToken: string | null = null
let refreshInFlight: Promise<string> | null = null
export const setAccessToken = (token: string | null) => { accessToken = token }

async function rawRequest<T>(path: string, init: RequestInit = {}): Promise<{ response: Response; body: T | null }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => null)
  return { response, body }
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await SecureStore.getItemAsync('laundry.refreshToken')
      if (!refreshToken) throw new Error('Sesi berakhir. Silakan masuk kembali.')
      const result = await rawRequest<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
      if (!result.response.ok || !result.body) throw new Error('Sesi berakhir. Silakan masuk kembali.')
      await SecureStore.setItemAsync('laundry.refreshToken', result.body.refreshToken)
      setAccessToken(result.body.accessToken)
      return result.body.accessToken
    })().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { response, body } = await rawRequest<T>(path, init)
  if (response.status === 401 && retry && (body as { code?: string } | null)?.code === 'TOKEN_EXPIRED') {
    await refreshAccessToken()
    return request<T>(path, init, false)
  }
  if (!response.ok) throw new Error((body as { message?: string } | null)?.message ?? 'Permintaan gagal.')
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}
