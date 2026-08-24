import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthAtmosphere, AuthEntrance } from '@/components/AuthAtmosphere';
import { useAuth } from '@/contexts/AuthContext';
import { auth, authStyles } from '@/lib/authUi';
import { createFamily } from '@/lib/api';

export default function CreateFamilyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, refresh } = useAuth();
  const [name, setName] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

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
    <View style={authStyles.root}>
      <AuthAtmosphere />
      <KeyboardAvoidingView
        style={authStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 36,
              paddingBottom: insets.bottom + 24,
            },
          ]}>
          <AuthEntrance delay={60}>
            <Text style={authStyles.brandMark}>Family Media</Text>
            <Text style={authStyles.title}>Start a family</Text>
            <Text style={authStyles.subtitle}>
              You’re the admin. Invite others with a code — or join one that
              already exists.
            </Text>
          </AuthEntrance>

          <AuthEntrance delay={200} style={styles.mid}>
            <Text style={authStyles.label}>Family name</Text>
            <View
              style={[
                authStyles.inputShell,
                focused && authStyles.inputShellOn,
              ]}>
              <TextInput
                style={authStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. The Sharma Family"
                placeholderTextColor={auth.creamDim}
                autoFocus
                selectionColor={auth.amber}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Require approval</Text>
                <Text style={styles.rowHint}>
                  New members wait until you let them in.
                </Text>
              </View>
              <Switch
                value={requireApproval}
                onValueChange={setRequireApproval}
                trackColor={{
                  false: 'rgba(232,213,163,0.2)',
                  true: auth.amber,
                }}
                thumbColor={requireApproval ? auth.cream : '#cfcfcf'}
              />
            </View>

            {error ? <Text style={authStyles.error}>{error}</Text> : null}
          </AuthEntrance>

          <AuthEntrance delay={320}>
            <Pressable
              style={({ pressed }) => [
                authStyles.button,
                (!name.trim() || busy) && authStyles.buttonDisabled,
                pressed && name.trim() && !busy && authStyles.buttonPressed,
              ]}
              disabled={!name.trim() || busy}
              onPress={() => void onCreate()}>
              {busy ? (
                <ActivityIndicator color={auth.ink} />
              ) : (
                <Text style={authStyles.buttonText}>Create family</Text>
              )}
            </Pressable>

            <Pressable
              style={authStyles.ghost}
              onPress={() => router.push('/(auth)/join-code')}>
              <Text style={authStyles.ghostText}>I have an invite code →</Text>
            </Pressable>
          </AuthEntrance>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    gap: 28,
  },
  mid: { gap: 4 },
  row: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(232,213,163,0.18)',
  },
  rowTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: auth.cream,
  },
  rowHint: {
    marginTop: 4,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: auth.creamFaint,
  },
});
