-- 기연리프트 ERP 시스템 데이터베이스 DDL 스키마 (Supabase PostgreSQL 호환)

-- 기존 테이블 삭제 (순서 주의: 자식 테이블 먼저)
DROP TABLE IF EXISTS repair_consumables CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS billing_details CASCADE;
DROP TABLE IF EXISTS billings CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS contract_history CASCADE;
DROP TABLE IF EXISTS contract_assets CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS consumable_logs CASCADE;
DROP TABLE IF EXISTS consumables CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customer_sites CASCADE;
DROP TABLE IF EXISTS customer_contacts CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. 사용자 테이블 (users)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    "loginId" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'MANAGER', 'USER', 'MECHANIC')),
    "createdAt" TEXT NOT NULL
);

-- 2. 메뉴 권한 테이블 (permissions)
CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT FALSE,
    "canSave" BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. 고객 테이블 (customers)
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "bizRegNo" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT FALSE,
    address TEXT,
    representative TEXT,
    "repContact" TEXT,
    "repEmail" TEXT,
    "driveFolderId" TEXT,
    "createdAt" TEXT NOT NULL
);

-- 4. 고객 담당자 테이블 (customer_contacts)
CREATE TABLE customer_contacts (
    id TEXT PRIMARY KEY,
    "customerId" TEXT REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT,
    contact TEXT,
    email TEXT,
    "createdAt" TEXT NOT NULL
);

-- 5. 고객 납품현장 테이블 (customer_sites)
CREATE TABLE customer_sites (
    id TEXT PRIMARY KEY,
    "customerId" TEXT REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    "contactName" TEXT,
    contact TEXT,
    email TEXT,
    "createdAt" TEXT NOT NULL
);

-- 6. 제품 마스터 테이블 (products)
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    "modelName" TEXT NOT NULL UNIQUE,
    feet INTEGER NOT NULL,
    spec TEXT,
    manufacturer TEXT,
    "createdAt" TEXT NOT NULL
);

-- 7. 자산 대장 테이블 (assets)
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    "modelName" TEXT REFERENCES products("modelName") ON UPDATE CASCADE,
    "assetNo" TEXT NOT NULL UNIQUE,
    "serialNo" TEXT,
    manufacturer TEXT,
    "ownerType" TEXT CHECK ("ownerType" IN ('OWNED', 'RENTED')) NOT NULL,
    status TEXT CHECK (status IN ('AVAILABLE', 'RENTED', 'REPAIRING', 'RENTED_RETURNED', 'SOLD')) NOT NULL,
    
    -- 현재 대여 관련 세부 (실시간 동기화)
    "currentCustomerId" TEXT,
    "currentSiteId" TEXT,
    "contractStart" TEXT,
    "contractEnd" TEXT,
    "billingDay" INTEGER,
    "monthlyRentalFee" DOUBLE PRECISION,
    "dailyRentalFee" DOUBLE PRECISION,

    -- 당사자산 상세
    "acquisitionDate" TEXT,
    "acquisitionPrice" DOUBLE PRECISION,
    "depreciationMonths" INTEGER,
    "residualValueRate" DOUBLE PRECISION,
    "accumDepreciation" DOUBLE PRECISION,
    "bookValue" DOUBLE PRECISION,
    "cumRentalFee" DOUBLE PRECISION DEFAULT 0,
    "cumRepairCost" DOUBLE PRECISION DEFAULT 0,

    -- 임차자산 상세
    renter TEXT,
    "rentStart" TEXT,
    "rentEnd" TEXT,
    "monthlyRentFee" DOUBLE PRECISION,
    "dailyRentFee" DOUBLE PRECISION,

    -- 매각 상세
    "disposalDate" TEXT,
    "disposalPrice" DOUBLE PRECISION,
    buyer TEXT,
    
    supplier TEXT,
    memo1 TEXT,
    memo2 TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 8. 소모품 테이블 (consumables)
CREATE TABLE consumables (
    id TEXT PRIMARY KEY,
    "modelName" TEXT NOT NULL UNIQUE,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    supplier TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 9. 소모품 입출고 로그 테이블 (consumable_logs)
CREATE TABLE consumable_logs (
    id TEXT PRIMARY KEY,
    "consumableId" TEXT REFERENCES consumables(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('INBOUND', 'OUTBOUND', 'ADJUST')) NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    supplier TEXT,
    "userId" TEXT,
    "targetAssetId" TEXT,
    "actionDate" TEXT NOT NULL,
    description TEXT,
    "createdAt" TEXT NOT NULL
);

-- 10. 계약 테이블 (contracts)
CREATE TABLE contracts (
    id TEXT PRIMARY KEY,
    "contractNo" TEXT NOT NULL UNIQUE,
    "customerId" TEXT REFERENCES customers(id),
    "contactId" TEXT,
    "siteId" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "billingDay" INTEGER NOT NULL DEFAULT 30,
    status TEXT CHECK (status IN ('ACTIVE', 'EXTENDED', 'SHORTENED', 'SUCCEEDED', 'COMPLETED')) NOT NULL,
    "successorContractId" TEXT,
    "driveFolderId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 11. 계약 상세 자산 테이블 (contract_assets)
CREATE TABLE contract_assets (
    id TEXT PRIMARY KEY,
    "contractId" TEXT REFERENCES contracts(id) ON DELETE CASCADE,
    "assetId" TEXT REFERENCES assets(id),
    "monthlyRentalFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyRentalFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

-- 12. 계약 이력 테이블 (contract_history)
CREATE TABLE contract_history (
    id TEXT PRIMARY KEY,
    "contractId" TEXT REFERENCES contracts(id) ON DELETE CASCADE,
    "changeType" TEXT CHECK ("changeType" IN ('REGISTER', 'EXTEND', 'SHORTEN', 'SUCCEED', 'TERMINATE')) NOT NULL,
    "changeDate" TEXT NOT NULL,
    "prevEndDate" TEXT,
    "newEndDate" TEXT,
    description TEXT,
    "createdAt" TEXT NOT NULL
);

-- 13. 배차 및 운송 테이블 (deliveries)
CREATE TABLE deliveries (
    id TEXT PRIMARY KEY,
    "contractId" TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('OUTBOUND', 'INBOUND')) NOT NULL,
    status TEXT CHECK (status IN ('REQUESTED', 'DISPATCHED', 'COMPLETED')) NOT NULL,
    "requestDate" TEXT NOT NULL,
    "scheduledDate" TEXT,
    "vehicleType" TEXT,
    "driverName" TEXT,
    "driverContact" TEXT,
    "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCostSettled" BOOLEAN NOT NULL DEFAULT FALSE,
    memo TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 14. 청구 테이블 (billings)
CREATE TABLE billings (
    id TEXT PRIMARY KEY,
    "customerId" TEXT REFERENCES customers(id),
    "billingYm" TEXT NOT NULL,
    "billingDate" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID')) NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 15. 청구 상세 테이블 (billing_details)
CREATE TABLE billing_details (
    id TEXT PRIMARY KEY,
    "billingId" TEXT REFERENCES billings(id) ON DELETE CASCADE,
    "contractAssetId" TEXT,
    "itemName" TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    description TEXT,
    "createdAt" TEXT NOT NULL
);

-- 16. 수납 테이블 (payments)
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    "billingId" TEXT REFERENCES billings(id) ON DELETE CASCADE,
    "paymentDate" TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    method TEXT NOT NULL,
    memo TEXT,
    "createdAt" TEXT NOT NULL
);

-- 17. 자산 수리 테이블 (repairs)
CREATE TABLE repairs (
    id TEXT PRIMARY KEY,
    "assetId" TEXT REFERENCES assets(id),
    "mechanicId" TEXT,
    "requestDate" TEXT NOT NULL,
    "repairDate" TEXT,
    status TEXT CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')) NOT NULL,
    details TEXT,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billableToCustomer" BOOLEAN NOT NULL DEFAULT FALSE,
    "billingId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 18. 수리 투입 자재 상세 테이블 (repair_consumables)
CREATE TABLE repair_consumables (
    id TEXT PRIMARY KEY,
    "repairId" TEXT REFERENCES repairs(id) ON DELETE CASCADE,
    "consumableId" TEXT REFERENCES consumables(id),
    quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    cost DOUBLE PRECISION NOT NULL DEFAULT 0
);

-- ==========================================
-- 초기 기초 데이터 시딩 (Seed Data)
-- ==========================================

-- 1. 사용자 시드
INSERT INTO users (id, "loginId", "passwordHash", name, department, role, "createdAt") VALUES
('u-1', 'admin', 'admin123', '김관리', '본사', 'ADMIN', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('u-2', 'manager', 'mgr123', '박부장', '영업부', 'MANAGER', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('u-3', 'user', 'user123', '이대리', '영업부', 'USER', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('u-4', 'mechanic', 'mech123', '최정비', '정비팀', 'MECHANIC', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

-- 2. 기본 메뉴별 권한 시드 (ADMIN)
INSERT INTO permissions (id, role, "menuId", "canView", "canSave") VALUES
('p-admin-customer', 'ADMIN', 'customer', true, true),
('p-admin-product', 'ADMIN', 'product', true, true),
('p-admin-asset', 'ADMIN', 'asset', true, true),
('p-admin-acquisition_disposal', 'ADMIN', 'acquisition_disposal', true, true),
('p-admin-rent_asset', 'ADMIN', 'rent_asset', true, true),
('p-admin-consumable', 'ADMIN', 'consumable', true, true),
('p-admin-contract', 'ADMIN', 'contract', true, true),
('p-admin-billing', 'ADMIN', 'billing', true, true),
('p-admin-delivery', 'ADMIN', 'delivery', true, true),
('p-admin-smart_dispatch', 'ADMIN', 'smart_dispatch', true, true),
('p-admin-repair', 'ADMIN', 'repair', true, true),
('p-admin-permission', 'ADMIN', 'permission', true, true);

-- 3. 기본 메뉴별 권한 시드 (MANAGER)
INSERT INTO permissions (id, role, "menuId", "canView", "canSave") VALUES
('p-mgr-customer', 'MANAGER', 'customer', true, true),
('p-mgr-product', 'MANAGER', 'product', true, true),
('p-mgr-asset', 'MANAGER', 'asset', true, true),
('p-mgr-acquisition_disposal', 'MANAGER', 'acquisition_disposal', true, true),
('p-mgr-rent_asset', 'MANAGER', 'rent_asset', true, true),
('p-mgr-consumable', 'MANAGER', 'consumable', true, true),
('p-mgr-contract', 'MANAGER', 'contract', true, true),
('p-mgr-billing', 'MANAGER', 'billing', true, true),
('p-mgr-delivery', 'MANAGER', 'delivery', true, true),
('p-mgr-smart_dispatch', 'MANAGER', 'smart_dispatch', true, true),
('p-mgr-repair', 'MANAGER', 'repair', true, true),
('p-mgr-permission', 'MANAGER', 'permission', true, false);

-- 4. 기본 메뉴별 권한 시드 (USER)
INSERT INTO permissions (id, role, "menuId", "canView", "canSave") VALUES
('p-user-customer', 'USER', 'customer', true, true),
('p-user-product', 'USER', 'product', true, true),
('p-user-asset', 'USER', 'asset', true, true),
('p-user-acquisition_disposal', 'USER', 'acquisition_disposal', true, false),
('p-user-rent_asset', 'USER', 'rent_asset', true, true),
('p-user-consumable', 'USER', 'consumable', true, false),
('p-user-contract', 'USER', 'contract', true, true),
('p-user-billing', 'USER', 'billing', true, true),
('p-user-delivery', 'USER', 'delivery', true, false),
('p-user-smart_dispatch', 'USER', 'smart_dispatch', true, true),
('p-user-repair', 'USER', 'repair', true, false),
('p-user-permission', 'USER', 'permission', false, false);

-- 5. 기본 메뉴별 권한 시드 (MECHANIC)
INSERT INTO permissions (id, role, "menuId", "canView", "canSave") VALUES
('p-mech-repair', 'MECHANIC', 'repair', true, true),
('p-mech-consumable', 'MECHANIC', 'consumable', true, true),
('p-mech-asset', 'MECHANIC', 'asset', true, false),
('p-mech-delivery', 'MECHANIC', 'delivery', true, false),
('p-mech-customer', 'MECHANIC', 'customer', false, false),
('p-mech-product', 'MECHANIC', 'product', false, false),
('p-mech-acquisition_disposal', 'MECHANIC', 'acquisition_disposal', false, false),
('p-mech-rent_asset', 'MECHANIC', 'rent_asset', false, false),
('p-mech-contract', 'MECHANIC', 'contract', false, false),
('p-mech-billing', 'MECHANIC', 'billing', false, false),
('p-mech-smart_dispatch', 'MECHANIC', 'smart_dispatch', false, false),
('p-mech-permission', 'MECHANIC', 'permission', false, false);

-- 6. 제품 마스터 시드
INSERT INTO products (id, "modelName", feet, spec, manufacturer, "createdAt") VALUES
('prod-1', 'Skyjack SJ3219', 19, '작업높이 7.8m / 리프트 용량 227kg', 'Skyjack', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('prod-2', 'Genie GS-1930', 19, '작업높이 7.8m / 무소음 친환경 모터', 'Genie', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('prod-3', 'JLG 1930ES', 19, '작업높이 7.7m / 장시간 운행 배터리', 'JLG', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('prod-4', 'Skyjack SJ4632', 32, '작업높이 11.7m / 넓은 적재 공간', 'Skyjack', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

-- 7. 고객사 시드
INSERT INTO customers (id, name, "bizRegNo", "isClosed", address, representative, "repContact", "repEmail", "driveFolderId", "createdAt") VALUES
('cust-1', '현대건설(주)', '101-81-12345', false, '서울시 종로구 율곡로 75', '윤영준', '02-746-1114', 'contact@hdec.co.kr', 'folder-hdec-123', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('cust-2', '삼성물산(주)', '202-81-54321', false, '서울시 강동구 상일로6길 26', '오세철', '02-2145-5114', 'info@samsungcnt.com', 'folder-samsung-456', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
