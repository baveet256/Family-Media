import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export function ContextSwitcher() {
  const router = useRouter();
  const {
    token,
    families,
    connections,
    context,
    activeFamily,
    switchContext,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token || !activeFamily) return null;

  const label = context?.connection
    ? `${activeFamily.name} · ${context.connection.name || 'Connection'}`
    : activeFamily.name;

  const onPick = async (familyId: string, connectionId: string | null) => {
    setBusy(true);
    try {
      await switchContext({ familyId, connectionId });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const relevantConnections = connections.filter((c) =>
    c.families.some((f) => f.id === activeFamily.id),
  );

  return (
    <>
      <Pressable style={styles.chip} onPress={() => setOpen(true)}>
        <Text style={styles.chipText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.chipCaret}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Switch context</Text>
            <ScrollView>
              <Text style={styles.section}>Family</Text>
              {families
                .filter((f) => f.status === 'active')
                .map((f) => {
                  const selected =
                    activeFamily.id === f.id && !context?.connectionId;
                  return (
                    <Pressable
                      key={f.id}
                      style={[styles.row, selected && styles.rowSelected]}
                      disabled={busy}
                      onPress={() => void onPick(f.id, null)}>
                      <Text style={styles.rowTitle}>{f.name}</Text>
                      <Text style={styles.rowMeta}>Family only</Text>
                    </Pressable>
                  );
                })}

              {relevantConnections.length ? (
                <>
                  <Text style={styles.section}>Connections</Text>
                  {relevantConnections.map((c) => {
                    const selected = context?.connectionId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={[styles.row, selected && styles.rowSelected]}
                        disabled={busy}
                        onPress={() =>
                          void onPick(activeFamily.id, c.id)
                        }>
                        <Text style={styles.rowTitle}>
                          {c.name || 'Connection'}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {c.families.map((f) => f.name).join(' · ')} · trees
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
            </ScrollView>

            <Pressable
              style={styles.manage}
              onPress={() => {
                setOpen(false);
                router.push('/connections');
              }}>
              <Text style={styles.manageText}>Manage connections</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 220,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#111', flexShrink: 1 },
  chipCaret: { fontSize: 12, color: '#666' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  section: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  rowSelected: { backgroundColor: '#f2f2f2' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowMeta: { marginTop: 2, fontSize: 13, color: '#777' },
  manage: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  manageText: { fontWeight: '700', color: '#111' },
});
