import { Injectable, computed, signal } from '@angular/core';

const TOKEN_STORAGE_KEY = 'api_lab_auth_token';

/**
 * TokenManagerService
 *
 * Manages authentication token state and persistence using Angular Signals.
 * Handles token storage, retrieval, and lifecycle management with localStorage integration.
 *
 * @standalone
 */
@Injectable({
  providedIn: 'root',
})
export class TokenManagerService {
  /**
   * Signal to store the current authentication token
   * @private
   */
  private readonly authToken = signal<string | null>(null);

  /**
   * Computed signal that indicates whether the user is authenticated
   * Returns true if a valid token exists, false otherwise
   */
  readonly isAuthenticated = computed(() => !!this.authToken());

  constructor() {
    this.initializeToken();
  }

  /**
   * Initializes the token from localStorage on service construction
   * Restores the saved token if it exists
   *
   * @private
   */
  private initializeToken(): void {
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        this.authToken.set(storedToken);
      }
    } catch (error) {
      console.error('[TokenManagerService] Error initializing token from localStorage:', error);
    }
  }

  /**
   * Sets a new authentication token and persists it to localStorage
   *
   * @param token - The authentication token to store
   * @throws Will log an error if localStorage is unavailable
   */
  setToken(token: string): void {
    try {
      this.authToken.set(token);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (error) {
      console.error('[TokenManagerService] Error saving token to localStorage:', error);
      // Still update the signal even if localStorage fails
      this.authToken.set(token);
    }
  }

  /**
   * Retrieves the current authentication token
   *
   * @returns The current token string, or null if no token exists
   */
  getToken(): string | null {
    return this.authToken();
  }

  /**
   * Clears the authentication token from both the signal and localStorage
   * Effectively logs out the user
   *
   * @throws Will log an error if localStorage removal fails
   */
  clearToken(): void {
    try {
      this.authToken.set(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('[TokenManagerService] Error clearing token from localStorage:', error);
      // Still clear the signal even if localStorage fails
      this.authToken.set(null);
    }
  }
}
