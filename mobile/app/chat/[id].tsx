import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  fetchMessages,
  presignMedia,
  sendMessage,
  uploadMediaFile,
  type ChatMessage,
} from '@/lib/api';

export default function ChatThreadScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const chatId = typeof params.id === 'string' ? params.id : '';
  const title =
    typeof params.title === 'string' ? params.title : 'Chat';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const latestCreatedAt = useRef<string | null>(null);

  const mergeMessages = useCallback((incoming: ChatMessage[], replace = false) => {
    setMessages((prev) => {
      const map = new Map<string, ChatMessage>();
      const base = replace ? [] : prev;
      for (const m of base) map.set(m.id, m);
      for (const m of incoming) map.set(m.id, m);
      const next = [...map.values()].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      if (next.length) {
        latestCreatedAt.current = next[next.length - 1].createdAt;
      }
      return next;
    });
  }, []);

  const loadInitial = useCallback(async () => {
    if (!token || !chatId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMessages(token, chatId, { limit: 50 });
      mergeMessages(data.messages, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [token, chatId, mergeMessages]);

  const poll = useCallback(async () => {
    if (!token || !chatId || !latestCreatedAt.current) return;
    try {
      const data = await fetchMessages(token, chatId, {
        after: latestCreatedAt.current,
        limit: 50,
      });
      if (data.messages.length) mergeMessages(data.messages);
    } catch {
      // ignore poll errors
    }
  }, [token, chatId, mergeMessages]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const id = setInterval(() => void poll(), 2500);
    return () => clearInterval(id);
  }, [poll]);

  const onSend = async () => {
    if (!token || !chatId || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    const body = text.trim();
    setText('');
    try {
      const res = await sendMessage(token, chatId, { body });
      mergeMessages([res.message]);
    } catch (e) {
      setText(body);
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const onAttachImage = async () => {
    if (!token || !chatId || sending) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    const file = {
      uri: a.uri,
      name: a.fileName || `chat.${a.uri.split('.').pop() || 'jpg'}`,
      type: a.mimeType || 'image/jpeg',
    };
    setSending(true);
    setError(null);
    try {
      const signed = await presignMedia(token, 'image', file.name);
      const uploaded = await uploadMediaFile(
        token,
        signed.uploadUrl,
        signed.key,
        file,
      );
      const res = await sendMessage(token, chatId, {
        body: text.trim() || undefined,
        mediaUrl: uploaded.publicUrl,
      });
      setText('');
      mergeMessages([res.message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable
              hitSlop={10}
              onPress={() =>
                router.push({
                  pathname: '/chat/info',
                  params: { id: chatId, title },
                })
              }>
              <Text style={styles.headerAction}>Info</Text>
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Say hello to start the chat.</Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender.id === user?.id;
            return (
              <View
                style={[
                  styles.bubbleWrap,
                  mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs,
                ]}>
                {!mine ? (
                  <Text style={styles.sender}>{item.sender.displayName}</Text>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                  ]}>
                  {item.mediaUrl ? (
                    <Image
                      source={{ uri: item.mediaUrl }}
                      style={styles.media}
                    />
                  ) : null}
                  {item.body ? (
                    <Text
                      style={[
                        styles.bubbleText,
                        mine && styles.bubbleTextMine,
                      ]}>
                      {item.body}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        <Pressable style={styles.attach} onPress={() => void onAttachImage()}>
          <Text style={styles.attachText}>＋</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor="#aaa"
          multiline
          maxLength={4000}
        />
        <Pressable
          style={[styles.send, (!text.trim() || sending) && styles.sendDisabled]}
          disabled={!text.trim() || sending}
          onPress={() => void onSend()}>
          <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  headerAction: { color: '#c2410c', fontWeight: '700', fontSize: 15 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 8 },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 15,
  },
  bubbleWrap: { marginBottom: 10, maxWidth: '82%' },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { fontSize: 12, color: '#777', marginBottom: 2, marginLeft: 4 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  bubbleMine: { backgroundColor: '#111' },
  bubbleTheirs: { backgroundColor: '#fff' },
  bubbleText: { fontSize: 15, color: '#111', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  media: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: '#ddd',
  },
  meta: { fontSize: 11, color: '#999', marginTop: 2, marginHorizontal: 4 },
  error: { color: '#b00020', textAlign: 'center', paddingHorizontal: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  attach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: { fontSize: 22, color: '#333', marginTop: -2 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  send: {
    backgroundColor: '#111',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
