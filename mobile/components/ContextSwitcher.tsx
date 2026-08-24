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
import { fonts, theme } from '@/lib/theme';

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
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  chipText: {
    fontFamily: fonts.bodyMed,
    fontSize: 13,
    color: theme.ink,
    flexShrink: 1,
  },
  chipCaret: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.muted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,41,34,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: theme.paperElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 28,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: theme.ink,
    marginBottom: 8,
  },
  section: {
    marginTop: 12,
    marginBottom: 6,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  rowSelected: { backgroundColor: theme.accentSoft },
  rowTitle: {
    fontFamily: fonts.bodyMed,
    fontSize: 16,
    color: theme.ink,
  },
  rowMeta: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.muted,
  },
  manage: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
  },
  manageText: {
    fontFamily: fonts.bodyBold,
    color: theme.accent,
  },
});
