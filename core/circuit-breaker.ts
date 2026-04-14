/**
 * Circuit Breaker for Agent Safety
 * From MAW Guide - Circuit Breaker pattern
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening
  cooldownPeriod: number;         // Milliseconds before half-open
  successThreshold: number;       // Successes before closing
  timeout: number;                // Operation timeout
}

export enum CircuitState {
  CLOSED = 'closed',    // Normal operation
  OPEN = 'open',        // Circuit open, reject calls
  HALF_OPEN = 'half_open' // Testing if recovered
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation with circuit breaker
   * From MAW Guide - Circuit Breaker pattern
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      // Execute operation with timeout
      const result = await this.withTimeout(operation, this.config.timeout);
      
      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   * From MAW Guide - Circuit Breaker pattern
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  /**
   * Handle failed operation
   * From MAW Guide - Circuit Breaker pattern
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.warn(`Circuit breaker OPEN after ${this.failureCount} failures`);
    }
  }

  /**
   * Check if should attempt reset
   * From MAW Guide - Circuit Breaker pattern
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.cooldownPeriod;
  }

  /**
   * Execute with timeout
   * From MAW Guide - Circuit Breaker pattern
   */
  private async withTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  /**
   * Manual reset
   * From MAW Guide - Circuit Breaker pattern
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Get current circuit state
   * From MAW Guide - Circuit Breaker pattern
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   * From MAW Guide - Circuit Breaker pattern
   */
  getFailureCount(): number {
    return this.failureCount;
  }
}
