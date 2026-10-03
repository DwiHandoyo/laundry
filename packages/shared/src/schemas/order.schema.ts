import { z } from 'zod'
import { ORDER_STATUS_VALUES, PAYMENT_METHOD_VALUES } from '../enums'
import { phoneField } from './customer.schema'

const orderStatusEnum = z.enum(ORDER_STATUS_VALUES)
const paymentMethodEnum = z.enum(PAYMENT_METHOD_VALUES)

export const orderItemInputSchema = z.object({
  serviceId: z.uuid('serviceId harus berupa UUID'),
  quantity: z.number().int().min(1, 'Jumlah minimal 1').max(999),
  notes: z.string().trim().max(500).nullish(),
})

export const customerInlineSchema = z.object({
  name: z.string().trim().min(1, 'Nama pelanggan wajib diisi').max(120),
  phone: phoneField,
  notes: z.string().trim().max(500).nullish(),
})

/**
 * Payload pembuatan pesanan.
 * Sengaja TIDAK memuat harga apa pun — server mengambilnya dari tabel Service.
 * Array item boleh kosong di lapisan ini supaya service bisa menolaknya
 * dengan kode domain ORDER_EMPTY_ITEMS (422), bukan VALIDATION_FAILED (400).
 */
export const createOrderSchema = z
  .object({
    customerId: z.uuid().optional(),
    customer: customerInlineSchema.optional(),
    items: z.array(orderItemInputSchema).max(50),
    discount: z.number().int().min(0).max(2_000_000_000).default(0),
    notes: z.string().trim().max(1000).nullish(),
  })
  .refine((d) => Boolean(d.customerId) !== Boolean(d.customer), {
    message: 'Isi tepat salah satu: customerId atau customer',
    path: ['customerId'],
  })
export type CreateOrderInput = z.infer<typeof createOrderSchema>

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  note: z.string().trim().max(500).nullish(),
})
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>

export const recordPaymentSchema = z.object({
  amount: z.number().int().min(1, 'Nominal pembayaran minimal 1'),
  method: paymentMethodEnum,
})
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

export const queryOrdersSchema = z.object({
  status: z.string().trim().optional(),
  search: z.string().trim().max(120).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  customerId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['receivedAt:desc', 'receivedAt:asc', 'estimatedDoneAt:asc'])
    .default('receivedAt:desc'),
})
export type QueryOrdersInput = z.infer<typeof queryOrdersSchema>

export const dailySummaryQuerySchema = z.object({
  date: dateOnly.optional(),
})
export type DailySummaryQueryInput = z.infer<typeof dailySummaryQuerySchema>
