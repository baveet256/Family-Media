import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TreeService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status === 'removed') {
      throw new ForbiddenException('Not a member of this family');
    }
    // Pending members can view tree to pick parents during onboarding
    return membership;
  }

  async getTree(familyId: string, userId: string) {
    await this.requireMember(familyId, userId);

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
    });
    if (!family) throw new NotFoundException('Family not found');

    const [persons, relationships] = await Promise.all([
      this.prisma.person.findMany({
        where: { familyId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.relationship.findMany({
        where: { familyId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      family: {
        id: family.id,
        name: family.name,
        avatarUrl: family.avatarUrl,
      },
      nodes: persons.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        userId: p.userId,
        isPlaceholder: p.isPlaceholder,
        phone: p.phone,
      })),
      edges: relationships.map((r) => ({
        id: r.id,
        fromPersonId: r.fromPersonId,
        toPersonId: r.toPersonId,
        type: r.type,
        source: r.source,
      })),
    };
  }

  async listPersons(familyId: string, userId: string) {
    await this.requireMember(familyId, userId);
    const persons = await this.prisma.person.findMany({
      where: { familyId },
      orderBy: { displayName: 'asc' },
    });
    return {
      persons: persons.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        userId: p.userId,
        isPlaceholder: p.isPlaceholder,
      })),
    };
  }

  async getPerson(personId: string, userId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });
    if (!person) throw new NotFoundException('Person not found');
    await this.requireMember(person.familyId, userId);

    const [asChild, asParent, spouses, siblings] = await Promise.all([
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'parent_of',
          toPersonId: personId,
        },
        include: { fromPerson: true },
      }),
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'parent_of',
          fromPersonId: personId,
        },
        include: { toPerson: true },
      }),
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'spouse_of',
          OR: [{ fromPersonId: personId }, { toPersonId: personId }],
        },
        include: { fromPerson: true, toPerson: true },
      }),
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'sibling_of',
          OR: [{ fromPersonId: personId }, { toPersonId: personId }],
        },
        include: { fromPerson: true, toPerson: true },
      }),
    ]);

    const parents = asChild.map((r) => ({
      id: r.fromPerson.id,
      displayName: r.fromPerson.displayName,
      isPlaceholder: r.fromPerson.isPlaceholder,
    }));
    const children = asParent.map((r) => ({
      id: r.toPerson.id,
      displayName: r.toPerson.displayName,
      isPlaceholder: r.toPerson.isPlaceholder,
    }));
    const spouseList = spouses.map((r) => {
      const other =
        r.fromPersonId === personId ? r.toPerson : r.fromPerson;
      return {
        id: other.id,
        displayName: other.displayName,
        isPlaceholder: other.isPlaceholder,
      };
    });
    const siblingList = siblings.map((r) => {
      const other =
        r.fromPersonId === personId ? r.toPerson : r.fromPerson;
      return {
        id: other.id,
        displayName: other.displayName,
        isPlaceholder: other.isPlaceholder,
      };
    });

    const parts: string[] = [];
    if (parents.length) {
      parts.push(`child of ${parents.map((p) => p.displayName).join(' & ')}`);
    }
    if (spouseList.length) {
      parts.push(
        `spouse of ${spouseList.map((p) => p.displayName).join(', ')}`,
      );
    }
    if (siblingList.length) {
      parts.push(
        `sibling of ${siblingList.map((p) => p.displayName).join(', ')}`,
      );
    }

    return {
      person: {
        id: person.id,
        familyId: person.familyId,
        displayName: person.displayName,
        avatarUrl: person.avatarUrl,
        userId: person.userId,
        isPlaceholder: person.isPlaceholder,
        phone: person.phone,
      },
      parents,
      children,
      spouses: spouseList,
      siblings: siblingList,
      summary: parts.length ? parts.join('; ') : 'No relationships yet',
    };
  }
}
