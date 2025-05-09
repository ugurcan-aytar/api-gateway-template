export class ResponseUtils {
  /**
   * Process and standardize service responses
   */
  static standardizeResponse<T>(data: any): { 
    success: boolean; 
    data: T; 
    metadata?: Record<string, any> 
  } {
    // If data already has our expected structure, return it as is
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data;
    }

    // Otherwise, wrap it in our standard response format
    return {
      success: true,
      data,
    };
  }

  /**
   * Extract pagination metadata from service response
   */
  static extractPaginationMetadata(response: any): Record<string, any> | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    // Check for pagination metadata in various formats
    const metadata = response.metadata || response.meta || response.pagination;
    if (metadata) {
      return metadata;
    }

    // If standard pagination fields are at the top level, extract them
    const paginationFields = ['page', 'limit', 'total', 'totalPages', 'hasMore'];
    const extractedMetadata: Record<string, any> = {};
    
    let hasPaginationData = false;
    for (const field of paginationFields) {
      if (field in response) {
        extractedMetadata[field] = response[field];
        hasPaginationData = true;
      }
    }

    return hasPaginationData ? extractedMetadata : undefined;
  }
}