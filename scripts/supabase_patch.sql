-- ==================================================
-- Supabase Consolidated Database Migration Patch
-- Generated at: 2026. 7. 21. 오후 2:14:39
-- ==================================================

-- [보완] products 테이블 누락 컬럼 추가 DDL
ALTER TABLE products ADD COLUMN IF NOT EXISTS "safetyCertUrl" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "specSheetUrl" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "emergencyGuideUrl" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;

-- [생성] cash_flow_snapshots 테이블 추가
CREATE TABLE cash_flow_snapshots (
    id TEXT PRIMARY KEY,
    "snapshotDate" TEXT NOT NULL,
    "startingBalance" BIGINT NOT NULL,
    "projectedInflow" BIGINT NOT NULL,
    "projectedOpex" BIGINT NOT NULL,
    "projectedCapex" BIGINT NOT NULL,
    "projectedFinalBalance" BIGINT NOT NULL,
    notes TEXT,
    "createdAt" TEXT NOT NULL
);

