import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Thrown when a service is unavailable
 */
export class ServiceUnavailableException extends BaseException {
    constructor(service?: string) {
        const serviceMsg = service ? `${service} service` : 'service';
        super(
            'ServiceUnavailable',
            `The ${serviceMsg} is currently unavailable. Please try again later.`,
            HttpStatus.SERVICE_UNAVAILABLE,
            'ERR_SERVICE_UNAVAILABLE'
        );
    }
}

/**
 * Thrown when a request times out
 */
export class GatewayTimeoutException extends BaseException {
    constructor() {
        super(
            'GatewayTimeout',
            'The server did not receive a timely response from an upstream server.',
            HttpStatus.GATEWAY_TIMEOUT,
            'ERR_GATEWAY_TIMEOUT'
        );
    }
}