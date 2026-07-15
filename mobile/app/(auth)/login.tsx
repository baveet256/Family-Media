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

import { sendOtp } from '@/lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const onContinue = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await sendOtp(phone.trim());
      setDevOtp(result.devOtp ?? null);
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone: result.phone,
          ...(result.devOtp ? { hint: result.devOtp } : {}),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>
        Sign in with your phone number. We’ll text a one-time code (stubbed in
        dev).
      </Text>

      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+15551234567"
        keyboardType="phone-pad"
        autoComplete="tel"
        autoFocus
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {devOtp && (
        <Text style={styles.hint}>Dev OTP was: {devOtp} (also on next screen)</Text>
      )}

      <Pressable
        style={[styles.button, (!phone.trim() || busy) && styles.buttonDisabled]}
        disabled={!phone.trim() || busy}
        onPress={() => void onContinue()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send code</Text>
        )}
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
  error: { marginTop: 12, color: '#b91c1c', fontSize: 14 },
  hint: { marginTop: 12, color: '#15803d', fontSize: 13 },
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
