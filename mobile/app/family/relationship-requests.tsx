import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
  fetchRelationshipChangeRequests,
  reviewRelationshipChangeRequest,
} from '@/lib/api';

export default function RelationshipRequestsScreen() {
  const { token, activeFamily } = useAuth();
  const [rows, setRows] = useState<
    Array<{
      id: string;
      type: string;
      action: string;
      status: string;
      note: string | null;
      createdAt: string;
      fromPerson: { id: string; displayName: string };
      toPerson: { id: string; displayName: string };
      requestedBy: { id: string; displayName: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !activeFamily?.id) return;
    setLoading(true);
    try {
      const data = await fetchRelationshipChangeRequests(
        token,
        activeFamily.id,
      );
      setRows(data.requests);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, activeFamily?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const review = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    setBusyId(id);
    try {
      await reviewRelationshipChangeRequest(token, id, action);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tree corrections</Text>
      <Text style={styles.sub}>
        Members request relationship changes; admins approve.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No correction requests.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.action} {item.type.replace('_', ' ')}
              </Text>
              <Text style={styles.meta}>
                {item.fromPerson.displayName} → {item.toPerson.displayName}
              </Text>
              <Text style={styles.meta}>
                by {item.requestedBy.displayName} · {item.status}
              </Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              {item.status === 'pending' && activeFamily?.role === 'admin' ? (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.accept}
                    disabled={busyId === item.id}
                    onPress={() => void review(item.id, 'approve')}>
                    <Text style={styles.acceptText}>Approve</Text>
                  </Pressable>
                  <Pressable
                    style={styles.decline}
                    disabled={busyId === item.id}
                    onPress={() => void review(item.id, 'reject')}>
                    <Text style={styles.declineText}>Reject</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  sub: { marginTop: 6, marginBottom: 12, color: '#666' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  cardTitle: { fontWeight: '700', color: '#111' },
  meta: { marginTop: 4, color: '#666', fontSize: 13 },
  note: { marginTop: 8, color: '#333', fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  accept: {
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptText: { color: '#fff', fontWeight: '600' },
  decline: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  declineText: { color: '#333', fontWeight: '600' },
});
