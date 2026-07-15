import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { createJoinRequest } from '@/lib/api';

export default function JoinCodeScreen() {
  const router = useRouter();
  const { token, refresh } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onJoin = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createJoinRequest(token, code.trim());
      await refresh();
      setDone(
        `Join request sent to ${result.joinRequest.family.name}. Waiting for admin approval (Phase 2).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a family</Text>
      <Text style={styles.subtitle}>
        Enter the invite code from a QR or invite message.
      </Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="Invite code"
        autoCapitalize="characters"
        autoFocus
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {done && <Text style={styles.ok}>{done}</Text>}

      {!done ? (
        <Pressable
          style={[styles.button, (!code.trim() || busy) && styles.buttonDisabled]}
          disabled={!code.trim() || busy}
          onPress={() => void onJoin()}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Request to join</Text>
          )}
        </Pressable>
      ) : (
        <Pressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666' },
  input: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 2,
    color: '#111',
    textAlign: 'center',
  },
  error: { marginTop: 12, color: '#b91c1c', fontSize: 14 },
  ok: { marginTop: 12, color: '#15803d', fontSize: 14, lineHeight: 20 },
  button: {
    marginTop: 24,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
