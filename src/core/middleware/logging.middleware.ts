import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: Request, res: Response, next: NextFunction) {
        const { ip, method, originalUrl } = req;
        const userAgent = req.get('user-agent') || '';

        // Create request ID if not present
        const requestId = req.headers['x-request-id'] as string || uuidv4();
        req.headers['x-request-id'] = requestId;

        // Start time
        const startTime = Date.now();

        // Log request
        this.logger.log(`[${requestId}] ${method} ${originalUrl} - ${ip} - ${userAgent}`);

        // Add response listener to log when completed
        res.on('finish', () => {
            const { statusCode } = res;
            const contentLength = res.get('content-length') || 0;
            const responseTime = Date.now() - startTime;

            if (statusCode >= 500) {
                this.logger.error(
                    `[${requestId}] ${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms`
                );
            } else if (statusCode >= 400) {
                this.logger.warn(
                    `[${requestId}] ${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms`
                );
            } else {
                this.logger.log(
                    `[${requestId}] ${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms`
                );
            }
        });

        next();
    }
}