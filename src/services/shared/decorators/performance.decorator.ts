import { Logger } from '@nestjs/common';

/**
 * Decorator that measures execution time of a method
 */
export const MeasurePerformance = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const logger = new Logger(`${target.constructor.name}`);
    
    descriptor.value = async function(...args: any[]) {
      const start = performance.now();
      
      try {
        return await originalMethod.apply(this, args);
      } finally {
        const end = performance.now();
        const duration = end - start;
        logger.debug(`Method ${propertyKey} execution time: ${duration.toFixed(2)}ms`);
      }
    };
    
    return descriptor;
  };
};