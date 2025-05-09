import { AxiosRequestConfig } from 'axios';
import { Logger } from '@nestjs/common';

export class RequestUtils {
  private static readonly logger = new Logger('RequestUtils');

  /**
   * Create standardized headers for service-to-service communication
   */
  static createServiceHeaders(apiKey: string, tenantId: string, requestId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-tenant-id': tenantId,
    };

    if (requestId) {
      headers['x-request-id'] = requestId;
    } else {
      headers['x-request-id'] = `service-request-${Date.now()}`;
    }

    return headers;
  }

  /**
   * Create axios request config with timeout and headers
   */
  static createRequestConfig(
    headers: Record<string, string>,
    timeout: number = 30000
  ): AxiosRequestConfig {
    return {
      headers,
      timeout,
    };
  }

  /**
   * Format pagination parameters for API requests
   */
  static formatPaginationParams(page?: number, limit?: number): string {
    if (!page && !limit) return '';

    const params: string[] = [];
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);

    return params.length ? `?${params.join('&')}` : '';
  }

  /**
   * Build full URL with query parameters
   */
  static buildUrl(baseUrl: string, path: string, queryParams?: Record<string, string | number | boolean>): string {
    let url = `${baseUrl}/${path}`;
    
    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = Object.entries(queryParams)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&');
      
      url += url.includes('?') ? `&${queryString}` : `?${queryString}`;
    }
    
    return url;
  }
}