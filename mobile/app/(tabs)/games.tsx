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
import { fonts, theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
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
      <View style={[styles.centered, { paddingTop: insets.top }]}>
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
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 48,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={theme.accent}
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
  container: { flex: 1, backgroundColor: theme.paper },
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: {
    fontFamily: fonts.displaySoft,
    fontSize: 14,
    color: theme.gold,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: theme.ink,
    marginTop: 2,
    letterSpacing: -0.4,
  },
  newBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  newBtnText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
  },
  error: {
    marginTop: 16,
    fontFamily: fonts.bodyMed,
    color: theme.danger,
  },
  section: {
    marginTop: 28,
    marginBottom: 10,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: theme.paperElevated,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardKind: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.inkSoft,
  },
  cardTime: {
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    color: theme.gold,
  },
  cardPrompt: {
    marginTop: 8,
    fontFamily: fonts.displayMed,
    fontSize: 22,
    color: theme.ink,
    lineHeight: 28,
  },
  cardPhoto: {
    marginTop: 12,
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: theme.accentSoft,
  },
  cardBottom: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.muted,
    flexShrink: 1,
  },
  cardCta: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.accent,
  },
  emptyCard: {
    backgroundColor: theme.paperElevated,
    borderRadius: 18,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  emptyCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: theme.ink,
  },
  emptyCardBody: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.muted,
    lineHeight: 20,
  },
  inlineBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineBtnText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
  },
  shelf: {
    backgroundColor: theme.paperElevated,
    borderRadius: 18,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
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
    backgroundColor: theme.accentSoft,
  },
  shelfFallback: { alignItems: 'center', justifyContent: 'center' },
  shelfInitial: {
    fontFamily: fonts.bodyBold,
    color: theme.inkSoft,
  },
  shelfName: {
    flex: 1,
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    color: theme.ink,
  },
  shelfWins: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.muted,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.paperElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  resultPrompt: {
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    color: theme.ink,
  },
  resultMeta: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.muted,
  },
  resultChevron: { fontSize: 22, color: theme.faint },
});
