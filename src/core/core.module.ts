import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exception.filter';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { ThrottlerModule } from './throttler/throttler.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from './auth/guards/api-key-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ThrottlerGuard } from './throttler/throttler.guard';

/**
 * Core module for global filters, guards, interceptors, and middlewares.
 */
@Module({
  imports: [
    AuthModule,
    RedisModule,
    ThrottlerModule
  ],
  providers: [
    // Register global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter
    },
    // Register global guards in the correct order
    {
      provide: APP_GUARD,
      useClass: ApiKeyAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ],
  exports: [
    AuthModule,
    RedisModule,
    ThrottlerModule
  ],
})
export class CoreModule { }