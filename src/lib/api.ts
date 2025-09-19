const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  context?: {
    recommendations?: any[];
    compatibility?: any;
  };
}

export interface Component {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  description: string;
  specifications: any;
  compatibility: any;
  datasheetUrl?: string;
  imageUrl?: string;
  price?: number;
  availability: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

class ApiClient {
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      headers: { ...defaultHeaders, ...options.headers },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<T> = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Chat API
  async sendChatMessage(
    message: string,
    sessionId?: string,
    context?: any
  ): Promise<ApiResponse<{
    message: ChatMessage;
    sessionId: string;
    recommendations?: any[];
    compatibility?: any;
  }>> {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        sessionId,
        context,
      }),
    });
  }

  async getChatSession(sessionId: string): Promise<ApiResponse<any>> {
    return this.request(`/chat/sessions/${sessionId}`);
  }

  async clearChatSession(sessionId: string): Promise<ApiResponse> {
    return this.request(`/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async getChatSuggestions(): Promise<ApiResponse<any[]>> {
    return this.request('/chat/suggestions');
  }

  // Components API
  async searchComponents(
    query: string,
    filters?: {
      category?: string;
      manufacturer?: string;
      voltageRange?: { min: number; max: number };
      protocols?: string[];
      maxPrice?: number;
    }
  ): Promise<ApiResponse<Component[]>> {
    const params = new URLSearchParams();

    if (query) params.append('query', query);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.manufacturer) params.append('manufacturer', filters.manufacturer);
    if (filters?.voltageRange) params.append('voltageRange', JSON.stringify(filters.voltageRange));
    if (filters?.protocols) params.append('protocols', JSON.stringify(filters.protocols));
    if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());

    return this.request(`/components/search?${params.toString()}`);
  }

  async getComponent(id: string): Promise<ApiResponse<Component>> {
    return this.request(`/components/${id}`);
  }

  async getComponentCompatibility(
    componentId: string,
    boardId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/components/${componentId}/compatibility/${boardId}`);
  }

  async getComponentsByCategory(
    category: string,
    limit: number = 20
  ): Promise<ApiResponse<Component[]>> {
    return this.request(`/components/category/${category}?limit=${limit}`);
  }

  async getPopularComponents(limit: number = 10): Promise<ApiResponse<Component[]>> {
    return this.request(`/components/popular?limit=${limit}`);
  }

  async getCompatibleComponents(
    boardId: string,
    category?: string
  ): Promise<ApiResponse<Component[]>> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request(`/components/compatible/${boardId}${params}`);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request('/health');
  }

  // Cache management
  async getCacheStats(): Promise<ApiResponse<any>> {
    return this.request('/cache/stats');
  }

  async clearCache(pattern: string): Promise<ApiResponse<any>> {
    return this.request(`/cache/clear?pattern=${encodeURIComponent(pattern)}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();

// Utility functions for error handling
export function isApiError(response: ApiResponse): boolean {
  return !response.success;
}

export function getApiErrorMessage(response: ApiResponse): string {
  return response.message || response.error || 'An unknown error occurred';
}

// Hook for React Query integration
export function createApiQuery<T>(
  queryFn: () => Promise<ApiResponse<T>>
) {
  return async (): Promise<T> => {
    const response = await queryFn();

    if (isApiError(response)) {
      throw new Error(getApiErrorMessage(response));
    }

    return response.data!;
  };
}