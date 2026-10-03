import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { Request, Response } from 'express'
import { AppException, ERROR_CATALOG, type ErrorCode } from '../exceptions/app.exception'

interface ErrorBody {
  statusCode: number
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Satu bentuk response error untuk seluruh API.
 * Juga menangkap error Prisma yang bocor dan memetakannya ke kode domain,
 * sehingga client tidak pernah menerima detail internal database.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const body = this.toErrorBody(exception)

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    } else {
      // Kesalahan operasional yang diharapkan (mis. staff salah tekan tombol)
      // dicatat sebagai warn supaya alerting produksi tidak tenggelam.
      this.logger.warn(`${request.method} ${request.url} -> ${body.code}: ${body.message}`)
    }

    response.status(body.statusCode).json(body)
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception)
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const code: ErrorCode =
        status === 401
          ? 'TOKEN_INVALID'
          : status === 403
            ? 'FORBIDDEN_ROLE'
            : status === 404
              ? 'RESOURCE_NOT_FOUND'
              : status === 400
                ? 'VALIDATION_FAILED'
                : 'INTERNAL_ERROR'
      const payload = exception.getResponse()
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string }).message ?? ERROR_CATALOG[code].message)
      return { statusCode: status, code, message }
    }

    return {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: ERROR_CATALOG.INTERNAL_ERROR.message,
    }
  }

  private fromPrisma(e: Prisma.PrismaClientKnownRequestError): ErrorBody {
    const target = (e.meta?.target as string[] | string | undefined) ?? []
    const fields = Array.isArray(target) ? target : [target]

    if (e.code === 'P2002') {
      if (fields.includes('phone')) return this.body('CUSTOMER_PHONE_TAKEN')
      if (fields.includes('code')) return this.body('SERVICE_CODE_TAKEN')
      if (fields.includes('email')) return this.body('USER_EMAIL_TAKEN')
      return this.body('VALIDATION_FAILED', { fields })
    }
    if (e.code === 'P2025') return this.body('RESOURCE_NOT_FOUND')
    if (e.code === 'P2003') return this.body('RESOURCE_NOT_FOUND')

    return this.body('INTERNAL_ERROR')
  }

  private body(code: ErrorCode, details?: Record<string, unknown>): ErrorBody {
    return {
      statusCode: ERROR_CATALOG[code].status,
      code,
      message: ERROR_CATALOG[code].message,
      ...(details ? { details } : {}),
    }
  }
}
