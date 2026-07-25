import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  addChatParticipants,
  fetchChatDetail,
  fetchFamilyMembers,
  leaveChat,
  removeChatParticipant,
  renameChat,
  setChatParticipantRole,
  type ChatDetail,
  type ChatMember,
} from '@/lib/api';

const SCOPE_NOTE: Record<string, string> = {
  family: 'Everyone in your family is here automatically.',
  congregation:
    'This circle exists because these families are connected. Members follow the families, so nobody is added or removed by hand.',
};

export default function ChatInfoScreen() {
  const router = useRouter();
  const { token, user, activeFamily } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const chatId = typeof params.id === 'string' ? params.id : '';

  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [roster, setRoster] = useState<ChatMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !chatId) return;
    try {
      const res = await fetchChatDetail(token, chatId);
      setChat(res.chat);
      setName(res.chat.name ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = async () => {
    if (!token || !activeFamily) return;
    setAdding(true);
    try {
      const res = await fetchFamilyMembers(token, activeFamily.id);
      setRoster(res.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  const onLeave = () => {
    Alert.alert('Leave circle?', 'You will stop getting these messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await leaveChat(token!, chatId);
            router.back();
          }),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Info' }} />
        <ActivityIndicator />
      </View>
    );
  }
  if (!chat) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Info' }} />
        <Text style={styles.error}>{error ?? 'Not found'}</Text>
      </View>
    );
  }

  const alreadyIn = new Set(chat.participants.map((p) => p.id));
  const canAdd = roster.filter((m) => !alreadyIn.has(m.id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: chat.title }} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>
            {chat.scope === 'congregation'
              ? '🫂'
              : chat.scope === 'family'
                ? '🏡'
                : chat.type === 'direct'
                  ? '💬'
                  : '⭐️'}
          </Text>
        </View>
        <Text style={styles.heroTitle}>{chat.title}</Text>
        <Text style={styles.heroSub}>
          {chat.participants.length} people
          {chat.families.length ? ` · ${chat.families.length} families` : ''}
        </Text>
        {chat.families.length ? (
          <Text style={styles.families}>
            {chat.families.map((f) => f.name).join(' · ')}
          </Text>
        ) : null}
      </View>

      {SCOPE_NOTE[chat.scope] ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{SCOPE_NOTE[chat.scope]}</Text>
        </View>
      ) : null}

      {chat.canManage ? (
        <View style={styles.block}>
          <Text style={styles.label}>Circle name</Text>
          <View style={styles.renameRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={80}
              placeholder="Name this circle"
              placeholderTextColor="#aaa"
            />
            <Pressable
              style={[
                styles.saveBtn,
                (busy || !name.trim() || name === chat.name) &&
                  styles.disabled,
              ]}
              disabled={busy || !name.trim() || name === chat.name}
              onPress={() => void run(() => renameChat(token!, chatId, name))}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.label}>Members</Text>
          {chat.canManage ? (
            <Pressable onPress={() => void openAdd()}>
              <Text style={styles.link}>Add people</Text>
            </Pressable>
          ) : null}
        </View>

        {chat.participants.map((p) => {
          const isMe = p.id === user?.id;
          return (
            <View key={p.id} style={styles.row}>
              {p.avatarUrl ? (
                <Image source={{ uri: p.avatarUrl }} style={styles.face} />
              ) : (
                <View style={[styles.face, styles.faceEmpty]}>
                  <Text style={styles.faceLetter}>
                    {(p.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {p.displayName}
                  {isMe ? ' (you)' : ''}
                </Text>
                {p.status ? (
                  <Text style={styles.status} numberOfLines={1}>
                    {p.status}
                  </Text>
                ) : null}
                {p.viaTag ? <Text style={styles.via}>{p.viaTag}</Text> : null}
              </View>

              {p.role === 'admin' ? (
                <Text style={styles.adminPill}>admin</Text>
              ) : null}

              {chat.canManage && !isMe ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert(p.displayName, undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text:
                          p.role === 'admin'
                            ? 'Dismiss as admin'
                            : 'Make admin',
                        onPress: () =>
                          void run(() =>
                            setChatParticipantRole(
                              token!,
                              chatId,
                              p.id,
                              p.role === 'admin' ? 'member' : 'admin',
                            ),
                          ),
                      },
                      {
                        text: 'Remove from circle',
                        style: 'destructive',
                        onPress: () =>
                          void run(() =>
                            removeChatParticipant(token!, chatId, p.id),
                          ),
                      },
                    ])
                  }>
                  <Text style={styles.more}>⋯</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {adding ? (
        <View style={styles.block}>
          <Text style={styles.label}>Add to this circle</Text>
          {canAdd.length ? (
            canAdd.map((m) => (
              <Pressable
                key={m.id}
                style={styles.row}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await addChatParticipants(token!, chatId, [m.id]);
                    setAdding(false);
                  })
                }>
                <View style={[styles.face, styles.faceEmpty]}>
                  <Text style={styles.faceLetter}>
                    {(m.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.displayName}</Text>
                  {m.viaTag ? <Text style={styles.via}>{m.viaTag}</Text> : null}
                </View>
                <Text style={styles.link}>Add</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.muted}>Everyone is already here.</Text>
          )}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {chat.scope === 'custom' && chat.type === 'group' ? (
        <Pressable style={styles.leave} disabled={busy} onPress={onLeave}>
          <Text style={styles.leaveText}>Leave circle</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  heroIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fdeacd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 32 },
  heroTitle: { marginTop: 8, fontSize: 20, fontWeight: '700', color: '#111' },
  heroSub: { fontSize: 13, color: '#888' },
  families: { fontSize: 12, color: '#a16207', fontWeight: '600', marginTop: 2 },
  note: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fed7aa',
  },
  noteText: { color: '#9a3412', fontSize: 13, lineHeight: 18 },
  block: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 13, fontWeight: '700', color: '#888' },
  link: { color: '#c2410c', fontWeight: '700', fontSize: 13 },
  renameRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111',
  },
  saveBtn: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  saveText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  face: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  faceEmpty: { alignItems: 'center', justifyContent: 'center' },
  faceLetter: { fontWeight: '700', color: '#888' },
  name: { fontSize: 15, fontWeight: '600', color: '#111' },
  status: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  via: { fontSize: 12, color: '#db2777', fontWeight: '600' },
  adminPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c',
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  more: { fontSize: 20, color: '#999', paddingHorizontal: 6 },
  muted: { color: '#999', fontSize: 13 },
  error: { color: '#b00020', textAlign: 'center' },
  leave: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fee2e2',
  },
  leaveText: { color: '#b91c1c', fontWeight: '700' },
});
