import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { clearSession } from '../utils/session';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Global reference to auth logout function (set by AuthProvider)
let authLogout: (() => Promise<void>) | null = null;

export function setAuthLogout(logoutFn: () => Promise<void>) {
  authLogout = logoutFn;
}

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('token');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      const err = new Error(errorData.error || `HTTP ${response.status}`) as any;
      err.status = response.status;
      
      // Handle 401 Unauthorized - clear session and redirect to login
      if (response.status === 401) {
        await clearSession(async () => {
          // Clear in-memory auth state immediately
          if (authLogout) {
            await authLogout();
          }
        });
        router.replace('/(auth)/login');
      }
      
      throw err;
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  put<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { API_URL };
