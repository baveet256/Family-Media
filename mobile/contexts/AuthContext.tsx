import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchMe,
  getStoredToken,
  setActiveContext,
  setStoredToken,
  setUnauthorizedHandler,
  type ActiveContext,
  type ConnectionSummary,
  type FamilySummary,
  type MeResponse,
  type User,
  verifyOtp,
} from '@/lib/api';
import { cacheClearAll } from '@/lib/offlineCache';
import { registerForPushNotifications } from '@/lib/push';

type AuthState = {
  loading: boolean;
  token: string | null;
  user: User | null;
  families: FamilySummary[];
  connections: ConnectionSummary[];
  context: ActiveContext | null;
  activeFamily: FamilySummary | null;
  pendingJoinRequests: MeResponse['pendingJoinRequests'];
  needsProfile: boolean;
  needsFamily: boolean;
  needsOnboarding: boolean;
  onboardingJoinRequestId: string | null;
  refresh: () => Promise<void>;
  switchContext: (opts: {
    familyId: string;
    connectionId?: string | null;
  }) => Promise<void>;
  signInWithOtp: (
    phone: string,
    otp: string,
    displayName?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [context, setContext] = useState<ActiveContext | null>(null);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<
    MeResponse['pendingJoinRequests']
  >([]);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsFamily, setNeedsFamily] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingJoinRequestId, setOnboardingJoinRequestId] = useState<
    string | null
  >(null);

  const applyMe = useCallback((accessToken: string, me: MeResponse) => {
    setToken(accessToken);
    setUser(me.user);
    setFamilies(me.families);
    setConnections(me.connections ?? []);
    setContext(me.context ?? null);
    setPendingJoinRequests(me.pendingJoinRequests);
    setNeedsProfile(me.needsProfile);
    setNeedsFamily(me.needsFamily);
    setNeedsOnboarding(!!me.needsOnboarding);
    setOnboardingJoinRequestId(me.onboardingJoinRequestId ?? null);
    void registerForPushNotifications(accessToken);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setFamilies([]);
    setConnections([]);
    setContext(null);
    setPendingJoinRequests([]);
    setNeedsProfile(false);
    setNeedsFamily(false);
    setNeedsOnboarding(false);
    setOnboardingJoinRequestId(null);
  }, []);

  const refresh = useCallback(async () => {
    const stored = await getStoredToken();
    if (!stored) {
      clearSession();
      setLoading(false);
      return;
    }

    try {
      const me = await fetchMe(stored);
      applyMe(stored, me);
    } catch {
      await setStoredToken(null);
      await cacheClearAll();
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [applyMe, clearSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Any authenticated request that comes back 401 means the session is gone;
  // drop the token and cached data so the app returns to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void (async () => {
        await setStoredToken(null);
        await cacheClearAll();
        clearSession();
      })();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const signInWithOtp = useCallback(
    async (phone: string, otp: string, displayName?: string) => {
      const session = await verifyOtp(phone, otp, displayName);
      const me = await fetchMe(session.accessToken);
      applyMe(session.accessToken, me);
      setLoading(false);
    },
    [applyMe],
  );

  const signOut = useCallback(async () => {
    await setStoredToken(null);
    await cacheClearAll();
    clearSession();
  }, [clearSession]);

  const switchContext = useCallback(
    async (opts: { familyId: string; connectionId?: string | null }) => {
      if (!token) return;
      const res = await setActiveContext(token, opts);
      setContext(res.context);
      await refresh();
    },
    [token, refresh],
  );

  const activeFamily = useMemo(() => {
    if (context?.familyId) {
      return (
        families.find((f) => f.id === context.familyId) ??
        ({
          id: context.family.id,
          name: context.family.name,
          avatarUrl: context.family.avatarUrl,
          inviteCode: '',
          role: 'member' as const,
          status: 'active' as const,
        } satisfies FamilySummary)
      );
    }
    return (
      families.find((f) => f.status === 'active') ??
      families.find((f) => f.role === 'admin') ??
      families[0] ??
      null
    );
  }, [context, families]);

  const value = useMemo(
    () => ({
      loading,
      token,
      user,
      families,
      connections,
      context,
      activeFamily,
      pendingJoinRequests,
      needsProfile,
      needsFamily,
      needsOnboarding,
      onboardingJoinRequestId,
      refresh,
      switchContext,
      signInWithOtp,
      signOut,
    }),
    [
      loading,
      token,
      user,
      families,
      connections,
      context,
      activeFamily,
      pendingJoinRequests,
      needsProfile,
      needsFamily,
      needsOnboarding,
      onboardingJoinRequestId,
      refresh,
      switchContext,
      signInWithOtp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
