import { Controller, Get, HttpCode, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './core/auth/decorators/public.decorator';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);
    constructor(private readonly appService: AppService) { }

    @Get()
    getServiceInfo() {
        return this.appService.getServiceInfo();
    }

    @Get('health')
    @HttpCode(200)
    @Public()
    getHealthCheck() {
        return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
    }

    @Get('system-check')
    @HttpCode(200)
    @Public()
    getSystemHealthCheck() {
        return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
    }

    @Get('system-check-key')
    @HttpCode(200)
    getSystemHealthCheckWithKey() {
        // This endpoint requires authentication
        return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
    }
}