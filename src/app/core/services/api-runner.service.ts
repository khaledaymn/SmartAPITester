import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { concatMap, finalize, delay, tap, catchError, map } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';
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

  // State Signals
  results = signal<TestResult[]>([]);
  isTesting = signal<boolean>(false);
  progress = signal<number>(0);
  lastConfig = signal<ApiRequestConfig | null>(null);
  
  // Computed signal for test summary (Statistical Analysis)
  readonly testSummary = computed(() => {
    const testResults = this.results();
    if (testResults.length === 0) {
      return { totalRequests: 0, successCount: 0, errorCount: 0, avgTime: 0, minTime: 0, maxTime: 0, successRate: 0 };
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
   * Main execution method
   */
  executeTest(config: ApiRequestConfig): void {
    this.results.set([]);
    this.progress.set(0);
    this.isTesting.set(true);

    const requestIndices = Array.from({ length: config.requestCount }, (_, i) => i);

    from(requestIndices)
      .pipe(
        concatMap((index) => {
          // تنفيذ الطلب ثم انتظار الـ Delay المحدد
          return this.runSingleRequest(config, index).pipe(
            delay(config.requestDelay || 0)
          );
        }),
        finalize(() => {
          this.isTesting.set(false);
          this.progress.set(100);
        })
      )
      .subscribe({
        error: (err) => {
          console.error('[API Runner] Fatal Error:', err);
          this.isTesting.set(false);
        },
      });
  }

  /**
   * Executes a single request and returns an Observable of the result
   */
  private runSingleRequest(config: ApiRequestConfig, index: number): Observable<any> {

    const generatedData = !config.useFaker ?
                config.sampleBody : this.dataFaker.generateData(config.sampleBody);

    const headers = { ...(config.headers || {}) };
    if (config.bodyType && config.bodyType !== 'plain-text') {
      const contentTypeMap: Record<string, string> = {
        'json': 'application/json',
        'form-data': 'multipart/form-data',
        'x-www-form-urlencoded': 'application/x-www-form-urlencoded',
        'xml': 'application/xml',
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
      })
    );
  }

  /**
   * Helper to create the correct HttpClient Observable
   */
  private prepareHttpObservable(config: ApiRequestConfig, body: any, headers: any): Observable<any> {
  const url = config.url;
  const method = config.method.toUpperCase();

  let finalBody = body;
  if (config.bodyType === 'form-data' && typeof body === 'object') {
    const formData = new FormData();
    Object.keys(body).forEach(key => formData.append(key, body[key]));
    finalBody = formData;

    delete headers['Content-Type'];
  }

  switch (method) {
    case 'POST': return this.httpClient.post(url, finalBody, { headers });
    case 'PUT': return this.httpClient.put(url, finalBody, { headers });
    case 'PATCH': return this.httpClient.patch(url, finalBody, { headers });
    default: return this.httpClient.get(url, { headers });
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
