CREATE TABLE "User" (
 "id" TEXT NOT NULL, "googleSub" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "Session" (
 "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "ResumeTemplate" (
 "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "style" TEXT NOT NULL,
 "ats" BOOLEAN NOT NULL DEFAULT true, "active" BOOLEAN NOT NULL DEFAULT true, "priceCents" INTEGER NOT NULL DEFAULT 1990,
 CONSTRAINT "ResumeTemplate_pkey" PRIMARY KEY ("id"), CONSTRAINT "ResumeTemplate_price_positive" CHECK ("priceCents">0)
);
CREATE TABLE "Resume" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "templateId" TEXT NOT NULL, "data" JSONB NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Resume_userId_updatedAt_idx" ON "Resume"("userId","updatedAt");
CREATE TABLE "ResumeSection" (
 "id" TEXT NOT NULL, "resumeId" TEXT NOT NULL, "kind" TEXT NOT NULL, "position" INTEGER NOT NULL,
 "visible" BOOLEAN NOT NULL DEFAULT true, "data" JSONB NOT NULL, CONSTRAINT "ResumeSection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResumeSection_resumeId_position_key" ON "ResumeSection"("resumeId","position");
CREATE TABLE "Order" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "resumeId" TEXT NOT NULL, "templateId" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 "revision" INTEGER NOT NULL, "amountCents" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'BRL',
 "status" TEXT NOT NULL DEFAULT 'created', "requestKey" TEXT NOT NULL, "preferenceId" TEXT, "checkoutUrl" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Order_amount_positive" CHECK ("amountCents">0)
);
CREATE UNIQUE INDEX "Order_userId_requestKey_key" ON "Order"("userId","requestKey");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId","createdAt");
CREATE TABLE "Payment" (
 "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
 "orderId" TEXT NOT NULL, "status" TEXT NOT NULL, "amountCents" INTEGER NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_providerId_key" ON "Payment"("providerId");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE TABLE "DownloadEntitlement" (
 "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DownloadEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DownloadEntitlement_orderId_key" ON "DownloadEntitlement"("orderId");
CREATE TABLE "AuditLog" (
 "id" TEXT NOT NULL, "userId" TEXT, "action" TEXT NOT NULL, "resourceId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId","createdAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ResumeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResumeSection" ADD CONSTRAINT "ResumeSection_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ResumeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadEntitlement" ADD CONSTRAINT "DownloadEntitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
