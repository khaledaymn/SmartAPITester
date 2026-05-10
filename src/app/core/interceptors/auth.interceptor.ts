import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenManagerService } from '../services/token-manager.service';
import { ApiRunnerService } from '../services/api-runner.service';
import { AuthType, BasicAuthConfig, ApiKeyAuthConfig } from '../models/request-config.model';

/**
 * Functional HTTP Interceptor for handling multiple authentication types.
 *
 * Supports the following authentication methods:
 * - Bearer: Authorization: Bearer <token>
 * - Basic: Authorization: Basic <base64(username:password)>
 * - API Key: Custom header or query parameter
 * - None: No authentication
 *
 * The interceptor reads the authType and associated configurations from the
 * ApiRunnerService's lastConfig signal.
 *
 * Usage: Add this to the HTTP provider configuration:
 *
 * ```typescript
 * provideHttpClient(
 *   withInterceptors([authInterceptor])
 * )
 * ```
 *
 * @returns HttpInterceptorFn that processes requests and adds auth headers/params
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenManager = inject(TokenManagerService);
  const apiRunner = inject(ApiRunnerService);

  // Get the last config which contains auth information
  const lastConfig = apiRunner.lastConfig();
  const authType: AuthType = lastConfig?.authType || 'bearer';

  // Clone and modify the request based on auth type
  let modifiedReq = req;

  switch (authType) {
    case 'bearer':
      modifiedReq = applyBearerAuth(modifiedReq, tokenManager);
      break;

    case 'basic':
      if (lastConfig?.basicAuthConfig) {
        modifiedReq = applyBasicAuth(modifiedReq, lastConfig.basicAuthConfig);
      }
      break;

    case 'apikey':
      if (lastConfig?.apiKeyAuthConfig) {
        modifiedReq = applyApiKeyAuth(modifiedReq, lastConfig.apiKeyAuthConfig);
      }
      break;

    case 'none':
    default:
      // No authentication needed
      break;
  }

  return next(modifiedReq);
};

/**
 * Apply Bearer token authentication
 */
function applyBearerAuth(req: HttpRequest<any>, tokenManager: TokenManagerService): HttpRequest<any> {
  const token = tokenManager.getToken();

  if (token) {
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return req;
}

/**
 * Apply Basic authentication
 */
function applyBasicAuth(req: HttpRequest<any>, config: BasicAuthConfig): HttpRequest<any> {
  const credentials = `${config.username}:${config.password}`;
  const encodedCredentials = btoa(credentials);

  return req.clone({
    setHeaders: {
      Authorization: `Basic ${encodedCredentials}`,
    },
  });
}

/**
 * Apply API Key authentication
 */
function applyApiKeyAuth(req: HttpRequest<any>, config: ApiKeyAuthConfig): HttpRequest<any> {
  if (config.addTo === 'header') {
    // Add as custom header
    return req.clone({
      setHeaders: {
        [config.key]: config.value,
      },
    });
  } else if (config.addTo === 'query') {
    // Add as query parameter
    const url = new URL(req.url);
    url.searchParams.append(config.key, config.value);

    return req.clone({
      url: url.toString(),
    });
  }

  return req;
}
