import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  fetchConnectionInvites,
  fetchConnections,
  listFamilyPersons,
  respondConnectionInvite,
  type ConnectionInvite,
  type ConnectionSummary,
} from '@/lib/api';

type Person = { id: string; displayName: string; avatarUrl: string | null };

export default function ConnectionsScreen() {
  const router = useRouter();
  const { token, activeFamily, refresh } = useAuth();
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [incoming, setIncoming] = useState<ConnectionInvite[]>([]);
  const [ourPeople, setOurPeople] = useState<Record<string, Person[]>>({});
  const [pairPick, setPairPick] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [c, inv] = await Promise.all([
        fetchConnections(token),
        fetchConnectionInvites(token),
      ]);
      setConnections(c.connections);
      setIncoming(inv.incoming);

      // Invites that name someone need a matching person from our side.
      const familyIds = [
        ...new Set(
          inv.incoming.filter((i) => i.fromPerson).map((i) => i.toFamily.id),
        ),
      ];
      const rosters = await Promise.all(
        familyIds.map(async (fid) => {
          try {
            return [fid, (await listFamilyPersons(token, fid)).persons] as const;
          } catch {
            return [fid, [] as Person[]] as const;
          }
        }),
      );
      setOurPeople(Object.fromEntries(rosters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRespond = async (id: string, action: 'accept' | 'decline') => {
    if (!token) return;
    setBusyId(id);
    try {
      await respondConnectionInvite(token, id, {
        action,
        feedPolicy: 'unified_feed',
        toPersonId: action === 'accept' ? pairPick[id] : undefined,
      });
      await refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.inviteBtn}
        onPress={() => router.push('/connections/invite')}>
        <Text style={styles.inviteBtnText}>Invite a family</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {incoming.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Incoming invites</Text>
                  {incoming.map((inv) => (
                    <View key={inv.id} style={styles.inviteCard}>
                      <Text style={styles.cardTitle}>
                        {inv.fromFamily.name}
                        {inv.existingConnection
                          ? ` → join ${inv.existingConnection.name || 'connection'}`
                          : ' wants to connect'}
                      </Text>
                      <Text style={styles.cardMeta}>
                        Proposed:{' '}
                        {inv.proposedFeedPolicy === 'unified_feed'
                          ? 'Unified feed'
                          : 'Separate feeds'}
                      </Text>

                      {inv.fromPerson ? (
                        <View style={styles.marriage}>
                          <Text style={styles.marriageTitle}>
                            💐 {inv.fromPerson.displayName} is marrying into
                            your family
                          </Text>
                          <Text style={styles.marriageHint}>
                            Who are they marrying?
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.peopleRow}>
                            {(ourPeople[inv.toFamily.id] ?? []).map((p) => {
                              const on = pairPick[inv.id] === p.id;
                              return (
                                <Pressable
                                  key={p.id}
                                  style={[styles.person, on && styles.personOn]}
                                  onPress={() =>
                                    setPairPick((prev) => {
                                      const next = { ...prev };
                                      if (on) delete next[inv.id];
                                      else next[inv.id] = p.id;
                                      return next;
                                    })
                                  }>
                                  {p.avatarUrl ? (
                                    <Image
                                      source={{ uri: p.avatarUrl }}
                                      style={styles.face}
                                    />
                                  ) : (
                                    <View style={[styles.face, styles.faceEmpty]}>
                                      <Text style={styles.faceLetter}>
                                        {p.displayName.charAt(0).toUpperCase()}
                                      </Text>
                                    </View>
                                  )}
                                  <Text
                                    numberOfLines={1}
                                    style={[
                                      styles.personName,
                                      on && styles.personNameOn,
                                    ]}>
                                    {p.displayName}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      ) : null}

                      <View style={styles.actions}>
                        <Pressable
                          style={styles.accept}
                          disabled={busyId === inv.id}
                          onPress={() => void onRespond(inv.id, 'accept')}>
                          <Text style={styles.acceptText}>Accept</Text>
                        </Pressable>
                        <Pressable
                          style={styles.decline}
                          disabled={busyId === inv.id}
                          onPress={() => void onRespond(inv.id, 'decline')}>
                          <Text style={styles.declineText}>Decline</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.sectionTitle}>Your connections</Text>
              {!connections.length ? (
                <Text style={styles.empty}>
                  No connections yet
                  {activeFamily?.role === 'admin'
                    ? '. Invite another family to unite trees and feeds.'
                    : '.'}
                </Text>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/connections/[id]',
                  params: { id: item.id },
                })
              }>
              <Text style={styles.cardTitle}>
                {item.name || 'Connection'}
              </Text>
              <Text style={styles.cardMeta}>
                {item.families.map((f) => f.name).join(' · ')}
              </Text>
              <Text style={styles.cardMeta}>
                {item.feedPolicy === 'unified_feed'
                  ? 'Unified feed'
                  : 'Separate feeds'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', padding: 16 },
  inviteBtn: {
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  empty: { color: '#888', fontSize: 15, marginBottom: 16 },
  error: { color: '#b00020', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  inviteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  cardMeta: { marginTop: 4, fontSize: 13, color: '#666' },
  marriage: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fed7aa',
  },
  marriageTitle: { fontWeight: '700', color: '#9a3412', fontSize: 14 },
  marriageHint: { marginTop: 2, marginBottom: 8, fontSize: 12, color: '#a16207' },
  peopleRow: { gap: 10, paddingRight: 8 },
  person: {
    width: 68,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  personOn: { borderColor: '#c2410c', backgroundColor: '#ffedd5' },
  face: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#eee' },
  faceEmpty: { alignItems: 'center', justifyContent: 'center' },
  faceLetter: { fontWeight: '700', color: '#888', fontSize: 16 },
  personName: {
    marginTop: 5,
    fontSize: 10,
    color: '#78716c',
    fontWeight: '600',
    textAlign: 'center',
  },
  personNameOn: { color: '#c2410c' },
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
