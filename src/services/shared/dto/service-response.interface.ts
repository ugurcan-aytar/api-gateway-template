export interface ServiceResponse<T> {
    success: boolean;
    data: T;
    metadata?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
      hasMore?: boolean;
      [key: string]: any;
    };
  }