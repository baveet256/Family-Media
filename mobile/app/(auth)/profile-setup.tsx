import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { presignMedia, updateMe, uploadMediaFile } from '@/lib/api';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { token, refresh } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const uploaded = await uploadMediaFile(token, signed.uploadUrl, signed.key, {
          uri: avatarUri,
          name,
          type: 'image/jpeg',
        });
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your name</Text>
      <Text style={styles.subtitle}>
        First and last name — this becomes how family sees you.
      </Text>

      <Pressable style={styles.avatarBtn} onPress={() => void pickAvatar()}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <Text style={styles.avatarPlaceholder}>Add photo</Text>
        )}
      </Pressable>

      <Text style={styles.label}>First name</Text>
      <TextInput
        style={styles.input}
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        autoFocus
      />
      <Text style={styles.label}>Last name</Text>
      <TextInput
        style={styles.input}
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last name"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[
          styles.button,
          (!firstName.trim() || busy) && styles.buttonDisabled,
        ]}
        disabled={!firstName.trim() || busy}
        onPress={() => void onSave()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666' },
  avatarBtn: {
    marginTop: 24,
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 96, height: 96 },
  avatarPlaceholder: { color: '#666', fontWeight: '600', fontSize: 13 },
  label: { marginTop: 16, fontSize: 13, fontWeight: '600', color: '#888' },
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
