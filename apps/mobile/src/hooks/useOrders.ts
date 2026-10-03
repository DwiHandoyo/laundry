import { useQuery } from '@tanstack/react-query'
import type { OrderSummaryResponse, Paginated } from '@laundry/shared'
import { api } from '@/lib/api'

export function useOrders() {
  return useQuery({
    queryKey: ['orders', { page: 1 }],
    queryFn: () => api.get<Paginated<OrderSummaryResponse>>('/orders?page=1&limit=20'),
  })
}
