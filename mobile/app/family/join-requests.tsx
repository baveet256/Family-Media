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
import {
  approveJoinRequest,
  listJoinRequests,
  rejectJoinRequest,
  type JoinRequestRow,
} from '@/lib/api';

export default function JoinRequestsScreen() {
  const { token, refresh } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId = typeof params.familyId === 'string' ? params.familyId : '';

  const [rows, setRows] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const onApprove = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await approveJoinRequest(token, id);
      setMessage('Approved — member added to the tree');
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await rejectJoinRequest(token, id);
      setMessage('Rejected');
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join requests</Text>
      <Text style={styles.subtitle}>
        Approve places the member on the tree from their onboarding answers.
      </Text>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}
      {message && <Text style={styles.ok}>{message}</Text>}

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
            <Text style={styles.status}>
              {item.status}
              {item.hasOnboarding ? ' · onboarding ready' : ' · waiting onboarding'}
            </Text>

            {item.status === 'pending' && (
              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.button,
                    (!item.hasOnboarding || busyId === item.id) &&
                      styles.buttonDisabled,
                  ]}
                  disabled={!item.hasOnboarding || busyId === item.id}
                  onPress={() => void onApprove(item.id)}>
                  {busyId === item.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Approve</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  disabled={busyId === item.id}
                  onPress={() => void onReject(item.id)}>
                  <Text style={styles.secondaryText}>Reject</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />

      <Pressable style={styles.refresh} onPress={() => void load()}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666', lineHeight: 22 },
  error: { marginTop: 16, color: '#b91c1c' },
  ok: { marginTop: 16, color: '#15803d' },
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
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
  },
  actions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 96,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondary: {
    backgroundColor: '#f3f3f3',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryText: { color: '#b91c1c', fontWeight: '700' },
  refresh: {
    marginTop: 12,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  refreshText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
