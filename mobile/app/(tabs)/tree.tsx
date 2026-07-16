import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  fetchFamilyTree,
  fetchPerson,
  type FamilyTree,
  type TreeNode,
} from '@/lib/api';

type LayoutNode = TreeNode & { x: number; y: number; depth: number };

function layoutTree(tree: FamilyTree): LayoutNode[] {
  const childIds = new Set(
    tree.edges.filter((e) => e.type === 'parent_of').map((e) => e.toPersonId),
  );
  const roots = tree.nodes.filter((n) => !childIds.has(n.id));
  const childrenOf = new Map<string, string[]>();
  for (const e of tree.edges.filter((ed) => ed.type === 'parent_of')) {
    const list = childrenOf.get(e.fromPersonId) ?? [];
    list.push(e.toPersonId);
    childrenOf.set(e.fromPersonId, list);
  }

  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const placed = new Map<string, LayoutNode>();
  const depthCounts = new Map<number, number>();

  const visit = (id: string, depth: number) => {
    if (placed.has(id) || !byId.has(id)) return;
    const col = depthCounts.get(depth) ?? 0;
    depthCounts.set(depth, col + 1);
    const node = byId.get(id)!;
    placed.set(id, {
      ...node,
      depth,
      x: 24 + col * 140,
      y: 24 + depth * 110,
    });
    for (const child of childrenOf.get(id) ?? []) {
      visit(child, depth + 1);
    }
  };

  const start = roots.length ? roots : tree.nodes;
  for (const r of start) visit(r.id, 0);
  // orphans / spouse-only nodes
  for (const n of tree.nodes) {
    if (!placed.has(n.id)) visit(n.id, 0);
  }

  return [...placed.values()];
}

export default function TreeScreen() {
  const { token, families } = useAuth();
  const family =
    families.find((f) => f.status === 'active') ??
    families.find((f) => f.role === 'admin') ??
    families[0];

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    summary: string;
    displayName: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!token || !family?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFamilyTree(token, family.id);
      setTree(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tree');
    } finally {
      setLoading(false);
    }
  }, [token, family?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const nodes = useMemo(() => (tree ? layoutTree(tree) : []), [tree]);
  const canvasH = Math.max(420, ...nodes.map((n) => n.y + 100));
  const canvasW = Math.max(340, ...nodes.map((n) => n.x + 140));

  const openPerson = async (id: string) => {
    if (!token) return;
    setSelectedId(id);
    try {
      const data = await fetchPerson(token, id);
      setDetail({
        displayName: data.person.displayName,
        summary: data.summary,
      });
    } catch (e) {
      setDetail({
        displayName: 'Person',
        summary: e instanceof Error ? e.message : 'Failed to load',
      });
    }
  };

  if (!family) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Family Tree</Text>
        <Text style={styles.subtitle}>Join or create a family first.</Text>
      </View>
    );
  }

  if (family.status === 'pending') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Family Tree</Text>
        <Text style={styles.subtitle}>
          Your membership is pending approval. The tree opens once you’re in.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{family.name}</Text>
      <Text style={styles.subtitle}>Tap a person for lineage</Text>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && tree && (
        <ScrollView
          horizontal
          style={{ marginTop: 12 }}
          contentContainerStyle={{ minWidth: canvasW }}>
          <ScrollView contentContainerStyle={{ minHeight: canvasH }}>
            <View style={{ width: canvasW, height: canvasH }}>
              {tree.edges
                .filter((e) => e.type === 'parent_of')
                .map((e) => {
                  const from = nodes.find((n) => n.id === e.fromPersonId);
                  const to = nodes.find((n) => n.id === e.toPersonId);
                  if (!from || !to) return null;
                  const x1 = from.x + 55;
                  const y1 = from.y + 56;
                  const x2 = to.x + 55;
                  const y2 = to.y;
                  const midY = (y1 + y2) / 2;
                  return (
                    <View key={e.id} pointerEvents="none">
                      <View
                        style={{
                          position: 'absolute',
                          left: x1,
                          top: y1,
                          width: 2,
                          height: Math.max(2, midY - y1),
                          backgroundColor: '#ccc',
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          left: Math.min(x1, x2),
                          top: midY,
                          width: Math.max(2, Math.abs(x2 - x1)),
                          height: 2,
                          backgroundColor: '#ccc',
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          left: x2,
                          top: midY,
                          width: 2,
                          height: Math.max(2, y2 - midY),
                          backgroundColor: '#ccc',
                        }}
                      />
                    </View>
                  );
                })}

              {nodes.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => void openPerson(n.id)}
                  style={[
                    styles.node,
                    {
                      left: n.x,
                      top: n.y,
                      borderColor: n.isPlaceholder ? '#d97706' : '#111',
                    },
                  ]}>
                  <Text style={styles.nodeName} numberOfLines={2}>
                    {n.displayName}
                  </Text>
                  {n.isPlaceholder && (
                    <Text style={styles.nodeBadge}>not on app</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}

      <Pressable style={styles.refresh} onPress={() => void load()}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>

      <Modal
        visible={!!selectedId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedId(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{detail?.displayName ?? '…'}</Text>
            <Text style={styles.sheetBody}>{detail?.summary ?? 'Loading…'}</Text>
            <Pressable
              style={styles.button}
              onPress={() => setSelectedId(null)}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fafafa',
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 6, fontSize: 15, color: '#666' },
  error: { marginTop: 16, color: '#b91c1c' },
  node: {
    position: 'absolute',
    width: 110,
    minHeight: 64,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  nodeBadge: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
    textTransform: 'uppercase',
  },
  refresh: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshText: { color: '#fff', fontWeight: '700' },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
  },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  sheetBody: { fontSize: 15, color: '#444', lineHeight: 22 },
  button: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
