/**
 * HTTP status categories for test results
 */
export type ResponseStatus = 'success' | 'error' | 'timeout' | 'pending';

/**
 * Individual API test result
 */
export interface TestResult {
  /**
   * Unique identifier for the test result
   */
  id: string;

  /**
   * Status of the request (success, error, timeout, pending)
   */
  status: ResponseStatus;

  /**
   * Response time in milliseconds
   */
  timeMs: number;

  /**
   * HTTP status code (e.g., 200, 404, 500)
   */
  statusCode?: number;

  /**
   * HTTP status text (e.g., "OK", "Not Found", "Internal Server Error")
   */
  statusText?: string;

  /**
   * Response body content
   */
  responseBody?: string;

  /**
   * Response headers as key-value pairs
   */
  responseHeaders?: Record<string, string>;

  /**
   * Error message if request failed
   */
  errorMessage?: string;

  /**
   * Timestamp when the test was executed
   */
  timestamp: Date;

  /**
   * Whether the request resulted in an error
   */
  isError: boolean;

  /**
   * Request index in batch (for identifying requests in stress tests)
   */
  requestIndex?: number;

  /**
   * Size of response body in bytes
   */
  responseSize?: number;

  /**
   * Content-Type of response
   */
  contentType?: string;

  /**
   * Whether this was a successful response (2xx status)
   */
  isSuccess: boolean;

  url: string;
  
  /**
   * Custom error details for debugging
   */
  details?: {
    [key: string]: unknown;
  };
}

/**
 * Aggregated test results summary
 */
export interface TestResultsSummary {
  /**
   * Total number of requests made
   */
  totalRequests: number;

  /**
   * Number of successful requests
   */
  successCount: number;

  /**
   * Number of failed requests
   */
  errorCount: number;

  /**
   * Number of timed out requests
   */
  timeoutCount: number;

  /**
   * Minimum response time in milliseconds
   */
  minTime: number;

  /**
   * Maximum response time in milliseconds
   */
  maxTime: number;

  /**
   * Average response time in milliseconds
   */
  avgTime: number;

  /**
   * Median response time in milliseconds
   */
  medianTime: number;

  /**
   * 95th percentile response time in milliseconds
   */
  p95Time: number;

  /**
   * 99th percentile response time in milliseconds
   */
  p99Time: number;

  /**
   * Success rate as percentage (0-100)
   */
  successRate: number;

  /**
   * Requests per second
   */
  rps: number;

  /**
   * Test start time
   */
  startTime: Date;

  /**
   * Test end time
   */
  endTime: Date;

  /**
   * Total test duration in seconds
   */
  totalDuration: number;

  /**
   * Total data transferred in bytes
   */
  totalDataTransferred: number;

  /**
   * Average response size in bytes
   */
  avgResponseSize: number;
}
