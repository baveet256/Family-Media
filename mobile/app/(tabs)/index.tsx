import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { StoryRingRow } from '@/components/StoryRingRow';
import { UpcomingStrip } from '@/components/UpcomingStrip';
import {
  fetchFeed,
  fetchStoryRings,
  fetchUpcoming,
  reactToPost,
  type FeedPost,
  type StoryRing,
  type UpcomingItem,
} from '@/lib/api';
import { cacheGet, cacheSet } from '@/lib/offlineCache';
import { fonts, theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REACTIONS = ['❤️', '😂', '👏', '🔥', '😮'];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    token,
    user,
    families,
    pendingJoinRequests,
    activeFamily,
  } = useAuth();
  const family = activeFamily;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [rings, setRings] = useState<StoryRing[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [offline, setOffline] = useState(false);

  const loadStories = useCallback(async () => {
    if (!token || !family?.id || family.status === 'pending') return;
    try {
      const data = await fetchStoryRings(token, family.id);
      setRings(data.rings);
    } catch {
      // non-blocking for feed
    }
  }, [token, family?.id, family?.status]);

  const loadUpcoming = useCallback(async () => {
    if (!token || !family?.id || family.status === 'pending') return;
    try {
      const data = await fetchUpcoming(token, family.id, { days: 60, limit: 10 });
      setUpcoming(data.items);
    } catch {
      // non-blocking for feed
    }
  }, [token, family?.id, family?.status]);

  const fetchPostsPage = useCallback(
    async (opts: { cursor?: string; limit?: number } = {}) => {
      if (!token || !family?.id) {
        return { posts: [] as FeedPost[], nextCursor: null as string | null };
      }
      // Home is always the family feed — unified connection sharing is opt-in per post
      return fetchFeed(token, family.id, opts);
    },
    [token, family?.id],
  );

  const load = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      if (!token || !family?.id || family.status === 'pending') return;
      if (opts.reset) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await fetchPostsPage({
          cursor: opts.reset ? undefined : cursor ?? undefined,
          limit: 20,
        });
        setPosts((prev) =>
          opts.reset ? data.posts : [...prev, ...data.posts],
        );
        setCursor(data.nextCursor);
        if (opts.reset) await Promise.all([loadStories(), loadUpcoming()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      token,
      family?.id,
      family?.status,
      cursor,
      loadStories,
      loadUpcoming,
      fetchPostsPage,
    ],
  );

  useEffect(() => {
    setPosts([]);
    setCursor(null);
    setOffline(false);
    void (async () => {
      if (!token || !family?.id || family.status === 'pending') return;
      const cacheKey = `feed:family:${family.id}`;
      const cached = await cacheGet<FeedPost[]>(cacheKey);
      if (cached?.value?.length) {
        setPosts(cached.value);
      }
      setLoading(true);
      try {
        const [feedData] = await Promise.all([
          fetchPostsPage({ limit: 20 }),
          loadStories(),
          loadUpcoming(),
        ]);
        setPosts(feedData.posts);
        setCursor(feedData.nextCursor);
        await cacheSet(cacheKey, feedData.posts);
        setOffline(false);
      } catch (e) {
        if (cached?.value?.length) {
          setOffline(true);
          setError('Showing cached feed (offline)');
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load feed');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, family?.id, family?.status, loadStories, loadUpcoming, fetchPostsPage]);

  const onReact = async (postId: string, emoji: string) => {
    if (!token) return;
    try {
      const { post } = await reactToPost(token, postId, emoji);
      setPosts((prev) => prev.map((p) => (p.id === postId ? post : p)));
    } catch {
      // ignore
    }
  };

  if (!family) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.eyebrow}>Family Media</Text>
        <Text style={styles.title}>Your family home</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.detail}>
            Create a family or join with an invite code.
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.button}
              onPress={() => router.push('/(auth)/create-family')}>
              <Text style={styles.buttonText}>Create family</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => router.push('/(auth)/join-code')}>
              <Text style={styles.secondaryText}>Join with code</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (family.status === 'pending' || pendingJoinRequests.length > 0 && family.status !== 'active') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.eyebrow}>Family Media</Text>
        <Text style={styles.title}>{family.name}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Waiting for approval</Text>
          <Text style={styles.detail}>
            Finish onboarding, then an admin can approve you onto the tree and
            feed.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Family Media</Text>
          <Text style={styles.title}>{family.name}</Text>
          <Text style={styles.subtitle}>
            Hi {user?.firstName || user?.displayName || 'there'}
          </Text>
          {offline ? (
            <Text style={styles.offline}>Offline · cached</Text>
          ) : null}
        </View>
        <Pressable
          style={styles.compose}
          onPress={() =>
            router.push({
              pathname: '/feed/create',
              params: { familyId: family.id },
            })
          }>
          <Text style={styles.composeText}>＋ Post</Text>
        </Pressable>
      </View>

      {family.role === 'admin' && (
        <View style={styles.adminRow}>
          <Pressable
            style={styles.chip}
            onPress={() =>
              router.push({
                pathname: '/family/invite',
                params: { familyId: family.id },
              })
            }>
            <Text style={styles.chipText}>Invite</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            onPress={() =>
              router.push({
                pathname: '/family/join-requests',
                params: { familyId: family.id },
              })
            }>
            <Text style={styles.chipText}>Requests</Text>
          </Pressable>
        </View>
      )}

      <StoryRingRow
        familyId={family.id}
        rings={rings}
        currentUserId={user?.id}
      />

      <UpcomingStrip familyId={family.id} items={upcoming} />

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ reset: true })}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No posts yet</Text>
              <Text style={styles.detail}>
                Be the first to share something with the family.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null
        }
        onEndReached={() => {
          if (cursor && !loading) void load();
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <Pressable
            style={styles.postCard}
            onPress={() =>
              router.push({
                pathname: '/feed/[id]',
                params: { id: item.id },
              })
            }>
            <Text style={styles.author}>{item.author.displayName}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            {!!item.caption && (
              <Text style={styles.caption}>{item.caption}</Text>
            )}
            {item.media[0]?.mediaType === 'image' && (
              <Image
                source={{ uri: item.media[0].url }}
                style={styles.media}
                resizeMode="cover"
              />
            )}
            {item.media[0]?.mediaType === 'video' && (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoText}>▶ Video</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {item.reactions.total} reactions · {item.commentCount} comments
              </Text>
            </View>
            <View style={styles.reactRow}>
              {REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.reactBtn,
                    item.reactions.mine === emoji && styles.reactMine,
                  ]}
                  onPress={() => void onReact(item.id, emoji)}>
                  <Text style={styles.reactEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: theme.paper,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: {
    fontFamily: fonts.displaySoft,
    fontSize: 14,
    color: theme.gold,
    letterSpacing: 0.2,
  },
  title: {
    marginTop: 4,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: theme.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.muted,
  },
  offline: {
    marginTop: 4,
    fontFamily: fonts.bodyMed,
    color: theme.gold,
    fontSize: 12,
  },
  compose: {
    marginTop: 8,
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  composeText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
  },
  adminRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 },
  chip: {
    backgroundColor: theme.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: fonts.bodyMed,
    color: theme.accent,
    fontSize: 13,
  },
  card: {
    marginTop: 20,
    padding: 20,
    borderRadius: 18,
    backgroundColor: theme.paperElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detail: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.inkSoft,
    lineHeight: 22,
  },
  actions: { marginTop: 16, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.accent,
  },
  buttonText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
  },
  secondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.accentSoft,
  },
  secondaryText: {
    fontFamily: fonts.bodyBold,
    color: theme.accent,
  },
  error: {
    marginTop: 8,
    fontFamily: fonts.bodyMed,
    color: theme.danger,
  },
  postCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.paperElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  author: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: theme.ink,
  },
  time: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.faint,
  },
  caption: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.inkSoft,
    lineHeight: 22,
  },
  media: {
    marginTop: 12,
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: theme.accentSoft,
  },
  videoPlaceholder: {
    marginTop: 12,
    height: 160,
    borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
  },
  metaRow: { marginTop: 10 },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.muted,
  },
  reactRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reactBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.goldSoft,
  },
  reactMine: {
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  reactEmoji: { fontSize: 16 },
});
