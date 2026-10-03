import { z } from 'zod'
import { ROLE_VALUES } from '../enums'
import { phoneField } from './customer.schema'

const roleEnum = z.enum(ROLE_VALUES)

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(120),
  email: z.email('Format email tidak valid'),
  phone: phoneField.nullish(),
  password: z.string().min(8, 'Password minimal 8 karakter').max(128),
  role: roleEnum.default('STAFF'),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: phoneField.nullish(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>
