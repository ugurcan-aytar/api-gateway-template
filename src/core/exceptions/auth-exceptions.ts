import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Thrown when authentication fails
 */
export class AuthenticationException extends BaseException {
    constructor(message: string = 'Authentication failed.') {
        super(
            'Unauthorized',
            message,
            HttpStatus.UNAUTHORIZED,
            'ERR_AUTHENTICATION_FAILED'
        );
    }
}

/**
 * Thrown when a user lacks permission for an operation
 */
export class ForbiddenException extends BaseException {
    constructor(resource: string, action: string) {
        super(
            'Forbidden',
            `You don't have permission to ${action} this ${resource}`,
            HttpStatus.FORBIDDEN,
            'ERR_INSUFFICIENT_PERMISSIONS'
        );
    }
}