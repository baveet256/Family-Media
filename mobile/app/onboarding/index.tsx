import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  listFamilyPersons,
  submitOnboarding,
  type PersonRef,
} from '@/lib/api';

type Step = 'parent' | 'spouse' | 'siblings' | 'confirm';

type PersonOption = {
  id: string;
  displayName: string;
  isPlaceholder: boolean;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { token, pendingJoinRequests, refresh } = useAuth();
  const params = useLocalSearchParams<{ joinRequestId?: string }>();
  const joinRequestId =
    typeof params.joinRequestId === 'string'
      ? params.joinRequestId
      : pendingJoinRequests.find((j) => !j.hasOnboarding)?.id ?? '';

  const joinMeta = pendingJoinRequests.find((j) => j.id === joinRequestId);
  const familyId = joinMeta?.family.id ?? '';

  const [step, setStep] = useState<Step>('parent');
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parent, setParent] = useState<PersonRef | null>(null);
  const [parentName, setParentName] = useState('');
  const [spouse, setSpouse] = useState<PersonRef | null>(null);
  const [spouseName, setSpouseName] = useState('');
  const [skipSpouse, setSkipSpouse] = useState(false);
  const [siblings, setSiblings] = useState<PersonRef[]>([]);
  const [siblingName, setSiblingName] = useState('');

  const loadPersons = useCallback(async () => {
    if (!token || !familyId) {
      setLoading(false);
      return;
    }
    try {
      const data = await listFamilyPersons(token, familyId);
      setPersons(data.persons);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load people');
    } finally {
      setLoading(false);
    }
  }, [token, familyId]);

  useEffect(() => {
    void loadPersons();
  }, [loadPersons]);

  const parentLabel = useMemo(() => {
    if (!parent) return '';
    if (parent.personId) {
      return persons.find((p) => p.id === parent.personId)?.displayName ?? parent.personId;
    }
    return parent.name ?? '';
  }, [parent, persons]);

  const onSubmit = async () => {
    if (!token || !joinRequestId || !parent) return;
    setBusy(true);
    setError(null);
    try {
      await submitOnboarding(token, joinRequestId, {
        parent,
        spouse: skipSpouse ? null : spouse,
        siblings,
      });
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save answers');
    } finally {
      setBusy(false);
    }
  };

  if (!joinRequestId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Nothing to onboard</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Go home</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>
        Joining {joinMeta?.family.name ?? 'family'}
      </Text>
      <Text style={styles.title}>
        {step === 'parent' && 'Who is your parent?'}
        {step === 'spouse' && 'Who is your spouse?'}
        {step === 'siblings' && 'Any siblings?'}
        {step === 'confirm' && 'Confirm placement'}
      </Text>
      <Text style={styles.subtitle}>
        {step === 'parent' &&
          'Pick someone already in the tree, or add a placeholder if they’re not on the app yet.'}
        {step === 'spouse' && 'Optional — you can skip.'}
        {step === 'siblings' && 'Optional — add as many as you like.'}
        {step === 'confirm' && 'Admin approval will place you on the tree.'}
      </Text>

      {(step === 'parent' || step === 'spouse' || step === 'siblings') && (
        <FlatList
          data={persons}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 8, marginTop: 16 }}
          ListEmptyComponent={
            <Text style={styles.hint}>
              Tree is empty except founders will appear after create. Add a
              placeholder name below.
            </Text>
          }
          renderItem={({ item }) => {
            const selected =
              (step === 'parent' && parent?.personId === item.id) ||
              (step === 'spouse' && spouse?.personId === item.id) ||
              (step === 'siblings' &&
                siblings.some((s) => s.personId === item.id));
            return (
              <Pressable
                style={[styles.personRow, selected && styles.personSelected]}
                onPress={() => {
                  if (step === 'parent') {
                    setParent({ personId: item.id });
                    setParentName('');
                  } else if (step === 'spouse') {
                    setSkipSpouse(false);
                    setSpouse({ personId: item.id });
                    setSpouseName('');
                  } else {
                    setSiblings((prev) => {
                      const exists = prev.some((s) => s.personId === item.id);
                      if (exists) {
                        return prev.filter((s) => s.personId !== item.id);
                      }
                      return [...prev, { personId: item.id }];
                    });
                  }
                }}>
                <Text style={styles.personName}>{item.displayName}</Text>
                {item.isPlaceholder && (
                  <Text style={styles.badge}>placeholder</Text>
                )}
              </Pressable>
            );
          }}
        />
      )}

      {step === 'parent' && (
        <View style={styles.block}>
          <Text style={styles.label}>Or placeholder name</Text>
          <TextInput
            style={styles.input}
            value={parentName}
            onChangeText={(t) => {
              setParentName(t);
              if (t.trim()) setParent({ name: t.trim() });
            }}
            placeholder="e.g. Dad (not on app)"
          />
          <Pressable
            style={[styles.button, !parent && styles.buttonDisabled]}
            disabled={!parent}
            onPress={() => setStep('spouse')}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      )}

      {step === 'spouse' && (
        <View style={styles.block}>
          <Text style={styles.label}>Or placeholder name</Text>
          <TextInput
            style={styles.input}
            value={spouseName}
            onChangeText={(t) => {
              setSpouseName(t);
              if (t.trim()) {
                setSkipSpouse(false);
                setSpouse({ name: t.trim() });
              }
            }}
            placeholder="e.g. Partner name"
          />
          <View style={styles.actions}>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                setSkipSpouse(true);
                setSpouse(null);
                setStep('siblings');
              }}>
              <Text style={styles.secondaryText}>Skip</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => setStep('siblings')}>
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setStep('parent')}>
            <Text style={styles.link}>Back</Text>
          </Pressable>
        </View>
      )}

      {step === 'siblings' && (
        <View style={styles.block}>
          <Text style={styles.label}>Add sibling placeholder</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={siblingName}
              onChangeText={setSiblingName}
              placeholder="Sibling name"
            />
            <Pressable
              style={styles.secondary}
              onPress={() => {
                if (!siblingName.trim()) return;
                setSiblings((prev) => [...prev, { name: siblingName.trim() }]);
                setSiblingName('');
              }}>
              <Text style={styles.secondaryText}>Add</Text>
            </Pressable>
          </View>
          {siblings
            .filter((s) => s.name)
            .map((s, i) => (
              <Text key={`${s.name}-${i}`} style={styles.hint}>
                + {s.name}
              </Text>
            ))}
          <View style={styles.actions}>
            <Pressable style={styles.secondary} onPress={() => setStep('spouse')}>
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={() => setStep('confirm')}>
              <Text style={styles.buttonText}>Review</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 'confirm' && (
        <View style={styles.card}>
          <Text style={styles.detail}>Parent: {parentLabel}</Text>
          <Text style={styles.detail}>
            Spouse:{' '}
            {skipSpouse || !spouse
              ? 'None'
              : spouse.personId
                ? persons.find((p) => p.id === spouse.personId)?.displayName
                : spouse.name}
          </Text>
          <Text style={styles.detail}>
            Siblings:{' '}
            {siblings.length
              ? siblings
                  .map((s) =>
                    s.personId
                      ? persons.find((p) => p.id === s.personId)?.displayName
                      : s.name,
                  )
                  .join(', ')
              : 'None'}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable
              style={styles.secondary}
              onPress={() => setStep('siblings')}>
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              disabled={busy}
              onPress={() => void onSubmit()}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {error && step !== 'confirm' && (
        <Text style={styles.error}>{error}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fafafa' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fafafa',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  title: { marginTop: 8, fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666', lineHeight: 22 },
  personRow: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personSelected: { borderColor: '#111', backgroundColor: '#f5f5f5' },
  personName: { fontSize: 16, fontWeight: '600', color: '#111' },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
  },
  block: { marginTop: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#888' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    minWidth: 120,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondaryText: { color: '#111', fontWeight: '700' },
  link: { marginTop: 16, color: '#666', fontWeight: '600' },
  hint: { marginTop: 8, color: '#888', fontSize: 14 },
  card: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    gap: 8,
  },
  detail: { fontSize: 15, color: '#444', lineHeight: 22 },
  error: { marginTop: 12, color: '#b91c1c' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
});
