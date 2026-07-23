import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { fetchStoryViewers } from '@/lib/api';

export default function StoryViewersScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ storyId?: string }>();
  const storyId = typeof params.storyId === 'string' ? params.storyId : '';

  const [viewers, setViewers] = useState<
    Array<{ id: string; displayName: string; viewedAt: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !storyId) return;
    setLoading(true);
    try {
      const data = await fetchStoryViewers(token, storyId);
      setViewers(data.viewers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load viewers');
    } finally {
      setLoading(false);
    }
  }, [token, storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Viewers</Text>
      {loading && <ActivityIndicator style={{ marginTop: 24 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && viewers.length === 0 && (
        <Text style={styles.empty}>No views yet.</Text>
      )}
      <FlatList
        data={viewers}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingTop: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.displayName || 'Member'}</Text>
            <Text style={styles.time}>
              {new Date(item.viewedAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  error: { marginTop: 16, color: '#b91c1c' },
  empty: { marginTop: 24, color: '#888' },
  row: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  name: { fontWeight: '700', color: '#111' },
  time: { marginTop: 4, fontSize: 12, color: '#888' },
});
