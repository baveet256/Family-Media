import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { listJoinRequests, type JoinRequestRow } from '@/lib/api';

export default function JoinRequestsScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId = typeof params.familyId === 'string' ? params.familyId : '';

  const [rows, setRows] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !familyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listJoinRequests(token, familyId);
      setRows(data.joinRequests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, familyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join requests</Text>
      <Text style={styles.subtitle}>
        Read-only until Phase 2 (approve / reject).
      </Text>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && rows.length === 0 && (
        <Text style={styles.empty}>No join requests yet.</Text>
      )}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>
              {item.user.displayName || 'Unnamed user'}
            </Text>
            <Text style={styles.meta}>{item.user.phone}</Text>
            <Text style={styles.status}>{item.status}</Text>
          </View>
        )}
      />

      <Pressable style={styles.button} onPress={() => void load()}>
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666' },
  error: { marginTop: 16, color: '#b91c1c' },
  empty: { marginTop: 24, color: '#888', fontSize: 15 },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  name: { fontSize: 16, fontWeight: '700', color: '#111' },
  meta: { marginTop: 4, fontSize: 13, color: '#666' },
  status: {
    marginTop: 8,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
  },
  button: {
    marginTop: 12,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
