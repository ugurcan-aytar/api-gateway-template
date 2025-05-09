import { HttpException, HttpStatus } from '@nestjs/common';

export class ErrorUtils {
  /**
   * Create a standardized error object 
   */
  static createErrorResponse(
    errorType: string,
    message: string,
    errorCode?: string,
    details?: Record<string, any>
  ): Record<string, any> {
    const errorResponse: Record<string, any> = {
      error: errorType,
      message,
    };

    if (errorCode) {
      errorResponse.errorCode = errorCode;
    }

    if (details) {
      errorResponse.details = details;
    }

    return errorResponse;
  }

  /**
   * Map error status codes to error types
   */
  static getErrorTypeFromStatus(status: number): string {
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
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'ServiceUnavailable';
      default:
        return 'InternalServerError';
    }
  }
}