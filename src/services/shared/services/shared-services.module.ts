import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { TelemetryService } from './telemetry.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RedisModule } from '../../../core/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [CacheService, TelemetryService, CircuitBreakerService],
  exports: [CacheService, TelemetryService, CircuitBreakerService],
})
export class SharedServicesModule {}