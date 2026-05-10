import { Component, OnInit, Output, EventEmitter, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiRequestConfig, BodyType, HttpMethod, AuthType } from '../../../../../core/models/request-config.model';
import { ApiRunnerService } from '../../../../../core/services/api-runner.service';
import { TokenManagerService } from '../../../../../core/services/token-manager.service';

/**
 * ConfigPanelFormComponent
 *
 * Reactive form component for configuring API stress test parameters.
 * Includes fields for URL, HTTP method, headers, body type, request count, and delay.
 *
 * @standalone
 */
@Component({
  selector: 'app-config-panel-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './config-panel-form.component.html',
  styleUrls: ['./config-panel-form.component.scss'],
})
export class ConfigPanelFormComponent implements OnInit {
  @Output() configSubmitted = new EventEmitter<ApiRequestConfig>();

  private readonly fb = inject(FormBuilder);
  private readonly apiRunner = inject(ApiRunnerService);
  private readonly tokenManager = inject(TokenManagerService);

  configForm!: FormGroup;
  // Read-only alias to apiRunner's isTesting signal
  readonly isTesting = this.apiRunner.isTesting;

  httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  bodyTypes: BodyType[] = ['json', 'form-data', 'x-www-form-urlencoded', 'xml', 'plain-text'];
  authTypes: AuthType[] = ['none', 'bearer', 'basic', 'apikey'];

  ngOnInit(): void {
    this.initializeForm();
    const saved = this.apiRunner.lastConfig();

    if (saved) {
      this.configForm.patchValue({
        ...saved,
        headers: typeof saved.headers === 'object' ? JSON.stringify(saved.headers, null, 2) : saved.headers,
        sampleBody: typeof saved.sampleBody === 'object' ? JSON.stringify(saved.sampleBody, null, 2) : saved.sampleBody
      });
    }

    // Reactive effect to disable form inputs during testing
    effect(() => {
      const testing = this.isTesting();
      if (testing) {
        this.configForm.disable();
      } else {
        this.configForm.enable();
      }
    });
  }

  /**
   * Initialize the reactive form with default values and validators
   *
   * @private
   */
  private initializeForm(): void {
    this.configForm = this.fb.group({
      url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      method: ['POST', Validators.required],
      bodyType: ['json'],
      requestCount: [10, [Validators.required, Validators.min(1), Validators.max(10000)]],
      requestDelay: [0, [Validators.required, Validators.min(0), Validators.max(10000)]],
      concurrency: [5, [Validators.required, Validators.min(1), Validators.max(100)]],
      headers: [''],
      sampleBody: [''],
      timeout: [30000, [Validators.min(1000), Validators.max(120000)]],
      testDuration: [0, [Validators.min(0), Validators.max(3600)]],
      useFaker: [true],
      authType: ['none'],
      authToken: [''],
      basicUsername: [''],
      basicPassword: [''],
      apiKeyName: [''],
      apiKeyValue: [''],
      apiKeyAddTo: ['header'],
    });
    this.configForm.valueChanges.subscribe(val => {
      this.apiRunner.lastConfig.set(val);
    });
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (!this.configForm.valid) {
      return;
    }

    const formValue = this.configForm.value;

    // Parse headers JSON
    let headers: Record<string, string> = {};
    if (formValue.headers && formValue.headers.trim()) {
      try {
        headers = JSON.parse(formValue.headers);
      } catch (error) {
        console.warn('[ConfigPanel] Invalid headers JSON, ignoring:', error);
      }
    }

    // Parse sample body JSON
    let sampleBody: any = {};
    if (formValue.sampleBody && formValue.sampleBody.trim()) {
        try {
        sampleBody = JSON.parse(formValue.sampleBody);
      } catch (error) {
        console.warn('[ConfigPanel] Invalid sample body JSON, ignoring:', error);
      }
    }

    // Handle authentication
    const authType: AuthType = formValue.authType || 'none';

    if (authType === 'bearer' && formValue.authToken) {
      this.tokenManager.setToken(formValue.authToken);
    }

    const config: ApiRequestConfig = {
      url: formValue.url,
      method: formValue.method,
      bodyType: formValue.bodyType,
      requestCount: formValue.requestCount,
      requestDelay: formValue.requestDelay,
      concurrency: formValue.concurrency,
      headers,
      sampleBody,
      timeout: formValue.timeout,
      testDuration: formValue.testDuration > 0 ? formValue.testDuration : undefined,
      useFaker: formValue.useFaker,
      authType: authType,
      authToken: authType === 'bearer' ? formValue.authToken : undefined,
      basicAuthConfig: authType === 'basic' ? {
        username: formValue.basicUsername,
        password: formValue.basicPassword,
      } : undefined,
      apiKeyAuthConfig: authType === 'apikey' ? {
        key: formValue.apiKeyName,
        value: formValue.apiKeyValue,
        addTo: formValue.apiKeyAddTo,
      } : undefined,
    };

    console.log('[ConfigPanelForm] Submitting config:', config);
    this.apiRunner.lastConfig.set(config);
    this.configSubmitted.emit(config);
  }

  /**
   * Stop the currently running test
   */
  onStopTest(): void {
    this.apiRunner.stopTest();
  }

  private tryParseJson(value: string): any {
  if (!value || !value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
  /**
   * Check if a field is invalid and touched
   *
   * @param fieldName - The form field name
   * @returns True if field is invalid and touched
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.configForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get error message for a specific field
   *
   * @param fieldName - The form field name
   * @returns Error message string
   */
  getErrorMessage(fieldName: string): string {
    const field = this.configForm.get(fieldName);
    if (!field || !field.errors) {
      return '';
    }

    if (field.hasError('required')) {
      return `${this.formatFieldName(fieldName)} is required`;
    }

    if (field.hasError('pattern')) {
      return `${this.formatFieldName(fieldName)} must be a valid URL`;
    }

    if (field.hasError('min')) {
      return `${this.formatFieldName(fieldName)} value is too small`;
    }

    if (field.hasError('max')) {
      return `${this.formatFieldName(fieldName)} value is too large`;
    }

    return 'Invalid input';
  }

  /**
   * Format field name for display in error messages
   *
   * @param fieldName - The field name to format
   * @returns Formatted field name
   */
  private formatFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Format body type for display
   *
   * @param type - The body type to format
   * @returns Formatted body type
   */
  formatBodyType(type: BodyType): string {
    const typeMap: Record<BodyType, string> = {
      'json': 'JSON',
      'form-data': 'Form Data (multipart)',
      'x-www-form-urlencoded': 'URL Encoded',
      'xml': 'XML',
      'plain-text': 'Plain Text',
    };
    return typeMap[type];
  }

  /**
   * Format auth type for display
   *
   * @param type - The auth type to format
   * @returns Formatted auth type
   */
  formatAuthType(type: AuthType): string {
    const typeMap: Record<AuthType, string> = {
      'none': 'No Authentication',
      'bearer': 'Bearer Token',
      'basic': 'Basic Auth',
      'apikey': 'API Key',
    };
    return typeMap[type];
  }
}
