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

-- [보완 2026-07-29] deliveries 테이블 CHECK 제약 조건 업데이트 ('교환' 추가)
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_dispatchCategory_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_dispatchCategory_check CHECK ("dispatchCategory" IN ('출고', '입고', '반납', '정비', '이동', '교환'));

-- [보완 2026-07-30] contract_history 테이블 컬럼 및 제약조건 보강
ALTER TABLE contract_history ADD COLUMN IF NOT EXISTS "prevEndDate" TEXT;
ALTER TABLE contract_history ADD COLUMN IF NOT EXISTS "newEndDate" TEXT;
ALTER TABLE contract_history DROP CONSTRAINT IF EXISTS contract_history_changeType_check;
ALTER TABLE contract_history ADD CONSTRAINT contract_history_changeType_check CHECK ("changeType" IN ('REGISTER', 'EXTEND', 'SHORTEN', 'SUCCEED', 'TERMINATE', 'EXCHANGE'));

-- [보완 2026-07-30] contracts 테이블 승계 전(predecessor) 이력 추적 컬럼 추가
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "successorContractId" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "predecessorContractId" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "predecessorContractNo" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "predecessorCustomerId" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "predecessorCustomerName" TEXT;

-- [보완 2026-07-30] customers 테이블 청구서(세금계산서) 및 거래명세서 마감일 컬럼 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "defaultBillingDay" INTEGER DEFAULT 30;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "defaultStatementClosingDay" INTEGER DEFAULT 25;

