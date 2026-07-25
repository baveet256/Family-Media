import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/contexts/AuthContext';
import { ContextSwitcher } from '@/components/ContextSwitcher';
import {
  createChat,
  fetchConnectionTree,
  fetchFamilyTree,
  fetchPerson,
  type ConnectionSummary,
  type FamilyTree,
  type PersonDetail,
} from '@/lib/api';
import {
  CARD_H,
  PAD_Y,
  PORTRAIT,
  ROW_H,
  SLOT_W,
  descentPath,
  layoutFamilyTree,
  offsetLayout,
  shiftLayoutY,
  type LaidPerson,
  type LaidUnit,
  type TreeLayout,
} from '@/lib/treeLayout';
import { cacheGet, cacheSet } from '@/lib/offlineCache';

type BridgeLink = NonNullable<ConnectionSummary['bridgeLinks']>[number];

const BRIDGE_GAP = 150;
const FLOWERS = ['🌸', '🌺', '🌷', '💮', '🌼', '🌹'];

const INK = '#4a3f35';
const MUTED = '#9c8b7a';
const VINE = '#c9b49a';

function cubicAt(t: number, p0: number, p1: number, p2: number, p3: number) {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

/** Alternating warm bands so each generation reads as a row, not a grid. */
function GenerationBands({
  maxDepth,
  width,
  offsetY = 0,
}: {
  maxDepth: number;
  width: number;
  offsetY?: number;
}) {
  return (
    <>
      {Array.from({ length: maxDepth + 1 }).map((_, depth) => (
        <View
          key={depth}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 10,
            width: Math.max(0, width - 20),
            top: PAD_Y + depth * ROW_H + offsetY - 20,
            height: CARD_H + 26,
            borderRadius: 26,
            backgroundColor:
              depth % 2 === 0 ? 'rgba(255,255,255,0.62)' : 'transparent',
          }}
        />
      ))}
    </>
  );
}

function CouplePill({ unit }: { unit: LaidUnit }) {
  if (!unit.isCouple) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.couplePill,
        {
          left: unit.cx - unit.width / 2,
          top: unit.y - 7,
          width: unit.width,
          height: PORTRAIT + 14,
          borderRadius: (PORTRAIT + 14) / 2,
        },
      ]}>
      <Text style={styles.coupleHeart}>♥</Text>
    </View>
  );
}

function Portrait({
  person,
  isBridge,
  held,
  onPress,
  onLongPress,
}: {
  person: LaidPerson;
  isBridge?: boolean;
  held?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const first = person.firstName || person.displayName;
  const last = person.lastName || '';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={220}
      style={[
        styles.slot,
        { left: person.cx - SLOT_W / 2, top: person.y, width: SLOT_W },
        held && styles.slotHeld,
      ]}>
      <View
        style={[
          styles.ring,
          person.isPlaceholder && styles.ringPlaceholder,
          isBridge && styles.ringBridge,
        ]}>
        {person.avatarUrl ? (
          <Image source={{ uri: person.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initial}>
              {(first || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        {isBridge ? <Text style={styles.bridgeFlower}>🌸</Text> : null}
      </View>

      <Text style={styles.firstName} numberOfLines={1}>
        {first}
      </Text>
      {last ? (
        <Text style={styles.lastName} numberOfLines={1}>
          {last}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Marriage across two families — a flowered arch rather than a connector. */
function FloralArch({ a, b }: { a: LaidPerson; b: LaidPerson }) {
  const left = a.cx < b.cx ? a : b;
  const right = a.cx < b.cx ? b : a;

  const x1 = left.cx + PORTRAIT / 2 + 6;
  const x2 = right.cx - PORTRAIT / 2 - 6;
  const y1 = left.y + PORTRAIT / 2;
  const y2 = right.y + PORTRAIT / 2;
  if (x2 <= x1) return null;

  const lift = Math.min(70, Math.max(38, (x2 - x1) * 0.34));
  const c1x = x1 + (x2 - x1) * 0.25;
  const c2x = x1 + (x2 - x1) * 0.75;
  const c1y = y1 - lift;
  const c2y = y2 - lift;

  const count = Math.max(5, Math.min(11, Math.floor((x2 - x1) / 34)));
  const apexX = cubicAt(0.5, x1, c1x, c2x, x2);
  const apexY = cubicAt(0.5, y1, c1y, c2y, y2);

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const t = (i + 1) / (count + 1);
        return (
          <Text
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: cubicAt(t, x1, c1x, c2x, x2) - 10,
              top: cubicAt(t, y1, c1y, c2y, y2) - 10,
              fontSize: 18,
            }}>
            {FLOWERS[i % FLOWERS.length]}
          </Text>
        );
      })}
      <Text
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: apexX - 13,
          top: apexY - 34,
          fontSize: 22,
        }}>
        💕
      </Text>
      <Text
        pointerEvents="none"
        style={[styles.archCaption, { left: apexX - 40, top: apexY + 12 }]}>
        joined by marriage
      </Text>
    </>
  );
}

function archPath(a: LaidPerson, b: LaidPerson) {
  const left = a.cx < b.cx ? a : b;
  const right = a.cx < b.cx ? b : a;
  const x1 = left.cx + PORTRAIT / 2 + 6;
  const x2 = right.cx - PORTRAIT / 2 - 6;
  const y1 = left.y + PORTRAIT / 2;
  const y2 = right.y + PORTRAIT / 2;
  if (x2 <= x1) return null;
  const lift = Math.min(70, Math.max(38, (x2 - x1) * 0.34));
  return `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.25} ${y1 - lift}, ${
    x1 + (x2 - x1) * 0.75
  } ${y2 - lift}, ${x2} ${y2}`;
}

/** One family's vines, portraits and couple pills. */
function TreeCanvas({
  layout,
  bridgeIds,
  heldId,
  onPressPerson,
  onHoldPerson,
}: {
  layout: TreeLayout;
  bridgeIds?: Set<string>;
  heldId?: string | null;
  onPressPerson: (id: string) => void;
  onHoldPerson: (id: string) => void;
}) {
  return (
    <>
      {layout.units.map((u) => (
        <CouplePill key={`pill-${u.id}`} unit={u} />
      ))}
      {layout.persons.map((p) => (
        <Portrait
          key={p.id}
          person={p}
          isBridge={bridgeIds?.has(p.id)}
          held={heldId === p.id}
          onPress={() => onPressPerson(p.id)}
          onLongPress={() => onHoldPerson(p.id)}
        />
      ))}
    </>
  );
}

function ageFrom(birth?: string | null, death?: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const end = death ? new Date(death) : new Date();
  let age = end.getUTCFullYear() - b.getUTCFullYear();
  const m = end.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && end.getUTCDate() < b.getUTCDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** The card that appears while you hold a face in the tree. */
function PeekCard({
  detail,
  viaTag,
  busy,
  onMessage,
  onOpenProfile,
  onClose,
}: {
  detail: PersonDetail | null;
  viaTag: string | null;
  busy: boolean;
  onMessage: () => void;
  onOpenProfile: () => void;
  onClose: () => void;
}) {
  const p = detail?.person;
  const first = p?.firstName || p?.displayName || '';
  const age = ageFrom(p?.birthDate, p?.deathDate);

  return (
    <Pressable style={styles.peekBackdrop} onPress={onClose}>
      <Pressable style={styles.peekCard} onPress={() => {}}>
        {!detail ? (
          <ActivityIndicator style={{ paddingVertical: 34 }} color={INK} />
        ) : (
          <>
            <View style={styles.peekTop}>
              {p?.avatarUrl ? (
                <Image source={{ uri: p.avatarUrl }} style={styles.peekFace} />
              ) : (
                <View style={[styles.peekFace, styles.peekFaceEmpty]}>
                  <Text style={styles.peekInitial}>
                    {(first || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.peekName}>{p?.displayName}</Text>
                <Text style={styles.peekStatus}>
                  {p?.status?.trim() ||
                    (p?.isPlaceholder
                      ? 'Not on the app yet'
                      : 'No status yet')}
                </Text>
                {viaTag ? (
                  <Text style={styles.peekVia}>{viaTag}</Text>
                ) : p?.family ? (
                  <Text style={styles.peekFamily}>{p.family.name}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.peekFacts}>
              {age != null ? (
                <Text style={styles.peekFact}>
                  {p?.deathDate ? `Lived ${age} years` : `${age} years old`}
                </Text>
              ) : null}
              <Text style={styles.peekFact} numberOfLines={3}>
                {detail.summary}
              </Text>
            </View>

            <View style={styles.peekActions}>
              {detail.canMessage ? (
                <Pressable
                  style={[styles.peekBtn, styles.peekBtnPrimary]}
                  disabled={busy}
                  onPress={onMessage}>
                  <Text style={styles.peekBtnPrimaryText}>
                    {busy ? 'Opening…' : `💬  Message ${first}`}
                  </Text>
                </Pressable>
              ) : (
                <View style={[styles.peekBtn, styles.peekBtnMuted]}>
                  <Text style={styles.peekBtnMutedText}>
                    {detail.isMe ? 'This is you' : 'Not on the app yet'}
                  </Text>
                </View>
              )}
              <Pressable style={styles.peekBtn} onPress={onOpenProfile}>
                <Text style={styles.peekBtnText}>View full profile</Text>
              </Pressable>
            </View>
          </>
        )}
      </Pressable>
    </Pressable>
  );
}

function descentPaths(layout: TreeLayout) {
  const personById = new Map(layout.persons.map((p) => [p.id, p]));
  const unitById = new Map(layout.units.map((u) => [u.id, u]));

  return layout.descents
    .map((d) => {
      const from = unitById.get(d.fromUnitId);
      const to = personById.get(d.toPersonId);
      if (!from || !to) return null;
      return {
        id: d.id,
        d: descentPath(from.cx, from.y + CARD_H - 6, to.cx, to.y - 8),
      };
    })
    .filter((v): v is { id: string; d: string } => v != null);
}

export default function TreeScreen() {
  const router = useRouter();
  const { token, activeFamily, context } = useAuth();
  const family = activeFamily;
  const connectionId = context?.connectionId ?? null;

  const [peekId, setPeekId] = useState<string | null>(null);
  const [peek, setPeek] = useState<PersonDetail | null>(null);
  const [peekBusy, setPeekBusy] = useState(false);

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [connectionTrees, setConnectionTrees] = useState<FamilyTree[]>([]);
  const [bridgeLinks, setBridgeLinks] = useState<BridgeLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    summary: string;
    displayName: string;
    avatarUrl: string | null;
    firstName?: string;
    lastName?: string;
    parents: Array<{ id: string; displayName: string }>;
    spouses: Array<{ id: string; displayName: string }>;
    children: Array<{ id: string; displayName: string }>;
    siblings: Array<{ id: string; displayName: string }>;
  } | null>(null);

  const load = useCallback(async () => {
    if (!token || !family?.id || family.status === 'pending') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (connectionId) {
        const data = await fetchConnectionTree(token, connectionId);
        setConnectionTrees(data.trees);
        setBridgeLinks(data.bridgeLinks ?? []);
        setTree(null);
        await cacheSet(`tree:conn:${connectionId}`, {
          trees: data.trees,
          bridgeLinks: data.bridgeLinks,
        });
      } else {
        const cacheKey = `tree:family:${family.id}`;
        const cached = await cacheGet<FamilyTree>(cacheKey);
        if (cached?.value) setTree(cached.value);
        const data = await fetchFamilyTree(token, family.id);
        setTree(data);
        setConnectionTrees([]);
        setBridgeLinks([]);
        await cacheSet(cacheKey, data);
      }
    } catch (e) {
      if (!connectionId) {
        const cached = await cacheGet<FamilyTree>(`tree:family:${family.id}`);
        if (cached?.value) {
          setTree(cached.value);
          setError('Showing cached tree (offline)');
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load tree');
        }
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load tree');
      }
    } finally {
      setLoading(false);
    }
  }, [token, family?.id, family?.status, connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const single = useMemo(() => (tree ? layoutFamilyTree(tree) : null), [tree]);

  const connected = useMemo(() => {
    if (!connectionTrees.length) return [];

    // Seat families so every marriage joins neighbours. Walking the marriage
    // graph from one end keeps arches short instead of vaulting whole families.
    const neighbours = new Map<string, string[]>();
    for (const b of bridgeLinks) {
      neighbours.set(b.familyAId, [
        ...(neighbours.get(b.familyAId) ?? []),
        b.familyBId,
      ]);
      neighbours.set(b.familyBId, [
        ...(neighbours.get(b.familyBId) ?? []),
        b.familyAId,
      ]);
    }
    const treeByFamily = new Map(connectionTrees.map((t) => [t.family.id, t]));
    const order: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id) || !treeByFamily.has(id)) return;
      seen.add(id);
      order.push(id);
      for (const n of neighbours.get(id) ?? []) walk(n);
    };
    // Start at an end of the chain when there is one, else wherever.
    const ends = connectionTrees
      .map((t) => t.family.id)
      .filter((id) => (neighbours.get(id) ?? []).length === 1);
    for (const id of [...ends, ...connectionTrees.map((t) => t.family.id)]) {
      walk(id);
    }
    const ordered = order
      .map((id) => treeByFamily.get(id))
      .filter((t): t is FamilyTree => !!t);
    const indexOfFamily = new Map(ordered.map((t, i) => [t.family.id, i]));

    // Each spouse faces the family they married into.
    const pins = new Map<string, 'left' | 'right'>();
    for (const b of bridgeLinks) {
      const ia = indexOfFamily.get(b.familyAId);
      const ib = indexOfFamily.get(b.familyBId);
      if (ia == null || ib == null || ia === ib) continue;
      pins.set(b.personA.id, ia < ib ? 'right' : 'left');
      pins.set(b.personB.id, ia < ib ? 'left' : 'right');
    }

    let xOff = 0;
    const laid = ordered.map((t) => {
      const positioned = offsetLayout(layoutFamilyTree(t, { pins }), xOff);
      xOff = positioned.width + BRIDGE_GAP;
      return { family: t.family, layout: positioned };
    });

    // Level each married pair with one already in place, so every arch runs
    // flat. Left to right means each family anchors to the one before it.
    const placed = new Set<string>([laid[0]?.family.id].filter(Boolean) as string[]);
    for (let i = 1; i < laid.length; i++) {
      const me = laid[i].family.id;
      const link = bridgeLinks.find(
        (b) =>
          (b.familyAId === me && placed.has(b.familyBId)) ||
          (b.familyBId === me && placed.has(b.familyAId)),
      );
      placed.add(me);
      if (!link) continue;

      const mine = link.familyAId === me ? link.personA.id : link.personB.id;
      const theirs = link.familyAId === me ? link.personB.id : link.personA.id;
      const anchor = laid
        .slice(0, i)
        .flatMap((l) => l.layout.persons)
        .find((p) => p.id === theirs);
      const mover = laid[i].layout.persons.find((p) => p.id === mine);
      if (anchor && mover && anchor.y !== mover.y) {
        laid[i] = {
          ...laid[i],
          layout: shiftLayoutY(laid[i].layout, anchor.y - mover.y),
        };
      }
    }
    return laid;
  }, [connectionTrees, bridgeLinks]);

  const bridgeIds = useMemo(
    () => new Set(bridgeLinks.flatMap((b) => [b.personA.id, b.personB.id])),
    [bridgeLinks],
  );

  const connPersons = useMemo(
    () => connected.flatMap((l) => l.layout.persons),
    [connected],
  );
  const connWidth = Math.max(340, ...connected.map((l) => l.layout.width));
  const connHeight = Math.max(420, ...connected.map((l) => l.layout.height));

  const openPerson = async (id: string) => {
    if (!token) return;
    setSelectedId(id);
    setDetail(null);
    try {
      const data = await fetchPerson(token, id);
      setDetail({
        displayName: data.person.displayName,
        summary: data.summary,
        avatarUrl: data.person.avatarUrl,
        firstName: data.person.firstName,
        lastName: data.person.lastName,
        parents: data.parents,
        spouses: data.spouses,
        children: data.children,
        siblings: data.siblings,
      });
    } catch (e) {
      setDetail({
        displayName: 'Person',
        summary: e instanceof Error ? e.message : 'Failed to load',
        avatarUrl: null,
        parents: [],
        spouses: [],
        children: [],
        siblings: [],
      });
    }
  };

  const holdPerson = async (id: string) => {
    if (!token) return;
    setPeekId(id);
    setPeek(null);
    try {
      setPeek(await fetchPerson(token, id));
    } catch {
      setPeekId(null);
    }
  };

  const messageFromPeek = async () => {
    const other = peek?.person.userId;
    if (!token || !family?.id || !other || peekBusy) return;
    setPeekBusy(true);
    try {
      const res = await createChat(token, {
        familyId: family.id,
        type: 'direct',
        participantUserIds: [other],
      });
      setPeekId(null);
      setPeek(null);
      router.push({
        pathname: '/chat/[id]',
        params: { id: res.chat.id, title: res.chat.title },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open chat');
    } finally {
      setPeekBusy(false);
    }
  };

  /** DMs across a marriage carry a "via" tag, so surface it while holding. */
  const peekVia = useMemo(() => {
    const fam = peek?.person.familyId;
    if (!fam || !family?.id || fam === family.id) return null;
    const other = context?.connection?.name;
    return other ? `via ${other}` : 'connected family';
  }, [peek, family?.id, context?.connection?.name]);

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
      <Text style={styles.title}>
        {connectionId
          ? context?.connection?.name || 'Connected families'
          : family.name}
      </Text>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.ring]} />
          <Text style={styles.legendText}>on the app</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.ringPlaceholder]} />
          <Text style={styles.legendText}>not yet</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendHeart}>♥</Text>
          <Text style={styles.legendText}>married</Text>
        </View>
        {connectionId ? (
          <View style={styles.legendItem}>
            <Text style={styles.legendHeart}>🌸</Text>
            <Text style={styles.legendText}>joins the families</Text>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 10 }}>
        <ContextSwitcher />
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && (single || connected.length > 0) ? (
        <View style={styles.album}>
          <ScrollView horizontal>
            <ScrollView>
              {single ? (
                <View
                  style={{
                    width: Math.max(340, single.width),
                    height: Math.max(420, single.height),
                  }}>
                  <GenerationBands
                    maxDepth={single.maxDepth}
                    width={single.width}
                  />
                  <Svg
                    width={single.width}
                    height={single.height}
                    style={StyleSheet.absoluteFill}>
                    {descentPaths(single).map((p) => (
                      <Path
                        key={p.id}
                        d={p.d}
                        stroke={VINE}
                        strokeWidth={2}
                        strokeLinecap="round"
                        fill="none"
                      />
                    ))}
                  </Svg>
                  <TreeCanvas
                    layout={single}
                    heldId={peekId}
                    onPressPerson={openPerson}
                    onHoldPerson={holdPerson}
                  />
                </View>
              ) : (
                <View style={{ width: connWidth, height: connHeight }}>
                  {connected.map((l) => (
                    <GenerationBands
                      key={`bands-${l.family.id}`}
                      maxDepth={l.layout.maxDepth}
                      width={l.layout.width}
                    />
                  ))}

                  <Svg
                    width={connWidth}
                    height={connHeight}
                    style={StyleSheet.absoluteFill}>
                    {connected.flatMap((l) =>
                      descentPaths(l.layout).map((p) => (
                        <Path
                          key={p.id}
                          d={p.d}
                          stroke={VINE}
                          strokeWidth={2}
                          strokeLinecap="round"
                          fill="none"
                        />
                      )),
                    )}
                    {bridgeLinks.map((b) => {
                      const a = connPersons.find((p) => p.id === b.personA.id);
                      const c = connPersons.find((p) => p.id === b.personB.id);
                      const d = a && c ? archPath(a, c) : null;
                      if (!d) return null;
                      return (
                        <Path
                          key={`arch-${b.id}`}
                          d={d}
                          stroke="#f0a6c4"
                          strokeWidth={3}
                          strokeLinecap="round"
                          fill="none"
                        />
                      );
                    })}
                  </Svg>

                  {connected.map((l) => (
                    <Text
                      key={`label-${l.family.id}`}
                      style={[
                        styles.familyLabel,
                        {
                          left: l.layout.persons.length
                            ? Math.min(...l.layout.persons.map((p) => p.cx)) - 30
                            : 20,
                        },
                      ]}>
                      {l.family.name}
                    </Text>
                  ))}

                  {connected.map((l) => (
                    <TreeCanvas
                      key={`canvas-${l.family.id}`}
                      layout={l.layout}
                      bridgeIds={bridgeIds}
                      heldId={peekId}
                      onPressPerson={openPerson}
                      onHoldPerson={holdPerson}
                    />
                  ))}

                  {bridgeLinks.map((b) => {
                    const a = connPersons.find((p) => p.id === b.personA.id);
                    const c = connPersons.find((p) => p.id === b.personB.id);
                    if (!a || !c) return null;
                    return <FloralArch key={`fl-${b.id}`} a={a} b={c} />;
                  })}
                </View>
              )}
            </ScrollView>
          </ScrollView>
        </View>
      ) : null}

      <Pressable style={styles.refresh} onPress={() => void load()}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>

      <Modal
        visible={!!peekId}
        transparent
        animationType="fade"
        onRequestClose={() => setPeekId(null)}>
        <PeekCard
          detail={peek}
          viaTag={peekVia}
          busy={peekBusy}
          onMessage={() => void messageFromPeek()}
          onOpenProfile={() => {
            const id = peekId;
            setPeekId(null);
            if (id) void openPerson(id);
          }}
          onClose={() => {
            setPeekId(null);
            setPeek(null);
          }}
        />
      </Modal>

      <Modal
        visible={!!selectedId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSelectedId(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {detail?.avatarUrl ? (
              <Image source={{ uri: detail.avatarUrl }} style={styles.sheetAvatar} />
            ) : (
              <View style={styles.sheetAvatarFallback}>
                <Text style={styles.initial}>
                  {(detail?.displayName || '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.sheetTitle}>{detail?.displayName ?? '…'}</Text>
            {detail && (
              <View style={styles.relBlock}>
                {[
                  ['Parents', detail.parents],
                  ['Spouse', detail.spouses],
                  ['Children', detail.children],
                  ['Siblings', detail.siblings],
                ].map(([label, people]) => {
                  const list = people as Array<{
                    id: string;
                    displayName: string;
                  }>;
                  if (!list.length) return null;
                  return (
                    <View key={label as string} style={styles.relRow}>
                      <Text style={styles.relLabel}>{label as string}</Text>
                      <Text style={styles.relValue}>
                        {list.map((p) => p.displayName).join(', ')}
                      </Text>
                    </View>
                  );
                })}
                {!detail.parents.length &&
                  !detail.spouses.length &&
                  !detail.children.length &&
                  !detail.siblings.length && (
                    <Text style={styles.sheetBody}>{detail.summary}</Text>
                  )}
              </View>
            )}
            {!detail && <Text style={styles.sheetBody}>Loading…</Text>}
            <Pressable style={styles.button} onPress={() => setSelectedId(null)}>
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
    padding: 20,
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

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 16, height: 16, borderRadius: 8, padding: 0 },
  legendHeart: { fontSize: 13, color: '#e08aa8' },
  legendText: { fontSize: 12, color: MUTED, fontWeight: '600' },

  album: {
    flex: 1,
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fbf6ef',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e8dccb',
  },
  familyLabel: {
    position: 'absolute',
    top: 16,
    fontSize: 12,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  couplePill: {
    position: 'absolute',
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#efe1cf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coupleHeart: { fontSize: 13, color: '#e08aa8' },

  slot: { position: 'absolute', alignItems: 'center' },
  slotHeld: { transform: [{ scale: 1.12 }] },
  peekBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    backgroundColor: 'rgba(40,28,18,0.42)',
  },
  peekCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fffdf9',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: '#4a3f35',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  peekTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  peekFace: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: '#f3e3d0',
  },
  peekFaceEmpty: {
    backgroundColor: '#f3e3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekInitial: { fontSize: 26, fontWeight: '700', color: MUTED },
  peekName: { fontSize: 19, fontWeight: '700', color: INK },
  peekStatus: { marginTop: 2, fontSize: 13, color: MUTED, fontStyle: 'italic' },
  peekVia: { marginTop: 4, fontSize: 12, color: '#db2777', fontWeight: '700' },
  peekFamily: { marginTop: 4, fontSize: 12, color: MUTED, fontWeight: '600' },
  peekFacts: {
    gap: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eaddcb',
  },
  peekFact: { fontSize: 13, color: INK, lineHeight: 19 },
  peekActions: { gap: 8 },
  peekBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f3e3d0',
  },
  peekBtnText: { fontWeight: '700', color: INK },
  peekBtnPrimary: { backgroundColor: '#c2410c' },
  peekBtnPrimaryText: { fontWeight: '700', color: '#fff', fontSize: 15 },
  peekBtnMuted: { backgroundColor: '#f6f1ea' },
  peekBtnMutedText: { fontWeight: '600', color: MUTED },
  ring: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
    padding: 3,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#7a5c3a',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ringPlaceholder: { borderColor: '#e2d0b6', backgroundColor: '#f6efe4' },
  ringBridge: { borderColor: '#f0a6c4' },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: PORTRAIT / 2,
    backgroundColor: '#ece3d6',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700', color: '#8a7660', fontSize: 18 },
  bridgeFlower: { position: 'absolute', top: -8, right: -4, fontSize: 15 },
  firstName: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  lastName: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
  },
  archCaption: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '800',
    color: '#d97fa4',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    alignItems: 'center',
  },
  sheetAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eee',
  },
  sheetAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  sheetBody: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    alignSelf: 'stretch',
  },
  relBlock: { alignSelf: 'stretch', gap: 8, marginTop: 4 },
  relRow: { gap: 2 },
  relLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  relValue: { fontSize: 15, color: '#222', lineHeight: 22 },
  button: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
