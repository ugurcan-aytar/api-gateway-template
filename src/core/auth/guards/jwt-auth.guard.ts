import { Injectable, ExecutionContext, UnauthorizedException, Logger, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationProvider } from '../auth.provider';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    private readonly logger = new Logger(JwtAuthGuard.name);

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

        const request = context.switchToHttp().getRequest();
        const path = request.path;

        // Skip authentication for health check endpoint
        if (path === '/health' || path === '/api/health') {
            return true;
        }

        // Check if the user is already authenticated (e.g., by the API key guard)
        if (request.user && request.user.roles) {
            this.logger.debug(`User already authenticated with roles: ${JSON.stringify(request.user.roles)}`);
            return true;
        }

        const authHeader = request.headers.authorization;
        const tenantId = request.headers.tenantid;

        if (!authHeader) {
            this.logger.debug('No authorization header found');
            throw new UnauthorizedException('Missing authorization token');
        }

        if (!tenantId) {
            this.logger.debug('No tenant ID header found');
            throw new UnauthorizedException('Missing tenant ID header');
        }

        try {
            const userData = await this.authService.validateToken(authHeader);
            this.logger.debug('Token validated successfully');

            // Check if user has access to specified tenant
            if (!userData.userAccess || !Array.isArray(userData.userAccess)) {
                this.logger.debug('User has no access entries');
                throw new UnauthorizedException('Access denied');
            }

            // Find access for the specified tenant
            const tenantAccess = userData.userAccess.find(access => access.tenantId === tenantId);
            if (!tenantAccess) {
                this.logger.debug(`User does not have access to tenant: ${tenantId}`);
                throw new UnauthorizedException(`Access denied for tenant: ${tenantId}`);
            }

            // Set user role based on tenant access type
            const roles = tenantAccess.type === 'ADMIN' ? ['admin'] : ['user'];
            const tenantName = tenantAccess.tenantName || request.params.tenantName || request.body?.tenantName || request.query?.tenantName || userData.tenantName;

            // Explicitly set roles for the user
            userData.roles = roles;

            // Set user information in request
            request.user = {
                id: userData.userId || 'unknown',
                tenantId: tenantId,
                tenantName: tenantName || 'unknown',
                roles: roles,
                ...userData
            };

            this.logger.debug(`Authenticated user: ${request.user.id} with roles: ${JSON.stringify(request.user.roles)} for tenant: ${request.user.tenantName}`);
            return true;
        } catch (error) {
            this.logger.error(`Token validation failed: ${error.message}`, error.stack);
            throw new UnauthorizedException('Invalid token');
        }
    }
}