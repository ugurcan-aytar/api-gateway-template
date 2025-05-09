import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

interface RateLimitResult {
    limited: boolean;
    current: number;
    limit: number;
    remaining: number;
    resetTime: number;
}

@Injectable()
export class ThrottlerService {
    private readonly logger = new Logger(ThrottlerService.name);
    private readonly defaultTtl: number;
    private readonly defaultLimit: number;

    // Special limits for different endpoints or methods
    private readonly limitMap: Record<string, number> = {};
    private readonly ttlMap: Record<string, number> = {};

    constructor(
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
    ) {
        // Get configuration from environment or use reasonable defaults
        // Default TTL in seconds and request limit count
        this.defaultTtl = parseInt(this.configService.get<string>('THROTTLE_TTL') || '60');
        this.defaultLimit = parseInt(this.configService.get<string>('THROTTLE_LIMIT') || '60');

        // Configure specific rate limits by operation
        this.limitMap = {
            // Example rate limits for different operations
            'POST:user': 5,             // User creation (lower than default)
            'PUT:user': 10,             // User modification
            'POST:product': 5,          // Product creation
            'PUT:product': 10,          // Product modification
            'POST:file': 10,            // File upload
            'PUT:file': 15,             // File modification
            'POST:function': 15,        // Function creation
            'PUT:function': 20,         // Function modification
            'DELETE:function': 10,      // Function deletion
            'POST:version': 5,          // Version deployment
            'DELETE:version': 5,        // Version deletion
            // API rate limits
            'POST:data': 20,            // Data upload
            'DELETE:data': 10,          // Data deletion
            // Chat API rate limits
            'POST:chat': 60,            // Chat interactions (higher limit for user experience)
            // Default limits
            'GET': this.defaultLimit,   // Read operations have higher limit
            'DELETE': 20,               // Generic delete operations
        };

        // Configure specific TTLs (in seconds) for rate limiting windows
        this.ttlMap = {
            // TTLs for different operations
            'POST:user': this.defaultTtl,            // 1 minute window for user creation
            'PUT:user': this.defaultTtl,             // 1 minute for user modification
            'POST:product': this.defaultTtl,         // 1 minute for product creation
            'PUT:product': this.defaultTtl,          // 1 minute for product modification
            'POST:file': this.defaultTtl,            // 1 minute for file upload
            'PUT:file': this.defaultTtl,             // 1 minute for file modification
            'POST:function': this.defaultTtl,        // 1 minute for function creation
            'PUT:function': this.defaultTtl,         // 1 minute for function modification
            'DELETE:function': this.defaultTtl,      // 1 minute for function deletion
            'POST:version': this.defaultTtl,         // 1 minute for deployment
            'DELETE:version': this.defaultTtl,       // 1 minute for version deletion
            // Data API TTLs
            'POST:data': this.defaultTtl,            // 1 minute for data upload
            'DELETE:data': this.defaultTtl,          // 1 minute for data deletion
            // Sync API TTLs
            'POST:sync': this.defaultTtl * 2,        // 2 minute window for sync (resource intensive)
            // Chat API TTLs
            'POST:chat': this.defaultTtl,            // 1 minute for chat
            // Default TTLs
            'GET': this.defaultTtl,                  // 1 minute for read operations 
            'DELETE': this.defaultTtl * 2,           // 2 minutes for delete operations
        };
    }

    /**
     * Checks if a request should be rate limited
     * @param key The key to use for rate limiting (usually user ID or IP address)
     * @param method The HTTP method being used
     * @param resource The resource being accessed
     * @returns Object with rate limit info
     */
    async checkRateLimit(key: string, method: string, resource?: string): Promise<RateLimitResult> {
        // Determine the appropriate limit and TTL
        let limit = this.defaultLimit;
        let ttl = this.defaultTtl;

        // Check for specific method + resource limits
        if (resource && this.limitMap[`${method}:${resource}`]) {
            limit = this.limitMap[`${method}:${resource}`];
            ttl = this.ttlMap[`${method}:${resource}`] || this.defaultTtl;
        }
        // Check for method-specific limits
        else if (this.limitMap[method]) {
            limit = this.limitMap[method];
            ttl = this.ttlMap[method] || this.defaultTtl;
        }

        try {
            // Generate Redis key
            const redisKey = this.generateKey(key, method, resource, ttl);

            // Increment counter in Redis and retrieve current value
            const current = await this.redisService.incrementByThrottler(redisKey, 1, ttl);

            // Calculate time when limit resets
            const resetTime = Math.ceil(Date.now() / 1000) + ttl;

            // Calculate remaining requests
            const remaining = Math.max(0, limit - current);

            return {
                limited: current > limit,
                current,
                limit,
                remaining,
                resetTime
            };
        } catch (error) {
            this.logger.error(`Error checking rate limit: ${error.message}`);
            // Fail open in case of Redis errors
            return {
                limited: false,
                current: 0,
                limit,
                remaining: limit,
                resetTime: Math.ceil(Date.now() / 1000) + ttl
            };
        }
    }

    /**
     * Generates a Redis key for rate limiting
     * @param identifier User ID or IP address
     * @param method HTTP method
     * @param resource Optional resource being accessed
     * @param ttl Time-to-live in seconds
     * @returns Generated key
     */
    private generateKey(identifier: string, method: string, resource?: string, ttl?: number): string {
        const resourcePart = resource ? `:${resource}` : '';
        const period = ttl ? Math.floor(Date.now() / (ttl * 1000)) : Math.floor(Date.now() / (this.defaultTtl * 1000));
        return `api-gateway:${identifier}:${method}${resourcePart}:${period}`;
    }

    /**
     * Gets the TTL for a specific method and resource
     */
    getTtl(method: string, resource?: string): number {
        if (resource && this.ttlMap[`${method}:${resource}`]) {
            return this.ttlMap[`${method}:${resource}`];
        }

        if (this.ttlMap[method]) {
            return this.ttlMap[method];
        }

        return this.defaultTtl;
    }

    /**
     * Gets the limit for a specific method and resource
     */
    getLimit(method: string, resource?: string): number {
        if (resource && this.limitMap[`${method}:${resource}`]) {
            return this.limitMap[`${method}:${resource}`];
        }

        if (this.limitMap[method]) {
            return this.limitMap[method];
        }

        return this.defaultLimit;
    }
}