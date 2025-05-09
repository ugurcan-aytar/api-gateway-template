import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator that logs the action performed by a controller method
 * for audit purposes
 */
export const AuditLog = (action: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const timestamp = new Date().toISOString();
      console.log(`[AUDIT] ${timestamp} - ${action}`);
      
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        console.error(`[AUDIT] ${timestamp} - ${action} - Error: ${error.message}`);
        throw error;
      }
    };
    
    return descriptor;
  };
};