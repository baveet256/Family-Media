import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { updateFamily, updateMe } from '@/lib/api';

export default function ProfileScreen() {
  const { user, families, token, refresh, signOut } = useAuth();
  const family = families.find((f) => f.status === 'active') ?? families[0];
  const [name, setName] = useState(user?.displayName ?? '');
  const [familyName, setFamilyName] = useState(family?.name ?? '');
  const [requireApproval, setRequireApproval] = useState(
    family?.settings?.requireApproval ?? true,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateMe(token, { displayName: name.trim() });
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.meta}>{user?.phone}</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

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

      <Pressable style={styles.logout} onPress={() => void signOut()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
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
  label: { marginTop: 24, fontSize: 13, fontWeight: '600', color: '#888' },
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
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logout: { marginTop: 20, alignItems: 'center', padding: 12 },
  logoutText: { color: '#b91c1c', fontWeight: '600' },
});
