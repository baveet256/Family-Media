import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  deleteOccasion,
  fetchUpcoming,
  type UpcomingItem,
} from '@/lib/api';
import { formatShortDate, occasionEmoji, whenLabel } from '@/lib/occasions';

const GROUPS: Array<{ label: string; upTo: number }> = [
  { label: 'Today', upTo: 0 },
  { label: 'This week', upTo: 7 },
  { label: 'This month', upTo: 31 },
  { label: 'Later this year', upTo: 366 },
];

function group(items: UpcomingItem[]) {
  const out: Array<{ label: string; items: UpcomingItem[] }> = [];
  let from = 0;
  for (const g of GROUPS) {
    const bucket = items.filter(
      (i) => i.daysUntil >= from && i.daysUntil <= g.upTo,
    );
    if (bucket.length) out.push({ label: g.label, items: bucket });
    from = g.upTo + 1;
  }
  return out;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { token, activeFamily } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId =
    typeof params.familyId === 'string' ? params.familyId : activeFamily?.id;

  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !familyId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await fetchUpcoming(token, familyId, { days: 366 });
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, familyId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmRemove = (item: UpcomingItem) => {
    if (!item.occasionId || !token) return;
    Alert.alert('Remove this date?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteOccasion(token, item.occasionId!);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not remove');
            }
          })();
        },
      },
    ]);
  };

  const sections = group(items);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Coming up</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() =>
            router.push({ pathname: '/calendar/new', params: { familyId } })
          }>
          <Text style={styles.addBtnText}>＋ Add date</Text>
        </Pressable>
      </View>
      <Text style={styles.blurb}>
        Birthdays come from the family tree. Anniversaries and anything else you
        add show up here too.
      </Text>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !items.length ? (
        <Text style={styles.empty}>
          No dates in the next year. Add birthdays on the tree, or add an
          anniversary here.
        </Text>
      ) : null}

      {sections.map((section) => (
        <View key={section.label}>
          <Text style={styles.section}>{section.label}</Text>
          {section.items.map((item) => (
            <Pressable
              key={item.key}
              onLongPress={() => confirmRemove(item)}
              style={[styles.row, item.daysUntil === 0 && styles.rowToday]}>
              {item.people[0]?.avatarUrl ? (
                <Image
                  source={{ uri: item.people[0].avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.emoji}>{occasionEmoji(item.kind)}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {occasionEmoji(item.kind)} {item.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[formatShortDate(item.date), item.subtitle, item.viaTag]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>

              <Text
                style={[
                  styles.when,
                  item.daysUntil === 0 && styles.whenToday,
                ]}>
                {whenLabel(item.daysUntil, item.date)}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}

      {items.some((i) => i.occasionId) ? (
        <Text style={styles.footnote}>
          Long-press a date you added to remove it.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 28, fontWeight: '700', color: '#111' },
  addBtn: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  blurb: { marginTop: 8, fontSize: 14, color: '#888', lineHeight: 20 },
  section: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  rowToday: {
    backgroundColor: '#fff7ed',
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#eee' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 19 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  rowMeta: { marginTop: 3, fontSize: 12, color: '#888' },
  when: { fontSize: 12, fontWeight: '700', color: '#777' },
  whenToday: { color: '#b45309' },
  empty: { marginTop: 30, fontSize: 15, color: '#888', lineHeight: 21 },
  error: { marginTop: 16, color: '#b91c1c' },
  footnote: {
    marginTop: 20,
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
  },
});
