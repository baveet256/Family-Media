import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  createPost,
  presignMedia,
  uploadMediaFile,
} from '@/lib/api';

export default function CreatePostScreen() {
  const router = useRouter();
  const { token, families } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId =
    typeof params.familyId === 'string'
      ? params.familyId
      : families.find((f) => f.status === 'active')?.id ?? '';

  const [caption, setCaption] = useState('');
  const [asset, setAsset] = useState<{
    uri: string;
    name: string;
    type: string;
    mediaType: 'image' | 'video';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (videos: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: videos
        ? ['videos']
        : ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    const name =
      a.fileName ||
      `upload.${videos ? 'mp4' : a.uri.split('.').pop() || 'jpg'}`;
    setAsset({
      uri: a.uri,
      name,
      type: a.mimeType || (videos ? 'video/mp4' : 'image/jpeg'),
      mediaType: videos ? 'video' : 'image',
    });
  };

  const onPost = async () => {
    if (!token || !familyId) return;
    if (!caption.trim() && !asset) {
      setError('Add a caption or photo');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let media:
        | Array<{ mediaType: 'image' | 'video'; url: string; sortOrder: number }>
        | undefined;

      if (asset) {
        if (Platform.OS === 'web') {
          // On web, use a public placeholder or data URL isn't ideal for API —
          // skip binary upload and post caption-only unless we have a remote URI.
          if (asset.uri.startsWith('http')) {
            media = [
              { mediaType: asset.mediaType, url: asset.uri, sortOrder: 0 },
            ];
          } else {
            // For local web blob URIs, upload via FormData still works in many browsers
            const signed = await presignMedia(
              token,
              asset.mediaType,
              asset.name,
            );
            const uploaded = await uploadMediaFile(
              token,
              signed.uploadUrl,
              signed.key,
              asset,
            );
            media = [
              {
                mediaType: asset.mediaType,
                url: uploaded.publicUrl,
                sortOrder: 0,
              },
            ];
          }
        } else {
          const signed = await presignMedia(token, asset.mediaType, asset.name);
          const uploaded = await uploadMediaFile(
            token,
            signed.uploadUrl,
            signed.key,
            asset,
          );
          media = [
            {
              mediaType: asset.mediaType,
              url: uploaded.publicUrl,
              sortOrder: 0,
            },
          ];
        }
      }

      await createPost(token, {
        familyId,
        caption: caption.trim() || undefined,
        media,
      });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create post');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New post</Text>
      <Text style={styles.subtitle}>Share with your family</Text>

      <TextInput
        style={styles.input}
        value={caption}
        onChangeText={setCaption}
        placeholder="What's happening in the family?"
        multiline
        textAlignVertical="top"
      />

      {asset && asset.mediaType === 'image' && (
        <Image source={{ uri: asset.uri }} style={styles.preview} />
      )}
      {asset && asset.mediaType === 'video' && (
        <View style={styles.videoBox}>
          <Text style={styles.videoText}>Video selected</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={() => void pick(false)}>
          <Text style={styles.secondaryText}>Photo</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void pick(true)}>
          <Text style={styles.secondaryText}>Video</Text>
        </Pressable>
        {asset && (
          <Pressable style={styles.secondary} onPress={() => setAsset(null)}>
            <Text style={[styles.secondaryText, { color: '#b91c1c' }]}>
              Remove
            </Text>
          </Pressable>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={() => void onPost()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Share</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 6, fontSize: 15, color: '#666' },
  input: {
    marginTop: 20,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111',
  },
  preview: {
    marginTop: 16,
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  videoBox: {
    marginTop: 16,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: { color: '#fff', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  secondary: {
    backgroundColor: '#f3f3f3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryText: { fontWeight: '700', color: '#111' },
  error: { marginTop: 12, color: '#b91c1c' },
  button: {
    marginTop: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
