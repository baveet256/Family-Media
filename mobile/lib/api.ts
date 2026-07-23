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
  const isFormData =
    typeof FormData !== 'undefined' && rest.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

export type FeedPost = {
  id: string;
  familyId: string;
  caption: string | null;
  visibility: string;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  media: Array<{
    id: string;
    mediaType: 'image' | 'video';
    url: string;
    thumbnailUrl: string | null;
    sortOrder: number;
  }>;
  reactions: {
    counts: Record<string, number>;
    total: number;
    mine: string | null;
  };
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
  commentCount: number;
};

export async function fetchFeed(
  token: string,
  familyId: string,
  opts: { cursor?: string; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (opts.cursor) params.set('cursor', opts.cursor);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<{ posts: FeedPost[]; nextCursor: string | null }>(
    `/families/${familyId}/feed${qs ? `?${qs}` : ''}`,
    { token },
  );
}

export async function createPost(
  token: string,
  body: {
    familyId: string;
    caption?: string;
    media?: Array<{
      mediaType: 'image' | 'video';
      url: string;
      thumbnailUrl?: string;
      sortOrder?: number;
    }>;
  },
) {
  return apiFetch<{ post: FeedPost }>('/posts', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchPost(token: string, postId: string) {
  return apiFetch<{ post: FeedPost }>(`/posts/${postId}`, { token });
}

export async function reactToPost(
  token: string,
  postId: string,
  emoji: string,
) {
  return apiFetch<{ post: FeedPost }>(`/posts/${postId}/reactions`, {
    method: 'POST',
    token,
    body: JSON.stringify({ emoji }),
  });
}

export async function commentOnPost(
  token: string,
  postId: string,
  body: string,
) {
  return apiFetch<{ post: FeedPost }>(`/posts/${postId}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });
}

export async function fetchMyPosts(token: string, familyId: string) {
  return apiFetch<{ posts: FeedPost[] }>(`/families/${familyId}/my-posts`, {
    token,
  });
}

export async function presignMedia(
  token: string,
  mediaType: 'image' | 'video',
  filename?: string,
) {
  return apiFetch<{
    key: string;
    uploadUrl: string;
    publicUrl: string;
    fields: { key: string };
    method: string;
    mediaType: string;
  }>('/media/presign', {
    method: 'POST',
    token,
    body: JSON.stringify({ mediaType, filename }),
  });
}

export async function uploadMediaFile(
  token: string,
  uploadUrl: string,
  key: string,
  file: { uri: string; name: string; type: string },
) {
  const form = new FormData();
  form.append('key', key);
  // React Native FormData file shape
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  // uploadUrl may be absolute; if so use it directly
  const path = uploadUrl.startsWith('http')
    ? uploadUrl.replace(API_BASE_URL, '')
    : uploadUrl;
  return apiFetch<{ ok: boolean; publicUrl: string; key: string }>(path, {
    method: 'POST',
    token,
    body: form,
  });
}

export type StoryItem = {
  id: string;
  mediaType: 'image' | 'video' | string;
  url: string;
  expiresAt: string;
  createdAt: string;
  viewedByMe: boolean;
};

export type StoryRing = {
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  hasUnseen: boolean;
  stories: StoryItem[];
};

export async function fetchStoryRings(token: string, familyId: string) {
  return apiFetch<{ rings: StoryRing[] }>(`/families/${familyId}/stories`, {
    token,
  });
}

export async function createStory(
  token: string,
  body: {
    familyId: string;
    mediaType: 'image' | 'video';
    url: string;
    expiresInSeconds?: number;
  },
) {
  return apiFetch<{
    story: StoryItem & {
      familyId: string;
      author: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
    };
  }>('/stories', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function markStoryViewed(token: string, storyId: string) {
  return apiFetch<{ ok: boolean }>(`/stories/${storyId}/view`, {
    method: 'POST',
    token,
  });
}

export async function fetchStoryViewers(token: string, storyId: string) {
  return apiFetch<{
    viewers: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      viewedAt: string;
    }>;
  }>(`/stories/${storyId}/viewers`, { token });
}

export { ApiError, getStoredToken, setStoredToken };
