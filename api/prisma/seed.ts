import { PrismaClient } from '@prisma/client';

/**
 * Demo seed: two families joined by Vikram 💕 Aisha marriage.
 *
 * Sharma Family (invite SHARMA01)
 *   Robert ══ Priya
 *       ├── Arjun (admin, +15550001000) ══ Meera → kids
 *       ├── Vikram  ←── marriage bridge ──→  Aisha
 *       └── Neha
 *
 * Mehta Family (invite MEHTA01) — sits in the middle of the chain
 *   Raj (admin, +15550002000) ══ Sunita
 *       ├── Aisha  ←── marriage bridge ──→  Vikram Sharma
 *       └── Kabir  ←── marriage bridge ──→  Tara Kapoor
 *
 * Kapoor Family (invite KAPOOR01)
 *   Dev (admin, +15550003000) ══ Nina
 *       ├── Tara (bride)
 *       └── Ishaan
 *
 * Connection flow (already completed in seed):
 *   1. Arjun (Sharma admin) invites Mehta, naming Vikram; Raj accepts naming Aisha
 *   2. Raj invites Kapoor into the same connection naming Kabir; Dev accepts naming Tara
 *   → all three graphs visible to members of any of them, and three families
 *     produce 3C2 + 3C3 = 4 congregation circles in chat
 */
const prisma = new PrismaClient();

const SHARMA_ADMIN_PHONE = '+15550001000';
const MEHTA_ADMIN_PHONE = '+15550002000';
const KAPOOR_ADMIN_PHONE = '+15550003000';

// A few relatives get real accounts so chats and game votes look alive.
const MEERA_PHONE = '+15550001001';
const VIKRAM_PHONE = '+15550001002';
const NEHA_PHONE = '+15550001003';
const AISHA_PHONE = '+15550002001';
const TARA_PHONE = '+15550003001';

const DEMO_PHONES = [
  SHARMA_ADMIN_PHONE,
  MEHTA_ADMIN_PHONE,
  KAPOOR_ADMIN_PHONE,
  MEERA_PHONE,
  VIKRAM_PHONE,
  NEHA_PHONE,
  AISHA_PHONE,
  TARA_PHONE,
];

function name(first: string, last: string) {
  return { firstName: first, lastName: last, displayName: `${first} ${last}` };
}

function birth(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(seed)}`;

async function edge(
  familyId: string,
  fromId: string,
  toId: string,
  type: 'parent_of' | 'spouse_of' | 'sibling_of',
) {
  await prisma.relationship.upsert({
    where: {
      familyId_fromPersonId_toPersonId_type: {
        familyId,
        fromPersonId: fromId,
        toPersonId: toId,
        type,
      },
    },
    create: {
      familyId,
      fromPersonId: fromId,
      toPersonId: toId,
      type,
      source: 'admin',
    },
    update: {},
  });
}

async function linkBoth(
  familyId: string,
  a: string,
  b: string,
  type: 'spouse_of' | 'sibling_of',
) {
  await edge(familyId, a, b, type);
  await edge(familyId, b, a, type);
}

async function parentsOf(
  familyId: string,
  parentA: string,
  parentB: string,
  child: string,
) {
  await edge(familyId, parentA, child, 'parent_of');
  await edge(familyId, parentB, child, 'parent_of');
}

async function siblingsAll(familyId: string, people: string[]) {
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      await linkBoth(familyId, people[i], people[j], 'sibling_of');
    }
  }
}

/** Votes are addressed by the person they back, then resolved to an entry. */
type SeedVote = { voterUserId: string; personId: string };

async function seedRound(opts: {
  familyId: string;
  hostUserId: string;
  type: 'family_awards' | 'caption_battle';
  prompt: string;
  photoUrl?: string;
  entries: Array<{ personId: string; text?: string }>;
  votes: SeedVote[];
  status: 'submitting' | 'voting' | 'closed';
  /** Negative for rounds that already ended. */
  closesInHours: number;
  createdHoursAgo?: number;
}) {
  const now = Date.now();
  const round = await prisma.gameRound.create({
    data: {
      familyId: opts.familyId,
      createdByUserId: opts.hostUserId,
      type: opts.type,
      prompt: opts.prompt,
      photoUrl: opts.photoUrl ?? null,
      status: opts.status === 'closed' ? 'voting' : opts.status,
      closesAt: new Date(now + opts.closesInHours * 3_600_000),
      createdAt: new Date(now - (opts.createdHoursAgo ?? 0) * 3_600_000),
    },
  });

  const entryByPerson = new Map<string, string>();
  for (const e of opts.entries) {
    const row = await prisma.gameEntry.create({
      data: {
        roundId: round.id,
        personId: e.personId,
        text: e.text ?? null,
      },
    });
    entryByPerson.set(e.personId, row.id);
  }

  const tally = new Map<string, number>();
  for (const v of opts.votes) {
    const entryId = entryByPerson.get(v.personId);
    if (!entryId) continue;
    await prisma.gameVote.create({
      data: { roundId: round.id, voterUserId: v.voterUserId, entryId },
    });
    tally.set(entryId, (tally.get(entryId) ?? 0) + 1);
  }

  if (opts.status === 'closed') {
    const winnerEntryId =
      [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    await prisma.gameRound.update({
      where: { id: round.id },
      data: {
        status: 'closed',
        closedAt: new Date(now - 60_000),
        winnerEntryId,
      },
    });
  }

  return round;
}

async function wipeUserByPhone(phone: string) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (!existing) return;
  const memberships = await prisma.familyMembership.findMany({
    where: { userId: existing.id },
    select: { familyId: true },
  });
  for (const m of memberships) {
    await prisma.family
      .delete({ where: { id: m.familyId } })
      .catch(() => undefined);
  }
  await prisma.user.delete({ where: { id: existing.id } }).catch(() => undefined);
}

/** Turn a placeholder relative into a real app member. */
async function giveAccount(
  familyId: string,
  person: { id: string; firstName: string; lastName: string; avatarUrl: string | null },
  phone: string,
  status = '',
) {
  const user = await prisma.user.create({
    data: {
      phone,
      ...name(person.firstName, person.lastName),
      avatarUrl: person.avatarUrl,
      status,
    },
  });
  await prisma.familyMembership.create({
    data: { familyId, userId: user.id, role: 'member', status: 'active' },
  });
  await prisma.person.update({
    where: { id: person.id },
    data: { userId: user.id, isPlaceholder: false },
  });
  return user;
}

async function main() {
  for (const phone of DEMO_PHONES) {
    await wipeUserByPhone(phone);
  }
  await prisma.family.deleteMany({
    where: { inviteCode: { in: ['SHARMA01', 'MEHTA01', 'KAPOOR01'] } },
  });

  // ═══════════════════════════════════════════════════════════════════
  // SHARMA FAMILY
  // ═══════════════════════════════════════════════════════════════════
  const arjunUser = await prisma.user.create({
    data: {
      phone: SHARMA_ADMIN_PHONE,
      ...name('Arjun', 'Sharma'),
      avatarUrl: avatar('ArjunSharma'),
      status: 'Keeper of the family tree',
    },
  });

  const sharma = await prisma.family.create({
    data: {
      name: 'Sharma Family',
      inviteCode: 'SHARMA01',
      settings: { require_approval: true, who_can_invite: 'admin' },
    },
  });

  await prisma.familyMembership.create({
    data: {
      familyId: sharma.id,
      userId: arjunUser.id,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.chat.create({
    data: {
      familyId: sharma.id,
      type: 'group',
      scope: 'family',
      name: 'Family',
      participants: {
        create: [{ userId: arjunUser.id, lastReadAt: new Date() }],
      },
    },
  });

  const robert = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Robert', 'Sharma'),
      avatarUrl: avatar('RobertSharma'),
      gender: 'male',
      birthDate: birth(1952, 3, 12),
      isPlaceholder: true,
    },
  });
  const priya = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Priya', 'Sharma'),
      avatarUrl: avatar('PriyaSharma'),
      gender: 'female',
      birthDate: birth(1955, 8, 21),
      isPlaceholder: true,
    },
  });
  const arjun = await prisma.person.create({
    data: {
      familyId: sharma.id,
      userId: arjunUser.id,
      ...name('Arjun', 'Sharma'),
      avatarUrl: arjunUser.avatarUrl,
      gender: 'male',
      birthDate: birth(1980, 5, 4),
      isPlaceholder: false,
    },
  });
  const meera = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Meera', 'Sharma'),
      avatarUrl: avatar('MeeraSharma'),
      gender: 'female',
      birthDate: birth(1982, 11, 9),
      isPlaceholder: true,
    },
  });
  const vikram = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Vikram', 'Sharma'),
      avatarUrl: avatar('VikramSharma'),
      gender: 'male',
      birthDate: birth(1983, 1, 18),
      isPlaceholder: true,
    },
  });
  const neha = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Neha', 'Kapoor'),
      avatarUrl: avatar('NehaKapoor'),
      gender: 'female',
      birthDate: birth(1986, 7, 30),
      isPlaceholder: true,
    },
  });
  const kabirS = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Kabir', 'Sharma'),
      avatarUrl: avatar('KabirSharma'),
      gender: 'male',
      birthDate: birth(2008, 2, 14),
      isPlaceholder: true,
    },
  });
  const rohan = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Rohan', 'Sharma'),
      avatarUrl: avatar('RohanSharma'),
      gender: 'male',
      birthDate: birth(2010, 9, 3),
      isPlaceholder: true,
    },
  });
  const dev = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Dev', 'Sharma'),
      avatarUrl: avatar('DevSharma'),
      gender: 'male',
      birthDate: birth(2013, 4, 22),
      isPlaceholder: true,
    },
  });
  const ananya = await prisma.person.create({
    data: {
      familyId: sharma.id,
      ...name('Ananya', 'Sharma'),
      avatarUrl: avatar('AnanyaSharma'),
      gender: 'female',
      birthDate: birth(2016, 12, 1),
      isPlaceholder: true,
    },
  });

  await linkBoth(sharma.id, robert.id, priya.id, 'spouse_of');
  await parentsOf(sharma.id, robert.id, priya.id, arjun.id);
  await parentsOf(sharma.id, robert.id, priya.id, vikram.id);
  await parentsOf(sharma.id, robert.id, priya.id, neha.id);
  await siblingsAll(sharma.id, [arjun.id, vikram.id, neha.id]);
  await linkBoth(sharma.id, arjun.id, meera.id, 'spouse_of');
  for (const kid of [kabirS, rohan, dev, ananya]) {
    await parentsOf(sharma.id, arjun.id, meera.id, kid.id);
  }
  await siblingsAll(sharma.id, [kabirS.id, rohan.id, dev.id, ananya.id]);

  const meeraUser = await giveAccount(
    sharma.id,
    meera,
    MEERA_PHONE,
    'Mum of four. Currently hiding in the kitchen.',
  );
  const vikramUser = await giveAccount(
    sharma.id,
    vikram,
    VIKRAM_PHONE,
    'Just married 💍',
  );
  const nehaUser = await giveAccount(
    sharma.id,
    neha,
    NEHA_PHONE,
    'Ask me about my dog',
  );

  // ═══════════════════════════════════════════════════════════════════
  // MEHTA FAMILY (bride's side)
  // ═══════════════════════════════════════════════════════════════════
  const rajUser = await prisma.user.create({
    data: {
      phone: MEHTA_ADMIN_PHONE,
      ...name('Raj', 'Mehta'),
      avatarUrl: avatar('RajMehta'),
      status: 'Two weddings in one year 😅',
    },
  });

  const mehta = await prisma.family.create({
    data: {
      name: 'Mehta Family',
      inviteCode: 'MEHTA01',
      settings: { require_approval: true, who_can_invite: 'admin' },
    },
  });

  await prisma.familyMembership.create({
    data: {
      familyId: mehta.id,
      userId: rajUser.id,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.chat.create({
    data: {
      familyId: mehta.id,
      type: 'group',
      scope: 'family',
      name: 'Family',
      participants: {
        create: [{ userId: rajUser.id, lastReadAt: new Date() }],
      },
    },
  });

  const raj = await prisma.person.create({
    data: {
      familyId: mehta.id,
      userId: rajUser.id,
      ...name('Raj', 'Mehta'),
      avatarUrl: rajUser.avatarUrl,
      gender: 'male',
      birthDate: birth(1958, 6, 2),
      isPlaceholder: false,
    },
  });
  const sunita = await prisma.person.create({
    data: {
      familyId: mehta.id,
      ...name('Sunita', 'Mehta'),
      avatarUrl: avatar('SunitaMehta'),
      gender: 'female',
      birthDate: birth(1961, 10, 15),
      isPlaceholder: true,
    },
  });
  const aisha = await prisma.person.create({
    data: {
      familyId: mehta.id,
      ...name('Aisha', 'Mehta'),
      avatarUrl: avatar('AishaMehta'),
      gender: 'female',
      birthDate: birth(1985, 4, 8),
      isPlaceholder: true,
    },
  });
  const kabirM = await prisma.person.create({
    data: {
      familyId: mehta.id,
      ...name('Kabir', 'Mehta'),
      avatarUrl: avatar('KabirMehta'),
      gender: 'male',
      birthDate: birth(1988, 9, 19),
      isPlaceholder: true,
    },
  });

  await linkBoth(mehta.id, raj.id, sunita.id, 'spouse_of');
  await parentsOf(mehta.id, raj.id, sunita.id, aisha.id);
  await parentsOf(mehta.id, raj.id, sunita.id, kabirM.id);
  await siblingsAll(mehta.id, [aisha.id, kabirM.id]);

  await giveAccount(mehta.id, aisha, AISHA_PHONE, 'New surname, same me 🌸');

  // ═══════════════════════════════════════════════════════════════════
  // KAPOOR FAMILY — the second wedding, Kabir Mehta ↔ Tara Kapoor.
  // Three families in one connection give 3C2 + 3C3 = 4 congregation circles.
  // ═══════════════════════════════════════════════════════════════════
  const yashUser = await prisma.user.create({
    data: {
      phone: KAPOOR_ADMIN_PHONE,
      ...name('Yash', 'Kapoor'),
      avatarUrl: avatar('YashKapoor'),
      status: 'Retired, still runs the family WhatsApp',
    },
  });

  const kapoor = await prisma.family.create({
    data: {
      name: 'Kapoor Family',
      inviteCode: 'KAPOOR01',
      settings: { require_approval: true, who_can_invite: 'admin' },
    },
  });

  await prisma.familyMembership.create({
    data: {
      familyId: kapoor.id,
      userId: yashUser.id,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.chat.create({
    data: {
      familyId: kapoor.id,
      type: 'group',
      scope: 'family',
      name: 'Family',
      participants: {
        create: [{ userId: yashUser.id, lastReadAt: new Date() }],
      },
    },
  });

  const yash = await prisma.person.create({
    data: {
      familyId: kapoor.id,
      userId: yashUser.id,
      ...name('Yash', 'Kapoor'),
      avatarUrl: yashUser.avatarUrl,
      gender: 'male',
      birthDate: birth(1957, 3, 21),
      isPlaceholder: false,
    },
  });
  const nina = await prisma.person.create({
    data: {
      familyId: kapoor.id,
      ...name('Nina', 'Kapoor'),
      avatarUrl: avatar('NinaKapoor'),
      gender: 'female',
      birthDate: birth(1960, 12, 4),
      isPlaceholder: true,
    },
  });
  const tara = await prisma.person.create({
    data: {
      familyId: kapoor.id,
      ...name('Tara', 'Kapoor'),
      avatarUrl: avatar('TaraKapoor'),
      gender: 'female',
      birthDate: birth(1990, 7, 30),
      isPlaceholder: true,
    },
  });
  const ishaan = await prisma.person.create({
    data: {
      familyId: kapoor.id,
      ...name('Ishaan', 'Kapoor'),
      avatarUrl: avatar('IshaanKapoor'),
      gender: 'male',
      birthDate: birth(1993, 2, 11),
      isPlaceholder: true,
    },
  });

  await linkBoth(kapoor.id, yash.id, nina.id, 'spouse_of');
  await parentsOf(kapoor.id, yash.id, nina.id, tara.id);
  await parentsOf(kapoor.id, yash.id, nina.id, ishaan.id);
  await siblingsAll(kapoor.id, [tara.id, ishaan.id]);

  await giveAccount(kapoor.id, tara, TARA_PHONE, 'Counting down to the wedding');

  // ═══════════════════════════════════════════════════════════════════
  // WEDDING CONNECTION — both admins approved
  // Arjun invited → Raj accepted → marriage bridge Vikram ↔ Aisha
  // ═══════════════════════════════════════════════════════════════════
  const connection = await prisma.connection.create({
    data: {
      name: 'Vikram & Aisha',
      feedPolicy: 'unified_feed',
      status: 'active',
      memberships: {
        create: [
          { familyId: sharma.id, status: 'active' },
          { familyId: mehta.id, status: 'active' },
          { familyId: kapoor.id, status: 'active' },
        ],
      },
    },
  });

  await prisma.connectionInvite.create({
    data: {
      connectionId: connection.id,
      fromFamilyId: sharma.id,
      toFamilyId: mehta.id,
      initiatedByUserId: arjunUser.id,
      proposedName: 'Vikram & Aisha',
      proposedFeedPolicy: 'unified_feed',
      fromPersonId: vikram.id,
      status: 'accepted',
    },
  });

  await prisma.connectionInvite.create({
    data: {
      connectionId: connection.id,
      fromFamilyId: mehta.id,
      toFamilyId: kapoor.id,
      initiatedByUserId: rajUser.id,
      proposedFeedPolicy: 'unified_feed',
      fromPersonId: kabirM.id,
      status: 'accepted',
    },
  });

  await prisma.bridgeLink.create({
    data: {
      connectionId: connection.id,
      familyAId: sharma.id,
      personAId: vikram.id,
      familyBId: mehta.id,
      personBId: aisha.id,
      linkType: 'spouse',
    },
  });

  // Second marriage links Mehta to Kapoor, so Mehta sits in the middle.
  await prisma.bridgeLink.create({
    data: {
      connectionId: connection.id,
      familyAId: mehta.id,
      personAId: kabirM.id,
      familyBId: kapoor.id,
      personBId: tara.id,
      linkType: 'spouse',
    },
  });

  // Open app already on the connected view for every admin
  await prisma.userActiveContext.upsert({
    where: { userId: yashUser.id },
    create: {
      userId: yashUser.id,
      familyId: kapoor.id,
      connectionId: connection.id,
    },
    update: {
      familyId: kapoor.id,
      connectionId: connection.id,
    },
  });
  await prisma.userActiveContext.upsert({
    where: { userId: arjunUser.id },
    create: {
      userId: arjunUser.id,
      familyId: sharma.id,
      connectionId: connection.id,
    },
    update: {
      familyId: sharma.id,
      connectionId: connection.id,
    },
  });
  await prisma.userActiveContext.upsert({
    where: { userId: rajUser.id },
    create: {
      userId: rajUser.id,
      familyId: mehta.id,
      connectionId: connection.id,
    },
    update: {
      familyId: mehta.id,
      connectionId: connection.id,
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // GAMES — two finished rounds for the trophy shelf, two live to play
  // ═══════════════════════════════════════════════════════════════════
  const candidates = [
    robert,
    priya,
    arjun,
    meera,
    vikram,
    neha,
    kabirS,
    rohan,
    dev,
    ananya,
  ].map((p) => ({ personId: p.id }));

  await seedRound({
    familyId: sharma.id,
    hostUserId: meeraUser.id,
    type: 'family_awards',
    prompt: 'Best cook in the family',
    entries: candidates,
    votes: [
      { voterUserId: arjunUser.id, personId: priya.id },
      { voterUserId: meeraUser.id, personId: priya.id },
      { voterUserId: vikramUser.id, personId: priya.id },
      { voterUserId: nehaUser.id, personId: meera.id },
    ],
    status: 'closed',
    closesInHours: -48,
    createdHoursAgo: 72,
  });

  await seedRound({
    familyId: sharma.id,
    hostUserId: arjunUser.id,
    type: 'family_awards',
    prompt: 'Most likely to be late to a wedding',
    entries: candidates,
    votes: [
      { voterUserId: arjunUser.id, personId: vikram.id },
      { voterUserId: meeraUser.id, personId: vikram.id },
      { voterUserId: nehaUser.id, personId: arjun.id },
      { voterUserId: vikramUser.id, personId: neha.id },
    ],
    status: 'closed',
    closesInHours: -6,
    createdHoursAgo: 30,
  });

  // Live: Arjun has not voted yet, so logging in as him lands on a real turn
  await seedRound({
    familyId: sharma.id,
    hostUserId: nehaUser.id,
    type: 'family_awards',
    prompt: 'Craziest laugh',
    entries: candidates,
    votes: [
      { voterUserId: meeraUser.id, personId: kabirS.id },
      { voterUserId: vikramUser.id, personId: robert.id },
      { voterUserId: nehaUser.id, personId: kabirS.id },
    ],
    status: 'voting',
    closesInHours: 20,
    createdHoursAgo: 4,
  });

  await seedRound({
    familyId: sharma.id,
    hostUserId: meeraUser.id,
    type: 'caption_battle',
    prompt: 'Caption this',
    photoUrl: 'https://picsum.photos/seed/sharmapicnic/800/600',
    entries: [
      { personId: meera.id, text: 'When Dad says “just one more photo”' },
      { personId: vikram.id, text: 'Nobody move — the cake is watching' },
      { personId: neha.id, text: 'Family photo, attempt number 47' },
    ],
    votes: [
      { voterUserId: vikramUser.id, personId: meera.id },
      { voterUserId: nehaUser.id, personId: vikram.id },
    ],
    status: 'voting',
    closesInHours: 8,
    createdHoursAgo: 2,
  });

  // ═══════════════════════════════════════════════════════════════════
  // OCCASIONS — birthdays come from the tree, these are the rest
  // ═══════════════════════════════════════════════════════════════════
  const anniversary = (
    familyId: string,
    createdByUserId: string,
    a: { id: string },
    b: { id: string },
    date: Date,
  ) =>
    prisma.occasion.create({
      data: {
        familyId,
        createdByUserId,
        type: 'anniversary',
        date,
        personAId: a.id,
        personBId: b.id,
      },
    });

  await anniversary(sharma.id, arjunUser.id, robert, priya, birth(1978, 11, 26));
  await anniversary(sharma.id, arjunUser.id, arjun, meera, birth(2007, 8, 2));
  await anniversary(mehta.id, rajUser.id, raj, sunita, birth(1983, 7, 27));
  await anniversary(kapoor.id, yashUser.id, yash, nina, birth(1986, 2, 9));

  // The wedding that joined the two families
  await prisma.occasion.create({
    data: {
      familyId: sharma.id,
      createdByUserId: arjunUser.id,
      type: 'anniversary',
      title: 'Vikram & Aisha — wedding day',
      date: birth(2026, 6, 14),
      personAId: vikram.id,
      personBId: aisha.id,
    },
  });

  await prisma.occasion.create({
    data: {
      familyId: sharma.id,
      createdByUserId: arjunUser.id,
      type: 'custom',
      title: 'Sharma family reunion',
      date: birth(2019, 8, 15),
    },
  });

  console.log('');
  console.log('Seeded Sharma 💕 Mehta 💕 Kapoor — three families, one connection');
  console.log('────────────────────────────────────────────');
  console.log(`  connection:  ${connection.name} (${connection.id})`);
  console.log(`  bridges:     Vikram Sharma ↔ Aisha Mehta`);
  console.log(`               Kabir Mehta  ↔ Tara Kapoor`);
  console.log('');
  console.log('  Sharma admin: Arjun  phone', SHARMA_ADMIN_PHONE, '  code SHARMA01');
  console.log('  Mehta admin:  Raj    phone', MEHTA_ADMIN_PHONE, '  code MEHTA01');
  console.log('  Kapoor admin: Yash   phone', KAPOOR_ADMIN_PHONE, '  code KAPOOR01');
  console.log('');
  console.log('  Robert ══ Priya         Raj ══ Sunita          Yash ══ Nina');
  console.log('      │                       │                      │');
  console.log('      ├── Arjun ══ Meera      ├── Aisha ◄─💕─► Vikram ├── Tara ◄─💕─► Kabir');
  console.log('      │       └── (4 kids)    └── Kabir ◄─💕─► Tara   └── Ishaan');
  console.log('      ├── Vikram');
  console.log('      └── Neha');
  console.log('');
  console.log('  All three admins approved; Tree opens on the connected graphs.');
  console.log('');
  console.log('  Circles (3 families ⇒ 3C2 + 3C3 = 4 rooms, auto-created)');
  console.log('    · Mehta · Sharma      · Kapoor · Sharma      · Kapoor · Mehta');
  console.log('    · Kapoor · Mehta · Sharma  (everyone)');
  console.log('    Hold any face in the tree to see their status and message them.');
  console.log('');
  console.log('  Games (Sharma family)');
  console.log('    · Craziest laugh — voting open, Arjun has not voted');
  console.log('    · Caption Battle — 3 anonymous captions, voting open');
  console.log('    · Finished: Best cook (Priya), Late to a wedding (Vikram)');
  console.log('');
  console.log('  Coming up (birthdays from the tree + seeded occasions)');
  console.log('    · Raj & Sunita anniversary, Neha birthday, Arjun & Meera');
  console.log('    · Reunion, Priya birthday, then Kabir Mehta via the wedding');
  console.log('');
  console.log('  Extra logins  Meera', MEERA_PHONE, '· Vikram', VIKRAM_PHONE);
  console.log('                Neha ', NEHA_PHONE, '· Aisha ', AISHA_PHONE);
  console.log('                Tara ', TARA_PHONE);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
