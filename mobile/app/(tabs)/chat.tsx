import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { fetchChats, type ChatSummary } from '@/lib/api';
import { fonts, theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function preview(chat: ChatSummary): string {
  const m = chat.lastMessage;
  if (!m) return 'No messages yet';
  if (m.mediaUrl && !m.body) return 'Photo';
  return m.body || 'Message';
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, activeFamily } = useAuth();
  const family = activeFamily;

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { soft?: boolean } = {}) => {
      if (!token || !family?.id || family.status === 'pending') {
        setLoading(false);
        return;
      }
      if (!opts.soft) setLoading(true);
      setError(null);
      try {
        const data = await fetchChats(token, family.id);
        setChats(data.chats);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load chats');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, family?.id, family?.status],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void load({ soft: true }), 4000);
      return () => clearInterval(id);
    }, [load]),
  );

  // Rooms that exist because families are connected sit in their own section,
  // otherwise a four-family connection would bury the real conversations.
  const sections = useMemo(() => {
    const circles = chats.filter((c) => c.scope === 'congregation');
    const rest = chats.filter((c) => c.scope !== 'congregation');
    return [
      ...(rest.length ? [{ title: null, data: rest }] : []),
      ...(circles.length
        ? [{ title: 'Circles · connected families', data: circles }]
        : []),
    ] as Array<{ title: string | null; data: ChatSummary[] }>;
  }, [chats]);

  if (!family || family.status === 'pending') {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Chat</Text>
        <Text style={styles.emptySub}>Join an active family to message.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.eyebrow}>Family Media</Text>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <Pressable
          style={styles.newBtn}
          onPress={() =>
            router.push({
              pathname: '/chat/new',
              params: { familyId: family.id },
            })
          }>
          <Text style={styles.newBtnText}>New</Text>
        </Pressable>
      </View>

      {loading && chats.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptySub}>
                {error || 'No chats yet. Start a conversation.'}
              </Text>
            </View>
          }
          ListHeaderComponent={
            error && chats.length > 0 ? (
              <Text style={styles.error}>{error}</Text>
            ) : null
          }
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionHint}>
                  Every combination of your connected families gets a room
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const circle = item.scope === 'congregation';
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[id]',
                    params: { id: item.id, title: item.title },
                  })
                }>
                <View style={[styles.avatar, circle && styles.avatarCircle]}>
                  <Text style={styles.avatarText}>
                    {circle
                      ? '🫂'
                      : (item.title || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowTime}>
                      {timeLabel(item.updatedAt)}
                    </Text>
                  </View>
                  {item.viaTag ? (
                    <Text style={styles.viaTag} numberOfLines={1}>
                      {item.viaTag}
                    </Text>
                  ) : circle && item.familyCount ? (
                    <Text style={styles.circleTag}>
                      {item.familyCount} families · {item.participants.length}{' '}
                      people
                    </Text>
                  ) : item.scope === 'family' ? (
                    <Text style={styles.circleTag}>Everyone at home</Text>
                  ) : null}
                  <View style={styles.rowTop}>
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {preview(item)}
                    </Text>
                    {item.unreadCount > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.paper },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
    backgroundColor: theme.paper,
  },
  eyebrow: {
    fontFamily: fonts.displaySoft,
    fontSize: 13,
    color: theme.gold,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: theme.ink,
    letterSpacing: -0.4,
  },
  newBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 2,
  },
  newBtnText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
    fontSize: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.paper,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: theme.ink,
  },
  emptySub: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.muted,
    textAlign: 'center',
  },
  error: {
    fontFamily: fonts.bodyMed,
    color: theme.danger,
    padding: 12,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.paperElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarCircle: { backgroundColor: theme.goldSoft },
  avatarText: {
    fontFamily: fonts.displayMed,
    fontSize: 18,
    color: theme.inkSoft,
  },
  sectionHead: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 8,
    backgroundColor: theme.paper,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.gold,
  },
  sectionHint: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.faint,
  },
  circleTag: {
    marginTop: 2,
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    color: theme.gold,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: theme.ink,
  },
  rowTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.faint,
  },
  viaTag: {
    marginTop: 2,
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    color: theme.via,
  },
  rowPreview: {
    flex: 1,
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.muted,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
    fontSize: 11,
  },
});
