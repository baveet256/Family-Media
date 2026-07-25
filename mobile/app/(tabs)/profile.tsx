import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { ContextSwitcher } from '@/components/ContextSwitcher';
import {
  deleteMyAccount,
  exportMyData,
  presignMedia,
  updateFamily,
  updateMe,
  uploadMediaFile,
} from '@/lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, families, token, refresh, signOut, activeFamily } = useAuth();
  const family = activeFamily ?? families[0];
  const [firstName, setFirstName] = useState(
    user?.firstName || user?.displayName?.split(' ')[0] || '',
  );
  const [lastName, setLastName] = useState(
    user?.lastName ||
      user?.displayName?.split(' ').slice(1).join(' ') ||
      '',
  );
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);
  const [status, setStatus] = useState(user?.status ?? '');
  const [familyName, setFamilyName] = useState(family?.name ?? '');
  const [requireApproval, setRequireApproval] = useState(
    family?.settings?.requireApproval ?? true,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    if (!token) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    setError(null);
    try {
      const a = result.assets[0];
      const name = a.fileName || `avatar.${a.uri.split('.').pop() || 'jpg'}`;
      const signed = await presignMedia(token, 'image', name);
      const uploaded = await uploadMediaFile(token, signed.uploadUrl, signed.key, {
        uri: a.uri,
        name,
        type: a.mimeType || 'image/jpeg',
      });
      setAvatarUrl(uploaded.publicUrl);
      await updateMe(token, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim(),
        avatarUrl: uploaded.publicUrl,
      });
      await refresh();
      setMessage('Photo updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateMe(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: status.trim(),
        ...(avatarUrl !== user?.avatarUrl ? { avatarUrl } : {}),
      });
      if (family?.role === 'admin' && family.status !== 'pending') {
        await updateFamily(token, family.id, {
          name: familyName.trim(),
          requireApproval,
        });
      }
      await refresh();
      setMessage('Saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const data = await exportMyData(token);
      const payload = JSON.stringify(data, null, 2);
      await Share.share({
        message: payload.slice(0, 8000),
        title: 'Family Media data export',
      });
      setMessage('Export ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete account?',
      'This removes your personal data and signs you out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              if (!token) return;
              setBusy(true);
              try {
                await deleteMyAccount(token);
                await signOut();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Delete failed');
                setBusy(false);
              }
            })(),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.meta}>{user?.phone}</Text>
      <View style={{ marginTop: 12 }}>
        <ContextSwitcher />
      </View>

      <Pressable style={styles.avatarBtn} onPress={() => void pickAvatar()}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <Text style={styles.avatarPlaceholder}>Add photo</Text>
        )}
      </Pressable>
      <Text style={styles.avatarHint}>Tap to change profile picture</Text>

      <Pressable
        style={styles.linkBtn}
        onPress={() => router.push('/notifications')}>
        <Text style={styles.linkBtnText}>Notifications</Text>
      </Pressable>
      <Pressable
        style={styles.linkBtnSecondary}
        onPress={() => router.push('/connections')}>
        <Text style={styles.linkBtnSecondaryText}>Family connections</Text>
      </Pressable>
      <Pressable
        style={styles.linkBtnSecondary}
        onPress={() => router.push('/family/relationship-requests')}>
        <Text style={styles.linkBtnSecondaryText}>Tree corrections</Text>
      </Pressable>

      <Text style={styles.label}>First name</Text>
      <TextInput
        style={styles.input}
        value={firstName}
        onChangeText={setFirstName}
      />
      <Text style={styles.label}>Last name</Text>
      <TextInput
        style={styles.input}
        value={lastName}
        onChangeText={setLastName}
      />
      <Text style={styles.preview}>
        Display name: {[firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || '—'}
      </Text>

      <Text style={styles.label}>Status</Text>
      <TextInput
        style={styles.input}
        value={status}
        onChangeText={setStatus}
        maxLength={140}
        placeholder="Grandpa of six, gardener of one tomato plant"
        placeholderTextColor="#aaa"
      />
      <Text style={styles.preview}>
        Family sees this when they hold your photo in the tree.
      </Text>

      {family?.role === 'admin' && family.status !== 'pending' ? (
        <>
          <Text style={styles.label}>Family name</Text>
          <TextInput
            style={styles.input}
            value={familyName}
            onChangeText={setFamilyName}
          />
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Require approval to join</Text>
            <Switch value={requireApproval} onValueChange={setRequireApproval} />
          </View>
        </>
      ) : null}

      {message && <Text style={styles.ok}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={() => void onSave()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.secondaryBtn, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={() => void onExport()}>
        <Text style={styles.secondaryBtnText}>Export my data</Text>
      </Pressable>

      <Pressable style={styles.logout} onPress={() => void signOut()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>

      {Platform.OS !== 'web' || true ? (
        <Pressable style={styles.delete} onPress={onDelete} disabled={busy}>
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#fafafa',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  meta: { marginTop: 6, fontSize: 14, color: '#666' },
  avatarBtn: {
    marginTop: 16,
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 88, height: 88 },
  avatarPlaceholder: { color: '#666', fontWeight: '600', fontSize: 12 },
  avatarHint: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
    color: '#888',
  },
  linkBtn: {
    marginTop: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkBtnText: { color: '#fff', fontWeight: '700' },
  linkBtnSecondary: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  linkBtnSecondaryText: { color: '#111', fontWeight: '700' },
  label: { marginTop: 20, fontSize: 13, fontWeight: '600', color: '#888' },
  preview: { marginTop: 8, fontSize: 13, color: '#555' },
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
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTitle: { fontSize: 15, color: '#111', flex: 1 },
  ok: { marginTop: 14, color: '#15803d' },
  error: { marginTop: 14, color: '#b91c1c' },
  button: {
    marginTop: 24,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#111', fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logout: { marginTop: 20, alignItems: 'center', padding: 12 },
  logoutText: { color: '#b91c1c', fontWeight: '600' },
  delete: { alignItems: 'center', padding: 8, marginBottom: 24 },
  deleteText: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
});
