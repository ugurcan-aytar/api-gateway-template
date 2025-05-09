import { Injectable, ExecutionContext, UnauthorizedException, Logger, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationProvider } from '../auth.provider';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Request } from 'express';
import { RESOURCE_KEY, ACTION_KEY } from '../decorators/auth.decorator';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
    private readonly logger = new Logger(ApiKeyAuthGuard.name);

    constructor(
        private readonly authService: AuthenticationProvider,
        private readonly reflector: Reflector
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if the endpoint is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const path = request.path;

        // Skip authentication for health check endpoint
        if (path === '/health' || path === '/api/health' || path.endsWith('/health')) {
            return true;
        }

        // Extract headers
        const apiKey = request.headers['x-api-key'] as string;
        const authHeader = request.headers.authorization;
        const userEmail = request.headers['x-user-email'] as string;
        const userRole = request.headers['x-user-role'] as string;
        const tenantName = request.headers['x-tenant-name'] as string;
        const tenantId = request.headers['x-tenant-id'] as string;
        const clientIp = request.headers['x-forwarded-for'] as string;
        const acceptLang = request.headers['x-accept-language'] as string;
        const requestId = request.headers['x-request-id'] as string || `api-gateway:${tenantName}:${Date.now()}`
        const sourceService = request.headers['x-source-service'] as string;

        // Store original headers for potential outgoing requests
        request['originalHeaders'] = {
            'x-api-key': apiKey,
            'x-user-email': userEmail,
            'x-user-role': userRole,
            'x-tenant-name': tenantName,
            'x-tenant-id': tenantId,
            'x-request-id': requestId,
            'x-forwarded-for': clientIp,
            'x-accept-language': acceptLang
        };

        // If there's an Authorization header but no API key, let JWT guard handle it
        if (authHeader && !apiKey) {
            this.logger.debug('Found Authorization header but no API key, letting JWT guard handle authentication');
            return true;
        }

        // If no API key is present, reject the request
        if (!apiKey) {
            this.logger.debug('No API key found');
            throw new UnauthorizedException('Missing API key');
        }

        // Validate the API key
        const isValidApiKey = this.authService.validateApiKey(apiKey);
        if (!isValidApiKey) {
            this.logger.debug(`Invalid API key provided: ${apiKey}`);
            throw new UnauthorizedException('Invalid API key');
        }

        // Check the type of request
        if (sourceService === 'service-b') {
            // This is a request from Service B
            this.logger.debug(`Service-to-service call from Service B`);

            if (userEmail && userRole && tenantName) {
                // Use the forwarded user context
                request.user = {
                    id: `api-gateway:${userEmail}`,
                    email: userEmail,
                    tenantName: tenantName,
                    tenantId: tenantId,
                    roles: [userRole],
                    requestId: requestId,
                    acceptLanguage: acceptLang || 'en-US',
                    sourceService: 'service-b'
                };

                this.logger.debug(`Using forwarded user context from Service B: ${userEmail}, role: ${userRole}`);
            } else {
                // Service call without user context
                request.user = {
                    id: requestId,
                    tenantName: 'service-b',
                    tenantId: 'service-b',
                    roles: ['admin'],
                    requestId: requestId,
                    sourceService: 'service-b'
                };

                this.logger.debug(`Service call from Service B without user context`);
            }
        } else if (userEmail && userRole && tenantName && tenantId) {
            // This is a request from Gateway with user context
            request.user = {
                id: `api-gateway:${userEmail}`,
                email: userEmail,
                tenantName: tenantName,
                tenantId: tenantId,
                roles: [userRole],
                clientIp: clientIp,
                acceptLanguage: acceptLang || 'en-US',
                requestId: requestId,
                sourceService: sourceService ? sourceService : 'gateway'
            };

            this.logger.debug(`Request for user: ${userEmail}, role: ${userRole}, tenant: ${tenantName}`);
        } else {
            // Direct API key access
            const tenantNameFromRequest = request.params.tenantName ||
                request.body?.tenantName ||
                request.query?.tenantName as string;

            request.user = {
                id: requestId,
                tenantName: tenantNameFromRequest || 'direct-api-access',
                tenantId: tenantNameFromRequest || 'direct-api-access',
                roles: ['admin'],  // Give direct API keys admin privileges by default
                requestId: requestId,
                sourceService: sourceService ? sourceService : 'direct-api-access',
            };

            this.logger.debug(`Direct API key access validated for tenant: ${tenantNameFromRequest || 'direct-api-access'}`);
        }

        this.logger.debug(`API key validated successfully`);

        // Extra validation to match the RolesGuard behavior
        const resource = this.reflector.get<string>(RESOURCE_KEY, context.getHandler());
        const action = this.reflector.get<string>(ACTION_KEY, context.getHandler());
        if (resource && action) {
            const hasPermission = await this.authService.validatePermissions(
                request.user.id,
                resource,
                action,
                request.user.roles,
                request.user.tenantName
            );
            if (!hasPermission) {
                this.logger.debug(`Permission denied for ${resource}/${action} with API key auth`);
                return false; // This will cause a 403 Forbidden response
            }
        }

        return true;
    }
}