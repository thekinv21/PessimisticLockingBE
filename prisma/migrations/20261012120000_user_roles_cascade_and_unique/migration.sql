-- DropForeignKey
ALTER TABLE "UserRoles" DROP CONSTRAINT "UserRoles_userId_fkey";

-- Remove duplicate role assignments so the unique index can be created
DELETE FROM "UserRoles" a
USING "UserRoles" b
WHERE a."userId" = b."userId"
  AND a."roleId" = b."roleId"
  AND a."id" > b."id";

-- CreateIndex
CREATE UNIQUE INDEX "UserRoles_userId_roleId_key" ON "UserRoles"("userId", "roleId");

-- AddForeignKey
ALTER TABLE "UserRoles" ADD CONSTRAINT "UserRoles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
