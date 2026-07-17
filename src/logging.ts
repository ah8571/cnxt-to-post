/**
 * Structured error logging and monitoring system
 * Provides consistent error tracking, correlation IDs, and severity levels
 */

import { generateCorrelationId, redactToken } from "./crypto";

export enum ErrorSeverity {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export enum ErrorType {
  // Authentication & Authorization
  AUTH_FAILED = "auth_failed",
  TOKEN_EXPIRED = "token_expired",
  TOKEN_INVALID = "token_invalid",
  PERMISSION_DENIED = "permission_denied",

  // API Errors
  API_RATE_LIMIT = "api_rate_limit",
  API_TIMEOUT = "api_timeout",
  API_INVALID_RESPONSE = "api_invalid_response",
  API_CONNECTION_FAILED = "api_connection_failed",

  // Platform-specific
  PLATFORM_BLUESKY_ERROR = "platform_bluesky_error",
  PLATFORM_X_ERROR = "platform_x_error",
  PLATFORM_LINKEDIN_ERROR = "platform_linkedin_error",
  PLATFORM_FACEBOOK_ERROR = "platform_facebook_error",
  PLATFORM_INSTAGRAM_ERROR = "platform_instagram_error",
  PLATFORM_THREADS_ERROR = "platform_threads_error",
  PLATFORM_TIKTOK_ERROR = "platform_tiktok_error",

  // Validation Errors
  VALIDATION_FAILED = "validation_failed",
  MISSING_REQUIRED_FIELD = "missing_required_field",
  INVALID_DATA_FORMAT = "invalid_data_format",

  // Database Errors
  DATABASE_CONNECTION_FAILED = "database_connection_failed",
  DATABASE_QUERY_FAILED = "database_query_failed",
  DATABASE_CONSTRAINT_VIOLATED = "database_constraint_violated",

  // Business Logic Errors
  POST_FAILED = "post_failed",
  POST_NOT_FOUND = "post_not_found",
  SCHEDULE_CONFLICT = "schedule_conflict",
  INSUFFICIENT_CREDITS = "insufficient_credits",

  // System Errors
  INTERNAL_ERROR = "internal_error",
  SERVICE_UNAVAILABLE = "service_unavailable",
  CONFIGURATION_ERROR = "configuration_error",
}

export interface ErrorLogEntry {
  correlation_id: string;
  error_type: ErrorType;
  error_code?: string;
  error_message: string;
  error_stack?: string;
  severity: ErrorSeverity;
  user_id?: string;
  endpoint?: string;
  method?: string;
  request_body?: Record<string, unknown>;
  platform?: string;
  user_agent?: string;
  ip_address?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface ErrorContext {
  userId?: string;
  endpoint?: string;
  method?: string;
  requestBody?: Record<string, unknown>;
  platform?: string;
  userAgent?: string;
  ipAddress?: string;
  additionalContext?: Record<string, unknown>;
}

/**
 * Log error to both console and database (if configured)
 */
export async function logError(
  errorType: ErrorType,
  errorMessage: string,
  severity: ErrorSeverity = ErrorSeverity.ERROR,
  context?: ErrorContext,
  error?: Error
): Promise<void> {
  const correlationId = generateCorrelationId();
  const timestamp = new Date().toISOString();

  const logEntry: ErrorLogEntry = {
    correlation_id: correlationId,
    error_type: errorType,
    error_message: errorMessage,
    severity,
    user_id: context?.userId,
    endpoint: context?.endpoint,
    method: context?.method,
    request_body: sanitizeRequestBody(context?.requestBody),
    platform: context?.platform,
    user_agent: context?.userAgent,
    ip_address: context?.ipAddress,
    timestamp,
    context: context?.additionalContext,
  };

  // Add error details if provided
  if (error) {
    logEntry.error_code = (error as any).code;
    logEntry.error_stack = error.stack;
  }

  // Log to console (structured JSON)
  console.error(JSON.stringify(logEntry));

  // In production, you'd also send this to:
  // 1. Database for long-term storage
  // 2. Error tracking service (Sentry, DataDog, etc.)
  // 3. Monitoring dashboard

  // TODO: Implement database logging when Supabase is configured
  // await logErrorToDatabase(logEntry);
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!body) return undefined;

  const sanitized = { ...body };
  const sensitiveFields = [
    "access_token",
    "refresh_token", 
    "password",
    "api_key",
    "secret",
    "authorization",
    "token",
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = redactToken(sanitized[field] as string);
    }
  }

  return sanitized;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  errorType: ErrorType,
  message: string,
  correlationId: string,
  statusCode: number = 500
): { error: string; error_type: ErrorType; correlation_id: string; status: number } {
  return {
    error: message,
    error_type: errorType,
    correlation_id: correlationId,
    status: statusCode,
  };
}

/**
 * Log API request for debugging and analytics
 */
export interface RequestLogEntry {
  correlation_id: string;
  endpoint: string;
  method: string;
  user_id?: string;
  status_code: number;
  duration_ms: number;
  timestamp: string;
  platform?: string;
}

export async function logRequest(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number,
  userId?: string,
  platform?: string
): Promise<void> {
  const logEntry: RequestLogEntry = {
    correlation_id: generateCorrelationId(),
    endpoint,
    method,
    user_id: userId,
    status_code: statusCode,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
    platform,
  };

  // Log success responses as info level
  if (statusCode >= 200 && statusCode < 400) {
    console.info(JSON.stringify(logEntry));
  } else {
    // Log error responses as warning level
    console.warn(JSON.stringify(logEntry));
  }
}

/**
 * Wrap API handlers with error logging and request tracking
 */
export function withErrorLogging<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  context: {
    endpoint: string;
    method: string;
  }
): T {
  return (async (...args: unknown[]) => {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    try {
      const response = await handler(...args);
      const duration = Date.now() - startTime;

      // Log request completion
      await logRequest(
        context.endpoint,
        context.method,
        response.status,
        duration,
        // Extract user ID from args if available
        undefined, // We'll extract this in the actual implementation
        undefined // Platform if available
      );

      // Add correlation ID to response headers
      response.headers.set("X-Correlation-ID", correlationId);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log the error
      await logError(
        ErrorType.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Unknown error",
        ErrorSeverity.ERROR,
        {
          endpoint: context.endpoint,
          method: context.method,
        },
        error instanceof Error ? error : undefined
      );

      // Log failed request
      await logRequest(
        context.endpoint,
        context.method,
        500,
        duration
      );

      // Return standardized error response
      const errorResponse = createErrorResponse(
        ErrorType.INTERNAL_ERROR,
        "An internal error occurred. Please try again later.",
        correlationId,
        500
      );

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId,
        },
      });
    }
  }) as T;
}

/**
 * Log platform-specific errors with detailed context
 */
export async function logPlatformError(
  platform: string,
  errorType: ErrorType,
  errorMessage: string,
  context?: ErrorContext,
  error?: Error
): Promise<void> {
  await logError(
    errorType,
    `[${platform.toUpperCase()}] ${errorMessage}`,
    ErrorSeverity.ERROR,
    { ...context, platform },
    error
  );
}

/**
 * Log authentication errors
 */
export async function logAuthError(
  errorType: ErrorType,
  errorMessage: string,
  context?: ErrorContext
): Promise<void> {
  await logError(
    errorType,
    `[AUTH] ${errorMessage}`,
    ErrorSeverity.WARNING,
    context
  );
}

/**
 * Log rate limit errors
 */
export async function logRateLimitError(
  platform: string,
  limit: number,
  window: string,
  context?: ErrorContext
): Promise<void> {
  await logError(
    ErrorType.API_RATE_LIMIT,
    `Rate limit exceeded for ${platform}. Limit: ${limit} per ${window}`,
    ErrorSeverity.WARNING,
    { ...context, platform }
  );
}

/**
 * Log successful operations for audit trail
 */
export async function logSuccess(
  operation: string,
  details: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const logEntry = {
    correlation_id: generateCorrelationId(),
    operation,
    details,
    user_id: userId,
    timestamp: new Date().toISOString(),
    severity: "info",
  };

  console.info(JSON.stringify(logEntry));
}

/**
 * Health check monitoring
 */
export interface HealthCheckResult {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  response_time_ms?: number;
  timestamp: string;
}

export interface SystemHealth {
  overall_status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheckResult[];
  timestamp: string;
}

export async function performHealthChecks(): Promise<SystemHealth> {
  const checks: HealthCheckResult[] = [];
  const timestamp = new Date().toISOString();

  // Example health checks (you'd implement actual checks)
  checks.push({
    service: "worker",
    status: "healthy",
    timestamp,
  });

  // Determine overall status
  const overallStatus: "healthy" | "degraded" | "unhealthy" = checks.every(
    check => check.status === "healthy"
  ) ? "healthy" : 
  checks.some(check => check.status === "unhealthy") ? "unhealthy" : "degraded";

  return {
    overall_status: overallStatus,
    checks,
    timestamp,
  };
}

/**
 * Create a monitoring alert for critical issues
 */
export async function createAlert(
  alertType: string,
  severity: ErrorSeverity,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  const alert = {
    alert_type: alertType,
    severity,
    message,
    context,
    timestamp: new Date().toISOString(),
    correlation_id: generateCorrelationId(),
  };

  console.error(JSON.stringify(alert));

  // TODO: Send to monitoring service (PagerDuty, Slack, etc.)
  // await sendAlertToMonitoringService(alert);
}

/**
 * Performance tracking for API endpoints
 */
export interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration_ms: number;
  timestamp: string;
  user_id?: string;
  status_code: number;
}

const performanceMetrics: PerformanceMetric[] = [];

export function trackPerformance(
  endpoint: string,
  method: string,
  durationMs: number,
  statusCode: number,
  userId?: string
): void {
  const metric: PerformanceMetric = {
    endpoint,
    method,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
    user_id: userId,
    status_code: statusCode,
  };

  performanceMetrics.push(metric);

  // Keep only last 1000 metrics in memory
  if (performanceMetrics.length > 1000) {
    performanceMetrics.shift();
  }
}

export function getAverageResponseTime(endpoint?: string): number {
  const relevantMetrics = endpoint 
    ? performanceMetrics.filter(m => m.endpoint === endpoint)
    : performanceMetrics;

  if (relevantMetrics.length === 0) return 0;

  const total = relevantMetrics.reduce((sum, m) => sum + m.duration_ms, 0);
  return total / relevantMetrics.length;
}

/**
 * Get performance statistics for monitoring dashboard
 */
export function getPerformanceStats() {
  if (performanceMetrics.length === 0) {
    return {
      total_requests: 0,
      average_response_time: 0,
      error_rate: 0,
      slowest_endpoint: null,
      fastest_endpoint: null,
    };
  }

  const totalRequests = performanceMetrics.length;
  const errorCount = performanceMetrics.filter(m => m.status_code >= 400).length;
  const averageResponseTime = getAverageResponseTime();

  // Find slowest and fastest endpoints
  const byEndpoint = new Map<string, number[]>();
  performanceMetrics.forEach(m => {
    if (!byEndpoint.has(m.endpoint)) {
      byEndpoint.set(m.endpoint, []);
    }
    byEndpoint.get(m.endpoint)!.push(m.duration_ms);
  });

  let slowestEndpoint: { endpoint: string; avgMs: number } | null = null;
  let fastestEndpoint: { endpoint: string; avgMs: number } | null = null;

  for (const [endpoint, durations] of byEndpoint) {
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    if (!slowestEndpoint || avgMs > slowestEndpoint.avgMs) {
      slowestEndpoint = { endpoint, avgMs };
    }
    if (!fastestEndpoint || avgMs < fastestEndpoint.avgMs) {
      fastestEndpoint = { endpoint, avgMs };
    }
  }

  return {
    total_requests: totalRequests,
    average_response_time: averageResponseTime,
    error_rate: (errorCount / totalRequests) * 100,
    slowest_endpoint: slowestEndpoint,
    fastest_endpoint: fastestEndpoint,
  };
}