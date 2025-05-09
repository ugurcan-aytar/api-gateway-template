import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getServiceInfo(): Record<string, any> {
        return {
            name: 'API Gateway Template',
            version: '1.0.0',
            description: 'Production-ready API Gateway with authentication, rate-limiting, and more',
            services: {
                'service-a': 'Service A Integration',
                'service-b': 'Service B Integration',
                'service-c': 'Service C Integration'
            }
        };
    }
}