/**
 * HTTP Method types supported by API Lab
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Request body type for serialization
 */
export type BodyType = 'json' | 'form-data' | 'x-www-form-urlencoded' | 'xml' | 'plain-text';

/**
 * Authentication type for API requests
 */
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

/**
 * Basic authentication configuration
 */
export interface BasicAuthConfig {
  username: string;
  password: string;
}

/**
 * API Key authentication configuration
 */
export interface ApiKeyAuthConfig {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

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
   * Authentication type to use for the request
   */
  authType?: AuthType;

  /**
   * Optional authentication token (for Bearer auth)
   */
  authToken?: string;

  /**
   * Basic authentication configuration
   */
  basicAuthConfig?: BasicAuthConfig;

  /**
   * API Key authentication configuration
   */
  apiKeyAuthConfig?: ApiKeyAuthConfig;

  /**
   * Test duration in seconds (for continuous load testing)
   */
  testDuration?: number;

  /**
   * Delay between requests in milliseconds (for rate limiting tests)
   */
  requestDelay?: number;

  /**
   * Maximum number of concurrent HTTP requests to send simultaneously
   * Controls parallelism in stress testing. If not provided, defaults to 5.
   * Set to requestCount for maximum parallel pressure.
   */
  concurrency?: number;

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
