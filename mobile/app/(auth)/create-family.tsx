import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { createFamily } from '@/lib/api';

export default function CreateFamilyScreen() {
  const router = useRouter();
  const { token, refresh } = useAuth();
  const [name, setName] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await createFamily(token, { name: name.trim(), requireApproval });
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create family');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your family</Text>
      <Text style={styles.subtitle}>
        You’ll be the admin and can invite others with a code or QR.
      </Text>

      <Text style={styles.label}>Family name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Horas"
        autoFocus
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Require approval</Text>
          <Text style={styles.rowHint}>
            Join requests stay pending until Phase 2 approval.
          </Text>
        </View>
        <Switch value={requireApproval} onValueChange={setRequireApproval} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (!name.trim() || busy) && styles.buttonDisabled]}
        disabled={!name.trim() || busy}
        onPress={() => void onCreate()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create family</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={() => router.push('/(auth)/join-code')}>
        <Text style={styles.linkText}>I have an invite code</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666', lineHeight: 22 },
  label: { marginTop: 28, fontSize: 13, fontWeight: '600', color: '#888' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    color: '#111',
  },
  row: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowHint: { marginTop: 4, fontSize: 13, color: '#888' },
  error: { marginTop: 12, color: '#b91c1c', fontSize: 14 },
  button: {
    marginTop: 28,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#111', fontWeight: '600', fontSize: 15 },
});
