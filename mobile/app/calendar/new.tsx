import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { createOccasion, listFamilyPersons } from '@/lib/api';

type Person = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type Kind = 'anniversary' | 'custom';

export default function NewOccasionScreen() {
  const router = useRouter();
  const { token, activeFamily } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId =
    typeof params.familyId === 'string' ? params.familyId : activeFamily?.id;

  const [kind, setKind] = useState<Kind>('anniversary');
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !familyId) return;
    void (async () => {
      try {
        const data = await listFamilyPersons(token, familyId);
        setPeople(data.persons);
      } catch {
        // the picker is only needed for anniversaries
      }
    })();
  }, [token, familyId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const onSave = async () => {
    if (!token || !familyId || busy) return;

    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!d || !m || !y || d > 31 || m > 12 || y < 1900 || y > 2200) {
      setError('Enter a real date');
      return;
    }
    if (kind === 'anniversary' && selected.length !== 2) {
      setError('Pick the two people');
      return;
    }
    if (kind === 'custom' && !title.trim()) {
      setError('Give the occasion a name');
      return;
    }

    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    setBusy(true);
    setError(null);
    try {
      await createOccasion(token, {
        familyId,
        type: kind,
        date: iso,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(kind === 'anniversary'
          ? { personAId: selected[0], personBId: selected[1] }
          : {}),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the date');
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={styles.label}>What is it</Text>
      <View style={styles.typeRow}>
        <Pressable
          style={[styles.typeCard, kind === 'anniversary' && styles.typeOn]}
          onPress={() => setKind('anniversary')}>
          <Text style={styles.typeEmoji}>💕</Text>
          <Text style={styles.typeTitle}>Anniversary</Text>
          <Text style={styles.typeBody}>For a couple</Text>
        </Pressable>
        <Pressable
          style={[styles.typeCard, kind === 'custom' && styles.typeOn]}
          onPress={() => setKind('custom')}>
          <Text style={styles.typeEmoji}>📅</Text>
          <Text style={styles.typeTitle}>Something else</Text>
          <Text style={styles.typeBody}>Reunion, festival…</Text>
        </Pressable>
      </View>

      {kind === 'anniversary' ? (
        <>
          <Text style={styles.label}>Who</Text>
          <Text style={styles.hint}>Pick two people ({selected.length}/2)</Text>
          <View style={styles.chips}>
            {people.map((p) => {
              const on = selected.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  style={[styles.person, on && styles.personOn]}
                  onPress={() => toggle(p.id)}>
                  {p.avatarUrl ? (
                    <Image
                      source={{ uri: p.avatarUrl }}
                      style={styles.personAvatar}
                    />
                  ) : null}
                  <Text style={[styles.personName, on && styles.personNameOn]}>
                    {p.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>
        Name {kind === 'anniversary' ? '(optional)' : ''}
      </Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={
          kind === 'anniversary' ? 'Defaults to their names' : 'Diwali dinner'
        }
        placeholderTextColor="#aaa"
        maxLength={120}
      />

      <Text style={styles.label}>Date it started</Text>
      <Text style={styles.hint}>
        The original year — we work out each anniversary from it.
      </Text>
      <View style={styles.dateRow}>
        <TextInput
          style={[styles.input, styles.dateInput]}
          value={day}
          onChangeText={setDay}
          placeholder="DD"
          placeholderTextColor="#aaa"
          keyboardType="number-pad"
          maxLength={2}
        />
        <TextInput
          style={[styles.input, styles.dateInput]}
          value={month}
          onChangeText={setMonth}
          placeholder="MM"
          placeholderTextColor="#aaa"
          keyboardType="number-pad"
          maxLength={2}
        />
        <TextInput
          style={[styles.input, styles.dateInput, { flex: 1.4 }]}
          value={year}
          onChangeText={setYear}
          placeholder="YYYY"
          placeholderTextColor="#aaa"
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, busy && styles.primaryDisabled]}
        disabled={busy}
        onPress={() => void onSave()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Save the date</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: { marginBottom: 10, fontSize: 13, color: '#999' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e5e5e5',
  },
  typeOn: { borderColor: '#111', backgroundColor: '#f7f7f7' },
  typeEmoji: { fontSize: 24 },
  typeTitle: { marginTop: 6, fontSize: 15, fontWeight: '700', color: '#111' },
  typeBody: { marginTop: 2, fontSize: 12, color: '#777' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  personOn: { backgroundColor: '#111', borderColor: '#111' },
  personAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eee',
  },
  personName: { fontSize: 14, fontWeight: '600', color: '#333' },
  personNameOn: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1, textAlign: 'center' },
  primary: {
    marginTop: 28,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { marginTop: 16, color: '#b91c1c' },
});
