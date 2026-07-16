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
  setStoredToken,
  type FamilySummary,
  type MeResponse,
  type User,
  verifyOtp,
} from '@/lib/api';

type AuthState = {
  loading: boolean;
  token: string | null;
  user: User | null;
  families: FamilySummary[];
  pendingJoinRequests: MeResponse['pendingJoinRequests'];
  needsProfile: boolean;
  needsFamily: boolean;
  needsOnboarding: boolean;
  onboardingJoinRequestId: string | null;
  refresh: () => Promise<void>;
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
    setPendingJoinRequests(me.pendingJoinRequests);
    setNeedsProfile(me.needsProfile);
    setNeedsFamily(me.needsFamily);
    setNeedsOnboarding(!!me.needsOnboarding);
    setOnboardingJoinRequestId(me.onboardingJoinRequestId ?? null);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setFamilies([]);
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
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [applyMe, clearSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      loading,
      token,
      user,
      families,
      pendingJoinRequests,
      needsProfile,
      needsFamily,
      needsOnboarding,
      onboardingJoinRequestId,
      refresh,
      signInWithOtp,
      signOut,
    }),
    [
      loading,
      token,
      user,
      families,
      pendingJoinRequests,
      needsProfile,
      needsFamily,
      needsOnboarding,
      onboardingJoinRequestId,
      refresh,
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
