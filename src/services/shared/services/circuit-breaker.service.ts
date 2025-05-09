import { Injectable, Logger } from '@nestjs/common';
import { ServiceUnavailableException } from '../../../core/exceptions';

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

interface CircuitOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenAttempts: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker for a service
   */
  getCircuit(serviceName: string, options?: Partial<CircuitOptions>): CircuitBreaker {
    if (!this.circuits.has(serviceName)) {
      const circuit = new CircuitBreaker(serviceName, options);
      this.circuits.set(serviceName, circuit);
    }
    
    return this.circuits.get(serviceName);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>,
    options?: Partial<CircuitOptions>
  ): Promise<T> {
    const circuit = this.getCircuit(serviceName, options);
    return await circuit.execute(fn);
  }
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastError: Error | null = null;
  private nextAttempt: number = 0;
  private halfOpenSuccesses: number = 0;
  private readonly logger = new Logger('CircuitBreaker');
  
  private readonly options: CircuitOptions = {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    halfOpenAttempts: 2,
  };

  constructor(
    private readonly serviceName: string,
    options?: Partial<CircuitOptions>
  ) {
    Object.assign(this.options, options);
    this.logger.log(`Circuit breaker created for service: ${serviceName}`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private checkState(): void {
    const now = Date.now();
    
    if (this.state === CircuitState.OPEN && now >= this.nextAttempt) {
      this.logger.log(`Circuit for ${this.serviceName} transitioning from OPEN to HALF_OPEN`);
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenSuccesses = 0;
    }
    
    if (this.state === CircuitState.OPEN) {
      const timeLeft = Math.ceil((this.nextAttempt - now) / 1000);
      this.logger.warn(`Circuit for ${this.serviceName} is OPEN. Retry in ${timeLeft}s`);
      throw new ServiceUnavailableException(this.serviceName);
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      
      if (this.halfOpenSuccesses >= this.options.halfOpenAttempts) {
        this.logger.log(`Circuit for ${this.serviceName} recovered. Transitioning to CLOSED`);
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  private onFailure(error: Error): void {
    this.lastError = error;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.logger.warn(`Circuit for ${this.serviceName} failed in HALF_OPEN state. Transitioning to OPEN`);
      this.trip();
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      
      if (this.failureCount >= this.options.failureThreshold) {
        this.logger.warn(`Circuit for ${this.serviceName} failure threshold reached. Transitioning to OPEN`);
        this.trip();
      }
    }
  }

  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeout;
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastError = null;
    this.nextAttempt = 0;
    this.halfOpenSuccesses = 0;
  }
}