import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService {
    private readonly logger = new Logger(RedisService.name, { timestamp: true });
    redisClient: RedisClientType;

    constructor(private readonly configService: ConfigService) {
        const REDIS_HOST = this.configService.get<string>('REDIS_HOST_MASTER') || 'localhost';
        const REDIS_PORT = this.configService.get<string>('REDIS_PORT') || '6379';

        this.redisClient = createClient({
            url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
            socket: {
                reconnectStrategy: retries => Math.min(retries * 50, 1000),
                rejectUnauthorized: false,
            },
        });
        this.redisClient.connect();

        this.redisClient.on('error', (err) => {
            this.logger.error(`Redis client error: ${err}`);
        });
    }

    async setValue(key: string, value: string, ttl: number) {
        try {
            await this.redisClient.set(key, value, { EX: ttl });
        } catch (e) {
            this.logger.error(`Error occurred while setting: ${e.message}`);
        }
    }

    async getValue(key: string) {
        try {
            return this.redisClient.get(key);
        } catch (e) {
            this.logger.error(`Error occurred while getting: ${e.message}`);
            return null;
        }
    }

    async deleteKey(key: string) {
        try {
            return this.redisClient.del(key);
        } catch (e) {
            this.logger.error(`Error occurred while deleting: ${e.message}`);
            return 0;
        }
    }

    async incrementBy(key: string, increment: number) {
        try {
            return await this.redisClient.incrBy(key, increment);
        } catch (e) {
            this.logger.error(`Error occurred while incrementing: ${e.message}`);
            throw e;
        }
    }

    async incrementByThrottler(key: string, increment: number = 1, ttl?: number) {
        try {
            const value = await this.redisClient.incrBy(key, increment);
            if (ttl && value === increment) {
                // Only set TTL if this is the first increment
                await this.redisClient.expire(key, ttl);
            }
            return value;
        } catch (e) {
            this.logger.error(`Error occurred while incrementing in Redis: ${e.message}`);
            return 0;
        }
    }

    async decrementBy(key: string, decrement: number) {
        try {
            return await this.redisClient.decrBy(key, decrement);
        } catch (e) {
            this.logger.error(`Error occurred while decrementing: ${e.message}`);
            throw e;
        }
    }
}