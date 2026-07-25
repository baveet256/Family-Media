import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  createChat,
  fetchFamilyMembers,
  type ChatMember,
} from '@/lib/api';

type Mode = 'direct' | 'group';

export default function NewChatScreen() {
  const router = useRouter();
  const { token, user, families } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId =
    typeof params.familyId === 'string'
      ? params.familyId
      : families.find((f) => f.status === 'active')?.id ?? '';

  const [mode, setMode] = useState<Mode>('direct');
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !familyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFamilyMembers(token, familyId);
      setMembers(data.members.filter((m) => m.id !== user?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [token, familyId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === 'direct') {
        return new Set(next.has(id) ? [] : [id]);
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCreate = async () => {
    if (!token || !familyId || selected.size === 0 || busy) return;
    if (mode === 'group' && !groupName.trim()) {
      setError('Name this circle');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createChat(token, {
        familyId,
        type: mode,
        participantUserIds: [...selected],
        name: mode === 'group' ? groupName.trim() : undefined,
      });
      router.replace({
        pathname: '/chat/[id]',
        params: { id: res.chat.id, title: res.chat.title },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create chat');
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modes}>
        <Pressable
          style={[styles.modeBtn, mode === 'direct' && styles.modeActive]}
          onPress={() => {
            setMode('direct');
            setSelected(new Set());
          }}>
          <Text
            style={[
              styles.modeText,
              mode === 'direct' && styles.modeTextActive,
            ]}>
            Direct
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'group' && styles.modeActive]}
          onPress={() => {
            setMode('group');
            setSelected(new Set());
          }}>
          <Text
            style={[
              styles.modeText,
              mode === 'group' && styles.modeTextActive,
            ]}>
            Circle
          </Text>
        </Pressable>
      </View>

      {mode === 'group' ? (
        <TextInput
          style={styles.nameInput}
          placeholder="Circle name (e.g. Cousins only)"
          placeholderTextColor="#aaa"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={80}
        />
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No family or connected people to chat with yet.
            </Text>
          }
          renderItem={({ item }) => {
            const on = selected.has(item.id);
            return (
              <Pressable style={styles.row} onPress={() => toggle(item.id)}>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.displayName || item.phone || 'Member'}
                  </Text>
                  {item.viaTag ? (
                    <Text style={styles.viaTag}>{item.viaTag}</Text>
                  ) : item.role ? (
                    <Text style={styles.role}>{item.role}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[
          styles.create,
          (selected.size === 0 || busy) && styles.createDisabled,
        ]}
        disabled={selected.size === 0 || busy}
        onPress={() => void onCreate()}>
        <Text style={styles.createText}>
          {busy ? 'Creating…' : mode === 'direct' ? 'Start chat' : 'Create circle'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  modes: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  modeActive: { backgroundColor: '#111' },
  modeText: { fontWeight: '600', color: '#444' },
  modeTextActive: { color: '#fff' },
  nameInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#111', borderColor: '#111' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: '#111' },
  role: { fontSize: 12, color: '#888', marginTop: 2 },
  viaTag: {
    fontSize: 12,
    color: '#db2777',
    marginTop: 2,
    fontWeight: '600',
  },
  error: { color: '#b00020', textAlign: 'center', padding: 8 },
  create: {
    margin: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createDisabled: { opacity: 0.4 },
  createText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
