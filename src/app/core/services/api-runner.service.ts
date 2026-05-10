import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { mergeMap, finalize, delay, tap, catchError, map, takeUntil } from 'rxjs/operators';
import { from, of, Observable, Subject } from 'rxjs';
import { ApiRequestConfig } from '../models/request-config.model';
import { TestResult } from '../models/test-result.model';
import { DataFakerService } from './data-faker.service';
import { TokenManagerService } from './token-manager.service';
import { isPlatformBrowser } from '@angular/common';

// LocalStorage key for persisting config
const CONFIG_STORAGE_KEY = 'smartapitest_config';

@Injectable({
  providedIn: 'root',
})
export class ApiRunnerService {
  private readonly httpClient = inject(HttpClient);
  private readonly dataFaker = inject(DataFakerService);
  private readonly tokenManager = inject(TokenManagerService);
  private readonly platformId = inject(PLATFORM_ID);

  // Cancellation Subject for manual stop functionality
  private destroy$ = new Subject<void>();

  // State Signals
  results = signal<TestResult[]>([]);
  isTesting = signal<boolean>(false);
  progress = signal<number>(0);
  lastConfig = signal<ApiRequestConfig | null>(null);

  // Computed signal for test summary (Statistical Analysis)
  readonly testSummary = computed(() => {
    const testResults = this.results();
    if (testResults.length === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        avgTime: 0,
        minTime: 0,
        maxTime: 0,
        successRate: 0,
        rps: 0,
        totalDataTransferred: 0,
        testDurationSeconds: 0,
      };
    }

    const errors = testResults.filter((r) => r.isError);
    const successes = testResults.filter((r) => !r.isError);
    const times = successes.map((r) => r.timeMs);

    // Calculate test duration in milliseconds (from first to last request)
    const sortedByTime = [...testResults].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const firstRequestTime = new Date(sortedByTime[0]?.timestamp).getTime();
    const lastRequestTime = new Date(sortedByTime[sortedByTime.length - 1]?.timestamp).getTime();
    const testDurationMs = Math.max(lastRequestTime - firstRequestTime, 1); // Avoid division by zero
    const testDurationSeconds = testDurationMs / 1000;

    // Calculate RPS (Requests Per Second) based on successful requests
    const rps = testDurationSeconds > 0 ? Math.round((successes.length / testDurationSeconds) * 100) / 100 : 0;

    // Estimate total data transferred (rough calculation based on response body sizes)
    const totalDataTransferred = testResults.reduce((total, result) => {
      // Estimate size of response body in bytes (approximate)
      const bodySize = result.responseBody ? new Blob([result.responseBody]).size : 0;
      return total + bodySize;
    }, 0);

    return {
      totalRequests: testResults.length,
      successCount: successes.length,
      errorCount: errors.length,
      avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      minTime: times.length > 0 ? Math.min(...times) : 0,
      maxTime: times.length > 0 ? Math.max(...times) : 0,
      successRate: Math.round((successes.length / testResults.length) * 100),
      rps,
      totalDataTransferred,
      testDurationSeconds: Math.round(testDurationSeconds * 100) / 100,
    };
  });

  /**
   * Main execution method with parallel concurrency control
   * Enables stress testing by executing requests in parallel up to the concurrency limit
   * Persists key config settings (URL, Method, Concurrency) to localStorage
   */
  executeTest(config: ApiRequestConfig): void {
    this.results.set([]);
    this.progress.set(0);
    this.isTesting.set(true);
    this.lastConfig.set(config);

    // Save essential config to localStorage for persistence across page refreshes
    this.saveConfigToStorage(config);

    // Create a fresh destroy subject for this test run
    this.destroy$ = new Subject<void>();

    const requestIndices = Array.from({ length: config.requestCount }, (_, i) => i);

    // Determine concurrency limit: use provided value, default to 5, or max out to requestCount
    const concurrencyLimit = config.concurrency || 5;

    from(requestIndices)
      .pipe(
        // mergeMap enables parallel execution with concurrency control as the second argument
        // This replaces concatMap's sequential execution with controlled parallelism
        mergeMap(
          (index) => {
            // Execute the request with optional delay between attempts
            // The delay is applied per request but executes in parallel up to concurrencyLimit
            return this.runSingleRequest(config, index).pipe(
              delay(config.requestDelay || 0)
            );
          },
          concurrencyLimit // Second argument: max concurrent requests
        ),
        // takeUntil ensures the stream unsubscribes when stopTest() is called
        // This cancels pending requests immediately
        takeUntil(this.destroy$),
        finalize(() => {
          // Finalize block executes once all requests complete or when stream is cancelled
          this.isTesting.set(false);
          // Keep progress at current value to show where the test was stopped
        }),
      )
      .subscribe({
        error: (err) => {
          console.error('[API Runner] Fatal Error:', err);
          this.isTesting.set(false);
        },
      });
  }

  /**
   * Manually stop the ongoing stress test
   * Unsubscribes from the request stream, cancelling pending requests
   * Progress is preserved to show where the test was stopped
   */
  stopTest(): void {
    if (!this.isTesting()) {
      console.warn('[API Runner] No test is currently running');
      return;
    }

    console.log('[API Runner] Test manually aborted by user. Stopping all pending requests...');
    this.destroy$.next();
    this.isTesting.set(false);
  }

  /**
   * Executes a single request and returns an Observable of the result
   */
  private runSingleRequest(config: ApiRequestConfig, index: number): Observable<any> {
    const generatedData = !config.useFaker
      ? config.sampleBody
      : this.dataFaker.generateData(config.sampleBody);

    const headers = { ...(config.headers || {}) };
    if (config.bodyType && config.bodyType !== 'plain-text') {
      const contentTypeMap: Record<string, string> = {
        json: 'application/json',
        'form-data': 'multipart/form-data',
        'x-www-form-urlencoded': 'application/x-www-form-urlencoded',
        xml: 'application/xml',
      };
      if (contentTypeMap[config.bodyType]) {
        headers['Content-Type'] = contentTypeMap[config.bodyType];
      }
    }

    // 3. تحديد وقت البدء
    const startTime = performance.now();

    // 4. بناء الـ Request
    return this.prepareHttpObservable(config, generatedData, headers).pipe(
      map((response) => {
        const timeMs = Math.round(performance.now() - startTime);
        if (response && typeof response === 'object') this.extractAndSaveToken(response);

        const result: TestResult = {
          id: `${Date.now()}-${index}`,
          status: 'success',
          statusCode: 200,
          timeMs,
          responseBody: JSON.stringify(response, null, 2),
          timestamp: new Date(),
          isError: false,
          isSuccess: true,
          statusText: 'OK',
          url: config.url,
          method: config.method,
        };
        this.addResult(result, index, config.requestCount);
        return result;
      }),
      catchError((error: HttpErrorResponse) => {
        const timeMs = Math.round(performance.now() - startTime);
        const result: TestResult = {
          id: `${Date.now()}-${index}`,
          status: 'error',
          statusCode: error.status || 0,
          timeMs,
          responseBody: JSON.stringify(error.error || { message: error.message }, null, 2),
          timestamp: new Date(),
          isError: true,
          isSuccess: false,
          statusText: error.statusText || 'Error',
          errorMessage: error.message,
          url: config.url,
          method: config.method,
        };
        this.addResult(result, index, config.requestCount);
        return of(result); // نستخدم of لضمان استمرار الـ Stream في حالة الخطأ
      }),
    );
  }

  /**
   * Helper to create the correct HttpClient Observable
   */
  private prepareHttpObservable(
    config: ApiRequestConfig,
    body: any,
    headers: any,
  ): Observable<any> {
    let url = config.url;
    const method = config.method.toUpperCase();

    if (method === 'GET' && body && typeof body === 'object') {
      const params = new URLSearchParams();
      // Flatten nested objects/arrays into query parameters using recursive helper
      this.flattenObjectToParams(body, params);

      const queryString = params.toString();
      if (queryString) {
        // Properly handle existing query parameters in base URL
        url += url.includes('?') ? `&${queryString}` : `?${queryString}`;
      }
    }

    let finalBody = body;
    const hasFileUpload = body && typeof body === 'object' &&
                      this.hasFileTagsRecursive(body);

    if ((config.bodyType === 'form-data' || hasFileUpload) && typeof body === 'object' && method !== 'GET') {
      const formData = new FormData();
      this.appendFormDataRecursive(body, formData);
      finalBody = formData;

      if (headers['Content-Type']) {
        delete headers['Content-Type'];
      }
    }
    switch (method) {
      case 'POST':
        return this.httpClient.post(url, finalBody, { headers });
      case 'PUT':
        return this.httpClient.put(url, finalBody, { headers });
      case 'PATCH':
        return this.httpClient.patch(url, finalBody, { headers });
      case 'DELETE':
        return this.httpClient.delete(url, { headers, body: finalBody });
      default:
        return this.httpClient.get(url, { headers });
    }
  }

  /**
   * File tag metadata mapping
   * Maps file tags to their MIME types and extensions
   */
  private readonly FILE_TAG_MAP: Record<string, { mimeType: string; extension: string }> = {
    '[FILE_UPLOAD]': { mimeType: 'image/png', extension: 'png' },
    '[FILE_PDF]': { mimeType: 'application/pdf', extension: 'pdf' },
    '[FILE_ZIP]': { mimeType: 'application/zip', extension: 'zip' },
    '[FILE_DOCX]': { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
    '[FILE_TXT]': { mimeType: 'text/plain', extension: 'txt' },
  };

  /**
   * Check if an object or its nested properties contain any file tags
   * Works recursively through nested objects and arrays
   *
   * @param obj - Object to check for file tags
   * @returns True if any file tags are found
   */
  private hasFileTagsRecursive(obj: any): boolean {
    if (obj === null || obj === undefined) {
      return false;
    }

    if (typeof obj !== 'object') {
      return Object.keys(this.FILE_TAG_MAP).includes(String(obj));
    }

    if (Array.isArray(obj)) {
      return obj.some(item => this.hasFileTagsRecursive(item));
    }

    // Check object values recursively
    return Object.values(obj).some(value => {
      if (Object.keys(this.FILE_TAG_MAP).includes(String(value))) {
        return true;
      }
      return typeof value === 'object' && this.hasFileTagsRecursive(value);
    });
  }


  /**
   * Recursively append form data from object, handling file tags and nested structures
   * Converts file tags to Blob objects with appropriate MIME types
   *
   * @param obj - Object to append to FormData
   * @param formData - FormData instance to append to
   * @param prefix - Current key prefix for nested objects (used recursively)
   */
  private appendFormDataRecursive(obj: any, formData: FormData, prefix: string = ''): void {
  // التأكد أن الكائن ليس فارغاً
  if (obj === null || obj === undefined) return;

  Object.keys(obj).forEach((key) => {
    const value = obj[key];

    // 1. تخطي القيم الفارغة
    if (value === null || value === undefined) {
      return;
    }

    // 2. بناء اسم الحقل (FieldName)
    // لاحظ: نستخدم النقطة (.) للأوبجكت، وسنتعامل مع المصفوفة بالأسفل
    const fieldName = prefix ? `${prefix}.${key}` : key;

    // 3. التحقق من "تاجات الملفات" (الميزة التي برمجناها سابقاً)
    const fileTagInfo = this.FILE_TAG_MAP[String(value)];
    if (fileTagInfo) {
      const dummyContent = `Dummy content for ${fileTagInfo.extension}`;
      const mockFile = new Blob([dummyContent], { type: fileTagInfo.mimeType });
      const fileName = `test-document.${fileTagInfo.extension}`;
      formData.append(fieldName, mockFile, fileName);
      return;
    }

    // 4. التعامل مع المصفوفات (الـ Arrays) - الجزء الأهم للإصلاح
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item === null || item === undefined) return;

        // بناء اسم الحقل للمصفوفة بالشكل الذي يفهمه ASP.NET Core: Key[0]
        const arrayFieldName = `${fieldName}[${index}]`;

        // إذا كان العنصر داخل المصفوفة عبارة عن "تاجات ملفات"
        const itemFileTagInfo = this.FILE_TAG_MAP[String(item)];
        if (itemFileTagInfo) {
          const dummyContent = `Dummy content for ${itemFileTagInfo.extension}`;
          const mockFile = new Blob([dummyContent], { type: itemFileTagInfo.mimeType });
          const fileName = `test-document.${itemFileTagInfo.extension}`;
          formData.append(arrayFieldName, mockFile, fileName);
        }
        // إذا كان العنصر داخل المصفوفة عبارة عن Object (زي InvoiceModels)
        else if (typeof item === 'object' && item !== null) {
          this.appendFormDataRecursive(item, formData, arrayFieldName);
        }
        // إذا كان عنصراً بسيطاً (String, Number)
        else {
          formData.append(arrayFieldName, item.toString());
        }
      });
      return;
    }

    // 5. التعامل مع الكائنات المتداخلة (Nested Objects)
    if (typeof value === 'object' && value.constructor === Object) {
      this.appendFormDataRecursive(value, formData, fieldName);
      return;
    }

    // 6. التعامل مع القيم البسيطة (الـ Primitive)
    // تأكد من إرسالها كـ string أو Blob مباشرة
    formData.append(fieldName, value.toString());
  });
}

  /**
   * Recursively flatten nested objects and arrays into URLSearchParams
   * Handles nested objects using dot notation (e.g., user.id -> "user.id=1")
   * Handles arrays by repeating the key (e.g., tags -> "tags=a&tags=b")
   *
   * @param obj - Object to flatten (may contain nested objects/arrays)
   * @param params - URLSearchParams to append flattened values to
   * @param prefix - Current key prefix for nested objects (used recursively)
   */
  private flattenObjectToParams(obj: any, params: URLSearchParams, prefix: string = ''): void {
    Object.keys(obj).forEach(key => {
      const value = obj[key];

      // Skip null, undefined, or empty string values
      if (value === null || value === undefined) {
        return;
      }

      // Build the parameter key: use prefix for nested objects
      const paramKey = prefix ? `${prefix}.${key}` : key;

      // Handle arrays: append each element with the same key
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item !== null && item !== undefined) {
            // Encode special characters in the value
            params.append(paramKey, this.encodeParamValue(item));
          }
        });
        return;
      }

      // Handle nested objects: recursively flatten
      if (typeof value === 'object' && value.constructor === Object) {
        this.flattenObjectToParams(value, params, paramKey);
        return;
      }

      // Handle primitive values: append directly with encoding
      params.append(paramKey, this.encodeParamValue(value));
    });
  }

  /**
   * Encode parameter values to handle special characters and spaces
   * Converts non-string values to strings and applies proper URL encoding
   *
   * @param value - Value to encode (can be string, number, boolean, etc.)
   * @returns Encoded string safe for URL query parameters
   */
  private encodeParamValue(value: any): string {
    const stringValue = typeof value === 'string' ? value : String(value);
    return encodeURIComponent(stringValue);
  }

  private addResult(result: TestResult, index: number, totalRequests: number): void {
    this.results.update((current) => [...current, result]);
    const progressPercentage = Math.round(((index + 1) / totalRequests) * 100);
    this.progress.set(Math.min(progressPercentage, 100));
  }

  private extractAndSaveToken(response: any): void {
    const tokenFields = ['token', 'accessToken', 'access_token', 'jwt', 'authToken'];
    for (const field of tokenFields) {
      if (response[field] && typeof response[field] === 'string') {
        this.tokenManager.setToken(response[field]);
        return;
      }
    }
  }

  clearResults(): void {
    this.results.set([]);
    this.progress.set(0);
    this.isTesting.set(false);
  }

  /**
   * Export test results as CSV
   *
   * CSV Header: URL, Method, Status Code, Status Text, Time (ms), Timestamp, Is Error
   *
   * Properly escapes values and handles special characters
   */
  exportToCSV(): void {
    const results = this.results();
    if (results.length === 0) {
      console.warn('[ApiRunner] No results to export');
      return;
    }

    // Define CSV headers
    const headers = ['URL', 'Method', 'Status Code', 'Status Text', 'Time (ms)', 'Timestamp', 'Is Error'];

    // Map results to CSV rows with proper escaping
    const rows = results.map((result) => [
      this.escapeCSVValue(result.url || ''),
      this.escapeCSVValue(result.method || ''),
      result.statusCode?.toString() || '',
      this.escapeCSVValue(result.statusText || ''),
      result.timeMs?.toString() || '',
      this.escapeCSVValue(result.timestamp?.toISOString() || ''),
      result.isError ? 'true' : 'false',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `api-test-report-${timestamp}.csv`;

    // Trigger download
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Export test results as JSON
   *
   * Exports the full results array with all metadata in formatted JSON
   */
  exportToJSON(): void {
    const results = this.results();
    if (results.length === 0) {
      console.warn('[ApiRunner] No results to export');
      return;
    }

    // Add metadata to the export
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalRequests: results.length,
        successCount: results.filter(r => !r.isError).length,
        errorCount: results.filter(r => r.isError).length,
        testConfig: this.lastConfig(),
      },
      results: results,
    };

    // Convert to formatted JSON
    const jsonContent = JSON.stringify(exportData, null, 2);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `api-test-report-${timestamp}.json`;

    // Trigger download
    this.downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
  }

  /**
   * Helper method to escape CSV values
   * Wraps values in quotes and escapes internal quotes
   */
  private escapeCSVValue(value: string): string {
    if (!value) return '';

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Helper method to trigger file download
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Save essential config to localStorage
   * Persists URL, Method, and Concurrency settings for recovery after page refresh
   * Safely checks if running in browser environment
   */
  private saveConfigToStorage(config: ApiRequestConfig): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const configToStore = {
        url: config.url,
        method: config.method,
        concurrency: config.concurrency,
      };
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToStore));
    } catch (error) {
      console.warn('[ApiRunner] Failed to save config to localStorage:', error);
    }
  }

  /**
   * Load config from localStorage if available
   * Returns null if no saved config exists or on server-side rendering
   * Safely handles localStorage errors
   */
  loadConfigFromStorage(): Partial<ApiRequestConfig> | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[ApiRunner] Failed to load config from localStorage:', error);
    }

    return null;
  }

  /**
   * Clear saved config from localStorage
   */
  clearStoredConfig(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (error) {
      console.warn('[ApiRunner] Failed to clear config from localStorage:', error);
    }
  }
}
