import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationProvider } from '../auth.provider';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);

    constructor(
        private reflector: Reflector,
        private readonly authService: AuthenticationProvider,
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

        const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
        this.logger.debug(`Required roles: ${JSON.stringify(requiredRoles)}`);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true; // No roles required, allow access
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            this.logger.warn('User not found in request');
            throw new ForbiddenException('User not authenticated');
        }

        // Log the actual user object to debug
        this.logger.debug(`User object: ${JSON.stringify(user)}`);

        // Ensure roles is at least an empty array, but don't overwrite if already set
        if (!user.roles) {
            this.logger.warn('User roles not found, setting to empty array');
            user.roles = [];
        }

        this.logger.debug(`User roles: ${JSON.stringify(user.roles)}`);
        this.logger.debug(`Required roles: ${JSON.stringify(requiredRoles)}`);

        // Check if the user has any of the required roles
        const hasRequiredRole = requiredRoles.some(role => user.roles.includes(role));
        this.logger.debug(`User has required role: ${hasRequiredRole}`);

        if (hasRequiredRole) {
            return true;
        }

        // If no direct role match, check resource-based permissions
        const resource = this.reflector.get<string>('resource', context.getHandler());
        const action = this.reflector.get<string>('action', context.getHandler());
        this.logger.debug(`Resource: ${resource}, Action: ${action}`);

        if (!resource || !action) {
            this.logger.warn(`Missing resource or action metadata for route: ${request.path}`);
            return false;
        }

        // Check permission
        const hasPermission = await this.authService.validatePermissions(
            user.id,
            resource,
            action,
            user.roles,
            user.tenantName
        );

        this.logger.debug(`Has permission: ${hasPermission}`);

        if (!hasPermission) {
            throw new ForbiddenException(`You don't have permission to ${action} this ${resource}`);
        }

        return true;
    }
}