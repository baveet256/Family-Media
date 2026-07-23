-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_views" (
    "story_id" UUID NOT NULL,
    "viewer_user_id" UUID NOT NULL,
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_views_pkey" PRIMARY KEY ("story_id","viewer_user_id")
);

-- CreateIndex
CREATE INDEX "stories_family_id_expires_at_idx" ON "stories"("family_id", "expires_at");

-- CreateIndex
CREATE INDEX "stories_author_user_id_created_at_idx" ON "stories"("author_user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
