import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { UpcomingItem } from '@/lib/api';
import { occasionEmoji, whenLabel } from '@/lib/occasions';

type Props = {
  familyId: string;
  items: UpcomingItem[];
};

export function UpcomingStrip({ familyId, items }: Props) {
  const router = useRouter();
  if (!items.length) return null;

  const next = items[0];
  const isToday = next.daysUntil === 0;
  const more = items.length - 1;
  const person = next.people[0];

  return (
    <Pressable
      style={[styles.card, isToday && styles.cardToday]}
      onPress={() =>
        router.push({ pathname: '/calendar', params: { familyId } })
      }>
      {person?.avatarUrl ? (
        <Image source={{ uri: person.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.emoji}>{occasionEmoji(next.kind)}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={[styles.label, isToday && styles.labelToday]}>
          {isToday ? 'Today' : 'Coming up'}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {occasionEmoji(next.kind)} {next.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[
            isToday ? next.subtitle : whenLabel(next.daysUntil, next.date),
            next.viaTag,
            more > 0 ? `+${more} more` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  cardToday: {
    backgroundColor: '#fff7ed',
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  labelToday: { color: '#b45309' },
  title: { marginTop: 2, fontSize: 15, fontWeight: '700', color: '#111' },
  meta: { marginTop: 2, fontSize: 12, color: '#888' },
  chevron: { fontSize: 22, color: '#bbb' },
});
