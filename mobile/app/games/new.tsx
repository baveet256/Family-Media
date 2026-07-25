import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  createGameRound,
  fetchGamePrompts,
  presignMedia,
  uploadMediaFile,
  type GamePromptSuggestions,
  type GameType,
} from '@/lib/api';

const DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
];

export default function NewGameRoundScreen() {
  const router = useRouter();
  const { token, families, activeFamily } = useAuth();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId =
    typeof params.familyId === 'string'
      ? params.familyId
      : activeFamily?.id ??
        families.find((f) => f.status === 'active')?.id ??
        '';

  const [type, setType] = useState<GameType>('family_awards');
  const [prompt, setPrompt] = useState('');
  const [hours, setHours] = useState(24);
  const [suggestions, setSuggestions] = useState<GamePromptSuggestions | null>(
    null,
  );
  const [asset, setAsset] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        setSuggestions(await fetchGamePrompts(token));
      } catch {
        // suggestions are a nicety; a custom prompt still works
      }
    })();
  }, [token]);

  const shown =
    type === 'family_awards'
      ? suggestions?.familyAwards ?? []
      : suggestions?.captionBattle ?? [];

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setAsset({
      uri: a.uri,
      name: a.fileName || `caption.${a.uri.split('.').pop() || 'jpg'}`,
      type: a.mimeType || 'image/jpeg',
    });
  };

  const onCreate = async () => {
    if (!token || !familyId || busy) return;
    if (!prompt.trim()) {
      setError('Pick or write a prompt');
      return;
    }
    if (type === 'caption_battle' && !asset) {
      setError('Caption Battle needs a photo');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let photoUrl: string | undefined;
      if (asset) {
        if (asset.uri.startsWith('http')) {
          photoUrl = asset.uri;
        } else {
          const signed = await presignMedia(token, 'image', asset.name);
          const uploaded = await uploadMediaFile(
            token,
            signed.uploadUrl,
            signed.key,
            { uri: asset.uri, name: asset.name, type: asset.type },
          );
          photoUrl = uploaded.publicUrl;
        }
      }

      const { round } = await createGameRound(token, {
        familyId,
        type,
        prompt: prompt.trim(),
        durationHours: hours,
        ...(photoUrl ? { photoUrl } : {}),
      });
      router.replace({ pathname: '/games/[id]', params: { id: round.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the round');
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={styles.label}>Game</Text>
      <View style={styles.typeRow}>
        <Pressable
          style={[styles.typeCard, type === 'family_awards' && styles.typeOn]}
          onPress={() => {
            setType('family_awards');
            setPrompt('');
          }}>
          <Text style={styles.typeEmoji}>🏆</Text>
          <Text style={styles.typeTitle}>Family Awards</Text>
          <Text style={styles.typeBody}>Vote for a person</Text>
        </Pressable>
        <Pressable
          style={[styles.typeCard, type === 'caption_battle' && styles.typeOn]}
          onPress={() => {
            setType('caption_battle');
            setPrompt('');
          }}>
          <Text style={styles.typeEmoji}>💬</Text>
          <Text style={styles.typeTitle}>Caption Battle</Text>
          <Text style={styles.typeBody}>Caption a photo</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Prompt</Text>
      <View style={styles.chips}>
        {shown.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, prompt === s && styles.chipOn]}
            onPress={() => setPrompt(s)}>
            <Text style={[styles.chipText, prompt === s && styles.chipTextOn]}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="…or write your own"
        placeholderTextColor="#aaa"
        maxLength={140}
      />

      {type === 'caption_battle' ? (
        <>
          <Text style={styles.label}>Photo</Text>
          {asset ? (
            <Image source={{ uri: asset.uri }} style={styles.preview} />
          ) : null}
          <Pressable style={styles.secondary} onPress={() => void pickPhoto()}>
            <Text style={styles.secondaryText}>
              {asset ? 'Choose a different photo' : 'Pick a photo'}
            </Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.label}>Open for</Text>
      <View style={styles.chips}>
        {DURATIONS.map((d) => (
          <Pressable
            key={d.hours}
            style={[styles.chip, hours === d.hours && styles.chipOn]}
            onPress={() => setHours(d.hours)}>
            <Text
              style={[styles.chipText, hours === d.hours && styles.chipTextOn]}>
              {d.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, busy && styles.primaryDisabled]}
        disabled={busy}
        onPress={() => void onCreate()}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Start the round</Text>
        )}
      </Pressable>
      <Text style={styles.footnote}>
        Everyone in the family gets a notification.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  label: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e5e5e5',
  },
  typeOn: { borderColor: '#111', backgroundColor: '#f7f7f7' },
  typeEmoji: { fontSize: 24 },
  typeTitle: { marginTop: 6, fontSize: 15, fontWeight: '700', color: '#111' },
  typeBody: { marginTop: 2, fontSize: 12, color: '#777' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 14, color: '#333', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eee',
    marginBottom: 10,
  },
  secondary: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f3f3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryText: { fontWeight: '700', color: '#111' },
  primary: {
    marginTop: 28,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footnote: {
    marginTop: 10,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  error: { marginTop: 16, color: '#b91c1c' },
});
