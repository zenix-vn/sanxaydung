import { NextResponse } from 'next/server';
import type { ApiResponse } from './types';

// CORS mở cho app mobile / client ngoài. Siết origin ở production nếu cần.
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey',
};

export function ok<T>(data: T, meta?: ApiResponse<T>['meta']) {
  return NextResponse.json<ApiResponse<T>>({ data, error: null, meta }, { headers: CORS_HEADERS });
}

export function fail(message: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>(
    { data: null, error: message },
    { status, headers: CORS_HEADERS },
  );
}
