/**
 * Bounded exponential backoff with jitter, for transient failures only.
 *
 * Access-denied, missing-list, invalid-configuration and validation failures
 * must never retry — retrying them wastes a request and delays showing the
 * user the (unchanging) outcome. Callers decide retryability; this module
 * only computes delay and bounds attempt count.
 */

export interface IRetryOptions {
  /** Maximum number of attempts, including the first. Default 4. */
  readonly maxAttempts?: number;
  /** Base delay in ms before the first retry. Default 500. */
  readonly baseDelayMs?: number;
  /** Hard ceiling on any single delay, regardless of attempt count. Default 8000. */
  readonly maxDelayMs?: number;
  /** Injectable random source, for deterministic tests. Default `Math.random`. */
  readonly random?: () => number;
  /** Injectable delay function, for tests that don't want to wait in real time. */
  readonly delay?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8000;

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes the delay before attempt `attemptNumber` (1-based: the delay
 * before the *second* attempt, since the first is never delayed).
 *
 * Full jitter: a uniformly random value between 0 and the exponential cap,
 * rather than a fixed delay plus a small jitter term — this is what actually
 * prevents synchronized retries across clients, per the standard AWS
 * backoff-with-jitter analysis.
 */
export function computeBackoffDelayMs(
  attemptNumber: number,
  options: Pick<IRetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'random'> = {}
): number {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const random = options.random ?? Math.random;

  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attemptNumber - 1));
  return Math.floor(random() * cap);
}

/**
 * Runs `operation`, retrying on failure only while `isRetryable` returns true.
 *
 * Does not catch and swallow the final failure — after `maxAttempts` attempts
 * the last error propagates, so the caller's existing error handling (e.g.
 * mapping to a typed error) still runs.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  options: IRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayFn = options.delay ?? defaultDelay;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }

      const delayMs = computeBackoffDelayMs(attempt, options);
      await delayFn(delayMs);
    }
  }

  // Unreachable: the loop always returns or throws. Kept for type-safety only.
  throw lastError;
}
