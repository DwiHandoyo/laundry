import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { AppConfigModule } from './config/config.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { CustomersModule } from './modules/customers/customers.module'
import { HealthModule } from './modules/health/health.module'
import { OrdersModule } from './modules/orders/orders.module'
import { ReportsModule } from './modules/reports/reports.module'
import { ServicesModule } from './modules/services/services.module'
import { UsersModule } from './modules/users/users.module'

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // Password, token, dan hash tidak pernah masuk log.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.refreshToken',
            'res.body.accessToken',
            'res.body.refreshToken',
            '*.passwordHash',
          ],
          censor: '[REDACTED]',
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: process.env.NODE_ENV !== 'test',
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    CustomersModule,
    OrdersModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    // Guard global: defaultnya aman — endpoint terbuka harus ditandai @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
