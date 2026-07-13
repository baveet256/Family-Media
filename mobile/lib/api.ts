import { Platform } from 'react-native';

const DEFAULT_PORT = 3000;

function getDefaultApiUrl(): string {
  // Browser on your laptop — API runs on same machine
  if (Platform.OS === 'web') {
    return `http://localhost:${DEFAULT_PORT}`;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_BASE_URL =
  Platform.OS === 'web'
    ? `http://localhost:${DEFAULT_PORT}`
    : (process.env.EXPO_PUBLIC_API_URL ?? getDefaultApiUrl());

export type HealthResponse = {
  status: 'ok' | 'error';
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
  details?: Record<string, { status: string; message?: string }>;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }

  return response.json() as Promise<HealthResponse>;
}
