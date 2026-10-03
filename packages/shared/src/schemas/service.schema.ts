import { z } from 'zod'
import { SERVICE_CATEGORY_VALUES, SERVICE_UNIT_VALUES } from '../enums'

const categoryEnum = z.enum(SERVICE_CATEGORY_VALUES)
const unitEnum = z.enum(SERVICE_UNIT_VALUES)

export const createServiceSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, 'Kode hanya boleh huruf kapital, angka, dan garis bawah'),
  name: z.string().trim().min(1).max(120),
  category: categoryEnum,
  unit: unitEnum.default('PAIR'),
  price: z.number().int().min(0, 'Harga tidak boleh negatif').max(2_000_000_000),
  estimatedDays: z.number().int().min(0).max(365).default(3),
  description: z.string().trim().max(500).nullish(),
})
export type CreateServiceInput = z.infer<typeof createServiceSchema>

export const updateServiceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: categoryEnum.optional(),
  unit: unitEnum.optional(),
  price: z.number().int().min(0).max(2_000_000_000).optional(),
  estimatedDays: z.number().int().min(0).max(365).optional(),
  description: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional(),
})
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>

export const queryServicesSchema = z.object({
  category: categoryEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  search: z.string().trim().max(120).optional(),
})
export type QueryServicesInput = z.infer<typeof queryServicesSchema>
