-- CreateEnum
CREATE TYPE "FeedPolicy" AS ENUM ('unified_feed', 'separate_feeds');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('pending', 'active', 'dissolved');

-- CreateEnum
CREATE TYPE "ConnectionMemberStatus" AS ENUM ('pending', 'active', 'left');

-- CreateEnum
CREATE TYPE "ConnectionInviteStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "BridgeLinkType" AS ENUM ('spouse', 'other');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "connection_id" UUID;

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "feed_policy" "FeedPolicy" NOT NULL DEFAULT 'separate_feeds',
    "status" "ConnectionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_memberships" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "status" "ConnectionMemberStatus" NOT NULL DEFAULT 'pending',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_links" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "family_a_id" UUID NOT NULL,
    "person_a_id" UUID NOT NULL,
    "family_b_id" UUID NOT NULL,
    "person_b_id" UUID NOT NULL,
    "link_type" "BridgeLinkType" NOT NULL DEFAULT 'spouse',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bridge_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_invites" (
    "id" UUID NOT NULL,
    "connection_id" UUID,
    "from_family_id" UUID NOT NULL,
    "to_family_id" UUID NOT NULL,
    "initiated_by_user_id" UUID NOT NULL,
    "proposed_name" TEXT,
    "proposed_feed_policy" "FeedPolicy" NOT NULL DEFAULT 'separate_feeds',
    "status" "ConnectionInviteStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_active_context" (
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "connection_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_active_context_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "connection_memberships_family_id_idx" ON "connection_memberships"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "connection_memberships_connection_id_family_id_key" ON "connection_memberships"("connection_id", "family_id");

-- CreateIndex
CREATE INDEX "bridge_links_connection_id_idx" ON "bridge_links"("connection_id");

-- CreateIndex
CREATE INDEX "connection_invites_to_family_id_status_idx" ON "connection_invites"("to_family_id", "status");

-- CreateIndex
CREATE INDEX "connection_invites_from_family_id_status_idx" ON "connection_invites"("from_family_id", "status");

-- CreateIndex
CREATE INDEX "user_active_context_family_id_idx" ON "user_active_context"("family_id");

-- CreateIndex
CREATE INDEX "posts_connection_id_created_at_idx" ON "posts"("connection_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_memberships" ADD CONSTRAINT "connection_memberships_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_memberships" ADD CONSTRAINT "connection_memberships_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_links" ADD CONSTRAINT "bridge_links_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_links" ADD CONSTRAINT "bridge_links_family_a_id_fkey" FOREIGN KEY ("family_a_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_links" ADD CONSTRAINT "bridge_links_family_b_id_fkey" FOREIGN KEY ("family_b_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_links" ADD CONSTRAINT "bridge_links_person_a_id_fkey" FOREIGN KEY ("person_a_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_links" ADD CONSTRAINT "bridge_links_person_b_id_fkey" FOREIGN KEY ("person_b_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_invites" ADD CONSTRAINT "connection_invites_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_invites" ADD CONSTRAINT "connection_invites_from_family_id_fkey" FOREIGN KEY ("from_family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_invites" ADD CONSTRAINT "connection_invites_to_family_id_fkey" FOREIGN KEY ("to_family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_invites" ADD CONSTRAINT "connection_invites_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_active_context" ADD CONSTRAINT "user_active_context_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_active_context" ADD CONSTRAINT "user_active_context_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_active_context" ADD CONSTRAINT "user_active_context_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
