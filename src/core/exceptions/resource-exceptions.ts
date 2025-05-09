import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Thrown when a resource is not found
 */
export class ResourceNotFoundException extends BaseException {
    constructor(resourceType: string, identifier: string) {
        super(
            'NotFound',
            `The ${resourceType} with identifier ${identifier} could not be found.`,
            HttpStatus.NOT_FOUND,
            'ERR_RESOURCE_NOT_FOUND'
        );
    }
}

/**
 * Thrown when a resource limit has been exceeded
 */
export class ResourceLimitExceededException extends BaseException {
    constructor(resourceType: string, limit: number) {
        super(
            `${resourceType}LimitExceeded`,
            `The ${resourceType} has reached the maximum limit of ${limit}.`,
            HttpStatus.FORBIDDEN,
            'ERR_RESOURCE_LIMIT_EXCEEDED'
        );
    }
}

/**
 * Thrown when a resource already exists and can't be created
 */
export class ResourceConflictException extends BaseException {
    constructor(resourceType: string, identifier: string) {
        super(
            'Conflict',
            `The ${resourceType} with identifier ${identifier} already exists.`,
            HttpStatus.CONFLICT,
            'ERR_RESOURCE_CONFLICT'
        );
    }
}