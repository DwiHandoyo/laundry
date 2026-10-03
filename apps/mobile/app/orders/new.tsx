import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Card, HelperText, Text, TextInput } from 'react-native-paper'
import { useRouter } from 'expo-router'
import type { OrderResponse, ServiceResponse } from '@laundry/shared'
import { api } from '@/lib/api'
import { formatRupiah } from '@/lib/format'
import { id } from '@/lib/i18n'
import { useQuery } from '@tanstack/react-query'

type DraftItem = { service: ServiceResponse; quantity: number }

export default function NewOrderScreen() {
  const router = useRouter()
  const services = useQuery({
    queryKey: ['services', { isActive: true }],
    queryFn: () => api.get<{ data: ServiceResponse[] }>('/services?isActive=true'),
  })
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const total = useMemo(() => items.reduce((sum, item) => sum + item.service.price * item.quantity, 0), [items])

  const addService = (service: ServiceResponse) => {
    setItems((current) => {
      const found = current.find((item) => item.service.id === service.id)
      if (found) return current.map((item) => item.service.id === service.id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { service, quantity: 1 }]
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const order = await api.post<OrderResponse>('/orders', {
        customer: { name, phone },
        items: items.map((item) => ({ serviceId: item.service.id, quantity: item.quantity })),
      })
      router.replace(`/orders/${order.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesanan gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall">{id.order.create}</Text>
      <TextInput label="Nama pelanggan" value={name} onChangeText={setName} />
      <TextInput label="Nomor HP" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text variant="titleMedium">Pilih layanan</Text>
      {services.isLoading && <ActivityIndicator />}
      {(services.data?.data ?? []).map((service) => (
        <Button key={service.id} mode="outlined" onPress={() => addService(service)}>
          {service.name} · {formatRupiah(service.price)}
        </Button>
      ))}
      {items.map((item) => (
        <Card key={item.service.id} style={styles.card}>
          <Card.Content>
            <Text>{item.service.name}</Text>
            <Text>{item.quantity} × {formatRupiah(item.service.price)}</Text>
            <Button onPress={() => setItems((current) => current.filter((entry) => entry.service.id !== item.service.id))}>Hapus</Button>
          </Card.Content>
        </Card>
      ))}
      <Text variant="titleLarge">Total: {formatRupiah(total)}</Text>
      <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
      <Button mode="contained" loading={saving} disabled={saving || !name || !phone || items.length === 0} onPress={save}>{id.common.save}</Button>
      <Button mode="outlined" onPress={() => router.back()}>{id.common.back}</Button>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  card: { marginVertical: 4 },
})
