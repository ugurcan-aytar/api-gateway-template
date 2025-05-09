import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthenticationProvider {
    private readonly logger = new Logger(AuthenticationProvider.name);
    private readonly authUrl: string;
    private readonly apiKeys: string[];

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.authUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:8005';
        this.logger.debug(`AUTH_SERVICE_URL is set to: ${this.authUrl}`);

        // Set up allowed API keys from configuration
        let apiKeysStr: string;
        try {
            apiKeysStr = this.configService.get<string>('STATIC_API_TOKEN') || '';
        } catch (error) {
            this.logger.warn(`Failed to get API keys: ${error.message}. Using default API key.`);
            apiKeysStr = 'default-api-key';
        }
        this.apiKeys = apiKeysStr.split(',').map(key => key.trim()).filter(Boolean);

        if (this.apiKeys.length === 0) {
            this.logger.warn('No API keys configured. API key authentication will not work properly.');
        }
    }

    /**
     * Validates a JWT token against the authentication service
     * @param token The JWT token to validate
     * @returns User data if token is valid
     * @throws UnauthorizedException if token is invalid
     */
    async validateToken(token: string): Promise<any> {
        try {
            this.logger.debug('Validating token with auth service');
            const response = await firstValueFrom(
                this.httpService.get(`${this.authUrl}/validate`, {
                    headers: {
                        'content-type': 'application/json',
                        Authorization: token,
                    },
                })
            );

            const userData = response.data;

            // Initialize with default empty array for roles
            userData.roles = userData.roles || [];

            return userData;
        } catch (error) {
            this.logger.error(`Token validation failed: ${error.message}`);
            if (error.response) {
                this.logger.error(`Auth service response: ${JSON.stringify(error.response.data)}`);
            }
            throw new UnauthorizedException('Invalid token');
        }
    }

    /**
     * Validates if an API key is allowed
     * @param apiKey The API key to validate
     * @returns true if API key is valid, false otherwise
     */
    validateApiKey(apiKey: string): boolean {
        return this.apiKeys.includes(apiKey);
    }

    /**
     * Validates if a user has permission to perform an action on a resource
     * @param userId The ID of the user
     * @param resource The resource being accessed (e.g., 'user', 'product')
     * @param action The action being performed (e.g., 'create', 'read', 'update', 'delete')
     * @param userRoles Array of roles assigned to the user
     * @param tenantName The tenant name for the request
     * @returns Boolean indicating if the user has permission
     */
    async validatePermissions(
        userId: string, 
        resource: string, 
        action: string, 
        userRoles: string[] = [], 
        tenantName?: string
    ): Promise<boolean> {
        try {
            this.logger.debug(`Validating permissions for user ${userId}, resource: ${resource}, action: ${action}, roles: ${userRoles}`);

            // If user has admin role, grant all permissions
            if (userRoles.includes('admin')) {
                return true;
            }

            // Define permission mapping for resources and actions
            const permissionMap = {
                'user': {
                    'create': ['admin'],
                    'read': ['user', 'admin'],
                    'update': ['admin'],
                    'delete': ['admin']
                },
                'product': {
                    'create': ['admin'],
                    'read': ['user', 'admin'],
                    'update': ['admin'],
                    'delete': ['admin']
                },
                'order': {
                    'create': ['user', 'admin'],
                    'read': ['user', 'admin'],
                    'update': ['admin'],
                    'delete': ['admin']
                },
                'report': {
                    'create': ['admin'],
                    'read': ['user', 'admin'],
                    'update': ['admin'],
                    'delete': ['admin']
                }
            };

            // Check if the resource exists in our permission map
            if (!permissionMap[resource]) {
                this.logger.warn(`Resource "${resource}" not found in permission map`);
                return false;
            }

            // Check if the action exists for this resource
            if (!permissionMap[resource][action]) {
                this.logger.warn(`Action "${action}" not found for resource "${resource}"`);
                return false;
            }

            // Check if any of the user's roles have permission for this resource/action
            const hasPermission = userRoles.some(role =>
                permissionMap[resource][action].includes(role)
            );

            this.logger.debug(`Permission check result: ${hasPermission ? 'Granted' : 'Denied'}`);
            return hasPermission;
        } catch (error) {
            this.logger.error(`Permission validation failed: ${error.message}`);
            return false;
        }
    }
}