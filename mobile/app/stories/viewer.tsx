import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  fetchStoryRings,
  markStoryViewed,
  type StoryItem,
  type StoryRing,
} from '@/lib/api';

export default function StoryViewerScreen() {
  const router = useRouter();
  const { token, user, families } = useAuth();
  const params = useLocalSearchParams<{
    familyId?: string;
    authorId?: string;
  }>();
  const familyId =
    typeof params.familyId === 'string'
      ? params.familyId
      : families.find((f) => f.status === 'active')?.id ?? '';
  const authorId =
    typeof params.authorId === 'string' ? params.authorId : user?.id ?? '';

  const [rings, setRings] = useState<StoryRing[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ring = useMemo(
    () => rings.find((r) => r.author.id === authorId) ?? rings[0],
    [rings, authorId],
  );
  const stories: StoryItem[] = ring?.stories ?? [];
  const current = stories[index];

  const load = useCallback(async () => {
    if (!token || !familyId) return;
    setLoading(true);
    try {
      const data = await fetchStoryRings(token, familyId);
      setRings(data.rings);
      const start = data.rings.find((r) => r.author.id === authorId);
      const firstUnseen = start?.stories.findIndex((s) => !s.viewedByMe) ?? 0;
      setIndex(firstUnseen >= 0 ? firstUnseen : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, [token, familyId, authorId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !current) return;
    void markStoryViewed(token, current.id).catch(() => undefined);
  }, [token, current?.id]);

  const goNext = () => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    // next author's ring
    const idx = rings.findIndex((r) => r.author.id === ring?.author.id);
    if (idx >= 0 && idx < rings.length - 1) {
      const next = rings[idx + 1];
      router.replace({
        pathname: '/stories/viewer',
        params: { familyId, authorId: next.author.id },
      });
      return;
    }
    router.back();
  };

  const goPrev = () => {
    if (index > 0) {
      setIndex((i) => i - 1);
      return;
    }
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || 'No stories'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const isAuthor = ring?.author.id === user?.id;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {stories.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.progress,
              i <= index ? styles.progressOn : styles.progressOff,
            ]}
          />
        ))}
      </View>

      <View style={styles.topBar}>
        <Text style={styles.author}>{ring?.author.displayName}</Text>
        <View style={styles.topActions}>
          {isAuthor && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/stories/viewers',
                  params: { storyId: current.id },
                })
              }>
              <Text style={styles.link}>Viewers</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Close</Text>
          </Pressable>
        </View>
      </View>

      {current.mediaType === 'image' ? (
        <Image
          source={{ uri: current.url }}
          style={styles.media}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.videoFallback}>
          <Text style={styles.videoText}>▶ Video story</Text>
          <Text style={styles.videoUrl} numberOfLines={2}>
            {current.url}
          </Text>
        </View>
      )}

      <Pressable style={styles.tapLeft} onPress={goPrev} />
      <Pressable style={styles.tapRight} onPress={goNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centered: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 48,
  },
  progress: { flex: 1, height: 3, borderRadius: 2 },
  progressOn: { backgroundColor: '#fff' },
  progressOff: { backgroundColor: 'rgba(255,255,255,0.25)' },
  topBar: {
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: { color: '#fff', fontWeight: '700', fontSize: 16 },
  topActions: { flexDirection: 'row', gap: 16 },
  link: { color: '#fff', fontWeight: '600' },
  media: { flex: 1, width: '100%', marginVertical: 12 },
  videoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  videoText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  videoUrl: { marginTop: 12, color: '#aaa', fontSize: 12, textAlign: 'center' },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 100,
    bottom: 0,
    width: '35%',
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 0,
    width: '65%',
  },
  error: { color: '#fca5a5', marginBottom: 16 },
  close: { color: '#fff', fontWeight: '700' },
});
