import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { API_BASE_URL, fetchHealth, type HealthResponse } from '@/lib/api';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

export default function HomeScreen() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const loadHealth = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await fetchHealth();
      setState({ kind: 'ok', data });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Family Media</Text>
      <Text style={styles.subtitle}>Private family network</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>API connection</Text>
        <Text style={styles.apiUrl}>{API_BASE_URL}</Text>

        {state.kind === 'loading' && (
          <ActivityIndicator style={styles.spinner} size="large" />
        )}

        {state.kind === 'ok' && (
          <View style={styles.statusBlock}>
            <Text style={styles.okBadge}>OK — {state.data.status}</Text>
            {state.data.info && (
              <Text style={styles.detail}>
                Database: {state.data.info.database?.status ?? 'unknown'}
              </Text>
            )}
            {state.data.info && (
              <Text style={styles.detail}>
                Redis: {state.data.info.redis?.status ?? 'unknown'}
              </Text>
            )}
          </View>
        )}

        {state.kind === 'error' && (
          <View style={styles.statusBlock}>
            <Text style={styles.errorBadge}>Offline</Text>
            <Text style={styles.errorText}>{state.message}</Text>
            <Text style={styles.hint}>
              Make sure Docker and the API server are running.
            </Text>
          </View>
        )}

        <Pressable style={styles.button} onPress={() => void loadHealth()}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#666',
  },
  card: {
    marginTop: 32,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  apiUrl: {
    marginTop: 8,
    fontSize: 13,
    color: '#444',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  spinner: {
    marginTop: 20,
  },
  statusBlock: {
    marginTop: 16,
    gap: 6,
  },
  okBadge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15803d',
  },
  errorBadge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#b91c1c',
  },
  detail: {
    fontSize: 14,
    color: '#444',
  },
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
  },
  hint: {
    marginTop: 4,
    fontSize: 13,
    color: '#888',
  },
  button: {
    marginTop: 20,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
