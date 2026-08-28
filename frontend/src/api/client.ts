export class ApiClientError extends Error {
  public status: number;
  public code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_D2_URL || 'http://localhost:8001';
};

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Important for D2 session auth
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      const text = await response.text();
      throw new ApiClientError(text || 'An unknown error occurred', response.status, 'UNKNOWN_ERROR');
    }

    throw new ApiClientError(
      errorData.message || errorData.error || 'API Request failed',
      response.status,
      errorData.error || 'API_ERROR'
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
}
