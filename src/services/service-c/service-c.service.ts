import { Injectable, Logger, NotFoundException, BadRequestException, StreamableFile } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import { Readable } from 'stream';
import { 
  ServiceUnavailableException, 
  GatewayTimeoutException,
  ResourceNotFoundException
} from '../../core/exceptions';
import { 
  FileMetadataDto, UploadFileMetadataDto, UpdateFileMetadataDto, FileType,
  FolderDto, CreateFolderDto, UpdateFolderDto
} from './dto';
import { PaginationDto, QueryFilterDto } from '../shared/dto';
import { RequestUtils, ResponseUtils } from '../shared/utils';
import { CacheService } from '../shared/services/cache.service';
import { CircuitBreakerService } from '../shared/services/circuit-breaker.service';
import { TelemetryService } from '../shared/services/telemetry.service';

/**
 * Service for Service C gateway - File & Folder Management
 */
@Injectable()
export class ServiceCService {
  private readonly logger = new Logger(ServiceCService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly telemetryService: TelemetryService,
  ) {
    this.baseUrl = this.configService.get<string>('SERVICE_C_URL') || 'http://localhost:8003';
    this.apiKey = this.configService.get<string>('SERVICE_C_API_KEY') || '';
  }

  /**
   * Health check for Service C
   */
  async healthCheck() {
    try {
      const url = `${this.baseUrl}/health`;
      const { data } = await firstValueFrom(
        this.httpService.get(url).pipe(
          catchError(() => {
            throw new ServiceUnavailableException('Service C');
          }),
        ),
      );
      
      return { status: 'ok', service: 'service-c', timestamp: new Date().toISOString() };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw new ServiceUnavailableException('Service C');
    }
  }

  /**
   * Upload a file
   * @param tenantId Tenant ID
   * @param file File to upload
   * @param metadata File metadata
   */
  async uploadFile(tenantId: string, file: Express.Multer.File, metadata: UploadFileMetadataDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, 'files', { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    
    // Create FormData for multipart request
    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    formData.append('metadata', JSON.stringify(metadata));
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_upload_file');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.post(url, formData, {
                headers: {
                  ...headers,
                  'Content-Type': 'multipart/form-data',
                },
              }).pipe(
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
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'UploadFile', error.message);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param tenantId Tenant ID
   * @param fileId File ID
   */
  async getFileMetadata(tenantId: string, fileId: string) {
    const cacheKey = this.cacheService.createCacheKey('service-c', tenantId, 'file-metadata', fileId);
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const url = RequestUtils.buildUrl(this.baseUrl, `files/${fileId}/metadata`, { tenantId });
        const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
        const requestConfig = RequestUtils.createRequestConfig(headers);
        
        try {
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            'service-c',
            async () => {
              const stopTimer = this.telemetryService.startTimer('service_c_get_file_metadata');
              
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
          this.logger.error(`Failed to get file metadata: ${error.message}`, error.stack);
          this.telemetryService.recordError('service-c', 'GetFileMetadata', error.message);
          
          if (error.message.includes('not found') || error.response?.status === 404) {
            throw new ResourceNotFoundException('file', fileId);
          }
          
          throw error;
        }
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Download a file
   * @param tenantId Tenant ID
   * @param fileId File ID
   */
  async downloadFile(tenantId: string, fileId: string): Promise<{ fileStream: Readable; metadata: any }> {
    // Get metadata first
    const { data: metadata } = await this.getFileMetadata(tenantId, fileId);
    
    const url = RequestUtils.buildUrl(this.baseUrl, `files/${fileId}`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = {
      ...RequestUtils.createRequestConfig(headers),
      responseType: 'arraybuffer' as const,
    };
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_download_file');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.get(url, requestConfig).pipe(
                catchError(this.handleError),
              ),
            );
            
            const fileStream = new Readable();
            fileStream.push(data);
            fileStream.push(null);
            
            return { fileStream, metadata };
          } finally {
            stopTimer();
          }
        }
      );
    } catch (error) {
      this.logger.error(`Failed to download file: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'DownloadFile', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('file', fileId);
      }
      
      throw error;
    }
  }

  /**
   * Update file metadata
   * @param tenantId Tenant ID
   * @param fileId File ID
   * @param updateData Update data
   */
  async updateFileMetadata(tenantId: string, fileId: string, updateData: UpdateFileMetadataDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, `files/${fileId}/metadata`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      const result = await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_update_file_metadata');
          
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
      
      // Invalidate cache
      const cacheKey = this.cacheService.createCacheKey('service-c', tenantId, 'file-metadata', fileId);
      await this.cacheService.delete(cacheKey);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to update file metadata: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'UpdateFileMetadata', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('file', fileId);
      }
      
      throw error;
    }
  }

  /**
   * Delete a file
   * @param tenantId Tenant ID
   * @param fileId File ID
   */
  async deleteFile(tenantId: string, fileId: string): Promise<void> {
    const url = RequestUtils.buildUrl(this.baseUrl, `files/${fileId}`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_delete_file');
          
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
      const metadataCacheKey = this.cacheService.createCacheKey('service-c', tenantId, 'file-metadata', fileId);
      await this.cacheService.delete(metadataCacheKey);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'DeleteFile', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('file', fileId);
      }
      
      throw error;
    }
  }

  /**
   * List files
   * @param tenantId Tenant ID
   * @param paginationDto Pagination parameters
   * @param filterDto Filter parameters
   * @param folderId Optional folder ID to filter files
   */
  async listFiles(
    tenantId: string,
    paginationDto: PaginationDto,
    filterDto: QueryFilterDto,
    folderId?: string
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
    
    if (folderId) {
      queryParams.folderId = folderId;
    }
    
    const url = RequestUtils.buildUrl(this.baseUrl, 'files', queryParams);
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_list_files');
          
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
      this.logger.error(`Failed to list files: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'ListFiles', error.message);
      throw error;
    }
  }

  /**
   * Create a folder
   * @param tenantId Tenant ID
   * @param folderData Folder data
   */
  async createFolder(tenantId: string, folderData: CreateFolderDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, 'folders', { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_create_folder');
          
          try {
            const { data } = await firstValueFrom(
              this.httpService.post(url, folderData, requestConfig).pipe(
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
      this.logger.error(`Failed to create folder: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'CreateFolder', error.message);
      throw error;
    }
  }

  /**
   * Get folder by ID
   * @param tenantId Tenant ID
   * @param folderId Folder ID
   */
  async getFolderById(tenantId: string, folderId: string) {
    const cacheKey = this.cacheService.createCacheKey('service-c', tenantId, 'folder', folderId);
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const url = RequestUtils.buildUrl(this.baseUrl, `folders/${folderId}`, { tenantId });
        const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
        const requestConfig = RequestUtils.createRequestConfig(headers);
        
        try {
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            'service-c',
            async () => {
              const stopTimer = this.telemetryService.startTimer('service_c_get_folder');
              
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
          this.logger.error(`Failed to get folder: ${error.message}`, error.stack);
          this.telemetryService.recordError('service-c', 'GetFolderById', error.message);
          
          if (error.message.includes('not found') || error.response?.status === 404) {
            throw new ResourceNotFoundException('folder', folderId);
          }
          
          throw error;
        }
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Update a folder
   * @param tenantId Tenant ID
   * @param folderId Folder ID
   * @param updateData Update data
   */
  async updateFolder(tenantId: string, folderId: string, updateData: UpdateFolderDto) {
    const url = RequestUtils.buildUrl(this.baseUrl, `folders/${folderId}`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      const result = await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_update_folder');
          
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
      
      // Invalidate caches
      const folderCacheKey = this.cacheService.createCacheKey('service-c', tenantId, 'folder', folderId);
      await this.cacheService.delete(folderCacheKey);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to update folder: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'UpdateFolder', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('folder', folderId);
      }
      
      throw error;
    }
  }

  /**
   * Delete a folder
   * @param tenantId Tenant ID
   * @param folderId Folder ID
   */
  async deleteFolder(tenantId: string, folderId: string): Promise<void> {
    const url = RequestUtils.buildUrl(this.baseUrl, `folders/${folderId}`, { tenantId });
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_delete_folder');
          
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
      const folderCacheKey = this.cacheService.createCacheKey('service-c', tenantId, 'folder', folderId);
      await this.cacheService.delete(folderCacheKey);
    } catch (error) {
      this.logger.error(`Failed to delete folder: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'DeleteFolder', error.message);
      
      if (error.message.includes('not found') || error.response?.status === 404) {
        throw new ResourceNotFoundException('folder', folderId);
      }
      
      throw error;
    }
  }

  /**
   * List folders
   * @param tenantId Tenant ID
   * @param paginationDto Pagination parameters
   * @param filterDto Filter parameters
   * @param parentId Optional parent folder ID to filter folders
   */
  async listFolders(
    tenantId: string,
    paginationDto: PaginationDto,
    filterDto: QueryFilterDto,
    parentId?: string
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
    
    if (parentId) {
      queryParams.parentId = parentId;
    }
    
    const url = RequestUtils.buildUrl(this.baseUrl, 'folders', queryParams);
    const headers = RequestUtils.createServiceHeaders(this.apiKey, tenantId);
    const requestConfig = RequestUtils.createRequestConfig(headers);
    
    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'service-c',
        async () => {
          const stopTimer = this.telemetryService.startTimer('service_c_list_folders');
          
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
      this.logger.error(`Failed to list folders: ${error.message}`, error.stack);
      this.telemetryService.recordError('service-c', 'ListFolders', error.message);
      throw error;
    }
  }

  /**
   * Handle HTTP errors from Service C
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
      throw new ServiceUnavailableException('Service C');
    }

    // Handle HTTP error responses
    if (error.response) {
      // Handle 404 errors specifically
      if (error.response.status === 404) {
        const resourceId = error.config.url.split('/').pop().split('?')[0];
        const resourceType = error.config.url.includes('files') ? 'file' : 'folder';
        throw new ResourceNotFoundException(resourceType, resourceId);
      }
      
      throw error.response.data || {
        error: 'InternalServerError',
        message: 'Service C request failed',
        status: error.response.status || 500
      };
    }

    // Handle other errors
    throw error;
  }
}