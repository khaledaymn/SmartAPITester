import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { mergeMap, finalize, delay, tap, catchError, map, takeUntil } from 'rxjs/operators';
import { from, of, Observable, Subject } from 'rxjs';
import { ApiRequestConfig } from '../models/request-config.model';
import { TestResult } from '../models/test-result.model';
import { DataFakerService } from './data-faker.service';
import { TokenManagerService } from './token-manager.service';

@Injectable({
  providedIn: 'root',
})
export class ApiRunnerService {
  private readonly httpClient = inject(HttpClient);
  private readonly dataFaker = inject(DataFakerService);
  private readonly tokenManager = inject(TokenManagerService);

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
      };
    }

    const errors = testResults.filter((r) => r.isError);
    const successes = testResults.filter((r) => !r.isError);
    const times = successes.map((r) => r.timeMs);

    return {
      totalRequests: testResults.length,
      successCount: successes.length,
      errorCount: errors.length,
      avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      minTime: times.length > 0 ? Math.min(...times) : 0,
      maxTime: times.length > 0 ? Math.max(...times) : 0,
      successRate: Math.round((successes.length / testResults.length) * 100),
    };
  });

  /**
   * Main execution method with parallel concurrency control
   * Enables stress testing by executing requests in parallel up to the concurrency limit
   */
  executeTest(config: ApiRequestConfig): void {
    this.results.set([]);
    this.progress.set(0);
    this.isTesting.set(true);
    this.lastConfig.set(config);

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

    Object.keys(body).forEach(key => {
      const value = body[key];
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(item => params.append(key, item));
        } else {
          params.append(key, value);
        }
      }
    });

    const queryString = params.toString();
    if (queryString) {
      url += url.includes('?') ? `&${queryString}` : `?${queryString}`;
    }
  }

    let finalBody = body;
    const hasFileUpload = body && typeof body === 'object' &&
                      Object.values(body).some(val => val === '[FILE_UPLOAD]');

  if ((config.bodyType === 'form-data' || hasFileUpload) && typeof body === 'object' && method !== 'GET') {
    const formData = new FormData();

      Object.keys(body).forEach((key) => {
        const value = body[key];

        if (value === '[FILE_UPLOAD]') {
          const mockFile = new Blob([''], { type: 'image/png' });
          formData.append(key, mockFile, 'test-image.png');
        } else {
          formData.append(key, value !== null && value !== undefined ? value.toString() : '');
        }
      });

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
}
