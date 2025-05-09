import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception class for all domain-specific exceptions
 * Provides consistent error structure across the application
 */
export class BaseException extends HttpException {
    constructor(
        errorType: string,
        message: string,
        statusCode: HttpStatus,
        errorCode?: string,
        validationErrors?: Record<string, any>[]
    ) {
        const response: any = {
            error: errorType,
            message,
        };

        if (errorCode) {
            response.errorCode = errorCode;
        }

        if (validationErrors) {
            response.validationErrors = validationErrors;
        }

        super(response, statusCode);
    }
}