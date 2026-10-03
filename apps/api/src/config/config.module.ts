import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { validateEnv, type Env } from './env.schema'

export type TypedConfigService = ConfigService<Env, true>

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
  ],
})
export class AppConfigModule {}
