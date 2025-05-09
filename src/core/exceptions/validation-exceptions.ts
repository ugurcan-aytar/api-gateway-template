import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Thrown when request validation fails
 */
export class ValidationException extends BaseException {
    constructor(message: string, validationErrors?: Record<string, any>[]) {
        super(
            'ValidationError',
            message,
            HttpStatus.UNPROCESSABLE_ENTITY,
            'ERR_VALIDATION_FAILED',
            validationErrors
        );
    }
}

/**
 * Thrown specifically for invalid file uploads
 */
export class InvalidFileException extends BaseException {
    constructor(message: string) {
        super(
            'InvalidFile',
            message,
            HttpStatus.BAD_REQUEST,
            'ERR_INVALID_FILE'
        );
    }
}

/**
 * Thrown for invalid content
 */
export class InvalidContentException extends BaseException {
    constructor() {
        super(
            'InvalidContent',
            'The provided content is not valid',
            HttpStatus.BAD_REQUEST,
            'ERR_INVALID_CONTENT'
        );
    }
}

/**
 * Thrown for invalid file names
 */
export class InvalidFileNameException extends BaseException {
    constructor() {
        super(
            'InvalidFileName',
            'File must have a valid extension',
            HttpStatus.BAD_REQUEST,
            'ERR_INVALID_FILENAME'
        );
    }
}

/**
 * Thrown when a file is too large
 */
export class FileTooLargeException extends BaseException {
    constructor() {
        super(
            'FileTooLarge',
            'File size exceeds the limit.',
            HttpStatus.PAYLOAD_TOO_LARGE,
            'ERR_FILE_TOO_LARGE'
        );
    }
}