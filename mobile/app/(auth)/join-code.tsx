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
import { useAuth } from '@/contexts/AuthContext';
import { auth, authStyles } from '@/lib/authUi';
import { createJoinRequest } from '@/lib/api';

export default function JoinCodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, refresh } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const onJoin = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createJoinRequest(token, code.trim());
      await refresh();
      router.replace({
        pathname: '/onboarding',
        params: { joinRequestId: result.joinRequest.id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={authStyles.root}>
      <AuthAtmosphere />
      <KeyboardAvoidingView
        style={authStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            authStyles.inner,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 },
          ]}>
          <AuthEntrance delay={40}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={authStyles.back}>← Back</Text>
            </Pressable>
          </AuthEntrance>

          <AuthEntrance delay={120} style={styles.hero}>
            <Text style={authStyles.brandMark}>Family Media</Text>
            <Text style={authStyles.title}>Join a family</Text>
            <Text style={authStyles.subtitle}>
              Enter the invite code from a relative — we’ll place you on their
              tree next.
            </Text>
          </AuthEntrance>

          <AuthEntrance delay={260} style={styles.form}>
            <Text style={authStyles.label}>Invite code</Text>
            <View
              style={[
                authStyles.inputShell,
                focused && authStyles.inputShellOn,
              ]}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={setCode}
                placeholder="SHARMA01"
                placeholderTextColor={auth.creamDim}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                selectionColor={auth.amber}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </View>

            {error ? <Text style={authStyles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                authStyles.button,
                (!code.trim() || busy) && authStyles.buttonDisabled,
                pressed && code.trim() && !busy && authStyles.buttonPressed,
              ]}
              disabled={!code.trim() || busy}
              onPress={() => void onJoin()}>
              {busy ? (
                <ActivityIndicator color={auth.ink} />
              ) : (
                <Text style={authStyles.buttonText}>Request to join</Text>
              )}
            </Pressable>

            <Pressable
              style={authStyles.ghost}
              onPress={() => router.replace('/(auth)/create-family')}>
              <Text style={authStyles.ghostText}>Create a new family instead</Text>
            </Pressable>
          </AuthEntrance>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 20 },
  form: { gap: 4 },
  codeInput: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 32,
    color: auth.cream,
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
