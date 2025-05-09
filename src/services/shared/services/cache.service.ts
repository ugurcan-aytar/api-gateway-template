import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../core/redis/redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl = 60 * 5; // 5 minutes

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisService.getValue(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Error getting value from cache: ${error.message}`);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl: number = this.defaultTtl): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      await this.redisService.setValue(key, stringValue, ttl);
    } catch (error) {
      this.logger.error(`Error setting value in cache: ${error.message}`);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redisService.deleteKey(key);
    } catch (error) {
      this.logger.error(`Error deleting value from cache: ${error.message}`);
    }
  }

  /**
   * Get or set value in cache with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = this.defaultTtl
  ): Promise<T> {
    const cachedValue = await this.get<T>(key);
    
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    const newValue = await factory();
    await this.set(key, newValue, ttl);
    
    return newValue;
  }

  /**
   * Create a scoped cache key
   */
  createCacheKey(scope: string, identifier: string, ...parts: string[]): string {
    return `${scope}:${identifier}:${parts.join(':')}`;
  }
}