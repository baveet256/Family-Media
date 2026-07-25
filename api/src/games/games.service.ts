import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRoundDto, SubmitEntryDto, VoteDto } from './dto/games.dto';
import { suggestPrompts } from './prompts';

const HOUR_MS = 60 * 60 * 1000;

type PersonCard = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isPlaceholder: boolean;
};

const personSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  isPlaceholder: true,
  userId: true,
} as const;

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

function toCard(person: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isPlaceholder: boolean;
}): PersonCard {
  return {
    id: person.id,
    displayName: person.displayName,
    avatarUrl: person.avatarUrl,
    isPlaceholder: person.isPlaceholder,
  };
}

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireActiveMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }
    return membership;
  }

  suggestions() {
    return suggestPrompts();
  }

  // ── Round lifecycle ───────────────────────────────────────────────

  async createRound(userId: string, dto: CreateRoundDto) {
    await this.requireActiveMember(dto.familyId, userId);

    if (dto.type === 'caption_battle' && !dto.photoUrl) {
      throw new BadRequestException('Caption battle needs a photo');
    }

    const closesAt = new Date(Date.now() + (dto.durationHours ?? 24) * HOUR_MS);

    // Awards go straight to voting (everyone on the tree is already a
    // candidate); caption battle collects submissions first.
    const status = dto.type === 'caption_battle' ? 'submitting' : 'voting';

    const round = await this.prisma.gameRound.create({
      data: {
        familyId: dto.familyId,
        createdByUserId: userId,
        type: dto.type,
        prompt: dto.prompt.trim(),
        photoUrl: dto.photoUrl ?? null,
        status,
        closesAt,
      },
    });

    if (dto.type === 'family_awards') {
      await this.syncAwardCandidates(round.id, dto.familyId);
    }

    const members = await this.activeMemberIds(dto.familyId);
    await this.notifications.notifyMany(
      members.filter((id) => id !== userId),
      {
        type: 'game_round_open',
        title: dto.type === 'family_awards' ? 'Family Awards' : 'Caption Battle',
        body: round.prompt,
        data: { roundId: round.id, familyId: dto.familyId },
      },
    );

    return { round: await this.getRound(round.id, userId) };
  }

  /**
   * Everyone on the family tree is a candidate in an awards round — including
   * relatives who aren't on the app, which is half the fun.
   */
  private async syncAwardCandidates(roundId: string, familyId: string) {
    const persons = await this.prisma.person.findMany({
      where: { familyId },
      select: { id: true },
    });
    if (!persons.length) return;
    await this.prisma.gameEntry.createMany({
      data: persons.map((p) => ({ roundId, personId: p.id })),
      skipDuplicates: true,
    });
  }

  private async activeMemberIds(familyId: string) {
    const rows = await this.prisma.familyMembership.findMany({
      where: { familyId, status: 'active' },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private async requireMyPerson(familyId: string, userId: string) {
    const person = await this.prisma.person.findFirst({
      where: { familyId, userId },
      select: { id: true },
    });
    if (!person) {
      throw new BadRequestException('You are not on this family tree yet');
    }
    return person;
  }

  async submitEntry(roundId: string, userId: string, dto: SubmitEntryDto) {
    const round = await this.loadRound(roundId);
    await this.requireActiveMember(round.familyId, userId);

    if (round.type !== 'caption_battle') {
      throw new BadRequestException('This round has no submissions');
    }
    if (round.status !== 'submitting') {
      throw new BadRequestException('Submissions are closed for this round');
    }

    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Caption cannot be empty');

    const person = await this.requireMyPerson(round.familyId, userId);

    await this.prisma.gameEntry.upsert({
      where: { roundId_personId: { roundId, personId: person.id } },
      create: { roundId, personId: person.id, text },
      update: { text },
    });

    return { round: await this.getRound(roundId, userId) };
  }

  async vote(roundId: string, userId: string, dto: VoteDto) {
    const round = await this.loadRound(roundId);
    await this.requireActiveMember(round.familyId, userId);
    await this.settleIfExpired(round);

    if (round.status !== 'voting') {
      throw new BadRequestException(
        round.status === 'closed'
          ? 'This round is already closed'
          : 'Voting has not started yet',
      );
    }

    const entry = await this.prisma.gameEntry.findUnique({
      where: { id: dto.entryId },
      include: { person: { select: { userId: true } } },
    });
    if (!entry || entry.roundId !== roundId) {
      throw new NotFoundException('Entry not found in this round');
    }
    if (round.type === 'caption_battle' && entry.person.userId === userId) {
      throw new BadRequestException('You cannot vote for your own caption');
    }

    await this.prisma.gameVote.upsert({
      where: { roundId_voterUserId: { roundId, voterUserId: userId } },
      create: { roundId, voterUserId: userId, entryId: dto.entryId },
      update: { entryId: dto.entryId },
    });

    return { round: await this.getRound(roundId, userId) };
  }

  /** Host moves the round forward: submissions → voting → results. */
  async advance(roundId: string, userId: string) {
    const round = await this.loadRound(roundId);
    const membership = await this.requireActiveMember(round.familyId, userId);
    if (round.createdByUserId !== userId && membership.role !== 'admin') {
      throw new ForbiddenException('Only the host or an admin can do that');
    }

    if (round.status === 'submitting') {
      const entries = await this.prisma.gameEntry.count({ where: { roundId } });
      if (entries < 2) {
        throw new BadRequestException('Need at least two captions before voting');
      }
      await this.prisma.gameRound.update({
        where: { id: roundId },
        data: { status: 'voting' },
      });
    } else if (round.status === 'voting') {
      await this.close(roundId);
    }

    return { round: await this.getRound(roundId, userId) };
  }

  /** Pick the winner and reveal. Ties go to the earliest entry. */
  private async close(roundId: string) {
    const round = await this.prisma.gameRound.findUnique({
      where: { id: roundId },
      include: {
        entries: {
          orderBy: { createdAt: 'asc' },
          include: {
            person: { select: personSelect },
            _count: { select: { votes: true } },
          },
        },
      },
    });
    if (!round || round.status === 'closed') return;

    const ranked = [...round.entries].sort(
      (a, b) => b._count.votes - a._count.votes,
    );
    const top = ranked[0];
    const winner = top && top._count.votes > 0 ? top : null;

    await this.prisma.gameRound.update({
      where: { id: roundId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        winnerEntryId: winner?.id ?? null,
      },
    });

    if (winner) {
      const members = await this.activeMemberIds(round.familyId);
      await this.notifications.notifyMany(members, {
        type: 'game_round_result',
        title: `${round.prompt} — results are in`,
        body: `${winner.person.displayName} wins with ${winner._count.votes} vote${
          winner._count.votes === 1 ? '' : 's'
        }`,
        data: { roundId, familyId: round.familyId },
      });
    }
  }

  private async settleIfExpired(round: {
    id: string;
    status: string;
    closesAt: Date;
  }) {
    if (round.status !== 'closed' && round.closesAt.getTime() <= Date.now()) {
      await this.close(round.id);
      return true;
    }
    return false;
  }

  private async settleExpiredForFamily(familyId: string) {
    const expired = await this.prisma.gameRound.findMany({
      where: {
        familyId,
        status: { not: 'closed' },
        closesAt: { lte: new Date() },
      },
      select: { id: true },
    });
    for (const r of expired) {
      await this.close(r.id);
    }
  }

  private async loadRound(roundId: string) {
    const round = await this.prisma.gameRound.findUnique({
      where: { id: roundId },
    });
    if (!round) throw new NotFoundException('Round not found');
    return round;
  }

  // ── Reads ─────────────────────────────────────────────────────────

  async getRound(roundId: string, userId: string) {
    const initial = await this.loadRound(roundId);
    await this.requireActiveMember(initial.familyId, userId);
    await this.settleIfExpired(initial);

    // People added to the tree mid-round still get nominated
    if (initial.type === 'family_awards' && initial.status === 'voting') {
      await this.syncAwardCandidates(roundId, initial.familyId);
    }

    const round = await this.prisma.gameRound.findUniqueOrThrow({
      where: { id: roundId },
      include: {
        createdBy: { select: userSelect },
        entries: {
          orderBy: { createdAt: 'asc' },
          include: {
            person: { select: personSelect },
            _count: { select: { votes: true } },
          },
        },
        votes: { where: { voterUserId: userId }, select: { entryId: true } },
        _count: { select: { votes: true } },
      },
    });

    const closed = round.status === 'closed';
    const myVoteEntryId = round.votes[0]?.entryId ?? null;
    // Captions are judged blind so nobody votes for the name they recognise
    const hideAuthors = round.type === 'caption_battle' && !closed;

    const visibleEntries = round.entries.filter(
      (e) => round.status !== 'submitting' || e.person.userId === userId,
    );

    const entries = visibleEntries.map((e) => {
      const isMine = e.person.userId === userId;
      return {
        id: e.id,
        text: e.text,
        subject: hideAuthors && !isMine ? null : toCard(e.person),
        isMine,
        votes: closed ? e._count.votes : null,
        votedByMe: myVoteEntryId === e.id,
      };
    });

    const winnerEntry = round.winnerEntryId
      ? round.entries.find((e) => e.id === round.winnerEntryId)
      : null;

    const memberCount = (await this.activeMemberIds(round.familyId)).length;

    return {
      id: round.id,
      familyId: round.familyId,
      type: round.type,
      prompt: round.prompt,
      photoUrl: round.photoUrl,
      status: round.status,
      closesAt: round.closesAt,
      closedAt: round.closedAt,
      createdAt: round.createdAt,
      createdBy: round.createdBy,
      memberCount,
      entryCount: round.entries.length,
      voteCount: round._count.votes,
      myVoteEntryId,
      mySubmitted: round.entries.some(
        (e) => e.person.userId === userId && !!e.text,
      ),
      isHost: round.createdByUserId === userId,
      entries,
      winner: winnerEntry
        ? {
            entryId: winnerEntry.id,
            text: winnerEntry.text,
            subject: toCard(winnerEntry.person),
            votes: winnerEntry._count.votes,
          }
        : null,
    };
  }

  /** Games tab: what's live, what just finished, and who's winning overall. */
  async getHub(familyId: string, userId: string) {
    await this.requireActiveMember(familyId, userId);
    await this.settleExpiredForFamily(familyId);

    const rounds = await this.prisma.gameRound.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        createdBy: { select: userSelect },
        entries: {
          include: {
            person: { select: personSelect },
            _count: { select: { votes: true } },
          },
        },
        votes: { where: { voterUserId: userId }, select: { entryId: true } },
        _count: { select: { votes: true } },
      },
    });

    const summarize = (r: (typeof rounds)[number]) => {
      const winnerEntry = r.winnerEntryId
        ? r.entries.find((e) => e.id === r.winnerEntryId)
        : null;
      return {
        id: r.id,
        type: r.type,
        prompt: r.prompt,
        photoUrl: r.photoUrl,
        status: r.status,
        closesAt: r.closesAt,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        entryCount: r.entries.length,
        voteCount: r._count.votes,
        myVoteEntryId: r.votes[0]?.entryId ?? null,
        mySubmitted: r.entries.some(
          (e) => e.person.userId === userId && !!e.text,
        ),
        winner: winnerEntry
          ? {
              entryId: winnerEntry.id,
              text: winnerEntry.text,
              subject: toCard(winnerEntry.person),
              votes: winnerEntry._count.votes,
            }
          : null,
      };
    };

    const active = rounds.filter((r) => r.status !== 'closed').map(summarize);
    const finished = rounds
      .filter((r) => r.status === 'closed')
      .slice(0, 10)
      .map(summarize);

    // Trophy shelf — wins across every game, which is what makes the hub
    // feel like one product instead of separate toys.
    const wins = new Map<string, { person: PersonCard; wins: number }>();
    for (const r of rounds) {
      if (r.status !== 'closed' || !r.winnerEntryId) continue;
      const entry = r.entries.find((e) => e.id === r.winnerEntryId);
      if (!entry) continue;
      const current = wins.get(entry.personId);
      if (current) current.wins += 1;
      else wins.set(entry.personId, { person: toCard(entry.person), wins: 1 });
    }

    const trophies = [...wins.values()].sort((a, b) => b.wins - a.wins);

    return {
      active,
      finished,
      trophies,
      suggestions: suggestPrompts(4),
    };
  }
}
