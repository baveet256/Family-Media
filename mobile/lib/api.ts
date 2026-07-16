import { Platform } from 'react-native';

import { getStoredToken, setStoredToken } from '@/lib/tokenStorage';

const DEFAULT_PORT = 3000;

function getDefaultApiUrl(): string {
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }
  // Browser on the same machine can always use localhost
  if (Platform.OS === 'web') {
    return `http://localhost:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? getDefaultApiUrl();

export type HealthResponse = {
  status: 'ok' | 'error';
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
  details?: Record<string, { status: string; message?: string }>;
};

export type User = {
  id: string;
  phone: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilySummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  inviteCode: string;
  role: 'admin' | 'member';
  status?: 'pending' | 'active' | 'removed';
  personId?: string | null;
  settings?: {
    requireApproval: boolean;
    whoCanInvite: string;
  };
};

export type AuthSession = {
  accessToken: string;
  isNewUser: boolean;
  user: User;
  families: FamilySummary[];
  needsProfile: boolean;
  needsFamily: boolean;
};

export type MeResponse = {
  user: User;
  families: FamilySummary[];
  pendingJoinRequests: Array<{
    id: string;
    status: string;
    hasOnboarding?: boolean;
    family: { id: string; name: string; avatarUrl: string | null };
    createdAt: string;
  }>;
  needsProfile: boolean;
  needsFamily: boolean;
  needsOnboarding: boolean;
  onboardingJoinRequestId: string | null;
};

export type JoinRequestRow = {
  id: string;
  status: string;
  inviteCode: string | null;
  createdAt: string;
  hasOnboarding?: boolean;
  onboardingKeys?: string[];
  user: {
    id: string;
    phone: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export type PersonRef = {
  personId?: string;
  name?: string;
  phone?: string;
};

export type TreeNode = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  userId: string | null;
  isPlaceholder: boolean;
  phone?: string | null;
};

export type TreeEdge = {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: 'parent_of' | 'spouse_of' | 'sibling_of';
  source: string;
};

export type FamilyTree = {
  family: { id: string; name: string; avatarUrl: string | null };
  nodes: TreeNode[];
  edges: TreeEdge[];
};

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data &&
      'message' in data &&
      (data as { message: string | string[] }).message
        ? Array.isArray((data as { message: string | string[] }).message)
          ? (data as { message: string[] }).message.join(', ')
          : String((data as { message: string }).message)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

export async function sendOtp(phone: string) {
  return apiFetch<{
    ok: boolean;
    phone: string;
    expiresInSeconds: number;
    devOtp?: string;
  }>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(
  phone: string,
  otp: string,
  displayName?: string,
) {
  const session = await apiFetch<AuthSession>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, displayName }),
  });
  await setStoredToken(session.accessToken);
  return session;
}

export async function fetchMe(token: string) {
  return apiFetch<MeResponse>('/users/me', { token });
}

export async function updateMe(
  token: string,
  body: { displayName?: string; avatarUrl?: string | null },
) {
  return apiFetch<{ user: User }>('/users/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export async function createFamily(
  token: string,
  body: { name: string; requireApproval?: boolean },
) {
  return apiFetch<{
    family: FamilySummary & {
      settings: { requireApproval: boolean; whoCanInvite: string };
      createdAt: string;
    };
    role: 'admin';
  }>('/families', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function getFamily(token: string, familyId: string) {
  return apiFetch<{
    family: FamilySummary & {
      settings: { requireApproval: boolean; whoCanInvite: string };
      createdAt: string;
    };
    role: 'admin' | 'member';
    status: string;
  }>(`/families/${familyId}`, { token });
}

export async function updateFamily(
  token: string,
  familyId: string,
  body: { name?: string; requireApproval?: boolean },
) {
  return apiFetch<{ family: FamilySummary }>(`/families/${familyId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export async function inviteByPhone(
  token: string,
  familyId: string,
  phone: string,
) {
  return apiFetch<{
    ok: boolean;
    phone: string;
    inviteCode: string;
    deepLink: string;
    smsStub: boolean;
    message: string;
  }>(`/families/${familyId}/invites`, {
    method: 'POST',
    token,
    body: JSON.stringify({ phone }),
  });
}

export async function listJoinRequests(token: string, familyId: string) {
  return apiFetch<{ joinRequests: JoinRequestRow[] }>(
    `/families/${familyId}/join-requests`,
    { token },
  );
}

export async function createJoinRequest(token: string, inviteCode: string) {
  return apiFetch<{
    joinRequest: {
      id: string;
      status: string;
      inviteCode: string | null;
      createdAt: string;
      family: { id: string; name: string; avatarUrl: string | null };
    };
    alreadyPending: boolean;
    needsOnboarding?: boolean;
  }>('/join-requests', {
    method: 'POST',
    token,
    body: JSON.stringify({ inviteCode }),
  });
}

export async function submitOnboarding(
  token: string,
  joinRequestId: string,
  body: {
    parent: PersonRef;
    spouse?: PersonRef | null;
    siblings?: PersonRef[];
  },
) {
  return apiFetch<{
    ok?: boolean;
    awaitingApproval?: boolean;
    message?: string;
    status?: string;
    personId?: string;
  }>(`/join-requests/${joinRequestId}/onboarding`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function approveJoinRequest(token: string, joinRequestId: string) {
  return apiFetch<{ ok: boolean; personId?: string; status?: string }>(
    `/join-requests/${joinRequestId}/approve`,
    { method: 'POST', token },
  );
}

export async function rejectJoinRequest(token: string, joinRequestId: string) {
  return apiFetch<{ ok: boolean; status?: string }>(
    `/join-requests/${joinRequestId}/reject`,
    { method: 'POST', token },
  );
}

export async function fetchFamilyTree(token: string, familyId: string) {
  return apiFetch<FamilyTree>(`/families/${familyId}/tree`, { token });
}

export async function listFamilyPersons(token: string, familyId: string) {
  return apiFetch<{
    persons: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      userId: string | null;
      isPlaceholder: boolean;
    }>;
  }>(`/families/${familyId}/persons`, { token });
}

export async function fetchPerson(token: string, personId: string) {
  return apiFetch<{
    person: TreeNode & { familyId: string };
    parents: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
    children: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
    spouses: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
    siblings: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
    summary: string;
  }>(`/persons/${personId}`, { token });
}

export { ApiError, getStoredToken, setStoredToken };
