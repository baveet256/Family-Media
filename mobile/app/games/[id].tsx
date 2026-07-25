import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  advanceGameRound,
  fetchGameRound,
  submitGameEntry,
  voteGameEntry,
  type GameEntry,
  type GameRound,
} from '@/lib/api';

function headline(round: GameRound) {
  if (round.status === 'submitting') return 'Write your caption';
  if (round.status === 'voting') {
    return round.type === 'family_awards' ? 'Who is it?' : 'Pick the funniest';
  }
  return 'Results';
}

function subhead(round: GameRound) {
  if (round.status === 'submitting') {
    return 'Nobody sees each other’s captions until voting starts.';
  }
  if (round.status === 'voting') {
    return round.type === 'family_awards'
      ? 'One vote each. Votes stay hidden until the reveal.'
      : 'Captions are anonymous until the reveal.';
  }
  return null;
}

export default function GameRoundScreen() {
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const roundId = typeof params.id === 'string' ? params.id : '';

  const [round, setRound] = useState<GameRound | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !roundId) return;
    try {
      const data = await fetchGameRound(token, roundId);
      setRound(data);
      const mine = data.entries.find((e) => e.isMine);
      if (mine?.text) setCaption(mine.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load round');
    } finally {
      setLoading(false);
    }
  }, [token, roundId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<{ round: GameRound }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { round: next } = await fn();
      setRound(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!round) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || 'Round not found'}</Text>
      </View>
    );
  }

  const closed = round.status === 'closed';
  const ranked = closed
    ? [...round.entries].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    : round.entries;

  const renderEntry = (entry: GameEntry, index: number) => {
    const selected = entry.votedByMe;
    const isWinner = closed && round.winner?.entryId === entry.id;
    const votable =
      round.status === 'voting' &&
      !(round.type === 'caption_battle' && entry.isMine);

    return (
      <Pressable
        key={entry.id}
        disabled={!votable || busy}
        onPress={() =>
          void run(() => voteGameEntry(token!, round.id, entry.id))
        }
        style={[
          styles.entry,
          selected && styles.entrySelected,
          isWinner && styles.entryWinner,
        ]}>
        {round.type === 'family_awards' ? (
          entry.subject?.avatarUrl ? (
            <Image
              source={{ uri: entry.subject.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(entry.subject?.displayName || '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.captionIndex}>
            <Text style={styles.captionIndexText}>{index + 1}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {round.type === 'family_awards' ? (
            <Text style={styles.entryTitle}>
              {entry.subject?.displayName ?? 'Someone'}
            </Text>
          ) : (
            <>
              <Text style={styles.entryCaption}>{entry.text}</Text>
              <Text style={styles.entryAuthor}>
                {entry.subject
                  ? entry.isMine
                    ? 'your caption'
                    : entry.subject.displayName
                  : 'anonymous'}
              </Text>
            </>
          )}
        </View>

        {closed ? (
          <Text style={[styles.voteCount, isWinner && styles.voteCountWin]}>
            {isWinner ? '🏆 ' : ''}
            {entry.votes ?? 0}
          </Text>
        ) : selected ? (
          <Text style={styles.checkMark}>✓</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={styles.kind}>
        {round.type === 'family_awards'
          ? '🏆 Family Awards'
          : '💬 Caption Battle'}
      </Text>
      <Text style={styles.prompt}>{round.prompt}</Text>
      <Text style={styles.host}>
        Hosted by {round.createdBy.id === user?.id ? 'you' : round.createdBy.displayName}
      </Text>

      {round.photoUrl ? (
        <Image source={{ uri: round.photoUrl }} style={styles.photo} />
      ) : null}

      <Text style={styles.headline}>{headline(round)}</Text>
      {subhead(round) ? (
        <Text style={styles.subhead}>{subhead(round)}</Text>
      ) : null}

      {closed && round.winner ? (
        <View style={styles.winnerCard}>
          <Text style={styles.winnerLabel}>Winner</Text>
          <Text style={styles.winnerName}>
            🏆 {round.winner.subject.displayName}
          </Text>
          {round.winner.text ? (
            <Text style={styles.winnerText}>“{round.winner.text}”</Text>
          ) : null}
          <Text style={styles.winnerVotes}>
            {round.winner.votes} vote{round.winner.votes === 1 ? '' : 's'}
          </Text>
        </View>
      ) : null}

      {round.status === 'submitting' ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={caption}
            onChangeText={setCaption}
            placeholder="Your funniest caption…"
            placeholderTextColor="#aaa"
            maxLength={200}
            multiline
          />
          <Pressable
            style={[
              styles.primary,
              (!caption.trim() || busy) && styles.primaryDisabled,
            ]}
            disabled={!caption.trim() || busy}
            onPress={() =>
              void run(() => submitGameEntry(token!, round.id, caption.trim()))
            }>
            <Text style={styles.primaryText}>
              {round.mySubmitted ? 'Update caption' : 'Send caption'}
            </Text>
          </Pressable>
          <Text style={styles.progress}>
            {round.entryCount} of {round.memberCount} have written one
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>{ranked.map(renderEntry)}</View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {round.isHost && !closed ? (
        <Pressable
          style={[styles.hostBtn, busy && styles.primaryDisabled]}
          disabled={busy}
          onPress={() => void run(() => advanceGameRound(token!, round.id))}>
          <Text style={styles.hostBtnText}>
            {round.status === 'submitting'
              ? 'Close captions · start voting'
              : 'Reveal the results'}
          </Text>
        </Pressable>
      ) : null}

      {!closed ? (
        <Text style={styles.footnote}>
          {round.voteCount} of {round.memberCount} voted · closes automatically
        </Text>
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
  kind: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prompt: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    lineHeight: 32,
  },
  host: { marginTop: 6, fontSize: 13, color: '#888' },
  photo: {
    marginTop: 16,
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#eee',
  },
  headline: {
    marginTop: 24,
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  subhead: { marginTop: 4, fontSize: 13, color: '#888', lineHeight: 19 },
  winnerCard: {
    marginTop: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  winnerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  winnerName: { marginTop: 4, fontSize: 22, fontWeight: '700', color: '#111' },
  winnerText: {
    marginTop: 8,
    fontSize: 16,
    fontStyle: 'italic',
    color: '#444',
    lineHeight: 22,
  },
  winnerVotes: { marginTop: 8, fontSize: 13, color: '#92400e' },
  composer: { marginTop: 14 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111',
    textAlignVertical: 'top',
  },
  primary: {
    marginTop: 12,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  progress: { marginTop: 10, fontSize: 13, color: '#888', textAlign: 'center' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#eee',
  },
  entrySelected: { borderColor: '#111', backgroundColor: '#f7f7f7' },
  entryWinner: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontWeight: '700', color: '#444', fontSize: 16 },
  captionIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionIndexText: { fontWeight: '700', color: '#666', fontSize: 13 },
  entryTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  entryCaption: { fontSize: 16, color: '#111', lineHeight: 22 },
  entryAuthor: { marginTop: 4, fontSize: 12, color: '#999' },
  voteCount: { fontSize: 16, fontWeight: '700', color: '#666' },
  voteCountWin: { color: '#b45309' },
  checkMark: { fontSize: 18, fontWeight: '700', color: '#111' },
  hostBtn: {
    marginTop: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  hostBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footnote: {
    marginTop: 14,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  error: { marginTop: 14, color: '#b91c1c', textAlign: 'center' },
});
