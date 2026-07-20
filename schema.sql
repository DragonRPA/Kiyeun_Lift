-- 기연리프트 ERP 시스템 데이터베이스 DDL 스키마 (Supabase PostgreSQL 호환)
-- 최종 합의된 프로젝트 요구사항 적용 (인사/조직도, 매입 이원화, 협업 3대 테이블, 외주/배차 등 확장)

-- 기존 테이블 삭제 (순서 주의: 자식 테이블 먼저)
DROP TABLE IF EXISTS collaboration_request_history CASCADE;
DROP TABLE IF EXISTS collaboration_requests CASCADE;
DROP TABLE IF EXISTS work_instructions CASCADE;
DROP TABLE IF EXISTS announcement_reads CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS consumable_logs CASCADE;
DROP TABLE IF EXISTS consumable_purchase_items CASCADE;
DROP TABLE IF EXISTS consumable_purchase_requests CASCADE;
DROP TABLE IF EXISTS repair_consumables CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;
DROP TABLE IF EXISTS purchase_billing_details CASCADE;
DROP TABLE IF EXISTS purchase_billings CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS billing_details CASCADE;
DROP TABLE IF EXISTS billings CASCADE;
DROP TABLE IF EXISTS contract_history CASCADE;
DROP TABLE IF EXISTS contract_assets CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS consumables CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customer_sites CASCADE;
DROP TABLE IF EXISTS customer_contacts CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 1. 부서 테이블 (departments) - 신설
CREATE TABLE departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    "parentDepartmentId" TEXT REFERENCES departments(id),
    "managerId" TEXT, -- users.id 참조 (순환 참조 문제로 추후 ALTER 처리하거나 논리적 유지)
    "createdAt" TEXT NOT NULL
);

-- 2. 사용자 테이블 (users) - 확장(인사노무)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    "loginId" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    name TEXT NOT NULL,
    "departmentId" TEXT REFERENCES departments(id),
    position TEXT, -- 직급 (사원, 대리, 부장 등)
    "managerId" TEXT REFERENCES users(id), -- 직속 상급자
    status TEXT CHECK (status IN ('ACTIVE', 'LEAVE_OF_ABSENCE', 'RETIRED')) NOT NULL DEFAULT 'ACTIVE',
    role TEXT CHECK (role IN ('ADMIN', 'MANAGER', 'USER', 'MECHANIC')),
    "joinDate" TEXT,
    "retireDate" TEXT,
    "birthDate" TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    "profileImageUrl" TEXT,
    "createdAt" TEXT NOT NULL
);

-- 3. 매입 거래처 테이블 (vendors) - 신설
CREATE TABLE vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('TRANSPORT', 'RENTAL', 'REPAIR', 'CONSUMABLE', 'OTHER')) NOT NULL,
    "bizRegNo" TEXT,
    "contactName" TEXT,
    contact TEXT,
    "bankAccount" TEXT,
    memo TEXT,
    "createdAt" TEXT NOT NULL
);

-- 4. 메뉴 권한 테이블 (permissions)
CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT FALSE,
    "canSave" BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. 고객 테이블 (customers)
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
    "prepaidBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL
);

-- 6. 고객 담당자 및 현장 (customer_contacts, customer_sites)
CREATE TABLE customer_contacts (
    id TEXT PRIMARY KEY,
    "customerId" TEXT REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT,
    contact TEXT,
    email TEXT,
    "createdAt" TEXT NOT NULL
);

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

-- 7. 제품 마스터 테이블 (products)
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    "modelName" TEXT NOT NULL UNIQUE,
    feet INTEGER NOT NULL,
    spec TEXT,
    manufacturer TEXT,
    "createdAt" TEXT NOT NULL
);

-- 8. 자산 대장 테이블 (assets)
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    "modelName" TEXT REFERENCES products("modelName") ON UPDATE CASCADE,
    "assetNo" TEXT NOT NULL UNIQUE,
    "serialNo" TEXT,
    manufacturer TEXT,
    "ownerType" TEXT CHECK ("ownerType" IN ('OWNED', 'RENTED')) NOT NULL,
    status TEXT CHECK (status IN ('AVAILABLE', 'RENTED', 'REPAIRING', 'RENTED_RETURNED', 'SOLD')) NOT NULL,
    
    -- 당사자산 상세
    "acquisitionDate" TEXT,
    "acquisitionPrice" DOUBLE PRECISION,
    "depreciationMonths" INTEGER,
    "residualValueRate" DOUBLE PRECISION,
    "accumDepreciation" DOUBLE PRECISION,
    "bookValue" DOUBLE PRECISION,
    
    -- 임차자산 상세 (vendors 연동)
    "vendorId" TEXT REFERENCES vendors(id),
    "rentStart" TEXT,
    "rentEnd" TEXT, -- 실제 반납 시 지연 정산 기준
    "monthlyRentFee" DOUBLE PRECISION,
    "dailyRentFee" DOUBLE PRECISION,
    "actualRentReturnDate" TEXT,

    memo TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 9. 소모품 테이블 (consumables)
CREATE TABLE consumables (
    id TEXT PRIMARY KEY,
    "modelName" TEXT NOT NULL UNIQUE,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0, -- 기준 매입가
    "vendorId" TEXT REFERENCES vendors(id),
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 10. 소모품 구매신청서 마스터 (consumable_purchase_requests) - 신설
CREATE TABLE consumable_purchase_requests (
    id TEXT PRIMARY KEY,
    "requesterId" TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    status TEXT CHECK (status IN ('REQUESTED', 'PARTIAL_INBOUND', 'COMPLETED', 'CANCELLED')) NOT NULL,
    "requestDate" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 11. 소모품 구매신청 상세 (consumable_purchase_items) - 신설
CREATE TABLE consumable_purchase_items (
    id TEXT PRIMARY KEY,
    "requestId" TEXT REFERENCES consumable_purchase_requests(id) ON DELETE CASCADE,
    "consumableId" TEXT REFERENCES consumables(id),
    "requestQty" DOUBLE PRECISION NOT NULL,
    "inboundQty" DOUBLE PRECISION NOT NULL DEFAULT 0 -- 누적 입고 수량
);

-- 12. 소모품 입출고 로그 (consumable_logs) - 증빙 확장
CREATE TABLE consumable_logs (
    id TEXT PRIMARY KEY,
    "consumableId" TEXT REFERENCES consumables(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('INBOUND', 'OUTBOUND', 'ADJUST')) NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "vendorId" TEXT REFERENCES vendors(id),
    "userId" TEXT REFERENCES users(id),
    "targetAssetId" TEXT REFERENCES assets(id),
    "purchaseItemId" TEXT REFERENCES consumable_purchase_items(id), -- 구매신청 입고 매칭
    "evidenceFileUrl" TEXT, -- 거래명세서 등 매입 증빙 파일
    "actionDate" TEXT NOT NULL,
    description TEXT,
    "createdAt" TEXT NOT NULL
);

-- 13. 계약 테이블 (contracts) - 영업사원 추가
CREATE TABLE contracts (
    id TEXT PRIMARY KEY,
    "contractNo" TEXT NOT NULL UNIQUE,
    "customerId" TEXT REFERENCES customers(id),
    "salespersonId" TEXT REFERENCES users(id), -- 담당 영업사원
    "contactId" TEXT REFERENCES customer_contacts(id),
    "siteId" TEXT REFERENCES customer_sites(id),
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "billingDay" INTEGER NOT NULL DEFAULT 30,
    status TEXT CHECK (status IN ('ACTIVE', 'EXTENDED', 'SHORTENED', 'SUCCEEDED', 'COMPLETED')) NOT NULL,
    "driveFolderId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 14. 계약 자산 및 이력 (contract_assets, contract_history)
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

CREATE TABLE contract_history (
    id TEXT PRIMARY KEY,
    "contractId" TEXT REFERENCES contracts(id) ON DELETE CASCADE,
    "changeType" TEXT CHECK ("changeType" IN ('REGISTER', 'EXTEND', 'SHORTEN', 'SUCCEED', 'TERMINATE')) NOT NULL,
    "changeDate" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TEXT NOT NULL
);

-- 15. 배차 및 운송 테이블 (deliveries) - 운송사 및 상하차 일시 확장
CREATE TABLE deliveries (
    id TEXT PRIMARY KEY,
    "contractId" TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "assetIds" TEXT,
    "transportVendorId" TEXT REFERENCES vendors(id), -- 운송 거래처
    type TEXT CHECK (type IN ('OUTBOUND', 'INBOUND')) NOT NULL,
    status TEXT CHECK (status IN ('REQUESTED', 'DISPATCHED', 'COMPLETED', 'CANCELLED')) NOT NULL,
    "requestDate" TEXT NOT NULL,
    "loadingTime" TEXT, -- 상차 예정 일시
    "unloadingTime" TEXT, -- 하차 예정 일시
    "vehicleType" TEXT,
    "driverName" TEXT,
    "driverContact" TEXT,
    "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseBillId" TEXT, -- 매입 마감 연동
    memo TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 16. 매출 청구 마스터 (billings) - 고객 대상
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

-- 17. 매출 청구 상세 (billing_details) - 자산 개별 매핑
CREATE TABLE billing_details (
    id TEXT PRIMARY KEY,
    "billingId" TEXT REFERENCES billings(id) ON DELETE CASCADE,
    "contractAssetId" TEXT REFERENCES contract_assets(id),
    "assetId" TEXT REFERENCES assets(id), -- 손익 분석용 자산 직접 연결
    "itemName" TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    description TEXT,
    "createdAt" TEXT NOT NULL
);

-- 18. 매입 청구 마스터 (purchase_billings) - 신설
CREATE TABLE purchase_billings (
    id TEXT PRIMARY KEY,
    "vendorId" TEXT REFERENCES vendors(id),
    "billingYm" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('REQUESTED', 'APPROVED', 'PAID')) NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 19. 매입 청구 상세 (purchase_billing_details) - 신설 (비용의 자산 연계)
CREATE TABLE purchase_billing_details (
    id TEXT PRIMARY KEY,
    "purchaseBillId" TEXT REFERENCES purchase_billings(id) ON DELETE CASCADE,
    "assetId" TEXT REFERENCES assets(id), -- 어떤 자산에 투입된 비용인가? (손익 추적)
    "contractId" TEXT REFERENCES contracts(id), -- 어떤 계약에 투입된 비용인가? (손익 추적)
    "expenseType" TEXT CHECK ("expenseType" IN ('TRANSPORT', 'REPAIR', 'RENTAL_FEE', 'CONSUMABLE', 'OTHER')) NOT NULL,
    "itemName" TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL
);

-- 20. 매출 수납 테이블 (payments)
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    "billingId" TEXT REFERENCES billings(id) ON DELETE CASCADE,
    "paymentDate" TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    method TEXT NOT NULL,
    memo TEXT,
    "createdAt" TEXT NOT NULL
);

-- 21. 자산 수리 테이블 (repairs) - 외주 정비 및 영업 청구 판단 이원화
CREATE TABLE repairs (
    id TEXT PRIMARY KEY,
    "assetId" TEXT REFERENCES assets(id),
    "mechanicId" TEXT REFERENCES users(id),
    "repairType" TEXT CHECK ("repairType" IN ('INTERNAL', 'EXTERNAL')) NOT NULL DEFAULT 'INTERNAL',
    "vendorId" TEXT REFERENCES vendors(id), -- 외주업체
    "outboundDate" TEXT, -- 반출일자
    "completedDate" TEXT, -- 정비완료일자
    "estimateFileUrl" TEXT, -- 견적서 첨부
    "requestDate" TEXT NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')) NOT NULL,
    details TEXT,
    "isCustomerFault" BOOLEAN NOT NULL DEFAULT FALSE, -- 입고 시 고객 파손 의심 통지
    "faultImageUrl" TEXT, -- 파손 증빙 사진
    
    -- 비용 및 청구 판단
    "laborHours" DOUBLE PRECISION, -- 메카닉 투입 공수
    "costTotal" DOUBLE PRECISION NOT NULL DEFAULT 0, -- 원가 합계 (자재비 등)
    "billableToCustomer" BOOLEAN, -- 영업사원의 최종 청구 판단 (NULL이면 대기)
    "billingAmount" DOUBLE PRECISION, -- 영업사원이 확정한 고객 청구액
    
    "billingId" TEXT REFERENCES billings(id), -- 매출(고객) 전표
    "purchaseBillId" TEXT REFERENCES purchase_billings(id), -- 매입(외주) 전표
    
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 22. 수리 투입 자재 (repair_consumables)
CREATE TABLE repair_consumables (
    id TEXT PRIMARY KEY,
    "repairId" TEXT REFERENCES repairs(id) ON DELETE CASCADE,
    "consumableId" TEXT REFERENCES consumables(id),
    quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    cost DOUBLE PRECISION NOT NULL DEFAULT 0
);

-- 23. 공지사항 (announcements & announcement_reads) - 신설
CREATE TABLE announcements (
    id TEXT PRIMARY KEY,
    "authorId" TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

CREATE TABLE announcement_reads (
    id TEXT PRIMARY KEY,
    "announcementId" TEXT REFERENCES announcements(id) ON DELETE CASCADE,
    "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
    "readAt" TEXT NOT NULL
);

-- 24. 업무 지시 (work_instructions) - 3대 보고유형 - 신설
CREATE TABLE work_instructions (
    id TEXT PRIMARY KEY,
    "managerId" TEXT REFERENCES users(id),
    "assigneeId" TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    "reportType" TEXT CHECK ("reportType" IN ('FILE', 'TEXT', 'VERBAL')) NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'REPORTED', 'APPROVED', 'NEEDS_WORK')) NOT NULL DEFAULT 'PENDING',
    "reportContent" TEXT,
    "reportFileUrl" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 25. 협업 요청 (collaboration_requests & history) - 조율 4회 제한 - 신설
CREATE TABLE collaboration_requests (
    id TEXT PRIMARY KEY,
    "requesterId" TEXT REFERENCES users(id),
    "targetUserId" TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    status TEXT CHECK (status IN ('REQUESTED', 'NEGOTIATING', 'AGREED', 'REJECTED', 'ESCALATED')) NOT NULL DEFAULT 'REQUESTED',
    "negotiationCount" INTEGER NOT NULL DEFAULT 0, -- 4회 초과 시 자동 REJECTED 처리 로직 백엔드 수행
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

CREATE TABLE collaboration_request_history (
    id TEXT PRIMARY KEY,
    "requestId" TEXT REFERENCES collaboration_requests(id) ON DELETE CASCADE,
    "writerId" TEXT REFERENCES users(id),
    content TEXT NOT NULL,
    action TEXT CHECK (action IN ('NEGOTIATE', 'AGREE', 'REJECT', 'ESCALATE')) NOT NULL,
    "createdAt" TEXT NOT NULL
);


-- 26. 은행 입출금 거래 내역 (bank_transactions) - 신설
CREATE TABLE bank_transactions (
    id TEXT PRIMARY KEY,
    "transactionDate" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    memo TEXT,
    "matchedBillingId" TEXT REFERENCES billings(id) ON DELETE SET NULL,
    "matchingType" TEXT CHECK ("matchingType" IN ('AUTO', 'MANUAL')),
    "createdAt" TEXT NOT NULL
);

-- 27. 은행 입금 대조 학습 매핑 룰 (bank_matching_rules) - 신설
CREATE TABLE bank_matching_rules (
    id TEXT PRIMARY KEY,
    "senderName" TEXT NOT NULL UNIQUE,
    "customerId" TEXT REFERENCES customers(id) ON DELETE CASCADE,
    "createdAt" TEXT NOT NULL
);

-- 28. 자산 입출고/정비 이력 테이블 (asset_inout_logs) - 신설
CREATE TABLE asset_inout_logs (
    id TEXT PRIMARY KEY,
    "assetId" TEXT REFERENCES assets(id) ON DELETE CASCADE,
    "assetNo" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    type TEXT CHECK (type IN ('OUTBOUND', 'INBOUND', 'REPAIR')) NOT NULL,
    "eventDate" TEXT NOT NULL,
    "customerId" TEXT REFERENCES customers(id) ON DELETE SET NULL,
    "customerName" TEXT,
    "siteId" TEXT REFERENCES customer_sites(id) ON DELETE SET NULL,
    "siteName" TEXT,
    "deliveryId" TEXT REFERENCES deliveries(id) ON DELETE SET NULL,
    "repairId" TEXT REFERENCES repairs(id) ON DELETE SET NULL,
    "maintenanceScore" INTEGER,
    memo TEXT,
    "createdAt" TEXT NOT NULL
);


-- ==========================================
-- 초기 기초 데이터 시딩 (Seed Data)
-- ==========================================

-- 1. 부서 및 조직도 시드 (비어 있음)

-- 2. 사용자 시드 (최고관리자만 등록)
INSERT INTO users (id, "loginId", "passwordHash", name, "departmentId", position, "managerId", role, status, "joinDate", "createdAt") VALUES
('u-1', 'admin', 'admin123', '시스템관리자', NULL, '대표이사', NULL, 'ADMIN', 'ACTIVE', '2020-01-01', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

-- 3. 매입 거래처(vendors) 시드
INSERT INTO vendors (id, name, type, "contactName", contact, "createdAt") VALUES
('v-1', '제일운송', 'TRANSPORT', '김기사', '010-1234-5678', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('v-2', '에이스렌탈(주)', 'RENTAL', '이렌탈', '010-9876-5432', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('v-3', '대한고소공업', 'REPAIR', '최공업', '02-123-4567', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('v-4', '철물부속상사', 'CONSUMABLE', '박철물', '031-987-6543', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

-- (이후 기존 products, customers 시드는 유사하게 유지됨)
INSERT INTO products (id, "modelName", feet, spec, manufacturer, "createdAt") VALUES
('prod-1', 'Skyjack SJ3219', 19, '작업높이 7.8m / 리프트 용량 227kg', 'Skyjack', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('prod-2', 'Genie GS-1930', 19, '작업높이 7.8m / 무소음 친환경 모터', 'Genie', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

INSERT INTO customers (id, name, "bizRegNo", "isClosed", address, representative, "repContact", "createdAt") VALUES
('cust-1', '현대건설(주)', '101-81-12345', false, '서울시 종로구', '윤영준', '02-746-1114', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
('cust-2', '삼성물산(주)', '202-81-54321', false, '서울시 강동구', '오세철', '02-2145-5114', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
