import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOccasionDto } from './dto/calendar.dto';
import { nextOccurrence, startOfToday, toIsoDate } from './dates';

type PersonCard = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type UpcomingItem = {
  key: string;
  kind: 'birthday' | 'anniversary' | 'remembrance' | 'custom';
  title: string;
  subtitle: string | null;
  date: string;
  daysUntil: number;
  years: number | null;
  people: PersonCard[];
  /** Set when the date belongs to a family we're connected to */
  viaTag: string | null;
  familyName: string | null;
  occasionId: string | null;
};

const personSelect = {
  id: true,
  displayName: true,
  firstName: true,
  avatarUrl: true,
  birthDate: true,
  deathDate: true,
} as const;

function card(p: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}): PersonCard {
  return { id: p.id, displayName: p.displayName, avatarUrl: p.avatarUrl };
}

function possessive(name: string) {
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireActiveMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }
    return membership;
  }

  /**
   * Families reachable through an active connection, with the label we show
   * so people know why a stranger's birthday is on their list.
   */
  private async connectedFamilies(familyId: string) {
    const memberships = await this.prisma.connectionMembership.findMany({
      where: {
        familyId,
        status: 'active',
        connection: { status: 'active' },
      },
      include: {
        connection: {
          include: {
            memberships: {
              where: { status: 'active', familyId: { not: familyId } },
              include: { family: { select: { id: true, name: true } } },
            },
            bridgeLinks: {
              include: {
                personA: { select: { firstName: true, displayName: true } },
                personB: { select: { firstName: true, displayName: true } },
              },
            },
          },
        },
      },
    });

    const out = new Map<string, { name: string; viaTag: string }>();
    for (const cm of memberships) {
      const conn = cm.connection;
      const bridge = conn.bridgeLinks[0];
      const couple = bridge
        ? `${bridge.personA.firstName || bridge.personA.displayName} & ${
            bridge.personB.firstName || bridge.personB.displayName
          }`
        : null;
      const label = conn.name?.trim() || couple || 'connection';
      for (const other of conn.memberships) {
        if (!out.has(other.family.id)) {
          out.set(other.family.id, {
            name: other.family.name,
            viaTag: `via ${label}`,
          });
        }
      }
    }
    return out;
  }

  async getUpcoming(
    familyId: string,
    userId: string,
    opts: { days?: number; limit?: number } = {},
  ) {
    await this.requireActiveMember(familyId, userId);

    const days = opts.days ?? 365;
    const limit = opts.limit ?? 60;
    const today = startOfToday();

    const connected = await this.connectedFamilies(familyId);
    const familyIds = [familyId, ...connected.keys()];

    const [persons, occasions] = await Promise.all([
      this.prisma.person.findMany({
        where: { familyId: { in: familyIds } },
        select: { ...personSelect, familyId: true },
      }),
      this.prisma.occasion.findMany({
        where: { familyId: { in: familyIds } },
        include: {
          personA: { select: personSelect },
          personB: { select: personSelect },
        },
      }),
    ]);

    const items: UpcomingItem[] = [];

    const tagsFor = (fid: string) => {
      const meta = connected.get(fid);
      return {
        viaTag: meta?.viaTag ?? null,
        familyName: meta?.name ?? null,
      };
    };

    for (const p of persons) {
      const tags = tagsFor(p.familyId);

      if (p.deathDate) {
        // A remembrance day rather than a birthday — same date maths, different tone
        const when = nextOccurrence(p.deathDate, today);
        items.push({
          key: `remembrance:${p.id}`,
          kind: 'remembrance',
          title: `Remembering ${p.displayName}`,
          subtitle: when.years > 0 ? `${when.years} years` : null,
          date: toIsoDate(when.dateMs),
          daysUntil: when.daysUntil,
          years: when.years,
          people: [card(p)],
          ...tags,
          occasionId: null,
        });
        continue;
      }

      if (!p.birthDate) continue;
      const when = nextOccurrence(p.birthDate, today);
      items.push({
        key: `birthday:${p.id}`,
        kind: 'birthday',
        title: `${possessive(p.firstName || p.displayName)} birthday`,
        subtitle: when.years > 0 ? `turns ${when.years}` : null,
        date: toIsoDate(when.dateMs),
        daysUntil: when.daysUntil,
        years: when.years,
        people: [card(p)],
        ...tags,
        occasionId: null,
      });
    }

    for (const o of occasions) {
      const when = nextOccurrence(o.date, today);
      const people = [o.personA, o.personB].filter(
        (p): p is NonNullable<typeof p> => p != null,
      );

      const defaultTitle =
        o.type === 'anniversary' && people.length === 2
          ? `${people[0].firstName || people[0].displayName} & ${
              people[1].firstName || people[1].displayName
            } — anniversary`
          : 'Family occasion';

      items.push({
        key: `occasion:${o.id}`,
        kind: o.type,
        title: o.title?.trim() || defaultTitle,
        subtitle:
          o.type === 'anniversary' && when.years > 0
            ? `${when.years} years together`
            : null,
        date: toIsoDate(when.dateMs),
        daysUntil: when.daysUntil,
        years: when.years,
        people: people.map(card),
        ...tagsFor(o.familyId),
        occasionId: o.id,
      });
    }

    const upcoming = items
      .filter((i) => i.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title))
      .slice(0, limit);

    return {
      today: toIsoDate(today),
      items: upcoming,
      todayCount: upcoming.filter((i) => i.daysUntil === 0).length,
    };
  }

  async createOccasion(userId: string, dto: CreateOccasionDto) {
    await this.requireActiveMember(dto.familyId, userId);

    const personIds = [dto.personAId, dto.personBId].filter(
      (id): id is string => !!id,
    );
    if (personIds.length) {
      // A cross-family wedding is exactly the kind of date worth recording,
      // so people from connected families are fair game too.
      const connected = await this.connectedFamilies(dto.familyId);
      const count = await this.prisma.person.count({
        where: {
          id: { in: personIds },
          familyId: { in: [dto.familyId, ...connected.keys()] },
        },
      });
      if (count !== personIds.length) {
        throw new BadRequestException(
          'People must be from this family or a connected one',
        );
      }
    }
    if (dto.type === 'anniversary' && personIds.length !== 2) {
      throw new BadRequestException('An anniversary needs two people');
    }
    if (dto.type === 'custom' && !dto.title?.trim()) {
      throw new BadRequestException('Give the occasion a name');
    }

    const occasion = await this.prisma.occasion.create({
      data: {
        familyId: dto.familyId,
        type: dto.type,
        title: dto.title?.trim() || null,
        date: new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`),
        personAId: dto.personAId ?? null,
        personBId: dto.personBId ?? null,
        createdByUserId: userId,
      },
    });

    return { occasion };
  }

  async deleteOccasion(occasionId: string, userId: string) {
    const occasion = await this.prisma.occasion.findUnique({
      where: { id: occasionId },
    });
    if (!occasion) throw new NotFoundException('Occasion not found');

    const membership = await this.requireActiveMember(
      occasion.familyId,
      userId,
    );
    if (occasion.createdByUserId !== userId && membership.role !== 'admin') {
      throw new ForbiddenException('Only the creator or an admin can remove it');
    }

    await this.prisma.occasion.delete({ where: { id: occasionId } });
    return { ok: true };
  }
}
