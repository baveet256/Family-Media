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

/**
 * Release builds must talk to a real HTTPS host. Failing loudly here surfaces a
 * misconfigured build during internal testing instead of shipping a store
 * binary that points at localhost or sends tokens over cleartext HTTP.
 */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!__DEV__) {
    if (!configured) {
      throw new Error(
        'EXPO_PUBLIC_API_URL must be set for release builds. Configure it in eas.json.',
      );
    }
    if (!configured.startsWith('https://')) {
      throw new Error(
        `EXPO_PUBLIC_API_URL must use https:// in release builds (got "${configured}").`,
      );
    }
    return configured;
  }

  return configured || getDefaultApiUrl();
}

export const API_BASE_URL = resolveApiBaseUrl();

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Lets AuthContext tear down the session from anywhere a request 401s, so an
 * expired token cannot leave the UI in a logged-in-but-broken state.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export type HealthResponse = {
  status: 'ok' | 'error';
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
  details?: Record<string, { status: string; message?: string }>;
};

export type User = {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl: string | null;
  /** Short "about" line shown when someone holds your face in the tree */
  status?: string;
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
  connections?: ConnectionSummary[];
  context?: ActiveContext | null;
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

export type ConnectionSummary = {
  id: string;
  name: string | null;
  feedPolicy: 'unified_feed' | 'separate_feeds' | string;
  status?: string;
  families: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
  }>;
  bridgeLinks?: Array<{
    id: string;
    linkType: string;
    familyAId: string;
    familyBId: string;
    personA: { id: string; displayName?: string; avatarUrl?: string | null };
    personB: { id: string; displayName?: string; avatarUrl?: string | null };
  }>;
};

export type ActiveContext = {
  familyId: string;
  family: { id: string; name: string; avatarUrl: string | null };
  connectionId: string | null;
  connection: {
    id: string;
    name: string | null;
    feedPolicy: string;
    families: Array<{
      id: string;
      name: string;
      avatarUrl: string | null;
    }>;
  } | null;
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
  firstName?: string;
  lastName?: string;
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

    // Only for authenticated calls: a 401 from the OTP endpoints just means a
    // wrong code, not an expired session.
    if (response.status === 401 && token) {
      unauthorizedHandler?.();
    }

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
  body: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string | null;
    status?: string;
  },
) {
  return apiFetch<{ user: User }>('/users/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export async function updatePerson(
  token: string,
  personId: string,
  body: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  },
) {
  return apiFetch<{
    person: {
      id: string;
      firstName: string;
      lastName: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>(`/persons/${personId}`, {
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

export type PersonDetail = {
  person: TreeNode & {
    familyId: string;
    status?: string;
    birthDate?: string | null;
    deathDate?: string | null;
    family?: { id: string; name: string };
  };
  parents: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
  children: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
  spouses: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
  siblings: Array<{ id: string; displayName: string; isPlaceholder: boolean }>;
  canMessage?: boolean;
  isMe?: boolean;
  summary: string;
};

export async function fetchPerson(token: string, personId: string) {
  return apiFetch<PersonDetail>(`/persons/${personId}`, { token });
}

export type FeedPost = {
  id: string;
  familyId: string;
  connectionId?: string | null;
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
    visibility?: 'family' | 'connection';
    connectionId?: string;
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

export type ChatMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  phone?: string | null;
  role?: string;
  status?: string;
  /** e.g. "via Vikram & Aisha" for connected-family people */
  viaTag?: string | null;
  connectionId?: string | null;
  connectionName?: string | null;
  source?: 'family' | 'connection';
};

/** family = the auto "Family" room, congregation = auto room for a set of
 *  connected families, custom = a DM or a circle someone made. */
export type ChatScope = 'family' | 'custom' | 'congregation';

export type ChatSummary = {
  id: string;
  familyId: string;
  type: 'direct' | 'group' | string;
  scope?: ChatScope;
  name: string | null;
  title: string;
  /** Present on DMs with someone from a connected family */
  viaTag?: string | null;
  connectionId?: string | null;
  /** How many families a congregation room spans */
  familyCount?: number | null;
  myRole?: 'admin' | 'member';
  participants: ChatMember[];
  lastMessage: {
    id: string;
    body: string | null;
    mediaUrl: string | null;
    createdAt: string;
    sender?: { id: string; displayName: string };
  } | null;
  unreadCount: number;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export async function fetchFamilyMembers(token: string, familyId: string) {
  return apiFetch<{ members: ChatMember[] }>(`/families/${familyId}/members`, {
    token,
  });
}

export async function fetchChats(token: string, familyId: string) {
  return apiFetch<{ chats: ChatSummary[] }>(
    `/chats?familyId=${encodeURIComponent(familyId)}`,
    { token },
  );
}

export async function createChat(
  token: string,
  body: {
    familyId: string;
    type: 'direct' | 'group';
    participantUserIds: string[];
    name?: string;
  },
) {
  return apiFetch<{ chat: ChatSummary }>('/chats', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchMessages(
  token: string,
  chatId: string,
  opts: { after?: string; limit?: number } = {},
) {
  const q = new URLSearchParams();
  if (opts.after) q.set('after', opts.after);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return apiFetch<{ messages: ChatMessage[] }>(
    `/chats/${chatId}/messages${qs ? `?${qs}` : ''}`,
    { token },
  );
}

export type ChatDetail = {
  id: string;
  type: 'direct' | 'group' | string;
  scope: ChatScope;
  name: string | null;
  title: string;
  connectionId: string | null;
  families: Array<{ id: string; name: string }>;
  createdBy: { id: string; displayName: string } | null;
  /** True only for circles you made and admin — the auto rooms are locked. */
  canManage: boolean;
  myRole: 'admin' | 'member';
  participants: ChatMember[];
};

export async function fetchChatDetail(token: string, chatId: string) {
  return apiFetch<{ chat: ChatDetail }>(`/chats/${chatId}`, { token });
}

export async function renameChat(
  token: string,
  chatId: string,
  name: string,
) {
  return apiFetch<{ chat: ChatDetail }>(`/chats/${chatId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ name }),
  });
}

export async function addChatParticipants(
  token: string,
  chatId: string,
  userIds: string[],
) {
  return apiFetch<{ chat: ChatDetail }>(`/chats/${chatId}/participants`, {
    method: 'POST',
    token,
    body: JSON.stringify({ userIds }),
  });
}

export async function removeChatParticipant(
  token: string,
  chatId: string,
  userId: string,
) {
  return apiFetch<{ chat: ChatDetail }>(
    `/chats/${chatId}/participants/${userId}`,
    { method: 'DELETE', token },
  );
}

export async function setChatParticipantRole(
  token: string,
  chatId: string,
  userId: string,
  role: 'admin' | 'member',
) {
  return apiFetch<{ chat: ChatDetail }>(
    `/chats/${chatId}/participants/${userId}`,
    { method: 'PATCH', token, body: JSON.stringify({ role }) },
  );
}

export async function leaveChat(token: string, chatId: string) {
  return apiFetch<{ ok: boolean; deleted: boolean }>(`/chats/${chatId}/leave`, {
    method: 'POST',
    token,
  });
}

export async function sendMessage(
  token: string,
  chatId: string,
  body: { body?: string; mediaUrl?: string },
) {
  return apiFetch<{ message: ChatMessage }>(`/chats/${chatId}/messages`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export type ConnectionInvite = {
  id: string;
  connectionId: string | null;
  status: string;
  proposedName: string | null;
  proposedFeedPolicy: string;
  createdAt: string;
  fromFamily: { id: string; name: string; avatarUrl: string | null };
  toFamily: { id: string; name: string; avatarUrl: string | null };
  initiatedBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  fromPerson: {
    id: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;
  existingConnection: { id: string; name: string | null } | null;
};

export async function fetchConnections(token: string) {
  return apiFetch<{ connections: ConnectionSummary[] }>('/connections', {
    token,
  });
}

export async function fetchConnection(token: string, connectionId: string) {
  return apiFetch<{ connection: ConnectionSummary }>(
    `/connections/${connectionId}`,
    { token },
  );
}

export async function updateConnection(
  token: string,
  connectionId: string,
  body: { name?: string; feedPolicy?: 'unified_feed' | 'separate_feeds' },
) {
  return apiFetch<{ connection: ConnectionSummary }>(
    `/connections/${connectionId}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    },
  );
}

export async function createConnectionInvite(
  token: string,
  body: {
    fromFamilyId: string;
    toFamilyInviteCode?: string;
    toFamilyId?: string;
    connectionId?: string;
    proposedName?: string;
    proposedFeedPolicy?: 'unified_feed' | 'separate_feeds';
    fromPersonId?: string;
  },
) {
  return apiFetch<{ invite: ConnectionInvite }>('/connection-invites', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchConnectionInvites(token: string) {
  return apiFetch<{
    incoming: ConnectionInvite[];
    outgoing: ConnectionInvite[];
  }>('/connection-invites', { token });
}

export async function respondConnectionInvite(
  token: string,
  inviteId: string,
  body: {
    action: 'accept' | 'decline';
    name?: string;
    feedPolicy?: 'unified_feed' | 'separate_feeds';
    toPersonId?: string;
  },
) {
  return apiFetch<{
    invite: ConnectionInvite;
    connection: ConnectionSummary | null;
  }>(`/connection-invites/${inviteId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export async function createBridgeLink(
  token: string,
  connectionId: string,
  body: {
    personAId: string;
    personBId: string;
    linkType?: 'spouse' | 'other';
  },
) {
  return apiFetch<{
    bridgeLink: ConnectionSummary['bridgeLinks'] extends
      | Array<infer T>
      | undefined
      ? T
      : never;
  }>(`/connections/${connectionId}/bridge-links`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchConnectionTree(token: string, connectionId: string) {
  return apiFetch<{
    connection: { id: string; name: string | null; feedPolicy: string };
    trees: FamilyTree[];
    bridgeLinks: NonNullable<ConnectionSummary['bridgeLinks']>;
  }>(`/connections/${connectionId}/tree`, { token });
}

export async function fetchConnectionFeed(
  token: string,
  connectionId: string,
  opts: { familyId?: string; cursor?: string; limit?: number } = {},
) {
  const q = new URLSearchParams();
  if (opts.familyId) q.set('familyId', opts.familyId);
  if (opts.cursor) q.set('cursor', opts.cursor);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return apiFetch<{
    posts: FeedPost[];
    nextCursor: string | null;
    feedPolicy: string;
  }>(`/connections/${connectionId}/feed${qs ? `?${qs}` : ''}`, { token });
}

export async function setActiveContext(
  token: string,
  body: { familyId: string; connectionId?: string | null },
) {
  return apiFetch<{ context: ActiveContext | null }>('/users/me/context', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export async function fetchNotifications(
  token: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
) {
  const q = new URLSearchParams();
  if (opts.unreadOnly) q.set('unreadOnly', 'true');
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return apiFetch<{
    notifications: AppNotification[];
    unreadCount: number;
  }>(`/notifications${qs ? `?${qs}` : ''}`, { token });
}

export async function markNotificationRead(
  token: string,
  notificationId: string,
) {
  return apiFetch<{ ok: boolean }>(
    `/notifications/${notificationId}/read`,
    { method: 'PATCH', token },
  );
}

export async function markAllNotificationsRead(token: string) {
  return apiFetch<{ ok: boolean }>('/notifications/read-all', {
    method: 'PATCH',
    token,
  });
}

export async function registerDeviceToken(
  token: string,
  pushToken: string,
  platform?: string,
) {
  return apiFetch<{ id: string }>('/users/me/devices', {
    method: 'POST',
    token,
    body: JSON.stringify({ token: pushToken, platform }),
  });
}

export async function exportMyData(token: string) {
  return apiFetch<Record<string, unknown>>('/users/me/export', { token });
}

export async function deleteMyAccount(token: string) {
  return apiFetch<{ ok: boolean; deletedAt: string }>('/users/me', {
    method: 'DELETE',
    token,
  });
}

export async function requestRelationshipChange(
  token: string,
  body: {
    familyId: string;
    fromPersonId: string;
    toPersonId: string;
    type: 'parent_of' | 'spouse_of' | 'sibling_of';
    action: 'create' | 'delete';
    note?: string;
  },
) {
  return apiFetch<{ request: unknown }>('/relationship-change-requests', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchRelationshipChangeRequests(
  token: string,
  familyId: string,
) {
  return apiFetch<{
    requests: Array<{
      id: string;
      type: string;
      action: string;
      status: string;
      note: string | null;
      createdAt: string;
      fromPerson: { id: string; displayName: string };
      toPerson: { id: string; displayName: string };
      requestedBy: { id: string; displayName: string };
    }>;
  }>(`/families/${familyId}/relationship-change-requests`, { token });
}

export async function reviewRelationshipChangeRequest(
  token: string,
  requestId: string,
  action: 'approve' | 'reject',
) {
  return apiFetch<{ request: unknown }>(
    `/relationship-change-requests/${requestId}/${action}`,
    { method: 'POST', token },
  );
}

export async function updatePostShare(
  token: string,
  postId: string,
  body: {
    visibility: 'family' | 'connection';
    connectionId?: string | null;
  },
) {
  return apiFetch<{ post: FeedPost }>(`/posts/${postId}/share`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchFamilyAudit(token: string, familyId: string) {
  return apiFetch<{
    events: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      meta: unknown;
      createdAt: string;
      actor: { id: string; displayName: string } | null;
    }>;
  }>(`/families/${familyId}/audit`, { token });
}

// ── Games ───────────────────────────────────────────────────────────

export type GameType = 'family_awards' | 'caption_battle';
export type GameRoundStatus = 'submitting' | 'voting' | 'closed';

export type GamePlayer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

/** Anyone on the family tree — app account optional */
export type GameNominee = GamePlayer & { isPlaceholder: boolean };

export type GameEntry = {
  id: string;
  text: string | null;
  /** Null while captions are judged blind */
  subject: GameNominee | null;
  isMine: boolean;
  votes: number | null;
  votedByMe: boolean;
};

export type GameWinner = {
  entryId: string;
  text: string | null;
  subject: GameNominee;
  votes: number;
};

export type GameRoundSummary = {
  id: string;
  type: GameType;
  prompt: string;
  photoUrl: string | null;
  status: GameRoundStatus;
  closesAt: string;
  createdAt: string;
  createdBy: GamePlayer;
  entryCount: number;
  voteCount: number;
  myVoteEntryId: string | null;
  mySubmitted: boolean;
  winner: GameWinner | null;
};

export type GameRound = GameRoundSummary & {
  familyId: string;
  closedAt: string | null;
  memberCount: number;
  isHost: boolean;
  entries: GameEntry[];
};

export type GamePromptSuggestions = {
  familyAwards: string[];
  captionBattle: string[];
};

export type GamesHub = {
  active: GameRoundSummary[];
  finished: GameRoundSummary[];
  trophies: Array<{ person: GameNominee; wins: number }>;
  suggestions: GamePromptSuggestions;
};

export async function fetchGamesHub(token: string, familyId: string) {
  return apiFetch<GamesHub>(`/families/${familyId}/games`, { token });
}

export async function fetchGamePrompts(token: string) {
  return apiFetch<GamePromptSuggestions>('/games/prompts', { token });
}

export async function createGameRound(
  token: string,
  body: {
    familyId: string;
    type: GameType;
    prompt: string;
    photoUrl?: string;
    durationHours?: number;
  },
) {
  return apiFetch<{ round: GameRound }>('/games/rounds', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchGameRound(token: string, roundId: string) {
  return apiFetch<GameRound>(`/games/rounds/${roundId}`, { token });
}

export async function submitGameEntry(
  token: string,
  roundId: string,
  text: string,
) {
  return apiFetch<{ round: GameRound }>(`/games/rounds/${roundId}/entries`, {
    method: 'POST',
    token,
    body: JSON.stringify({ text }),
  });
}

export async function voteGameEntry(
  token: string,
  roundId: string,
  entryId: string,
) {
  return apiFetch<{ round: GameRound }>(`/games/rounds/${roundId}/vote`, {
    method: 'POST',
    token,
    body: JSON.stringify({ entryId }),
  });
}

export async function advanceGameRound(token: string, roundId: string) {
  return apiFetch<{ round: GameRound }>(`/games/rounds/${roundId}/advance`, {
    method: 'POST',
    token,
  });
}

// ── Upcoming dates ──────────────────────────────────────────────────

export type OccasionKind =
  | 'birthday'
  | 'anniversary'
  | 'remembrance'
  | 'custom';

export type UpcomingItem = {
  key: string;
  kind: OccasionKind;
  title: string;
  subtitle: string | null;
  date: string;
  daysUntil: number;
  years: number | null;
  people: GamePlayer[];
  /** Set when the date belongs to a connected family */
  viaTag: string | null;
  familyName: string | null;
  occasionId: string | null;
};

export type UpcomingResponse = {
  today: string;
  items: UpcomingItem[];
  todayCount: number;
};

export async function fetchUpcoming(
  token: string,
  familyId: string,
  opts: { days?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (opts.days) params.set('days', String(opts.days));
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<UpcomingResponse>(
    `/families/${familyId}/upcoming${qs ? `?${qs}` : ''}`,
    { token },
  );
}

export async function createOccasion(
  token: string,
  body: {
    familyId: string;
    type: 'anniversary' | 'custom';
    title?: string;
    date: string;
    personAId?: string;
    personBId?: string;
  },
) {
  return apiFetch<{ occasion: { id: string } }>('/occasions', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function deleteOccasion(token: string, occasionId: string) {
  return apiFetch<{ ok: boolean }>(`/occasions/${occasionId}`, {
    method: 'DELETE',
    token,
  });
}

export { ApiError, getStoredToken, setStoredToken };
