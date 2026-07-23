import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  commentOnPost,
  fetchPost,
  reactToPost,
  type FeedPost,
} from '@/lib/api';

const REACTIONS = ['❤️', '😂', '👏', '🔥', '😮'];

export default function PostDetailScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = typeof params.id === 'string' ? params.id : '';

  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !postId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPost(token, postId);
      setPost(data.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [token, postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onReact = async (emoji: string) => {
    if (!token || !postId) return;
    const { post: updated } = await reactToPost(token, postId, emoji);
    setPost(updated);
  };

  const onComment = async () => {
    if (!token || !postId || !comment.trim()) return;
    setBusy(true);
    try {
      const { post: updated } = await commentOnPost(
        token,
        postId,
        comment.trim(),
      );
      setPost(updated);
      setComment('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comment failed');
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

  if (!post) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || 'Post not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={post.comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.author}>{post.author.displayName}</Text>
            <Text style={styles.time}>
              {new Date(post.createdAt).toLocaleString()}
            </Text>
            {!!post.caption && (
              <Text style={styles.caption}>{post.caption}</Text>
            )}
            {post.media[0]?.mediaType === 'image' && (
              <Image
                source={{ uri: post.media[0].url }}
                style={styles.media}
                resizeMode="cover"
              />
            )}
            <View style={styles.reactRow}>
              {REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.reactBtn,
                    post.reactions.mine === emoji && styles.reactMine,
                  ]}
                  onPress={() => void onReact(emoji)}>
                  <Text>
                    {emoji}{' '}
                    {post.reactions.counts[emoji]
                      ? post.reactions.counts[emoji]
                      : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.section}>Comments</Text>
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No comments yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Text style={styles.commentAuthor}>{item.author.displayName}</Text>
            <Text style={styles.commentBody}>{item.body}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment"
        />
        <Pressable
          style={[styles.send, (!comment.trim() || busy) && styles.sendDisabled]}
          disabled={!comment.trim() || busy}
          onPress={() => void onComment()}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  header: { padding: 20, paddingBottom: 8 },
  author: { fontSize: 18, fontWeight: '700', color: '#111' },
  time: { marginTop: 4, fontSize: 12, color: '#888' },
  caption: { marginTop: 12, fontSize: 16, color: '#222', lineHeight: 24 },
  media: {
    marginTop: 14,
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  reactBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f3f3',
  },
  reactMine: { backgroundColor: '#ffe4e6' },
  section: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
  },
  empty: { paddingHorizontal: 20, color: '#888' },
  comment: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  commentAuthor: { fontWeight: '700', color: '#111' },
  commentBody: { marginTop: 4, color: '#333', lineHeight: 20 },
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  send: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 8 },
});
