import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Thrown when rate limit is exceeded
 */
export class RateLimitExceededException extends BaseException {
    constructor(scope: string = 'request', resetTime?: number) {
        let message = `Too many ${scope}s, please try again later.`;
        if (resetTime) {
            message += ` Rate limit resets at ${new Date(resetTime * 1000).toISOString()}`;
        }

        super(
            'TooManyRequests',
            message,
            HttpStatus.TOO_MANY_REQUESTS,
            'ERR_RATE_LIMIT_EXCEEDED'
        );
    }
}