import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import { 
  ServiceUnavailableException, 
  GatewayTimeoutException,
  ResourceNotFoundException
} from '../../core/exceptions';
import { 
  GenerateReportDto, ReportResponseDto, ReportType,
  ScheduleReportDto, SendNotificationDto, NotificationResponseDto,
  NotificationType, NotificationPriority
} from './dto';
import { PaginationDto, QueryFilterDto } from '../shared/dto';
import { RequestUtils, ResponseUtils } from '../shared/utils';
import { CacheService } from '../shared/services/cache.service';
import { CircuitBreakerService } from '../shared/services/circuit-breaker.service';
import { TelemetryService } from '../shared/services/telemetry.service';

/**
 * Service for Service B gateway - Reports & Notifications
 */
@Injectable()
export class ServiceBService {
  private readonly logger = new Logger(ServiceBService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly telemetryService: TelemetryService,
  ) {
    this.baseUrl = this.configService.get<string>('SERVICE_B_URL') || 'http://localhost:8002';
    this.apiKey = this.configService.get<string>('SERVICE_B_API_KEY') || '';
  }

  /**
   * Health check for Service B
   */
  async healthCheck() {
    try {
      const url = `${this.baseUrl}/health`;
      const { data } = await firstValueFrom(
        this.httpService.get(url).pipe(
          catchError(() => {
            throw new ServiceUnavailableException('Service B');
          }),
        ),
      );
      
      return { status: 'ok', service: 'service-b', timestamp: new Date().toISOString() };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw new ServiceUnavailableException('Service B');
    }
  }

  /**
   * Generate a new report
   * @param tenantId Tenant ID
   * @param reportDto Report generation parameters
   */
  async generateReport(tenantId: string, reportDto: GenerateReportDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, 'reports', { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-b',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_b_generate_report');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.post(url, reportDto, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            return ResponseUtils.standardizeResponse(data);
          } finally {
            stopTimer();
          }
        }
      );
    } catch (error) {
      this.logger.error(`Failed to generate report: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-b', 'GenerateReport', error.message);
      throw error;
    }
  }

  /**
   * Get a report by ID
   * @param tenantId Tenant ID
   * @param reportId Report ID
   */
  async getReportById(tenantId: string, reportId: string) {
    const cacheKey = this.cacheService.createCacheKey('service-b', tenantId, 'report', reportId);
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const url = RequestUtils.buildUrl(this.baseUrl, `reports/${reportId}`, { tenantId });
        const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
        const requestConfig = RequestUtils.createRequestConfig(headers);
        
        try {
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            'service-b',
            async () => {
              const stopTimer = this.telemetryService.startTimer('service_b_get_report');
              
              try {
                const { data } = await firstValueFrom(
                  this.httpService.get(url, requestConfig).pipe(
                    catchError(this.handleError),
                  ),
                );
                
                return ResponseUtils.standardizeResponse(data);
              } finally {
                stopTimer();
              }
            }
          );
        } catch (error) {
          this.logger.error(`Failed to get report: ${error.message}`, error.stack);
          this.telemetryService.recordError('service-b', 'GetReportById', error.message);
          
          if (error.message.includes('not found') || error.response?.status === 404) {
            throw new ResourceNotFoundException('report', reportId);
          }
          
          throw error;
        }
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Get all reports for a tenant
   * @param tenantId Tenant ID
   * @param paginationDto Pagination parameters
   * @param filterDto Filter parameters
   */
  async getAllReports(
    tenantId: string, 
    paginationDto: PaginationDto,
    filterDto: QueryFilterDto
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const { search, filter, sort } = filterDto;
    
    // Build query parameters
    const queryParams: Record<string, string | number> = {
      page,
      limit,
      tenantId,
    };
    
    if (search) {
      queryParams.search = search;
    }
    
    if (filter) {
      queryParams.filter = filter;
    }
    
    if (sort) {
      queryParams.sort = sort;
    }
    
    const url = RequestUtils.buildUrl(this.baseUrl, 'reports', queryParams);
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-b',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_b_get_all_reports');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.get(url, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            return ResponseUtils.standardizeResponse(data);
          } finally {
            stopTimer();
          }
        }
      );
    } catch (error) {
      this.logger.error(`Failed to get reports: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-b', 'GetAllReports', error.message);
      throw error;
    }
  }

  /**
   * Delete a report
   * @param tenantId Tenant ID
   * @param reportId Report ID
   */
  async deleteReport(tenantId: string, reportId: string): Promise<void> {
    const url = RequestUtils.buildUrl(this.baseUrl, `reports/${reportId}`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-b',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_b_delete_report');
          
          try {
            await firstValueFrom(
              this.httpService.delete(url, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
          } finally {
            stopTimer();
          }
        }
      );
      
      // Invalidate caches
      const reportCacheKey = this.cacheService.createCacheKey('service-b', tenantId, 'report', reportId);
      await this.cacheService.delete(reportCacheKey);
    } catch (error) {
      this.logger.error(`Failed to delete report: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-b', 'DeleteReport', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('report', reportId);
      }
      
      throw error;
    }
  }

  /**
   * Schedule a recurring report
   * @param tenantId Tenant ID
   * @param scheduleDto Report schedule parameters
   */
  async scheduleReport(tenantId: string, scheduleDto: ScheduleReportDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, 'reports/schedule', { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-b',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_b_schedule_report');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.post(url, scheduleDto, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            return ResponseUtils.standardizeResponse(data);
          } finally {
            stopTimer();
          }
        }
      );
    } catch (error) {
      this.logger.error(`Failed to schedule report: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-b', 'ScheduleReport', error.message);
      throw error;
    }
  }

  /**
   * Send a notification
   * @param tenantId Tenant ID
   * @param notificationDto Notification data
   */
  async sendNotification(tenantId: string, notificationDto: SendNotificationDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, 'notifications', { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-b',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_b_send_notification');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.post(url, notificationDto, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            return ResponseUtils.standardizeResponse(data);
          } finally {
            stopTimer();
          }
        }
      );
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-b', 'SendNotification', error.message);
      throw error;
    }
  }

  /**
   * Get a notification by ID
   * @param tenantId Tenant ID
   * @param notificationId Notification ID
   */
  async getNotificationById(tenantId: string, notificationId: string) {
    const cacheKey = this.cacheService.createCacheKey('service-b', tenantId, 'notification', notificationId);
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const url = RequestUtils.buildUrl(this.baseUrl, `notifications/${notificationId}`, { tenantId });
        const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
        const requestConfig = RequestUtils.createRequestConfig(headers);
        
        try {
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            'service-b',
            async () => {
              const stopTimer = this.telemetryService.startTimer('service_b_get_notification');
              
              try {
                const { data } = await firstValueFrom(
                  this.httpService.get(url, requestConfig).pipe(
                    catchError(this.handleError),
                  ),
                );
                
                return ResponseUtils.standardizeResponse(data);
              } finally {
                stopTimer();
              }
            }
          );
        } catch (error) {
          this.logger.error(`Failed to get notification: ${error.message}`, error.stack);
          this.telemetryService.recordError('service-b', 'GetNotificationById', error.message);
          
          if (error.message.includes('not found') || error.response?.status === 404) {
            throw new ResourceNotFoundException('notification', notificationId);
          }
          
          throw error;
        }
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Get all notifications for a tenant
   * @param tenantId Tenant ID
   * @param paginationDto Pagination parameters
   * @param filterDto Filter parameters
   */
  async getAllNotifications(
    tenantId: string, 
    paginationDto: PaginationDto,
    filterDto: QueryFilterDto
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const { search, filter, sort } = filterDto;
    
    // Build query parameters
    const queryParams: Record<string, string | number> = {
      page,
      limit,
      tenantId,
    };
    
    if (search) {
      queryParams.search = search;
    }
    
    if (filter) {
      queryParams.filter = filter;
    }
    
    if (sort) {
      queryParams.sort = sort;
    }
    
    const url = RequestUtils.buildUrl(this.baseUrl, 'notifications', queryParams);
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-b',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_b_get_all_notifications');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.get(url, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            return ResponseUtils.standardizeResponse(data);
          } finally {
            stopTimer();
          }
        }
      );
    } catch (error) {
      this.logger.error(`Failed to get notifications: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-b', 'GetAllNotifications', error.message);
      throw error;
    }
  }

  /**
   * Handle HTTP errors from Service B
   */
  private handleError = (error: any) => {
    // Handle connection timeouts
    if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      (error.message && (error.message.includes('timeout') || error.message.includes('Timeout')))
    ) {
      throw new GatewayTimeoutException();
    }

    // Handle connection errors
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      (error.message && error.message.includes('connect'))
    ) {
      throw new ServiceUnavailableException('Service B');
    }

    // Handle HTTP error responses
    if (error.response) {
      // Handle 404 errors specifically
      if (error.response.status === 404) {
        const resourceId = error.config.url.split('/').pop().split('?')[0];
        const resourceType = error.config.url.includes('reports') ? 'report' : 'notification';
        throw new ResourceNotFoundException(resourceType, resourceId);
      }
      
      throw error.response.data || {
        error: 'InternalServerError',
        message: 'Service B request failed',
        status: error.response.status || 500
      };
    }

    // Handle other errors
    throw error;
  }
}