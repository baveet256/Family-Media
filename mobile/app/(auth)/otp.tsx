import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function OtpScreen() {
  const router = useRouter();
  const { signInWithOtp } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; hint?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const hint = typeof params.hint === 'string' ? params.hint : '';

  const [otp, setOtp] = useState(hint);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithOtp(phone, otp.trim());
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter code</Text>
      <Text style={styles.subtitle}>Sent to {phone || 'your phone'}</Text>
      {!!hint && (
        <Text style={styles.dev}>Dev mode: use {hint}</Text>
      )}

      <TextInput
        style={styles.input}
        value={otp}
        onChangeText={setOtp}
        placeholder="6-digit code"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (otp.length !== 6 || busy) && styles.buttonDisabled]}
        disabled={otp.length !== 6 || busy}
        onPress={() => void onVerify()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666' },
  dev: { marginTop: 12, fontSize: 13, color: '#15803d', fontWeight: '600' },
  input: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 6,
    color: '#111',
    textAlign: 'center',
  },
  error: { marginTop: 12, color: '#b91c1c', fontSize: 14 },
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
