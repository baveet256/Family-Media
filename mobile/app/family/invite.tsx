import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useAuth } from '@/contexts/AuthContext';
import { getFamily, inviteByPhone } from '@/lib/api';

export default function InviteScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId = typeof params.familyId === 'string' ? params.familyId : '';

  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !familyId) return;
    void (async () => {
      try {
        const data = await getFamily(token, familyId);
        setInviteCode(data.family.inviteCode);
        setFamilyName(data.family.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load family');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, familyId]);

  const deepLink = `familymedia://join?code=${inviteCode}`;

  const onCopy = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setMessage('Invite code copied');
  };

  const onInvitePhone = async () => {
    if (!token || !familyId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await inviteByPhone(token, familyId, phone.trim());
      setMessage(result.message);
      setPhone('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Invite to {familyName}</Text>
      <Text style={styles.subtitle}>
        Share the QR or code. Approvals land in Phase 2.
      </Text>

      <View style={styles.qrCard}>
        {!!inviteCode && <QRCode value={deepLink} size={180} />}
        <Text style={styles.code}>{inviteCode}</Text>
        <Text style={styles.link}>{deepLink}</Text>
        <Pressable style={styles.secondary} onPress={() => void onCopy()}>
          <Text style={styles.secondaryText}>Copy code</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Invite by phone (SMS stub)</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+15551234567"
        keyboardType="phone-pad"
      />
      <Pressable
        style={[styles.button, (!phone.trim() || busy) && styles.buttonDisabled]}
        disabled={!phone.trim() || busy}
        onPress={() => void onInvitePhone()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send invite stub</Text>
        )}
      </Pressable>

      {message && <Text style={styles.ok}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  container: { padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#666', lineHeight: 22 },
  qrCard: {
    marginTop: 24,
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    gap: 12,
  },
  code: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#111',
  },
  link: { fontSize: 12, color: '#888', textAlign: 'center' },
  secondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f3f3',
  },
  secondaryText: { fontWeight: '600', color: '#111' },
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
  button: {
    marginTop: 14,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ok: { marginTop: 14, color: '#15803d', fontSize: 14 },
  error: { marginTop: 14, color: '#b91c1c', fontSize: 14 },
});
