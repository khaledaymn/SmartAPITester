/**
 * HTTP Method types supported by API Lab
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Request body type for serialization
 */
export type BodyType = 'json' | 'form-data' | 'x-www-form-urlencoded' | 'xml' | 'plain-text';

/**
 * API Request Configuration for stress testing
 */
export interface ApiRequestConfig {
  /**
   * Unique identifier for the request configuration
   */
  id?: string;

  /**
   * API endpoint URL
   */
  url: string;

  /**
   * HTTP method to use
   */
  method: HttpMethod;

  /**
   * Request headers as key-value pairs
   */
  headers?: Record<string, string>;

  /**
   * Type of request body (defaults to 'json')
   */
  bodyType?: BodyType;

  /**
   * Sample request body
   */
  sampleBody?: string;

  /**
   * Number of concurrent requests for stress test
   */
  requestCount: number;

  /**
   * Request timeout in milliseconds (defaults to 30000)
   */
  timeout?: number;

  /**
   * Additional name/description for the request
   */
  name?: string;

  /**
   * Whether to follow redirects (defaults to true)
   */
  followRedirects?: boolean;

  /**
   * Optional authentication token
   */
  authToken?: string;

  /**
   * Test duration in seconds (for continuous load testing)
   */
  testDuration?: number;

  /**
   * Delay between requests in milliseconds (for rate limiting tests)
   */
  requestDelay?: number;

  /**
   * Created timestamp
   */
  createdAt?: Date;

  /**
   * Last modified timestamp
   */
  updatedAt?: Date;

  useFaker?: boolean; // إذا true، سيتم استخدام sampleBody كما هو بدون توليد بيانات
}
