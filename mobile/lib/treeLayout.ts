import type { FamilyTree, TreeNode } from '@/lib/api';

export const PORTRAIT = 60;
export const SLOT_W = 86;
export const COUPLE_GAP = 8;
export const UNIT_GAP = 28;
export const ROW_H = 158;
export const PAD_X = 30;
export const PAD_Y = 56;
/** Portrait + the two lines of name underneath */
export const CARD_H = PORTRAIT + 42;

export type LaidPerson = TreeNode & {
  cx: number;
  y: number;
  depth: number;
  unitId: string;
};

export type LaidUnit = {
  id: string;
  memberIds: string[];
  cx: number;
  y: number;
  depth: number;
  width: number;
  isCouple: boolean;
};

export type Descent = {
  id: string;
  fromUnitId: string;
  /** The actual child, not the couple they married into */
  toPersonId: string;
};

export type TreeLayout = {
  persons: LaidPerson[];
  units: LaidUnit[];
  descents: Descent[];
  width: number;
  height: number;
  maxDepth: number;
};

const unitWidthFor = (memberCount: number) =>
  memberCount === 2 ? SLOT_W * 2 + COUPLE_GAP : SLOT_W;

/**
 * A tidy-tree layout that treats a married pair as one unit and centres every
 * parent over the children below it. The naive "next free column" approach is
 * what made this read like an org chart.
 */
export type LayoutOptions = {
  /**
   * People who marry into another family, mapped to the side that family sits
   * on. A family in the middle of a chain has some of both, so this is per
   * person rather than one side for the whole tree.
   */
  pins?: Map<string, 'left' | 'right'>;
};

export function layoutFamilyTree(
  tree: FamilyTree,
  opts: LayoutOptions = {},
): TreeLayout {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const parentEdges = tree.edges.filter((e) => e.type === 'parent_of');
  const spouseEdges = tree.edges.filter((e) => e.type === 'spouse_of');

  // Pair spouses; first pairing wins so nobody lands in two units
  const spouseOf = new Map<string, string>();
  for (const e of spouseEdges) {
    if (!byId.has(e.fromPersonId) || !byId.has(e.toPersonId)) continue;
    if (spouseOf.has(e.fromPersonId) || spouseOf.has(e.toPersonId)) continue;
    spouseOf.set(e.fromPersonId, e.toPersonId);
    spouseOf.set(e.toPersonId, e.fromPersonId);
  }

  const unitOf = new Map<string, string>();
  const units = new Map<string, { id: string; memberIds: string[] }>();
  for (const n of tree.nodes) {
    if (unitOf.has(n.id)) continue;
    const spouse = spouseOf.get(n.id);
    const memberIds = spouse && byId.has(spouse) ? [n.id, spouse] : [n.id];
    const id = [...memberIds].sort().join('+');
    units.set(id, { id, memberIds });
    for (const m of memberIds) unitOf.set(m, id);
  }

  const childUnits = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const descents: Descent[] = [];
  const seenDescent = new Set<string>();
  for (const e of parentEdges) {
    const from = unitOf.get(e.fromPersonId);
    const to = unitOf.get(e.toPersonId);
    if (!from || !to || from === to) continue;

    const list = childUnits.get(from) ?? [];
    if (!list.includes(to)) {
      list.push(to);
      childUnits.set(from, list);
    }
    hasParent.add(to);

    // Both parents produce an edge to the same child; draw one line from the couple
    const key = `${from}->${e.toPersonId}`;
    if (!seenDescent.has(key)) {
      seenDescent.add(key);
      descents.push({
        id: key,
        fromUnitId: from,
        toPersonId: e.toPersonId,
      });
    }
  }

  const pos = new Map<string, number>();
  const depthOf = new Map<string, number>();
  const rowCursor = new Map<number, number>();
  const visited = new Set<string>();

  // Keep a cross-family bride/groom on the outside edge, so the marriage arch
  // has clear air instead of vaulting over their siblings' heads.
  const orderedChildren = (uid: string) => {
    const kids = childUnits.get(uid) ?? [];
    if (!opts.pins?.size || kids.length < 2) return kids;
    const rank = (k: string) => {
      const members = units.get(k)?.memberIds ?? [];
      if (members.some((m) => opts.pins!.get(m) === 'left')) return -1;
      if (members.some((m) => opts.pins!.get(m) === 'right')) return 1;
      return 0;
    };
    return [...kids].sort((a, b) => rank(a) - rank(b));
  };

  const shiftSubtree = (uid: string, dx: number, seen = new Set<string>()) => {
    if (seen.has(uid)) return;
    seen.add(uid);
    const current = pos.get(uid);
    if (current == null) return;
    const next = current + dx;
    pos.set(uid, next);
    const depth = depthOf.get(uid) ?? 0;
    const w = unitWidthFor(units.get(uid)?.memberIds.length ?? 1);
    rowCursor.set(
      depth,
      Math.max(rowCursor.get(depth) ?? 0, next + w / 2 + UNIT_GAP),
    );
    for (const kid of childUnits.get(uid) ?? []) shiftSubtree(kid, dx, seen);
  };

  const place = (uid: string, depth: number) => {
    if (visited.has(uid)) return;
    visited.add(uid);
    depthOf.set(uid, depth);

    const unit = units.get(uid);
    if (!unit) return;
    const w = unitWidthFor(unit.memberIds.length);

    for (const kid of orderedChildren(uid)) place(kid, depth + 1);

    const kidCentres = (childUnits.get(uid) ?? [])
      .map((k) => pos.get(k))
      .filter((v): v is number => v != null);

    const minCentre = (rowCursor.get(depth) ?? PAD_X) + w / 2;
    let centre = minCentre;

    if (kidCentres.length) {
      const desired = (Math.min(...kidCentres) + Math.max(...kidCentres)) / 2;
      centre = Math.max(desired, minCentre);
      // If the row forced us right, bring the children along so they stay centred
      const shift = centre - desired;
      if (shift > 0.5) {
        for (const kid of childUnits.get(uid) ?? []) shiftSubtree(kid, shift);
      }
    }

    pos.set(uid, centre);
    rowCursor.set(depth, centre + w / 2 + UNIT_GAP);
  };

  const roots = [...units.values()].filter((u) => !hasParent.has(u.id));
  for (const r of roots) place(r.id, 0);
  for (const u of units.values()) place(u.id, 0);

  // Within a couple, seat the blood relative on the side facing their parents.
  // Otherwise the person who married in ends up wedged between siblings.
  const parentUnitOf = new Map<string, string>();
  const bloodMembers = new Map<string, Set<string>>();
  for (const d of descents) {
    const cu = unitOf.get(d.toPersonId);
    if (!cu) continue;
    if (!parentUnitOf.has(cu)) parentUnitOf.set(cu, d.fromUnitId);
    const set = bloodMembers.get(cu) ?? new Set<string>();
    set.add(d.toPersonId);
    bloodMembers.set(cu, set);
  }
  for (const unit of units.values()) {
    if (unit.memberIds.length !== 2) continue;
    const blood = bloodMembers.get(unit.id);
    if (!blood || blood.size !== 1) continue;
    const parentX = pos.get(parentUnitOf.get(unit.id) ?? '');
    const selfX = pos.get(unit.id);
    if (parentX == null || selfX == null) continue;
    const wantIndex = parentX < selfX ? 0 : 1;
    if (unit.memberIds.indexOf([...blood][0]) !== wantIndex) {
      unit.memberIds.reverse();
    }
  }

  const minCentre = Math.min(
    ...[...units.values()].map(
      (u) => (pos.get(u.id) ?? 0) - unitWidthFor(u.memberIds.length) / 2,
    ),
  );
  const dx = PAD_X - minCentre;

  const laidUnits: LaidUnit[] = [];
  const persons: LaidPerson[] = [];

  for (const unit of units.values()) {
    const depth = depthOf.get(unit.id) ?? 0;
    const cx = (pos.get(unit.id) ?? 0) + dx;
    const y = PAD_Y + depth * ROW_H;
    const width = unitWidthFor(unit.memberIds.length);
    const isCouple = unit.memberIds.length === 2;

    laidUnits.push({
      id: unit.id,
      memberIds: unit.memberIds,
      cx,
      y,
      depth,
      width,
      isCouple,
    });

    unit.memberIds.forEach((pid, i) => {
      const node = byId.get(pid);
      if (!node) return;
      const offset = isCouple
        ? (i === 0 ? -1 : 1) * ((SLOT_W + COUPLE_GAP) / 2)
        : 0;
      persons.push({
        ...node,
        cx: cx + offset,
        y,
        depth,
        unitId: unit.id,
      });
    });
  }

  const maxDepth = Math.max(0, ...laidUnits.map((u) => u.depth));
  // Real content width — a minimum canvas size is the renderer's business.
  // Baking a floor in here would pad the gap between connected families.
  const width = Math.max(0, ...laidUnits.map((u) => u.cx + u.width / 2)) + PAD_X;
  const height = PAD_Y + (maxDepth + 1) * ROW_H;

  return { persons, units: laidUnits, descents, width, height, maxDepth };
}

/** Shift a whole laid-out tree sideways, for the connected two-family view. */
export function offsetLayout(layout: TreeLayout, dx: number): TreeLayout {
  return {
    ...layout,
    persons: layout.persons.map((p) => ({ ...p, cx: p.cx + dx })),
    units: layout.units.map((u) => ({ ...u, cx: u.cx + dx })),
    width: layout.width + dx,
  };
}

/** Drop a tree down so a cross-family couple ends up on the same row. */
export function shiftLayoutY(layout: TreeLayout, dy: number): TreeLayout {
  if (!dy) return layout;
  return {
    ...layout,
    persons: layout.persons.map((p) => ({ ...p, y: p.y + dy })),
    units: layout.units.map((u) => ({ ...u, y: u.y + dy })),
    height: layout.height + Math.max(0, dy),
  };
}

/** Soft S-curve between two generations — the thing that stops it looking like a flowchart. */
export function descentPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  const bend = Math.max(24, (toY - fromY) * 0.45);
  return `M ${fromX} ${fromY} C ${fromX} ${fromY + bend}, ${toX} ${
    toY - bend
  }, ${toX} ${toY}`;
}
