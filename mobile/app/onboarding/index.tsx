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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthAtmosphere, AuthEntrance } from '@/components/AuthAtmosphere';
import { useAuth } from '@/contexts/AuthContext';
import { auth, authStyles } from '@/lib/authUi';
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
  const insets = useSafeAreaInsets();
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
      return (
        persons.find((p) => p.id === parent.personId)?.displayName ??
        parent.personId
      );
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
      <View style={styles.shell}>
        <AuthAtmosphere />
        <View style={styles.centered}>
          <Text style={authStyles.title}>Nothing to onboard</Text>
          <Pressable
            style={authStyles.button}
            onPress={() => router.replace('/')}>
            <Text style={authStyles.buttonText}>Go home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.shell}>
        <AuthAtmosphere />
        <View style={styles.centered}>
          <ActivityIndicator color={auth.creamSoft} size="large" />
        </View>
      </View>
    );
  }

  const stepTitle =
    step === 'parent'
      ? 'Who is your parent?'
      : step === 'spouse'
        ? 'Who is your spouse?'
        : step === 'siblings'
          ? 'Any siblings?'
          : 'Confirm placement';

  const stepSub =
    step === 'parent'
      ? 'Pick someone already in the tree, or add a name if they’re not on the app yet.'
      : step === 'spouse'
        ? 'Optional — you can skip.'
        : step === 'siblings'
          ? 'Optional — add as many as you like.'
          : 'An admin will place you on the tree once they approve.';

  return (
    <View style={styles.shell}>
      <AuthAtmosphere />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 28,
            paddingBottom: insets.bottom + 32,
          },
        ]}>
        <AuthEntrance delay={40}>
          <Text style={authStyles.brandMark}>Family Media</Text>
          <Text style={styles.eyebrow}>
            Joining {joinMeta?.family.name ?? 'family'}
          </Text>
          <Text style={authStyles.title}>{stepTitle}</Text>
          <Text style={authStyles.subtitle}>{stepSub}</Text>
        </AuthEntrance>

        {(step === 'parent' || step === 'spouse' || step === 'siblings') && (
          <FlatList
            data={persons}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 8, marginTop: 22 }}
            ListEmptyComponent={
              <Text style={styles.hint}>
                Nobody on the tree yet — add a placeholder name below.
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
                  <Text
                    style={[
                      styles.personName,
                      selected && styles.personNameOn,
                    ]}>
                    {item.displayName}
                  </Text>
                  {item.isPlaceholder ? (
                    <Text style={styles.badge}>placeholder</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}

        {step === 'parent' && (
          <View style={styles.block}>
            <Text style={authStyles.label}>Or placeholder name</Text>
            <View style={authStyles.inputShell}>
              <TextInput
                style={authStyles.input}
                value={parentName}
                onChangeText={(t) => {
                  setParentName(t);
                  if (t.trim()) setParent({ name: t.trim() });
                }}
                placeholder="e.g. Dad (not on app)"
                placeholderTextColor={auth.creamDim}
                selectionColor={auth.amber}
              />
            </View>
            <Pressable
              style={[
                authStyles.button,
                !parent && authStyles.buttonDisabled,
              ]}
              disabled={!parent}
              onPress={() => setStep('spouse')}>
              <Text style={authStyles.buttonText}>Continue</Text>
            </Pressable>
          </View>
        )}

        {step === 'spouse' && (
          <View style={styles.block}>
            <Text style={authStyles.label}>Or placeholder name</Text>
            <View style={authStyles.inputShell}>
              <TextInput
                style={authStyles.input}
                value={spouseName}
                onChangeText={(t) => {
                  setSpouseName(t);
                  if (t.trim()) {
                    setSkipSpouse(false);
                    setSpouse({ name: t.trim() });
                  }
                }}
                placeholder="e.g. Partner name"
                placeholderTextColor={auth.creamDim}
                selectionColor={auth.amber}
              />
            </View>
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
                style={[authStyles.button, styles.flexBtn]}
                onPress={() => setStep('siblings')}>
                <Text style={authStyles.buttonText}>Continue</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setStep('parent')} style={authStyles.ghost}>
              <Text style={authStyles.ghostText}>← Back</Text>
            </Pressable>
          </View>
        )}

        {step === 'siblings' && (
          <View style={styles.block}>
            <Text style={authStyles.label}>Add sibling placeholder</Text>
            <View style={styles.row}>
              <View style={[authStyles.inputShell, { flex: 1 }]}>
                <TextInput
                  style={authStyles.input}
                  value={siblingName}
                  onChangeText={setSiblingName}
                  placeholder="Sibling name"
                  placeholderTextColor={auth.creamDim}
                  selectionColor={auth.amber}
                />
              </View>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  if (!siblingName.trim()) return;
                  setSiblings((prev) => [
                    ...prev,
                    { name: siblingName.trim() },
                  ]);
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
              <Pressable
                style={styles.secondary}
                onPress={() => setStep('spouse')}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[authStyles.button, styles.flexBtn]}
                onPress={() => setStep('confirm')}>
                <Text style={authStyles.buttonText}>Review</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'confirm' && (
          <View style={styles.summary}>
            <Text style={styles.detail}>Parent · {parentLabel}</Text>
            <Text style={styles.detail}>
              Spouse ·{' '}
              {skipSpouse || !spouse
                ? 'None'
                : spouse.personId
                  ? persons.find((p) => p.id === spouse.personId)?.displayName
                  : spouse.name}
            </Text>
            <Text style={styles.detail}>
              Siblings ·{' '}
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
            {error ? <Text style={authStyles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                style={styles.secondary}
                onPress={() => setStep('siblings')}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[
                  authStyles.button,
                  styles.flexBtn,
                  busy && authStyles.buttonDisabled,
                ]}
                disabled={busy}
                onPress={() => void onSubmit()}>
                {busy ? (
                  <ActivityIndicator color={auth.ink} />
                ) : (
                  <Text style={authStyles.buttonText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {error && step !== 'confirm' ? (
          <Text style={authStyles.error}>{error}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: auth.bg },
  container: { paddingHorizontal: 28, gap: 8 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: auth.amber,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  personRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(232,213,163,0.22)',
    backgroundColor: 'rgba(232,213,163,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personSelected: {
    borderColor: auth.creamSoft,
    backgroundColor: 'rgba(232,213,163,0.16)',
  },
  personName: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: auth.creamMuted,
  },
  personNameOn: {
    fontFamily: 'DMSans_700Bold',
    color: auth.cream,
  },
  badge: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: auth.amber,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  block: { marginTop: 18, gap: 4 },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  flexBtn: { flex: 1, minWidth: 120, marginTop: 0 },
  secondary: {
    backgroundColor: 'rgba(232,213,163,0.12)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: 'DMSans_700Bold',
    color: auth.creamSoft,
    fontSize: 15,
  },
  hint: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    color: auth.creamFaint,
    fontSize: 14,
  },
  summary: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(232,213,163,0.2)',
    gap: 10,
  },
  detail: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: auth.creamMuted,
    lineHeight: 24,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
});
