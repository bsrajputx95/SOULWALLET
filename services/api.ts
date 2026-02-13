import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { clearSession } from '../utils/session';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Global reference to auth logout function (set by AuthProvider)
let authLogout: (() => Promise<void>) | null = null;

export function setAuthLogout(logoutFn: () => Promise<void>) {
  authLogout = logoutFn;
}

type ApiError = Error & { status?: number };

const getErrorMessage = async (response: Response): Promise<string> => {
  const fallbackMessage = `HTTP ${response.status}`;

  try {
    const responseText = await response.text();
    if (!responseText) {
      return fallbackMessage;
    }

    try {
      const parsed = JSON.parse(responseText) as { error?: string; message?: string };
      return parsed.error || parsed.message || fallbackMessage;
    } catch {
      return responseText;
    }
  } catch {
    return fallbackMessage;
  }
};

const parseSuccessResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return {} as T;
  }

  const responseText = await response.text();
  if (!responseText) {
    return {} as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    return responseText as T;
  }
};

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('token');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const message = await getErrorMessage(response);
      const err = new Error(message) as ApiError;
      err.status = response.status;
      // Handle 401 Unauthorized - clear session and redirect to login
      if (response.status === 401) {
        await clearSession();

        if (authLogout) {
          await authLogout().catch(() => {
            // Ignore logout callback errors, session is already cleared.
          });
        }

        router.replace('/(auth)/login');
      }
      throw err;
    }
    return parseSuccessResponse<T>(response);
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body: unknown) {
    if (body == null) {
      return this.request<T>(endpoint, { method: 'POST' });
    }
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  put<T>(endpoint: string, body: unknown) {
    if (body == null) {
      return this.request<T>(endpoint, { method: 'PUT' });
    }
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { API_URL };
