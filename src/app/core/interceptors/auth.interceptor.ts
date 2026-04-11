import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenManagerService } from '../services/token-manager.service';

/**
 * Functional HTTP Interceptor for handling authentication tokens.
 *
 * This interceptor automatically adds the Authorization header with a Bearer token
 * to outgoing HTTP requests if a token exists in the TokenManagerService.
 *
 * Usage: Add this to the HTTP provider configuration:
 *
 * ```typescript
 * provideHttpClient(
 *   withInterceptors([authInterceptor])
 * )
 * ```
 *
 * @returns HttpInterceptorFn that processes requests and adds Bearer token if available
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenManager = inject(TokenManagerService);

  // Get the current token from the TokenManagerService
  const token = tokenManager.getToken();

  // If a token exists, clone the request and add the Authorization header
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // Pass the request (with or without token) to the next handler
  return next(req);
};
