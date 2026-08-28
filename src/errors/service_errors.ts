export class ServiceError extends Error {
  public code: string;
  public status: number;
  public details?: any;

  constructor(code: string, message: string, status: number = 500, details?: any) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const ServiceErrors = {
  ML_SERVICE_TIMEOUT: () => new ServiceError('ML_SERVICE_TIMEOUT', 'Machine-learning analysis timed out.', 504),
  ML_SERVICE_UNAVAILABLE: () => new ServiceError('ML_SERVICE_UNAVAILABLE', 'Machine-learning service is temporarily unavailable.', 503),
  AI_SERVICE_UNAVAILABLE: () => new ServiceError('AI_SERVICE_UNAVAILABLE', 'AI analysis is temporarily unavailable.', 503),
  GRAPH_SERVICE_UNAVAILABLE: () => new ServiceError('GRAPH_SERVICE_UNAVAILABLE', 'Graph analysis is temporarily unavailable.', 503),
  INVALID_SERVICE_RESPONSE: (details?: any) => new ServiceError('INVALID_SERVICE_RESPONSE', 'Downstream service returned an invalid response.', 502, details),
  CASE_ACCESS_DENIED: () => new ServiceError('CASE_ACCESS_DENIED', 'You are not authorized to access this case.', 403),
  SERVICE_TIMEOUT: (serviceName: string) => new ServiceError(`${serviceName}_TIMEOUT`, `${serviceName} timed out.`, 504),
};

export function handleServiceError(error: any): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }
  if (error.name === 'AbortError') {
    return new ServiceError('SERVICE_TIMEOUT', 'Service call timed out.', 504);
  }
  if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
    return new ServiceError('SERVICE_UNAVAILABLE', 'Service is temporarily unavailable.', 503);
  }
  return new ServiceError('INTERNAL_ERROR', error.message || 'An unexpected error occurred.', 500);
}
