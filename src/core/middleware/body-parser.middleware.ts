import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BodyParserMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Set default empty object for PUT requests without a body
        if (req.method === 'PUT' && (!req.body || Object.keys(req.body).length === 0)) {
            req.body = {};
        }
        next();
    }
}