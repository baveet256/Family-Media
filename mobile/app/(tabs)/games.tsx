import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
  fetchGamesHub,
  type GameRoundSummary,
  type GamesHub,
} from '@/lib/api';

const MEDALS = ['🥇', '🥈', '🥉'];

function gameLabel(type: GameRoundSummary['type']) {
  return type === 'family_awards' ? '🏆 Family Awards' : '💬 Caption Battle';
}

function statusLabel(round: GameRoundSummary) {
  if (round.status === 'submitting') return 'Writing captions';
  if (round.status === 'voting') return 'Voting open';
  return 'Results';
}

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closing…';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

function callToAction(round: GameRoundSummary) {
  if (round.status === 'submitting') {
    return round.mySubmitted ? 'Caption sent · view' : 'Write your caption';
  }
  if (round.status === 'voting') {
    return round.myVoteEntryId ? 'Voted · change it' : 'Cast your vote';
  }
  return 'See results';
}

export default function GamesScreen() {
  const router = useRouter();
  const { token, activeFamily } = useAuth();
  const family = activeFamily;

  const [hub, setHub] = useState<GamesHub | null>(null);
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
        setHub(await fetchGamesHub(token, family.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load games');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, family?.id, family?.status],
  );

  useFocusEffect(
    useCallback(() => {
      void load({ soft: true });
    }, [load]),
  );

  if (!family || family.status === 'pending') {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Games</Text>
        <Text style={styles.emptySub}>
          Join an active family to play together.
        </Text>
      </View>
    );
  }

  const openRound = (id: string) =>
    router.push({ pathname: '/games/[id]', params: { id } });

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
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{family.name}</Text>
          <Text style={styles.title}>Games</Text>
        </View>
        <Pressable
          style={styles.newBtn}
          onPress={() =>
            router.push({
              pathname: '/games/new',
              params: { familyId: family.id },
            })
          }>
          <Text style={styles.newBtnText}>New round</Text>
        </Pressable>
      </View>

      {loading && !hub ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {hub ? (
        <>
          <Text style={styles.section}>Live now</Text>
          {hub.active.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>Nothing running</Text>
              <Text style={styles.emptyCardBody}>
                Start a round and everyone gets a notification. Takes 10
                seconds.
              </Text>
              <Pressable
                style={styles.inlineBtn}
                onPress={() =>
                  router.push({
                    pathname: '/games/new',
                    params: { familyId: family.id },
                  })
                }>
                <Text style={styles.inlineBtnText}>Start a round</Text>
              </Pressable>
            </View>
          ) : (
            hub.active.map((round) => (
              <Pressable
                key={round.id}
                style={styles.card}
                onPress={() => openRound(round.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardKind}>{gameLabel(round.type)}</Text>
                  <Text style={styles.cardTime}>{timeLeft(round.closesAt)}</Text>
                </View>
                <Text style={styles.cardPrompt}>{round.prompt}</Text>
                {round.photoUrl ? (
                  <Image
                    source={{ uri: round.photoUrl }}
                    style={styles.cardPhoto}
                  />
                ) : null}
                <View style={styles.cardBottom}>
                  <Text style={styles.cardMeta}>
                    {statusLabel(round)} ·{' '}
                    {round.status === 'submitting'
                      ? `${round.entryCount} caption${round.entryCount === 1 ? '' : 's'}`
                      : `${round.voteCount} vote${round.voteCount === 1 ? '' : 's'}`}
                  </Text>
                  <Text style={styles.cardCta}>{callToAction(round)} →</Text>
                </View>
              </Pressable>
            ))
          )}

          {hub.trophies.length > 0 ? (
            <>
              <Text style={styles.section}>Trophy shelf</Text>
              <View style={styles.shelf}>
                {hub.trophies.map((t, i) => (
                  <View key={t.person.id} style={styles.shelfRow}>
                    <Text style={styles.shelfRank}>
                      {MEDALS[i] ?? `${i + 1}.`}
                    </Text>
                    {t.person.avatarUrl ? (
                      <Image
                        source={{ uri: t.person.avatarUrl }}
                        style={styles.shelfAvatar}
                      />
                    ) : (
                      <View style={[styles.shelfAvatar, styles.shelfFallback]}>
                        <Text style={styles.shelfInitial}>
                          {(t.person.displayName || '?')
                            .slice(0, 1)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.shelfName} numberOfLines={1}>
                      {t.person.displayName}
                    </Text>
                    <Text style={styles.shelfWins}>
                      {t.wins} win{t.wins === 1 ? '' : 's'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {hub.finished.length > 0 ? (
            <>
              <Text style={styles.section}>Recent results</Text>
              {hub.finished.map((round) => (
                <Pressable
                  key={round.id}
                  style={styles.resultRow}
                  onPress={() => openRound(round.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultPrompt} numberOfLines={1}>
                      {round.prompt}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {round.winner
                        ? `🏆 ${round.winner.subject.displayName} · ${round.winner.votes} vote${
                            round.winner.votes === 1 ? '' : 's'
                          }`
                        : 'No votes cast'}
                    </Text>
                  </View>
                  <Text style={styles.resultChevron}>›</Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fafafa',
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  emptySub: { marginTop: 8, fontSize: 15, color: '#888', textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#111', marginTop: 2 },
  newBtn: {
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newBtnText: { color: '#fff', fontWeight: '700' },
  error: { marginTop: 16, color: '#b91c1c' },
  section: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardKind: { fontSize: 13, fontWeight: '700', color: '#111' },
  cardTime: { fontSize: 12, fontWeight: '600', color: '#d97706' },
  cardPrompt: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: '700',
    color: '#111',
    lineHeight: 25,
  },
  cardPhoto: {
    marginTop: 12,
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  cardBottom: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMeta: { fontSize: 13, color: '#777', flexShrink: 1 },
  cardCta: { fontSize: 13, fontWeight: '700', color: '#111' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  emptyCardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  emptyCardBody: { marginTop: 6, fontSize: 14, color: '#777', lineHeight: 20 },
  inlineBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineBtnText: { color: '#fff', fontWeight: '700' },
  shelf: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shelfRank: { width: 26, fontSize: 16 },
  shelfAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  shelfFallback: { alignItems: 'center', justifyContent: 'center' },
  shelfInitial: { fontWeight: '700', color: '#444' },
  shelfName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111' },
  shelfWins: { fontSize: 13, color: '#777' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  resultPrompt: { fontSize: 15, fontWeight: '600', color: '#111' },
  resultMeta: { marginTop: 3, fontSize: 13, color: '#777' },
  resultChevron: { fontSize: 22, color: '#bbb' },
});
