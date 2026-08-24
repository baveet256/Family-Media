import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthAtmosphere, AuthEntrance } from '@/components/AuthAtmosphere';
import { useAuth } from '@/contexts/AuthContext';
import { sendOtp } from '@/lib/api';

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithOtp } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; hint?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone : '';
  // Ignored outside development so a crafted deep link cannot fake the dev
  // banner or prefill the field in a shipped build.
  const hint = __DEV__ && typeof params.hint === 'string' ? params.hint : '';

  const [otp, setOtp] = useState(hint);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

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

  const onResend = async () => {
    if (!phone || resending) return;
    setResending(true);
    setError(null);
    try {
      const result = await sendOtp(phone);
      if (__DEV__ && result.devOtp) setOtp(result.devOtp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <AuthAtmosphere />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.inner,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 },
          ]}>
          <AuthEntrance delay={40}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>← Back</Text>
            </Pressable>
          </AuthEntrance>

          <AuthEntrance delay={120} style={styles.hero}>
            <Text style={styles.brandMark}>Family Media</Text>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>
              Sent to{' '}
              <Text style={styles.phone}>{phone || 'your phone'}</Text>
            </Text>
            {!!hint && (
              <Text style={styles.dev}>Dev mode — code is {hint}</Text>
            )}
          </AuthEntrance>

          <AuthEntrance delay={260} style={styles.form}>
            <View style={[styles.inputShell, focused && styles.inputShellOn]}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                placeholderTextColor="rgba(232,213,163,0.28)"
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                selectionColor="#d4a574"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (otp.length !== 6 || busy) && styles.buttonDisabled,
                pressed && otp.length === 6 && !busy && styles.buttonPressed,
              ]}
              disabled={otp.length !== 6 || busy}
              onPress={() => void onVerify()}>
              {busy ? (
                <ActivityIndicator color="#15241c" />
              ) : (
                <Text style={styles.buttonText}>Verify & enter</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.resend}
              disabled={resending}
              onPress={() => void onResend()}>
              <Text style={styles.resendText}>
                {resending ? 'Sending…' : 'Resend code'}
              </Text>
            </Pressable>
          </AuthEntrance>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#15241c' },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  back: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: 'rgba(232,213,163,0.65)',
  },
  hero: { gap: 8, marginTop: 24 },
  brandMark: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 15,
    color: 'rgba(232,213,163,0.55)',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 36,
    lineHeight: 42,
    color: '#f5e6c8',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(232,213,163,0.62)',
  },
  phone: {
    fontFamily: 'DMSans_700Bold',
    color: '#e8d5a3',
  },
  dev: {
    marginTop: 10,
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: '#9dba8c',
  },
  form: { gap: 12 },
  inputShell: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(232,213,163,0.28)',
    paddingBottom: 12,
  },
  inputShellOn: { borderBottomColor: '#d4a574' },
  input: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 40,
    color: '#f5e6c8',
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  error: {
    fontFamily: 'DMSans_500Medium',
    color: '#f0a8a0',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#e8d5a3',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.38 },
  buttonText: {
    fontFamily: 'DMSans_700Bold',
    color: '#15241c',
    fontSize: 16,
  },
  resend: { alignItems: 'center', paddingVertical: 10 },
  resendText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: 'rgba(232,213,163,0.55)',
  },
});
