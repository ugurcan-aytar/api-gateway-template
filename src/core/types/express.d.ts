import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                roles?: string[];
                tenantName?: string;
                [key: string]: any;
            };
        }
    }
}