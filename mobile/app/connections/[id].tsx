import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  createBridgeLink,
  fetchConnection,
  fetchConnectionTree,
  updateConnection,
  type ConnectionSummary,
  type TreeNode,
} from '@/lib/api';

export default function ConnectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const connectionId = typeof id === 'string' ? id : '';
  const { token, activeFamily, switchContext, refresh } = useAuth();

  const [connection, setConnection] = useState<ConnectionSummary | null>(null);
  const [trees, setTrees] = useState<
    Array<{
      family: { id: string; name: string };
      nodes: TreeNode[];
    }>
  >([]);
  const [bridges, setBridges] = useState<
    NonNullable<ConnectionSummary['bridgeLinks']>
  >([]);
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !connectionId) return;
    setLoading(true);
    setError(null);
    try {
      const [c, t] = await Promise.all([
        fetchConnection(token, connectionId),
        fetchConnectionTree(token, connectionId),
      ]);
      setConnection(c.connection);
      setTrees(
        t.trees.map((tr) => ({
          family: { id: tr.family.id, name: tr.family.name },
          nodes: tr.nodes,
        })),
      );
      setBridges(t.bridgeLinks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPolicy = async (feedPolicy: 'unified_feed' | 'separate_feeds') => {
    if (!token || !connectionId) return;
    setBusy(true);
    try {
      const res = await updateConnection(token, connectionId, { feedPolicy });
      setConnection(res.connection);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const onBridge = async () => {
    if (!token || !connectionId || !pickA || !pickB) return;
    setBusy(true);
    setError(null);
    try {
      await createBridgeLink(token, connectionId, {
        personAId: pickA,
        personBId: pickB,
        linkType: 'spouse',
      });
      setPickA(null);
      setPickB(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bridge failed');
    } finally {
      setBusy(false);
    }
  };

  const onUseContext = async () => {
    if (!activeFamily || !connectionId) return;
    await switchContext({
      familyId: activeFamily.id,
      connectionId,
    });
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const familyA = trees[0];
  const familyB = trees[1];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{connection?.name || 'Connection'}</Text>
      <Text style={styles.meta}>
        {(connection?.families ?? []).map((f) => f.name).join(' · ')}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primary} onPress={() => void onUseContext()}>
        <Text style={styles.primaryText}>Use as active context</Text>
      </Pressable>

      <Text style={styles.section}>Feed policy</Text>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.pill,
            connection?.feedPolicy === 'unified_feed' && styles.pillOn,
          ]}
          disabled={busy}
          onPress={() => void onPolicy('unified_feed')}>
          <Text
            style={[
              styles.pillText,
              connection?.feedPolicy === 'unified_feed' && styles.pillTextOn,
            ]}>
            Unified
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.pill,
            connection?.feedPolicy === 'separate_feeds' && styles.pillOn,
          ]}
          disabled={busy}
          onPress={() => void onPolicy('separate_feeds')}>
          <Text
            style={[
              styles.pillText,
              connection?.feedPolicy === 'separate_feeds' && styles.pillTextOn,
            ]}>
            Separate
          </Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Bridge links</Text>
      {bridges.map((b) => (
        <View key={b.id} style={styles.bridge}>
          <Text style={styles.bridgeText}>
            {b.personA.displayName || 'Person'} ↔{' '}
            {b.personB.displayName || 'Person'} ({b.linkType})
          </Text>
        </View>
      ))}
      {!bridges.length ? (
        <Text style={styles.empty}>No bridge yet — pick one person from each family.</Text>
      ) : null}

      {familyA && familyB && activeFamily?.role === 'admin' ? (
        <>
          <Text style={styles.section}>Add spouse bridge</Text>
          <Text style={styles.sub}>{familyA.family.name}</Text>
          <View style={styles.wrap}>
            {familyA.nodes.map((n) => (
              <Pressable
                key={n.id}
                style={[styles.chip, pickA === n.id && styles.chipOn]}
                onPress={() => setPickA(n.id)}>
                <Text
                  style={[
                    styles.chipText,
                    pickA === n.id && styles.chipTextOn,
                  ]}>
                  {n.displayName}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sub}>{familyB.family.name}</Text>
          <View style={styles.wrap}>
            {familyB.nodes.map((n) => (
              <Pressable
                key={n.id}
                style={[styles.chip, pickB === n.id && styles.chipOn]}
                onPress={() => setPickB(n.id)}>
                <Text
                  style={[
                    styles.chipText,
                    pickB === n.id && styles.chipTextOn,
                  ]}>
                  {n.displayName}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.primary, (!pickA || !pickB || busy) && styles.disabled]}
            disabled={!pickA || !pickB || busy}
            onPress={() => void onBridge()}>
            <Text style={styles.primaryText}>Save bridge</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.section}>Side-by-side trees</Text>
      {trees.map((t) => (
        <View key={t.family.id} style={styles.treeCard}>
          <Text style={styles.treeTitle}>{t.family.name}</Text>
          {t.nodes.map((n) => {
            const bridged = bridges.some(
              (b) => b.personA.id === n.id || b.personB.id === n.id,
            );
            return (
              <Text
                key={n.id}
                style={[styles.node, bridged && styles.nodeBridge]}>
                {n.displayName}
                {bridged ? ' · bridge' : ''}
              </Text>
            );
          })}
        </View>
      ))}

      <Pressable
        style={styles.secondary}
        onPress={() =>
          router.push({
            pathname: '/connections/invite',
          })
        }>
        <Text style={styles.secondaryText}>Invite another family</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#111' },
  meta: { marginTop: 4, color: '#666', marginBottom: 12 },
  error: { color: '#b00020', marginBottom: 8 },
  section: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
  },
  sub: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  empty: { color: '#888', fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  pillOn: { backgroundColor: '#111' },
  pillText: { fontWeight: '600', color: '#444' },
  pillTextOn: { color: '#fff' },
  bridge: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  bridgeText: { fontWeight: '600', color: '#111' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  chipOn: { backgroundColor: '#111' },
  chipText: { color: '#333', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  treeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  treeTitle: { fontWeight: '700', marginBottom: 8, color: '#111' },
  node: { paddingVertical: 4, color: '#333' },
  nodeBridge: { fontWeight: '700', color: '#111' },
  primary: {
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: {
    marginTop: 16,
    marginBottom: 40,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { fontWeight: '700', color: '#111' },
  disabled: { opacity: 0.4 },
});
