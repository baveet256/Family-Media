import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { fonts, theme } from '@/lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: 24,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 40,
      }}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>Family Media</Text>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.meta}>{user?.phone}</Text>
      <View style={{ marginTop: 14 }}>
        <ContextSwitcher />
      </View>

      <Pressable style={styles.avatarBtn} onPress={() => void pickAvatar()}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarEmpty}>
            <Text style={styles.avatarLetter}>
              {(firstName.trim() || user?.displayName || '?')
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
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
        placeholderTextColor={theme.faint}
      />
      <Text style={styles.label}>Last name</Text>
      <TextInput
        style={styles.input}
        value={lastName}
        onChangeText={setLastName}
        placeholderTextColor={theme.faint}
      />
      <Text style={styles.preview}>
        Display name:{' '}
        {[firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || '—'}
      </Text>

      <Text style={styles.label}>Status</Text>
      <TextInput
        style={styles.input}
        value={status}
        onChangeText={setStatus}
        maxLength={140}
        placeholder="Grandpa of six, gardener of one tomato plant"
        placeholderTextColor={theme.faint}
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
            placeholderTextColor={theme.faint}
          />
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Require approval to join</Text>
            <Switch
              value={requireApproval}
              onValueChange={setRequireApproval}
              trackColor={{ false: theme.line, true: theme.gold }}
              thumbColor={requireApproval ? theme.paperElevated : '#eee'}
            />
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
          <ActivityIndicator color={theme.paperElevated} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.paper },
  eyebrow: {
    fontFamily: fonts.displaySoft,
    fontSize: 14,
    color: theme.gold,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: theme.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  meta: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.muted,
  },
  avatarBtn: {
    marginTop: 20,
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.goldSoft,
  },
  avatar: { width: 96, height: 96 },
  avatarEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: theme.accent,
  },
  avatarHint: {
    textAlign: 'center',
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.muted,
  },
  linkBtn: {
    marginTop: 20,
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  linkBtnText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
  },
  linkBtnSecondary: {
    marginTop: 8,
    backgroundColor: theme.paperElevated,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  linkBtnSecondaryText: {
    fontFamily: fonts.bodyBold,
    color: theme.ink,
  },
  label: {
    marginTop: 22,
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  preview: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.inkSoft,
  },
  input: {
    marginTop: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.line,
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
    paddingVertical: 12,
    fontFamily: fonts.bodyMed,
    fontSize: 17,
    color: theme.ink,
  },
  row: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTitle: {
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    color: theme.ink,
    flex: 1,
  },
  ok: {
    marginTop: 14,
    fontFamily: fonts.bodyMed,
    color: theme.accent,
  },
  error: {
    marginTop: 14,
    fontFamily: fonts.bodyMed,
    color: theme.danger,
  },
  button: {
    marginTop: 24,
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: theme.accentSoft,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.bodyBold,
    color: theme.accent,
    fontSize: 15,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    fontFamily: fonts.bodyBold,
    color: theme.paperElevated,
    fontSize: 16,
  },
  logout: { marginTop: 20, alignItems: 'center', padding: 12 },
  logoutText: {
    fontFamily: fonts.bodyMed,
    color: theme.danger,
  },
  delete: { alignItems: 'center', padding: 8 },
  deleteText: {
    fontFamily: fonts.bodyMed,
    color: theme.danger,
    fontSize: 13,
  },
});
