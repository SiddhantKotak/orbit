-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('HOOK', 'POST');

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "skeleton" TEXT NOT NULL,
    "beats" TEXT[],
    "why" TEXT NOT NULL,
    "needs" TEXT[],
    "tags" TEXT[],
    "system" BOOLEAN NOT NULL DEFAULT true,
    "profileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSave" (
    "profileId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateSave_pkey" PRIMARY KEY ("profileId","templateId")
);

-- CreateTable
CREATE TABLE "TemplateUse" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "documentId" TEXT,
    "source" TEXT NOT NULL,
    "editRatio" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");

-- CreateIndex
CREATE INDEX "Template_type_category_idx" ON "Template"("type", "category");

-- CreateIndex
CREATE INDEX "Template_profileId_idx" ON "Template"("profileId");

-- CreateIndex
CREATE INDEX "TemplateUse_profileId_createdAt_idx" ON "TemplateUse"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "TemplateUse_templateId_idx" ON "TemplateUse"("templateId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSave" ADD CONSTRAINT "TemplateSave_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSave" ADD CONSTRAINT "TemplateSave_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateUse" ADD CONSTRAINT "TemplateUse_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateUse" ADD CONSTRAINT "TemplateUse_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateUse" ADD CONSTRAINT "TemplateUse_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
