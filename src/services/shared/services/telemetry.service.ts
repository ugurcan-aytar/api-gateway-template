import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    // In a real implementation, this would send metrics to a monitoring system
    this.logger.debug(`METRIC: ${name} = ${value} ${JSON.stringify(tags)}`);
  }

  /**
   * Start a timer and return a function to stop it and record the duration
   */
  startTimer(metricName: string, tags: Record<string, string> = {}): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(metricName, duration, { ...tags, unit: 'ms' });
    };
  }

  /**
   * Record a request metric
   */
  recordRequest(
    service: string,
    operation: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.recordMetric('api_request', durationMs, {
      service,
      operation,
      status: statusCode.toString(),
      success: statusCode < 400 ? 'true' : 'false',
    });
  }

  /**
   * Record an error
   */
  recordError(source: string, errorType: string, message: string): void {
    // In a real implementation, this would send the error to an error tracking system
    this.logger.error(`ERROR: ${source} - ${errorType}: ${message}`);
  }
}