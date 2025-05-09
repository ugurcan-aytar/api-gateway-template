import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerService } from './throttler.service';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { RESOURCE_KEY } from '../auth/decorators/auth.decorator';
import { SKIP_THROTTLE_KEY } from './decorators/skip-throttle-decorator';

@Injectable()
export class ThrottlerGuard implements CanActivate {
    private readonly logger = new Logger(ThrottlerGuard.name);

    constructor(
        private readonly throttlerService: ThrottlerService,
        private readonly reflector: Reflector
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if the endpoint is marked as public for rate limiting
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        // Check if throttling should be skipped for this endpoint
        const skipThrottle = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (skipThrottle) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Skip rate limiting for health check endpoint
        if (request.path === '/health' || request.path === '/api/health') {
            return true;
        }

        // Get client identifier (API key, user ID or IP)
        const headers = request.headers || {}; // Safely handle undefined headers
        const apiKey = headers['x-api-key'] as string;
        const user = request.user;
        // Use API key as identifier if available, otherwise use user ID or IP
        let identifier: string = apiKey ? `api-key:${apiKey}:${(request.ip || user?.id || 'anonymous')}` : (user?.id || request.ip || 'anonymous');
        identifier = identifier
            .replace(/:{2,}/g, ':').replace(/:$/, '')
            .replace(/^:/, '')
            .replace(/(^|:)ffff($|:)/g, '$1$2')
            .replace(/:{2,}/g, ':')
            .replace(/^:|:$/g, '');

        // Get HTTP method and resource type from request
        const method = request.method;
        const resource = this.reflector.get<string>(RESOURCE_KEY, context.getHandler());

        // Extract source service information
        const sourceService = user?.sourceService;
        const tenantName = user?.tenantName;
        const tenantId = user?.tenantId;

        // Enhanced logging with context
        if (sourceService) {
            this.logger.debug(`Service-to-service request from ${sourceService}: ${method} ${request.path}`);
        }

        // OPTIONAL: Tenant-level rate limiting for resource-intensive operations
        // Only apply if configured via environment variable to ensure backward compatibility
        const enableTenantRateLimits = process.env.ENABLE_TENANT_RATE_LIMITS === 'true';

        if (enableTenantRateLimits && tenantName && tenantId && this.isResourceIntensiveOperation(method, resource)) {
            const tenantKey = `tenant:${tenantName}:${tenantId}`;

            // Check tenant-level rate limits
            try {
                const tenantLimit = await this.throttlerService.checkRateLimit(
                    tenantKey,
                    method,
                    resource
                );

                if (tenantLimit.limited) {
                    this.logger.warn(`Tenant rate limit exceeded for ${tenantName} (ID: ${tenantId}) on ${method} ${request.path}`);
                    response.header('X-Tenant-RateLimit-Limit', tenantLimit.limit.toString());
                    response.header('X-Tenant-RateLimit-Remaining', tenantLimit.remaining.toString());
                    response.header('X-Tenant-RateLimit-Reset', tenantLimit.resetTime.toString());

                    throw new HttpException(
                        {
                            statusCode: HttpStatus.TOO_MANY_REQUESTS,
                            message: 'Tenant rate limit exceeded, please try again later.',
                            error: 'Too Many Requests'
                        },
                        HttpStatus.TOO_MANY_REQUESTS
                    );
                }
            } catch (error) {
                if (error instanceof HttpException) {
                    throw error;
                }
                // If there's an error checking tenant limits, log it but don't block the request
                this.logger.error(`Error checking tenant rate limits: ${error.message}`);
            }
        }

        // Regular rate limit check
        const { limited, limit, remaining, resetTime } = await this.throttlerService.checkRateLimit(
            identifier,
            method,
            resource
        );

        // Add rate limit headers to the response
        response.header('X-RateLimit-Limit', limit.toString());
        response.header('X-RateLimit-Remaining', remaining.toString());
        response.header('X-RateLimit-Reset', resetTime.toString());

        if (limited) {
            this.logger.warn(`Rate limit exceeded for ${identifier} on ${method} ${request.path}`);
            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Too many requests, please try again later.',
                    error: 'Too Many Requests'
                },
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        return true;
    }

    /**
     * Determines if an operation is resource-intensive and should have tenant-level rate limiting
     */
    private isResourceIntensiveOperation(method: string, resource?: string): boolean {
        const resourceIntensiveOps = [
            'POST:user',
            'POST:product',
            'POST:file',
            'POST:sync',
            'POST:data',
            'DELETE:data'
        ];

        return resource && resourceIntensiveOps.includes(`${method}:${resource}`);
    }
}