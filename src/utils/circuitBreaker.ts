/**
 * Circuit Breaker - Fault tolerance pattern for network requests
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas. All rights reserved.
 * @license MIT
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * and provide automatic recovery from network issues.
 */

import { Logger } from '../services/logger';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
    failureThreshold: number;      // Number of failures before opening circuit
    successThreshold: number;       // Number of successes to close circuit from half-open
    timeout: number;                // Time to wait before trying half-open (ms)
    resetTimeout?: number;          // Time to keep circuit open before half-open (ms)
}

export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number;
    lastSuccessTime: number;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
}

/**
 * CircuitBreaker implements the circuit breaker pattern to prevent
 * cascading failures from repeated network errors.
 */
export class CircuitBreaker {
    private state: CircuitState = 'closed';
    private failures = 0;
    private successes = 0;
    private lastFailureTime = 0;
    private lastSuccessTime = 0;
    private totalRequests = 0;
    private totalFailures = 0;
    private totalSuccesses = 0;
    private logger: Logger;

    constructor(
        private name: string,
        private options: CircuitBreakerOptions
    ) {
        this.logger = Logger.getInstance();
        this.logger.debug(`Circuit breaker "${name}" initialized`, {
            failureThreshold: options.failureThreshold,
            successThreshold: options.successThreshold,
            timeout: options.timeout
        });
    }

    /**
     * Execute an operation with circuit breaker protection
     */
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        this.totalRequests++;

        // Check if circuit is open
        if (this.state === 'open') {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            const resetTimeout = this.options.resetTimeout || this.options.timeout;

            if (timeSinceLastFailure >= resetTimeout) {
                // Try half-open
                this.logger.debug(`Circuit breaker "${this.name}" transitioning to half-open`);
                this.state = 'half-open';
                this.successes = 0;
            } else {
                // Circuit still open
                this.logger.debug(`Circuit breaker "${this.name}" is open, rejecting request`);
                throw new Error(`Circuit breaker "${this.name}" is open. Service temporarily unavailable.`);
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error as Error);
            throw error;
        }
    }

    /**
     * Handle successful operation
     */
    private onSuccess(): void {
        this.totalSuccesses++;
        this.lastSuccessTime = Date.now();

        if (this.state === 'half-open') {
            this.successes++;
            this.logger.debug(`Circuit breaker "${this.name}" success in half-open state (${this.successes}/${this.options.successThreshold})`);

            if (this.successes >= this.options.successThreshold) {
                this.logger.info(`Circuit breaker "${this.name}" closed after successful recovery`);
                this.state = 'closed';
                this.failures = 0;
                this.successes = 0;
            }
        } else if (this.state === 'closed') {
            // Reset failure count on success
            this.failures = 0;
        }
    }

    /**
     * Handle failed operation
     */
    private onFailure(error: Error): void {
        this.totalFailures++;
        this.failures++;
        this.lastFailureTime = Date.now();

        this.logger.debug(`Circuit breaker "${this.name}" failure (${this.failures}/${this.options.failureThreshold})`, error);

        if (this.state === 'half-open') {
            // If failure in half-open, immediately open circuit
            this.logger.warn(`Circuit breaker "${this.name}" opened after failure in half-open state`);
            this.state = 'open';
            this.failures = 0;
            this.successes = 0;
        } else if (this.state === 'closed' && this.failures >= this.options.failureThreshold) {
            // Too many failures, open circuit
            this.logger.warn(`Circuit breaker "${this.name}" opened after ${this.failures} consecutive failures`);
            this.state = 'open';
        }
    }

    /**
     * Get current state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Get statistics
     */
    getStats(): CircuitBreakerStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses
        };
    }

    /**
     * Manually reset circuit breaker
     */
    reset(): void {
        this.logger.info(`Circuit breaker "${this.name}" manually reset`);
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
    }

    /**
     * Get success rate
     */
    getSuccessRate(): number {
        if (this.totalRequests === 0) {
            return 1.0;
        }
        return this.totalSuccesses / this.totalRequests;
    }

    /**
     * Check if circuit is healthy
     */
    isHealthy(): boolean {
        return this.state === 'closed' || this.state === 'half-open';
    }
}

/**
 * CircuitBreakerManager manages multiple circuit breakers
 */
export class CircuitBreakerManager {
    private breakers = new Map<string, CircuitBreaker>();
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * Get or create a circuit breaker
     */
    getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
        if (!this.breakers.has(name)) {
            const defaultOptions: CircuitBreakerOptions = {
                failureThreshold: 5,
                successThreshold: 2,
                timeout: 60000,         // 1 minute
                resetTimeout: 120000    // 2 minutes
            };

            const breaker = new CircuitBreaker(name, options || defaultOptions);
            this.breakers.set(name, breaker);
            this.logger.debug(`Created circuit breaker: ${name}`);
        }

        return this.breakers.get(name)!;
    }

    /**
     * Get all breakers
     */
    getAllBreakers(): Map<string, CircuitBreaker> {
        return new Map(this.breakers);
    }

    /**
     * Get health summary
     */
    getHealthSummary(): {
        total: number;
        healthy: number;
        unhealthy: number;
        details: Array<{ name: string; state: CircuitState; successRate: number }>;
    } {
        const details: Array<{ name: string; state: CircuitState; successRate: number }> = [];
        let healthy = 0;
        let unhealthy = 0;

        for (const [name, breaker] of this.breakers) {
            const stats = breaker.getStats();
            const successRate = breaker.getSuccessRate();

            details.push({
                name,
                state: stats.state,
                successRate
            });

            if (breaker.isHealthy()) {
                healthy++;
            } else {
                unhealthy++;
            }
        }

        return {
            total: this.breakers.size,
            healthy,
            unhealthy,
            details
        };
    }

    /**
     * Reset all circuit breakers
     */
    resetAll(): void {
        this.logger.info('Resetting all circuit breakers');
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }

    /**
     * Remove a circuit breaker
     */
    remove(name: string): boolean {
        return this.breakers.delete(name);
    }

    /**
     * Clear all circuit breakers
     */
    clear(): void {
        this.breakers.clear();
    }
}
