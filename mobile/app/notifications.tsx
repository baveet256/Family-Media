import { useFocusEffect, useRouter } from 'expo-router';
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
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(token, { limit: 50 });
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 ? (
          <Pressable
            onPress={() =>
              void (async () => {
                if (!token) return;
                await markAllNotificationsRead(token);
                await load();
              })()
            }>
            <Text style={styles.mark}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No notifications yet.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, !item.readAt && styles.unread]}
              onPress={() =>
                void (async () => {
                  if (!token) return;
                  if (!item.readAt) await markNotificationRead(token, item.id);
                  const data = item.data || {};
                  if (typeof data.chatId === 'string') {
                    router.push({
                      pathname: '/chat/[id]',
                      params: { id: data.chatId },
                    });
                  } else if (typeof data.inviteId === 'string') {
                    router.push('/connections');
                  } else {
                    await load();
                  }
                })()
              }>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowBody}>{item.body}</Text>
              <Text style={styles.rowMeta}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: {
    padding: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  mark: { fontWeight: '600', color: '#111' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  row: {
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  unread: { backgroundColor: '#f7f7f7' },
  rowTitle: { fontWeight: '700', color: '#111', fontSize: 15 },
  rowBody: { marginTop: 4, color: '#444', fontSize: 14 },
  rowMeta: { marginTop: 6, color: '#999', fontSize: 12 },
});
