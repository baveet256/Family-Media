import { useRouter } from 'expo-router';
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
import { createConnectionInvite, listFamilyPersons } from '@/lib/api';

type Person = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export default function InviteConnectionScreen() {
  const router = useRouter();
  const { token, activeFamily, connections } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [joinExistingId, setJoinExistingId] = useState<string | null>(null);
  const [unified, setUnified] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [marrying, setMarrying] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    if (!token || !activeFamily) return;
    try {
      const res = await listFamilyPersons(token, activeFamily.id);
      setPeople(res.persons);
    } catch {
      // Naming the couple is optional, so a failure here shouldn't block.
    }
  }, [token, activeFamily]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const onSend = async () => {
    if (!token || !activeFamily) return;
    if (!code.trim()) {
      setError('Enter the other family’s invite code');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createConnectionInvite(token, {
        fromFamilyId: activeFamily.id,
        toFamilyInviteCode: code.trim().toUpperCase(),
        connectionId: joinExistingId ?? undefined,
        proposedName: name.trim() || undefined,
        proposedFeedPolicy: unified ? 'unified_feed' : 'separate_feeds',
        fromPersonId: marrying ?? undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Their family invite code</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
        placeholder="e.g. ABCD1234"
        placeholderTextColor="#aaa"
      />

      {people.length ? (
        <>
          <Text style={styles.label}>Who’s getting married?</Text>
          <Text style={styles.hint}>
            Pick your side. Their admin names the other half when they accept,
            and we’ll draw the marriage on the tree for you.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.peopleRow}>
            {people.map((p) => {
              const on = marrying === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.person, on && styles.personOn]}
                  onPress={() => setMarrying(on ? null : p.id)}>
                  {p.avatarUrl ? (
                    <Image source={{ uri: p.avatarUrl }} style={styles.face} />
                  ) : (
                    <View style={[styles.face, styles.faceEmpty]}>
                      <Text style={styles.faceLetter}>
                        {p.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    numberOfLines={1}
                    style={[styles.personName, on && styles.personNameOn]}>
                    {p.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.label}>Connection name (optional)</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={
          marrying
            ? people.find((p) => p.id === marrying)?.displayName ?? 'Smith & Patel'
            : 'Smith & Patel'
        }
        placeholderTextColor="#aaa"
      />

      <Text style={styles.label}>Feed policy</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.pill, unified && styles.pillOn]}
          onPress={() => setUnified(true)}>
          <Text style={[styles.pillText, unified && styles.pillTextOn]}>
            Unified
          </Text>
        </Pressable>
        <Pressable
          style={[styles.pill, !unified && styles.pillOn]}
          onPress={() => setUnified(false)}>
          <Text style={[styles.pillText, !unified && styles.pillTextOn]}>
            Separate
          </Text>
        </Pressable>
      </View>

      {connections.length ? (
        <>
          <Text style={styles.label}>Or add them to an existing connection</Text>
          <Pressable
            style={[styles.option, !joinExistingId && styles.optionOn]}
            onPress={() => setJoinExistingId(null)}>
            <Text style={styles.optionText}>New connection</Text>
          </Pressable>
          {connections.map((c) => (
            <Pressable
              key={c.id}
              style={[
                styles.option,
                joinExistingId === c.id && styles.optionOn,
              ]}
              onPress={() => setJoinExistingId(c.id)}>
              <Text style={styles.optionText}>{c.name || 'Connection'}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void onSend()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send invite</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 40 },
  hint: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  peopleRow: { gap: 10, paddingVertical: 2, paddingRight: 8 },
  person: {
    width: 76,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  personOn: { borderColor: '#c2410c', backgroundColor: '#fff7ed' },
  face: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eee' },
  faceEmpty: { alignItems: 'center', justifyContent: 'center' },
  faceLetter: { fontWeight: '700', color: '#888', fontSize: 18 },
  personName: {
    marginTop: 6,
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  personNameOn: { color: '#c2410c' },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111',
  },
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  pillOn: { backgroundColor: '#111' },
  pillText: { fontWeight: '600', color: '#444' },
  pillTextOn: { color: '#fff' },
  option: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
    marginBottom: 6,
  },
  optionOn: { borderColor: '#111', borderWidth: 1.5 },
  optionText: { fontWeight: '600', color: '#111' },
  error: { color: '#b00020', marginTop: 12 },
  button: {
    marginTop: 24,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
