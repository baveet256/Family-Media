import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StoryRing } from '@/lib/api';

type Props = {
  familyId: string;
  rings: StoryRing[];
  currentUserId?: string;
  onRefresh?: () => void;
};

export function StoryRingRow({ familyId, rings, currentUserId }: Props) {
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      <Pressable
        style={styles.item}
        onPress={() =>
          router.push({
            pathname: '/stories/create',
            params: { familyId },
          })
        }>
        <View style={[styles.avatar, styles.addAvatar]}>
          <Text style={styles.addPlus}>＋</Text>
        </View>
        <Text style={styles.label} numberOfLines={1}>
          Your story
        </Text>
      </Pressable>

      {rings.map((ring) => {
        const isSelf = ring.author.id === currentUserId;
        return (
          <Pressable
            key={ring.author.id}
            style={styles.item}
            onPress={() =>
              router.push({
                pathname: '/stories/viewer',
                params: {
                  familyId,
                  authorId: ring.author.id,
                },
              })
            }>
            <View
              style={[
                styles.ring,
                ring.hasUnseen ? styles.ringUnseen : styles.ringSeen,
              ]}>
              <View style={styles.avatar}>
                <Text style={styles.initial}>
                  {(ring.author.displayName || '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {isSelf ? 'You' : ring.author.displayName}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
    paddingRight: 8,
    gap: 14,
    alignItems: 'center',
  },
  item: { width: 72, alignItems: 'center' },
  ring: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
  },
  ringUnseen: { borderColor: '#111' },
  ringSeen: { borderColor: '#d4d4d4' },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAvatar: {
    borderWidth: 2,
    borderColor: '#111',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
  },
  addPlus: { fontSize: 22, fontWeight: '700', color: '#111' },
  initial: { fontSize: 22, fontWeight: '700', color: '#111' },
  label: {
    marginTop: 6,
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    width: 72,
  },
});
