import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { presignMedia, updateMe, uploadMediaFile } from '@/lib/api';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, refresh } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<'first' | 'last' | null>(null);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUri(result.assets[0].uri);
  };

  const onSave = async () => {
    if (!token || !firstName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let avatarUrl: string | undefined;
      if (avatarUri) {
        const name = `avatar.${avatarUri.split('.').pop() || 'jpg'}`;
        const signed = await presignMedia(token, 'image', name);
        const uploaded = await uploadMediaFile(
          token,
          signed.uploadUrl,
          signed.key,
          { uri: avatarUri, name, type: 'image/jpeg' },
        );
        avatarUrl = uploaded.publicUrl;
      }
      await updateMe(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  };

  const display =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'You';

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
            <Text style={authStyles.title}>Who are you?</Text>
            <Text style={authStyles.subtitle}>
              This is how your family will know you in the tree, chats, and
              stories.
            </Text>
          </AuthEntrance>

          <AuthEntrance delay={200} style={styles.mid}>
            <Pressable
              style={styles.avatarBtn}
              onPress={() => void pickAvatar()}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarEmpty}>
                  <Text style={styles.avatarLetter}>
                    {(firstName.trim() || '?').charAt(0).toUpperCase()}
                  </Text>
                  <Text style={styles.avatarHint}>Add photo</Text>
                </View>
              )}
            </Pressable>
            <Text style={styles.previewName}>{display}</Text>

            <Text style={[authStyles.label, { marginTop: 28 }]}>First name</Text>
            <View
              style={[
                authStyles.inputShell,
                focus === 'first' && authStyles.inputShellOn,
              ]}>
              <TextInput
                style={authStyles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={auth.creamDim}
                autoFocus
                selectionColor={auth.amber}
                onFocus={() => setFocus('first')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <Text style={[authStyles.label, { marginTop: 20 }]}>Last name</Text>
            <View
              style={[
                authStyles.inputShell,
                focus === 'last' && authStyles.inputShellOn,
              ]}>
              <TextInput
                style={authStyles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={auth.creamDim}
                selectionColor={auth.amber}
                onFocus={() => setFocus('last')}
                onBlur={() => setFocus(null)}
              />
            </View>

            {error ? <Text style={authStyles.error}>{error}</Text> : null}
          </AuthEntrance>

          <AuthEntrance delay={320}>
            <Pressable
              style={({ pressed }) => [
                authStyles.button,
                (!firstName.trim() || busy) && authStyles.buttonDisabled,
                pressed && firstName.trim() && !busy && authStyles.buttonPressed,
              ]}
              disabled={!firstName.trim() || busy}
              onPress={() => void onSave()}>
              {busy ? (
                <ActivityIndicator color={auth.ink} />
              ) : (
                <Text style={authStyles.buttonText}>Continue</Text>
              )}
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
  avatarBtn: {
    alignSelf: 'center',
    width: 108,
    height: 108,
    borderRadius: 54,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(232,213,163,0.35)',
    backgroundColor: 'rgba(232,213,163,0.08)',
  },
  avatar: { width: 108, height: 108 },
  avatarEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  avatarLetter: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 36,
    color: auth.creamSoft,
  },
  avatarHint: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: auth.creamFaint,
  },
  previewName: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: auth.creamMuted,
  },
});
