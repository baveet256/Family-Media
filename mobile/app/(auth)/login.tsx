import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { sendOtp } from '@/lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const onContinue = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await sendOtp(phone.trim());
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone: result.phone,
          // Debug convenience only — never carry a live code in a release build.
          ...(__DEV__ && result.devOtp ? { hint: result.devOtp } : {}),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setBusy(false);
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
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 20 },
          ]}>
          <AuthEntrance delay={80} style={styles.hero}>
            <Text style={styles.brand}>Family Media</Text>
            <Text style={styles.tagline}>Your people, one place.</Text>
          </AuthEntrance>

          <AuthEntrance delay={280} style={styles.form}>
            <Text style={styles.label}>Phone number</Text>
            <View style={[styles.inputShell, focused && styles.inputShellOn]}>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 123 4567"
                placeholderTextColor="rgba(232,213,163,0.35)"
                keyboardType="phone-pad"
                autoComplete="tel"
                autoFocus
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                selectionColor="#d4a574"
              />
            </View>

            <Text style={styles.helper}>
              We’ll text a one-time code — no password to remember.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!phone.trim() || busy) && styles.buttonDisabled,
                pressed && phone.trim() && !busy && styles.buttonPressed,
              ]}
              disabled={!phone.trim() || busy}
              onPress={() => void onContinue()}>
              {busy ? (
                <ActivityIndicator color="#15241c" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
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
  hero: { gap: 14 },
  brand: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 44,
    lineHeight: 50,
    color: '#f5e6c8',
    letterSpacing: -0.8,
  },
  tagline: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(232,213,163,0.72)',
    maxWidth: 260,
  },
  form: { gap: 10 },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: 'rgba(232,213,163,0.55)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputShell: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(232,213,163,0.28)',
    paddingBottom: 10,
  },
  inputShellOn: {
    borderBottomColor: '#d4a574',
  },
  input: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 26,
    color: '#f5e6c8',
    paddingVertical: 8,
    letterSpacing: 0.4,
  },
  helper: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(232,213,163,0.45)',
    marginTop: 4,
  },
  error: {
    fontFamily: 'DMSans_500Medium',
    color: '#f0a8a0',
    fontSize: 14,
    marginTop: 4,
  },
  button: {
    marginTop: 18,
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
    letterSpacing: 0.2,
  },
});
