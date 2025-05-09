export interface ServiceError {
    error: string;
    message: string;
    errorCode?: string;
    details?: Record<string, any>;
  }