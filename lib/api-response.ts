import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * 统一错误响应格式
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

/**
 * 统一成功响应格式
 */
export interface ApiResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * 统一错误响应格式
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 通用错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  
  // 业务错误
  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",
  
  // RSS 相关
  FEED_NOT_FOUND = "FEED_NOT_FOUND",
  FEED_ALREADY_EXISTS = "FEED_ALREADY_EXISTS",
  INVALID_FEED = "INVALID_FEED",
  SYNC_FAILED = "SYNC_FAILED",
  
  // 文章相关
  ARTICLE_NOT_FOUND = "ARTICLE_NOT_FOUND",
  
  // 订阅相关
  SUBSCRIPTION_NOT_FOUND = "SUBSCRIPTION_NOT_FOUND",
  SUBSCRIPTION_ALREADY_EXISTS = "SUBSCRIPTION_ALREADY_EXISTS",
  
  // 分组相关
  GROUP_NOT_FOUND = "GROUP_NOT_FOUND",
  GROUP_ALREADY_EXISTS = "GROUP_ALREADY_EXISTS",
  
  // 收藏相关
  FAVORITE_NOT_FOUND = "FAVORITE_NOT_FOUND",
  FAVORITE_ALREADY_EXISTS = "FAVORITE_ALREADY_EXISTS",
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  status: number = 500
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
}

/**
 * 处理 Zod 验证错误
 */
export function handleZodError(error: z.ZodError) {
  return createErrorResponse(
    ErrorCode.INVALID_INPUT,
    "输入数据无效",
    error.issues,
    400
  );
}

/**
 * 处理已知错误
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error("API Error:", error);
  
  // Zod 验证错误
  if (error instanceof z.ZodError) {
    return handleZodError(error);
  }
  
  // 默认内部错误
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    "服务器错误",
    process.env.NODE_ENV === "development" ? String(error) : undefined,
    500
  );
}

/**
 * 异步处理器的包装器，自动处理错误
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  }) as T;
}
