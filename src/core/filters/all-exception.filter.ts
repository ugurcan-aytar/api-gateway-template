import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseException } from '../exceptions/base.exception';

/**
 * Global exception filter to handle all exceptions in a standardized way
 * following the technical design error handling requirements.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    /**
     * Catches and handles all exceptions to provide standardized error responses
     */
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Default error structure
        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let errorResponse: any = {
            error: 'InternalServerError',
            message: 'An unexpected error occurred.',
            timestamp: new Date().toISOString(),
            path: request.url
        };

        // Handle custom BaseException instances
        if (exception instanceof BaseException) {
            const exceptionResponse = exception.getResponse() as any;
            status = exception.getStatus();

            // Use the structured error format from our custom exception
            errorResponse = {
                ...exceptionResponse,
                timestamp: new Date().toISOString(),
                path: request.url
            };
        }
        // Handle standard HttpExceptions from NestJS
        else if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse() as any;

            // Format the error according to our API standards
            if (typeof exceptionResponse === 'object') {
                // Get specific error type from response or fallback to status mapping
                let errorType = exceptionResponse.error || this.getErrorTypeFromStatus(status);

                // Convert Bad Request error to proper format
                if (errorType === 'Bad Request') {
                    errorType = 'BadRequest';
                }

                errorResponse = {
                    error: errorType,
                    message: exceptionResponse.message || this.getDefaultMessageForStatus(status),
                    timestamp: new Date().toISOString(),
                    path: request.url
                };

                // Include validation errors if present
                if (exceptionResponse.validationErrors) {
                    errorResponse.validationErrors = exceptionResponse.validationErrors;
                }

                // Include error code if available
                if (exceptionResponse.errorCode) {
                    errorResponse.errorCode = exceptionResponse.errorCode;
                }
            } else {
                const errorType = this.getErrorTypeFromStatus(status);
                errorResponse = {
                    error: errorType,
                    message: exceptionResponse || this.getDefaultMessageForStatus(status),
                    timestamp: new Date().toISOString(),
                    path: request.url
                };
            }
        }
        // Handle specific error types from external APIs
        else if (exception instanceof Error) {
            // Try to parse API errors (usually from axios catch blocks)
            const err = exception as any;
            // Handle timeout errors specifically
            if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' ||
                (err.message && (err.message.includes('timeout') || err.message.includes('Timeout')))) {
                status = HttpStatus.GATEWAY_TIMEOUT;
                errorResponse = {
                    error: 'GatewayTimeout',
                    message: 'The server did not receive a timely response from an upstream server.',
                    errorCode: 'ERR_GATEWAY_TIMEOUT',
                    timestamp: new Date().toISOString(),
                    path: request.url
                };
            }
            // Handle connection errors
            else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ||
                (err.message && err.message.includes('connect'))) {
                status = HttpStatus.SERVICE_UNAVAILABLE;
                errorResponse = {
                    error: 'ServiceUnavailable',
                    message: 'The service is currently unavailable. Please try again later.',
                    errorCode: 'ERR_SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                    path: request.url
                };
            }
            else if (err.response && err.response.data) {
                status = err.response.status || HttpStatus.INTERNAL_SERVER_ERROR;

                // Directly use API error format if available
                if (err.response.data.error && err.response.data.message) {
                    if (err.response.data.error === 'Bad Request') {
                        err.response.data.error = 'BadRequest';
                    }

                    errorResponse = {
                        ...err.response.data,
                        timestamp: new Date().toISOString(),
                        path: request.url
                    };
                } else {
                    const errorType = this.getErrorTypeFromStatus(status);
                    errorResponse = {
                        error: errorType,
                        message: err.response.data.message || err.message || this.getDefaultMessageForStatus(status),
                        timestamp: new Date().toISOString(),
                        path: request.url
                    };
                }
            } else {
                errorResponse = {
                    error: 'UnexpectedError',
                    message: err.message,
                    timestamp: new Date().toISOString(),
                    path: request.url
                };
            }
        }

        if (errorResponse && errorResponse.error === 'Bad Request') {
            errorResponse.error = 'BadRequest';
        }

        // Special handling for payload too large errors
        if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
            errorResponse = {
                error: 'PayloadTooLarge',
                message: 'File size exceeds the limit.',
                errorCode: 'ERR_PAYLOAD_TOO_LARGE',
                timestamp: new Date().toISOString(),
                path: request.url
            };
        }

        // Add request ID for better tracking if available
        if (request.headers['x-request-id']) {
            errorResponse.requestId = request.headers['x-request-id'];
        }

        // Log the error with contextual information
        const method = request.method;
        const url = request.url;
        const userAgent = request.get('user-agent') || 'unknown';
        const ip = request.ip || 'unknown';

        if (status >= 500) {
            this.logger.error(
                `[ERROR] ${method} ${url} - Status ${status} - ${errorResponse.message}`,
                {
                    exception,
                    ip,
                    userAgent,
                    requestBody: this.sanitizeRequestBody(request.body),
                }
            );
        } else if (status >= 400) {
            this.logger.warn(
                `[WARN] ${method} ${url} - Status ${status} - ${errorResponse.message}`,
                {
                    ip,
                    userAgent,
                }
            );
        } else {
            this.logger.log(
                `[INFO] ${method} ${url} - Status ${status} - ${errorResponse.message}`
            );
        }

        response
            .status(status)
            .json(errorResponse);
    }

    /**
     * Maps HTTP status codes to human-readable error types
     * Only used as a fallback when no specific error code is provided
     */
    private getErrorTypeFromStatus(status: number): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'BadRequest';
            case HttpStatus.UNAUTHORIZED:
                return 'Unauthorized';
            case HttpStatus.FORBIDDEN:
                return 'Forbidden';
            case HttpStatus.NOT_FOUND:
                return 'NotFound';
            case HttpStatus.CONFLICT:
                return 'Conflict';
            case HttpStatus.UNPROCESSABLE_ENTITY:
                return 'ValidationError';
            case HttpStatus.TOO_MANY_REQUESTS:
                return 'TooManyRequests';
            case HttpStatus.GATEWAY_TIMEOUT:
                return 'GatewayTimeout';
            case HttpStatus.PAYLOAD_TOO_LARGE:
                return 'PayloadTooLarge';
            case HttpStatus.SERVICE_UNAVAILABLE:
                return 'ServiceUnavailable';
            default:
                return 'InternalServerError';
        }
    }

    /**
     * Returns default error messages for different HTTP status codes
     */
    private getDefaultMessageForStatus(status: number): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'The request was malformed or contained invalid parameters.';
            case HttpStatus.UNAUTHORIZED:
                return 'Authentication is required to access this resource.';
            case HttpStatus.FORBIDDEN:
                return 'You do not have permission to access this resource.';
            case HttpStatus.NOT_FOUND:
                return 'The requested resource could not be found.';
            case HttpStatus.CONFLICT:
                return 'The request could not be completed due to a conflict with the current state of the resource.';
            case HttpStatus.UNPROCESSABLE_ENTITY:
                return 'The request was well-formed but contained invalid fields.';
            case HttpStatus.TOO_MANY_REQUESTS:
                return 'Too many requests have been sent in a given amount of time.';
            case HttpStatus.GATEWAY_TIMEOUT:
                return 'The server did not receive a timely response from an upstream server.';
            case HttpStatus.SERVICE_UNAVAILABLE:
                return 'The service is currently unavailable. Please try again later.';
            case HttpStatus.PAYLOAD_TOO_LARGE:
                return 'File size exceeds the limit.';
            default:
                return 'An unexpected error occurred while processing the request.';
        }
    }

    /**
     * Sanitize request body for logging to avoid sensitive data exposure
     */
    private sanitizeRequestBody(body: any): any {
        if (!body) return {};

        const sanitized = { ...body };

        // Sanitize sensitive fields
        if (sanitized.data_base64) {
            sanitized.data_base64 = '[REDACTED]';
        }

        if (sanitized.password) {
            sanitized.password = '[REDACTED]';
        }

        if (sanitized.apiKey || sanitized.api_key) {
            sanitized.apiKey = '[REDACTED]';
            sanitized.api_key = '[REDACTED]';
        }

        return sanitized;
    }
}