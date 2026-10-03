import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'
import { AppException } from '../exceptions/app.exception'

/**
 * Memvalidasi body/query dengan skema Zod dari @laundry/shared.
 * Request yang bentuknya salah tidak pernah sampai ke service.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value)
    if (result.success) return result.data

    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : '_'
      if (!fields[key]) fields[key] = issue.message
    }
    throw new AppException('VALIDATION_FAILED', { fields })
  }
}
