import { Injectable, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import { 
  ServiceUnavailableException, 
  GatewayTimeoutException, 
  ResourceNotFoundException 
} from '../../core/exceptions';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { PaginationDto, QueryFilterDto } from '../shared/dto';
import { RequestUtils, ResponseUtils } from '../shared/utils';
import { CacheService } from '../shared/services/cache.service';
import { CircuitBreakerService } from '../shared/services/circuit-breaker.service';
import { TelemetryService } from '../shared/services/telemetry.service';

/**
 * Service for Service A gateway
 */
@Injectable()
export class ServiceAService {
  private readonly logger = new Logger(ServiceAService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly telemetryService: TelemetryService,
  ) {
    this.baseUrl = this.configService.get<string>('SERVICE_A_URL') || 'http://localhost:8001';
    this.apiKey = this.configService.get<string>('SERVICE_A_API_KEY') || '';
  }

  /**
   * Get all items from Service A
   * @param tenantId - The ID of the tenant
   * @param paginationDto - Pagination parameters
   * @param filterDto - Filter parameters
   * @returns The response from Service A
   */
  async getAllItems(
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
    
    const url = RequestUtils.buildUrl(this.baseUrl, 'items', queryParams);
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      // Use circuit breaker to prevent cascading failures
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-a',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_a_get_all_items');
          
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
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to get items: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-a', 'GetAllItems', error.message);
      
      throw new HttpException(
        { error: 'InternalServerError', message: 'Failed to get items' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get an item by ID from Service A
   * @param tenantId - The ID of the tenant
   * @param itemId - The ID of the item
   * @returns The response from Service A
   */
  async getItemById(tenantId: string, itemId: string) {
    // Create cache key for this item
    const cacheKey = this.cacheService.createCacheKey('service-a', tenantId, 'item', itemId);
    
    // Try to get from cache first
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const url = RequestUtils.buildUrl(this.baseUrl, `items/${itemId}`, { tenantId });
        const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
        const requestConfig = RequestUtils.createRequestConfig(headers);
        
        try {
          // Use circuit breaker to prevent cascading failures
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            'service-a',
            async () => {
              const stopTimer = this.telemetryService.startTimer('service_a_get_item_by_id');
              
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
          if (error instanceof HttpException) {
            throw error;
          }
          
          this.logger.error(`Failed to get item: ${error.message}`, error.stack);
          this.telemetryService.recordError('service-a', 'GetItemById', error.message);
          
          if (error.message.includes('not found') || error.response?.status === 404) {
            throw new ResourceNotFoundException('item', itemId);
          }
          
          throw new HttpException(
            { error: 'InternalServerError', message: 'Failed to get item' },
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Create a new item in Service A
   * @param tenantId - The ID of the tenant
   * @param itemData - The data for creating the item
   * @returns The response from Service A
   */
  async createItem(tenantId: string, itemData: CreateItemDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, 'items', { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);

    try {
      // Use circuit breaker to prevent cascading failures
      const result = await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-a',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_a_create_item');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.post(url, itemData, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            return ResponseUtils.standardizeResponse(data);
          } finally {
            stopTimer();
          }
        }
      );
      
      // Invalidate categories cache when a new item is created
      await this.cacheService.delete(this.cacheService.createCacheKey('service-a', tenantId, 'categories'));
      
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to create item: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-a', 'CreateItem', error.message);
      
      throw new HttpException(
        { error: 'InternalServerError', message: 'Failed to create item' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update an item in Service A
   * @param tenantId - The ID of the tenant
   * @param itemId - The ID of the item to update
   * @param updateData - The data for updating the item
   * @returns The response from Service A
   */
  async updateItem(tenantId: string, itemId: string, updateData: UpdateItemDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, `items/${itemId}`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);

    try {
      // Use circuit breaker to prevent cascading failures
      const result = await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-a',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_a_update_item');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.put(url, updateData, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            return ResponseUtils.standardizeResponse(data);
          } finally {
            stopTimer();
          }
        }
      );
      
      // Invalidate item cache
      const cacheKey = this.cacheService.createCacheKey('service-a', tenantId, 'item', itemId);
      await this.cacheService.delete(cacheKey);
      
      // If category was updated, invalidate categories cache
      if (updateData.category) {
        await this.cacheService.delete(this.cacheService.createCacheKey('service-a', tenantId, 'categories'));
      }
      
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to update item: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-a', 'UpdateItem', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('item', itemId);
      }
      
      throw new HttpException(
        { error: 'InternalServerError', message: 'Failed to update item' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete an item in Service A
   * @param tenantId - The ID of the tenant
   * @param itemId - The ID of the item to delete
   * @returns The response from Service A
   */
  async deleteItem(tenantId: string, itemId: string): Promise<void> {
    const url = RequestUtils.buildUrl(this.baseUrl, `items/${itemId}`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);

    try {
      // Use circuit breaker to prevent cascading failures
      await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-a',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_a_delete_item');
          
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
      const itemCacheKey = this.cacheService.createCacheKey('service-a', tenantId, 'item', itemId);
      const categoriesCacheKey = this.cacheService.createCacheKey('service-a', tenantId, 'categories');
      const statsCacheKey = this.cacheService.createCacheKey('service-a', tenantId, 'statistics');
      
      await Promise.all([
        this.cacheService.delete(itemCacheKey),
        this.cacheService.delete(categoriesCacheKey),
        this.cacheService.delete(statsCacheKey)
      ]);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to delete item: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-a', 'DeleteItem', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('item', itemId);
      }
      
      throw new HttpException(
        { error: 'InternalServerError', message: 'Failed to delete item' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get all categories in Service A
   * @param tenantId - The ID of the tenant
   * @returns The response from Service A
   */
  async getCategories(tenantId: string) {
    const cacheKey = this.cacheService.createCacheKey('service-a', tenantId, 'categories');
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const url = RequestUtils.buildUrl(this.baseUrl, 'categories', { tenantId });
        const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
        const requestConfig = RequestUtils.createRequestConfig(headers);
        
        try {
          // Use circuit breaker to prevent cascading failures
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            'service-a',
            async () => {
              const stopTimer = this.telemetryService.startTimer('service_a_get_categories');
              
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
          if (error instanceof HttpException) {
            throw error;
          }
          
          this.logger.error(`Failed to get categories: ${error.message}`, error.stack);
          this.telemetryService.recordError('service-a', 'GetCategories', error.message);
          
          throw new HttpException(
            { error: 'InternalServerError', message: 'Failed to get categories' },
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      },
      600 // Cache for 10 minutes
    );
  }

  /**
   * Get item statistics in Service A
   * @param tenantId - The ID of the tenant
   * @returns The response from Service A
   */
  async getStatistics(tenantId: string) {
    const cacheKey = this.cacheService.createCacheKey('service-a', tenantId, 'statistics');
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const url = RequestUtils.buildUrl(this.baseUrl, 'statistics', { tenantId });
        const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
        const requestConfig = RequestUtils.createRequestConfig(headers);
        
        try {
          // Use circuit breaker to prevent cascading failures
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            'service-a',
            async () => {
              const stopTimer = this.telemetryService.startTimer('service_a_get_statistics');
              
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
          if (error instanceof HttpException) {
            throw error;
          }
          
          this.logger.error(`Failed to get statistics: ${error.message}`, error.stack);
          this.telemetryService.recordError('service-a', 'GetStatistics', error.message);
          
          throw new HttpException(
            { error: 'InternalServerError', message: 'Failed to get statistics' },
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Handle HTTP errors from Service A
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
      throw new ServiceUnavailableException('Service A');
    }

    // Handle HTTP error responses
    if (error.response) {
      // Handle 404 errors specifically
      if (error.response.status === 404) {
        const resourceId = error.config.url.split('/').pop().split('?')[0];
        throw new ResourceNotFoundException('item', resourceId);
      }
      
      throw new HttpException(
        error.response.data || { error: 'Unknown error', message: 'Service A request failed' },
        error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Handle other errors
    throw new HttpException(
      { error: 'InternalServerError', message: 'Service A request failed' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}