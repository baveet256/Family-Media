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
import {
  fetchFeed,
  fetchStoryRings,
  reactToPost,
  type FeedPost,
  type StoryRing,
} from '@/lib/api';

const REACTIONS = ['❤️', '😂', '👏', '🔥', '😮'];

export default function HomeScreen() {
  const router = useRouter();
  const { token, user, families, pendingJoinRequests } = useAuth();
  const family =
    families.find((f) => f.status === 'active') ??
    families.find((f) => f.role === 'admin') ??
    families[0];

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [rings, setRings] = useState<StoryRing[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    if (!token || !family?.id || family.status === 'pending') return;
    try {
      const data = await fetchStoryRings(token, family.id);
      setRings(data.rings);
    } catch {
      // non-blocking for feed
    }
  }, [token, family?.id, family?.status]);

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
        const data = await fetchFeed(token, family.id, {
          cursor: opts.reset ? undefined : cursor ?? undefined,
          limit: 20,
        });
        setPosts((prev) =>
          opts.reset ? data.posts : [...prev, ...data.posts],
        );
        setCursor(data.nextCursor);
        if (opts.reset) await loadStories();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, family?.id, family?.status, cursor, loadStories],
  );

  useEffect(() => {
    setPosts([]);
    setCursor(null);
    void (async () => {
      if (!token || !family?.id || family.status === 'pending') return;
      setLoading(true);
      try {
        const [feedData] = await Promise.all([
          fetchFeed(token, family.id, { limit: 20 }),
          loadStories(),
        ]);
        setPosts(feedData.posts);
        setCursor(feedData.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, family?.id, family?.status, loadStories]);

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
      <View style={styles.container}>
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
      <View style={styles.container}>
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
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Family feed</Text>
          <Text style={styles.title}>{family.name}</Text>
          <Text style={styles.subtitle}>Hi {user?.displayName || 'there'}</Text>
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
    paddingTop: 48,
    backgroundColor: '#fafafa',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { marginTop: 4, fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 4, fontSize: 15, color: '#666' },
  compose: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composeText: { color: '#fff', fontWeight: '700' },
  adminRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  chip: {
    backgroundColor: '#f3f3f3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontWeight: '600', color: '#111', fontSize: 13 },
  card: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  detail: { marginTop: 10, fontSize: 15, color: '#444', lineHeight: 22 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
  },
  secondaryText: { color: '#111', fontWeight: '700' },
  error: { marginTop: 8, color: '#b91c1c' },
  postCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  author: { fontSize: 16, fontWeight: '700', color: '#111' },
  time: { marginTop: 2, fontSize: 12, color: '#888' },
  caption: { marginTop: 10, fontSize: 15, color: '#222', lineHeight: 22 },
  media: {
    marginTop: 12,
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  videoPlaceholder: {
    marginTop: 12,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: { color: '#fff', fontWeight: '700' },
  metaRow: { marginTop: 10 },
  meta: { fontSize: 13, color: '#666' },
  reactRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reactBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f3f3',
  },
  reactMine: { backgroundColor: '#ffe4e6' },
  reactEmoji: { fontSize: 16 },
});
