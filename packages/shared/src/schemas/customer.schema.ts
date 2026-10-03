import { z } from 'zod'

export const phoneField = z
  .string()
  .trim()
  .min(6, 'Nomor HP terlalu pendek')
  .max(30, 'Nomor HP terlalu panjang')
  .regex(/^[0-9+()\-\s]+$/, 'Nomor HP hanya boleh angka dan tanda + - ( )')

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(120),
  phone: phoneField,
  notes: z.string().trim().max(500).nullish(),
})
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: phoneField.optional(),
  notes: z.string().trim().max(500).nullish(),
})
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>

export const queryCustomersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type QueryCustomersInput = z.infer<typeof queryCustomersSchema>
