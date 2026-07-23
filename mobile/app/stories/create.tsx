import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  createStory,
  presignMedia,
  uploadMediaFile,
} from '@/lib/api';

export default function CreateStoryScreen() {
  const router = useRouter();
  const { token, families } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId =
    typeof params.familyId === 'string'
      ? params.familyId
      : families.find((f) => f.status === 'active')?.id ?? '';

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
      mediaTypes: videos ? ['videos'] : ['images'],
      quality: 0.85,
      videoMaxDuration: 60,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    if (videos && a.duration && a.duration > 60000) {
      setError('Videos must be 60 seconds or less');
      return;
    }
    setError(null);
    setAsset({
      uri: a.uri,
      name: a.fileName || `story.${videos ? 'mp4' : 'jpg'}`,
      type: a.mimeType || (videos ? 'video/mp4' : 'image/jpeg'),
      mediaType: videos ? 'video' : 'image',
    });
  };

  const onShare = async () => {
    if (!token || !familyId || !asset) return;
    setBusy(true);
    setError(null);
    try {
      let url = asset.uri;
      if (asset.uri.startsWith('http')) {
        url = asset.uri;
      } else {
        const signed = await presignMedia(token, asset.mediaType, asset.name);
        const uploaded = await uploadMediaFile(
          token,
          signed.uploadUrl,
          signed.key,
          asset,
        );
        url = uploaded.publicUrl;
      }

      await createStory(token, {
        familyId,
        mediaType: asset.mediaType,
        url,
      });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post story');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New story</Text>
      <Text style={styles.subtitle}>Visible to your family for 24 hours</Text>

      {asset?.mediaType === 'image' && (
        <Image source={{ uri: asset.uri }} style={styles.preview} />
      )}
      {asset?.mediaType === 'video' && (
        <View style={styles.videoBox}>
          <Text style={styles.videoText}>Video ready (≤60s)</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={() => void pick(false)}>
          <Text style={styles.secondaryText}>Photo</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void pick(true)}>
          <Text style={styles.secondaryText}>Video</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (!asset || busy) && styles.buttonDisabled]}
        disabled={!asset || busy}
        onPress={() => void onShare()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Share story</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 6, fontSize: 15, color: '#666' },
  preview: {
    marginTop: 20,
    width: '100%',
    height: 360,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  videoBox: {
    marginTop: 20,
    height: 200,
    borderRadius: 16,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: { color: '#fff', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
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
