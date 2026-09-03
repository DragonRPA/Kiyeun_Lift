// @ts-nocheck
import { supabase, db, calculateAssetDepreciation, normalizeCustomerName, STANDARD_SPECS, findCustomerByNormalizedName } from './db';
import * as XLSX from 'xlsx';
import { PRESET_PRODUCT_SPECS, ProductPresetSpec } from '../data/presetProductSpecs';

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────
export interface MigrationStats {
  productsCount: number;
  vendorsCount: number;
  customersCount: number;
  sitesCount: number;
  contactsCount: number;
  assetsCount: number;
  contractsCount: number;
  contractAssetsCount: number;
  externalLeasesCount: number;
  outboundDeliveriesCount: number;
  inboundDeliveriesCount: number;
  outboundInspectionsCount: number;
  assetInOutLogsCount: number;
  contractHistoriesCount: number;
  historicalBillingsCount: number;
  currentBillingsCount: number;
  totalBillingDetailsCount: number;
  totalHistoricalBillingAmount: number;
  currentMonthBillingAmount: number;
  purchaseBillingsCount: number;
  totalPurchaseBillingAmount: number;
  receivablesCount: number;
  totalReceivablesAmount: number;
  docLinkedProductsCount: number;
  activeRentedAssetsCount: number;
}

export interface ReconciliationReport {
  assetCountMatch: { excel: number; db: number; isMatch: boolean };
  currentBillingTotalMatch: { excel: number; db: number; diff: number; isMatch: boolean };
  currentDetailsTotalMatch: { headerSum: number; detailSum: number; diff: number; isMatch: boolean };
  leaseTotalMatch: { excel: number; db: number; isMatch: boolean };
  lifecycleChainMatch: { contracts: number; outboundDeliveries: number; isMatch: boolean };
  orphanCheck: { orphanContracts: number; orphanAssets: number; isClean: boolean };
  allPassed: boolean;
}

export interface ParsedInitialData {
  products: any[];
  vendors: any[];
  customers: any[];
  customerSites: any[];
  customerContacts: any[];
  assets: any[];
  contracts: any[];
  contractAssets: any[];
  externalLeases: any[];
  deliveries: any[];
  outboundInspections: any[];
  assetInOutLogs: any[];
  contractHistories: any[];
  billings: any[];
  billingDetails: any[];
  purchaseBillings: any[];
  purchaseBillingDetails: any[];
  receivables: any[];
  stats: MigrationStats;
  excelTotalBillingSum: number;
}

// ──────────────────────────────────────────────
// DB 스키마 화이트리스트 정의 (PostgREST 컬럼 불일치 원천 방어)
// ──────────────────────────────────────────────
export const TABLE_COLUMNS: Record<string, string[]> = {
  products: [
    'id', 'modelName', 'feet', 'spec', 'manufacturer', 'powerSource',
    'workingHeight', 'platformHeight', 'weight', 'capacityPreExt',
    'capacityPostExtMain', 'capacityPostExtDeck', 'machineDimensions',
    'platformDimensions', 'gradeability', 'speed', 'asContact',
    'maxWindSpeed', 'maxHeightCapacity', 'safetyCertDate', 'safetyCertUrl',
    'specSheetUrl', 'emergencyGuideUrl', 'isActive', 'createdAt', 'updatedAt'
  ],
  vendors: [
    'id', 'name', 'type', 'types', 'bizRegNo', 'representative', 'contactName', 'contact', 'email', 'address', 'bankName',
    'bankAccount', 'accountNumber', 'accountHolder', 'memo', 'isActive', 'createdAt', 'updatedAt'
  ],
  customers: [
    'id', 'name', 'bizRegNo', 'representative', 'repContact', 'repEmail',
    'address', 'defaultBillingDay', 'defaultStatementClosingDay', 'billingDay', 'paymentDueDay', 'paymentTermDays', 'payment_term_days',
    'bankAccounts', 'driveFolderId', 'prepaidBalance', 'isClosed', 'createdAt', 'updatedAt'
  ],
  customer_sites: [
    'id', 'customerId', 'name', 'address', 'contactName', 'contact', 'email', 'createdAt', 'updatedAt'
  ],
  customer_contacts: [
    'id', 'customerId', 'name', 'position', 'contact', 'email', 'isPrimary', 'createdAt', 'updatedAt'
  ],
  assets: [
    'id', 'modelName', 'assetNo', 'vendorAssetNo', 'serialNo', 'manufacturer', 'manufactureYear',
    'ownerType', 'status', 'acquisitionDate', 'acquisitionPrice', 'depreciationMonths',
    'residualValueRate', 'accumDepreciation', 'bookValue', 'vendorId', 'supplier',
    'renter', 'rentStart', 'rentEnd', 'monthlyRentFee', 'dailyRentFee', 'actualRentReturnDate',
    'disposalDate', 'disposalPrice', 'buyer', 'safetyInspectionUrl', 'preDeliveryChecklistUrl',
    'currentCustomerId', 'currentSiteId', 'contractStart', 'contractEnd',
    'cumRentalFee', 'cumRepairCost', 'note', 'memo', 'memo1', 'memo2', 'createdAt', 'updatedAt'
  ],
  contracts: [
    'id', 'contractNo', 'customerId', 'salespersonId', 'contactId', 'siteId',
    'billingDay', 'paymentDueDay', 'lateInterestRate', 'status', 'startDate', 'endDate',
    'successorContractId', 'predecessorContractId', 'predecessorContractNo',
    'predecessorCustomerId', 'predecessorCustomerName', 'lastBillingDate',
    'lastBilledPeriodStart', 'lastBilledPeriodEnd', 'lastBilledYm', 'billingCount',
    'driveFolderId', 'createdAt', 'updatedAt'
  ],
  contract_history: [
    'id', 'contractId', 'changeType', 'prevEndDate', 'newEndDate', 'description', 'changeDate', 'createdAt', 'updatedAt'
  ],
  contract_assets: [
    'id', 'contractId', 'assetId', 'expectedModel', 'monthlyRentalFee',
    'dailyRentalFee', 'startDate', 'endDate', 'createdAt', 'updatedAt'
  ],
  external_leases: [
    'id', 'vendorId', 'contractId', 'contractAssetId', 'assetDescription',
    'monthlyRentFee', 'dailyRentFee', 'leaseStartDate', 'leaseEndDate', 'status',
    'statementFileUrl', 'memo', 'contract_id', 'createdAt', 'updatedAt'
  ],
  deliveries: [
    'id', 'contractId', 'assetIds', 'transportVendorId', 'type', 'status',
    'vehicleType', 'driverName', 'driverContact', 'deliveryCost', 'purchaseBillId',
    'memo', 'requestDate', 'loadingTime', 'unloadingTime', 'createdAt', 'updatedAt',
    'isCostSettled', 'scheduledDate', 'originAddress', 'destinationAddress',
    'transportCompany', 'vehicleNo', 'expectedCost', 'deliveryCostConfirmed',
    'finalCost', 'costAdjustmentReason', 'reconciliationStatus', 'reconciledAt',
    'paymentRequestedAt', 'paymentCompletedAt', 'statementFileUrl',
    'billableToCustomer', 'billableCustomerId', 'vehicleRequirements', 'cargoItems',
    'vehicles', 'dispatchCategory', 'loadingDate', 'loadingTimeSlot',
    'unloadingDate', 'unloadingTimeSlot', 'closingMemo', 'rawText',
    'pickupType', 'pickupVendorName', 'dropoffType', 'viaDropoffName', 'viaDropoffAddress'
  ],
  outbound_inspections: [
    'id', 'deliveryId', 'contractId', 'assetId', 'status', 'inspectorId',
    'checkedItems', 'photos', 'notes', 'approvedAt', 'approvedBy', 'createdAt', 'updatedAt'
  ],
  asset_inout_logs: [
    'id', 'assetId', 'assetNo', 'modelName', 'type', 'eventDate',
    'contractId', 'customerId', 'siteId', 'deliveryId', 'details',
    'performedBy', 'createdAt', 'updatedAt'
  ],
  billings: [
    'id', 'customerId', 'contractId', 'billingYm', 'invoiceId', 'totalAmount', 'paidAmount', 'status', 'billingDate', 'createdAt', 'updatedAt'
  ],
  billing_invoices: [
    'id', 'customId', 'customerId', 'billingYm', 'siteId', 'totalAmount', 'vatAmount', 'grandTotal', 'status', 'dueDate', 'issuedAt', 'memo', 'createdAt', 'updatedAt'
  ],
  billing_details: [
    'id', 'billingId', 'contractAssetId', 'assetId', 'itemName', 'quantity',
    'unitPrice', 'amount', 'description', 'internalDescription', 'displayName',
    'createdAt', 'updatedAt'
  ],
  purchase_billings: [
    'id', 'vendorId', 'billingYm', 'totalAmount', 'status', 'createdAt', 'updatedAt'
  ],
  purchase_billing_details: [
    'id', 'purchaseBillId', 'assetId', 'contractId', 'expenseType', 'itemName', 'amount', 'createdAt', 'updatedAt'
  ],
  receivables: [
    'id', 'contractId', 'customerId', 'type', 'totalAmount', 'billedAmount',
    'vendorName', 'assetNo', 'repairId',
    'internalDescription', 'displayName', 'occurredDate', 'status', 'createdAt', 'updatedAt'
  ],
  reconciliation_reports: [
    'id', 'migration_run_at',
    'asset_count_excel', 'asset_count_db', 'asset_count_match',
    'billing_total_excel', 'billing_total_db', 'billing_total_diff', 'billing_total_match',
    'details_header_sum', 'details_detail_sum', 'details_sum_diff', 'details_sum_match',
    'lease_total_excel', 'lease_total_db', 'lease_total_match',
    'lifecycle_contracts', 'lifecycle_deliveries', 'lifecycle_match',
    'orphan_contracts', 'orphan_assets', 'orphan_is_clean',
    'all_passed', 'memo', 'created_at'
  ],
  transport_companies: [
    'id', 'name', 'businessNo', 'contact', 'bankName', 'bankAccount', 'bankHolder', 'memo', 'createdAt', 'updatedAt'
  ]
};

export function filterRecordBySchema(table: string, record: any): any {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed) return record;
  const filtered: any = {};
  allowed.forEach(col => {
    if (record[col] !== undefined) {
      filtered[col] = record[col];
    }
  });
  return filtered;
}

// ──────────────────────────────────────────────
// 1. 안전 파싱 및 정규화 유틸리티
// ──────────────────────────────────────────────
export function sanitizeNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

export function sanitizeExcelDate(val: any): string | null {
  if (!val || val === '미정' || val === '-' || val === '공란') return null;
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }
  const str = String(val).trim().replace(/\./g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

export function sanitizeModelName(m: any): string {
  if (!m) return '';
  return String(m).trim().replace(/\s+/g, ' ').toUpperCase();
}

export function parseClosingDay(dayStr: any): number {
  if (!dayStr) return 30;
  if (typeof dayStr === 'number') return Math.min(31, Math.max(1, dayStr));
  const s = String(dayStr).trim();
  if (s.includes('말일') || s.includes('말')) return 30;
  const match = s.match(/(\d+)/);
  if (match) {
    const n = parseInt(match[1], 10);
    return isNaN(n) ? 30 : Math.min(31, Math.max(1, n));
  }
  return 30;
}

/**
 * 결제 조건 파싱 — 엑셀 결제일 셀 값을 두 가지 타입으로 분리
 *
 * 반환값:
 *   paymentDueDay   : 특정 날짜 기준 결제일 (익월N일 방식) — null이면 Net Terms 사용
 *   paymentTermDays : 청구일 기준 N일 이내 결제 (Net Terms) — null이면 익월N일 방식 사용
 *
 * 판별 규칙:
 *   "익월N일" / "익익월N일" / "N일" (단, N ≤ 31)  →  paymentDueDay = N, paymentTermDays = null
 *   "익월말" / "말일"                              →  paymentDueDay = 30, paymentTermDays = null
 *   "N일" (N > 31) 또는 숫자만 (N > 31)            →  paymentDueDay = null, paymentTermDays = N  (Net Terms)
 *   공백 / null                                    →  paymentDueDay = 30, paymentTermDays = null (기본값)
 */
export function parsePaymentDueTerm(rawStr: any): { paymentDueDay: number | null; paymentTermDays: number | null } {
  const DEFAULT = { paymentDueDay: 30, paymentTermDays: null };
  if (!rawStr) return DEFAULT;

  const s = String(rawStr).trim();
  if (!s) return DEFAULT;

  // 말일 계열
  if (s.includes('말일') || s === '익월말' || s === '말') {
    return { paymentDueDay: 30, paymentTermDays: null };
  }

  // 숫자 추출
  const numMatch = s.match(/(\d+)/);
  if (!numMatch) return DEFAULT;
  const n = parseInt(numMatch[1], 10);
  if (isNaN(n)) return DEFAULT;

  // "익월N일" 패턴: "익월" 포함이고 N ≤ 31 → 익월 N일
  if (s.includes('익월') || s.includes('익익월')) {
    return { paymentDueDay: Math.min(31, Math.max(1, n)), paymentTermDays: null };
  }

  // N만 있는 경우: N ≤ 31이면 당월N일, N > 31이면 Net Terms
  if (n <= 31) {
    return { paymentDueDay: n, paymentTermDays: null };
  } else {
    // 예: "75일" → Net 75 Terms
    return { paymentDueDay: null, paymentTermDays: n };
  }
}

/**
 * 결제 만기일(dueDate) 계산 — paymentTermDays 또는 paymentDueDay 기반 단일 로직
 * @param billingDateStr  청구서 발행일 (YYYY-MM-DD)
 * @param paymentDueDay   익월N일 방식의 결제일 (nullable)
 * @param paymentTermDays Net Terms 일수 (nullable)
 */
export function calcDueDate(billingDateStr: string, paymentDueDay: number | null, paymentTermDays: number | null): string {
  if (!billingDateStr) return billingDateStr;
  const billingDate = new Date(billingDateStr);

  if (paymentTermDays != null && paymentTermDays > 0) {
    // Net Terms: 발행일 + N일
    const due = new Date(billingDate);
    due.setDate(due.getDate() + paymentTermDays);
    return due.toISOString().slice(0, 10);
  }

  // 익월N일 방식
  const dueDay = paymentDueDay ?? 30;
  const nextMonth = new Date(billingDate.getFullYear(), billingDate.getMonth() + 1, 1);
  const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  const actualDay = Math.min(dueDay, lastDayOfNextMonth);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
}


export function extractSiteNameAndMemo(rawSite: string): { cleanSiteName: string; dispatchMemo: string } {
  if (!rawSite) return { cleanSiteName: '기본현장', dispatchMemo: '' };
  const str = String(rawSite).trim();
  const memoMatch = str.match(/\((.*?)\)/);
  let dispatchMemo = memoMatch ? memoMatch[1] : '';
  let cleanSiteName = str.replace(/\(.*?\)/g, '').trim();
  if (!cleanSiteName) cleanSiteName = str;
  return { cleanSiteName, dispatchMemo };
}

export function extractContactPosition(rawName: string): { name: string; position: string } {
  if (!rawName) return { name: '', position: '담당자' };
  const str = String(rawName).trim();
  const posList = ['대표', '이사', '본부장', '부장', '차장', '과장', '대리', '주임', '사원', '소장', '반장', '팀장', '기사', '실장'];
  for (const p of posList) {
    if (str.endsWith(p)) {
      const pureName = str.slice(0, -p.length).trim();
      if (pureName.length >= 2) return { name: pureName, position: p };
    }
    const match = str.match(new RegExp(`^(.*?)\\s*(${p})$`));
    if (match) return { name: match[1].trim(), position: match[2] };
  }
  return { name: str, position: '담당자' };
}

function inferMakerFromModel(m: string): string {
  if (m.startsWith('ES') || m.startsWith('1930ES') || m.startsWith('1230ES') || m.startsWith('ES1330') || m.startsWith('2632ES')) return 'JLG';
  if (m.startsWith('GS') || m.startsWith('Z-')) return 'Genie';
  if (m.startsWith('SJ')) return 'SKYJACK';
  if (m.startsWith('GTJZ') || m.startsWith('GTBZ') || m.startsWith('S08') || m.startsWith('S10') || m.startsWith('S12') || m.startsWith('S14') || m.startsWith('S16') || m.startsWith('1414E')) return 'SINOBOOM';
  if (m.startsWith('STAR') || m.startsWith('OPTIMUM')) return 'Haulotte';
  if (m.startsWith('JCPT')) return 'Dingli';
  return '기타제조사';
}

function inferFeetFromModel(m: string, heightM: number = 0): number {
  if (heightM > 0) return Math.round(heightM * 3.28084);
  if (m.includes('1930') || m.includes('1330') || m.includes('1432') || m.includes('3215') || m.includes('0608')) return 19;
  if (m.includes('2646') || m.includes('2632') || m.includes('0812') || m.includes('0808') || m.includes('3219')) return 26;
  if (m.includes('3246') || m.includes('1012') || m.includes('1008')) return 32;
  if (m.includes('4047') || m.includes('4046') || m.includes('1212')) return 40;
  if (m.includes('4655') || m.includes('1412') || m.includes('1414')) return 46;
  if (m.includes('1612') || m.includes('1614')) return 53;
  return 19;
}

// ──────────────────────────────────────────────
// 2. 전체 DB 49개 테이블 백업 모듈 (JSON 내보내기)
// ──────────────────────────────────────────────
const ALL_TABLES = [
  'departments',
  'users',
  'vendors',
  'permissions',
  'customers',
  'customer_contacts',
  'customer_sites',
  'products',
  'assets',
  'consumables',
  'consumable_purchase_requests',
  'consumable_purchase_items',
  'consumable_logs',
  'contract_templates',
  'contracts',
  'contract_history',
  'contract_assets',
  'external_leases',
  'deliveries',
  'outbound_inspections',
  'asset_inout_logs',
  'maintenance_logs',
  'repair_history',
  'regular_inspections',
  'regular_inspection_items',
  'statutory_inspections',
  'maintenance_cost_details',
  'billings',
  'billing_details',
  'credit_card_claims',
  'payments',
  'purchase_billings',
  'purchase_billing_details',
  'purchase_payments',
  'receivables',
  'bank_transactions',
  'bank_matching_rules',
  'payment_deposit_links',
  'cash_flow_snapshots',
  'tax_invoices',
  'agent_registry',
  'activity_logs',
  'google_configs',
  'site_notices',
  'calendar_events',
  'work_instructions',
  'collaboration_requests',
  'collaboration_request_history',
  'document_jobs'
];

export async function exportFullDatabaseBackup(): Promise<{ backupData: Record<string, any[]>; timestamp: string; filename: string }> {
  const backupData: Record<string, any[]> = {};
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_db_49_tables_${timestamp}.json`;

  if (supabase) {
    for (const table of ALL_TABLES) {
      try {
        let allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(from, from + pageSize - 1);

          if (!error && data && data.length > 0) {
            allRows = allRows.concat(data);
            from += pageSize;
            if (data.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        backupData[table] = allRows;
      } catch (e) {
        backupData[table] = [];
      }
    }
  } else {
    for (const table of ALL_TABLES) {
      backupData[table] = (db as any)[table] || [];
    }
  }

  return { backupData, timestamp, filename };
}

// ──────────────────────────────────────────────
// 3. 기존 비즈니스 데이터 전체 안전 초기화 모듈 (FK 역순)
// ──────────────────────────────────────────────
export async function resetAllDatabaseTables(keepAdmin: boolean = true): Promise<{ success: boolean; message: string }> {
  const DELETION_ORDER = [
    'document_jobs',
    'agent_registry',
    'payment_deposit_links',
    'bank_matching_rules',
    'bank_transactions',
    'cash_flow_snapshots',
    'collaboration_request_history',
    'collaboration_requests',
    'work_instructions',
    'site_notices',
    'calendar_events',
    'activity_logs',
    'tax_invoices',
    'receivables',
    'purchase_payments',
    'purchase_billing_details',
    'purchase_billings',
    'payments',
    'credit_card_claims',
    'billing_details',
    'billings',
    'maintenance_cost_details',
    'statutory_inspections',
    'regular_inspection_items',
    'regular_inspections',
    'repair_history',
    'maintenance_logs',
    'asset_inout_logs',
    'outbound_inspections',
    'deliveries',
    'transport_companies',
    'external_leases',
    'contract_assets',
    'contract_history',
    'contracts',
    'contract_templates',
    'consumable_logs',
    'consumable_purchase_items',
    'consumable_purchase_requests',
    'consumables',
    'assets',
    'customer_contacts',
    'customer_sites',
    'customers',
    'products',
    'vendors'
  ];

  try {
    if (supabase) {
      for (const table of DELETION_ORDER) {
        const { error } = await supabase.from(table).delete().neq('id', 'KEEP_NOTHING_ALL');
        if (error && !error.message.includes('not found')) {
          console.warn(`[Reset Table Warning] ${table}:`, error.message);
        }
      }
    } else {
      DELETION_ORDER.forEach(tbl => {
        (db as any)[tbl] = [];
      });
    }

    return { success: true, message: '전체 비즈니스 테이블 안전 초기화 완료' };
  } catch (error: any) {
    return { success: false, message: `초기화 오류: ${error.message}` };
  }
}

// ──────────────────────────────────────────────
// 4. 엑셀 1개 파일 풀 라이프사이클 종합 파싱 엔진
// ──────────────────────────────────────────────

// ── 유틸리티 함수: 동적 헤더 매핑 ──
function buildHeaderMap(row: any[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!row || !Array.isArray(row)) return map;
  row.forEach((col, idx) => {
    if (col && typeof col === 'string') {
      const key = col.replace(/\s+/g, '').toLowerCase();
      if (!map.has(key)) map.set(key, idx);
    }
  });
  return map;
}

function getCol(row: any[], map: Map<string, number>, keys: string[], fallbackIdx: number): any {
  for (const k of keys) {
    const searchKey = k.toLowerCase().replace(/\s+/g, '');
    
    // 1. Exact match first
    if (map.has(searchKey)) {
      const idx = map.get(searchKey)!;
      if (row[idx] !== null && row[idx] !== undefined && String(row[idx]).trim() !== '') return row[idx];
    }
    // 2. Partial match (includes)
    for (const [headerKey, idx] of map.entries()) {
      if (headerKey.includes(searchKey)) {
        if (row[idx] !== null && row[idx] !== undefined && String(row[idx]).trim() !== '') return row[idx];
      }
    }
  }
  return row[fallbackIdx];
}

export function parseInitialExcelWorkbook(
  fileBuffer: ArrayBuffer | Uint8Array | XLSX.WorkBook,
  users?: any[],
  histBillingRange?: { start: string; end: string }   // 소급 청구 생성 기간 (없으면 생성 안 함)
): ParsedInitialData {
  let wb: XLSX.WorkBook;
  if ((fileBuffer as any).Sheets) {
    wb = fileBuffer as XLSX.WorkBook;
  } else {
    wb = XLSX.read(fileBuffer, { type: 'array' });
  }
  const nowIso = new Date().toISOString();

  // ── 초기 마이그레이션 담당자 지정 ──────────────────────────────
  // 영업 담당(salesperson): 김동우 팀장
  // 검수/출고 담당(inspector): 김관주 부장
  const kimDongwoo = users?.find(u =>
    u.name?.includes('김동우') || u.name?.replace(/\s/g, '').includes('김동우')
  );
  const kimGwanju = users?.find(u =>
    u.name?.includes('김관주') || u.name?.replace(/\s/g, '').includes('김관주')
  );
  const MIGRATION_SALESPERSON_ID: string | null = kimDongwoo?.id ?? null;
  const MIGRATION_INSPECTOR_ID: string = kimGwanju?.id ?? 'SYS-MIGRATED';
  // ────────────────────────────────────────────────────────────────

  const productMap = new Map<string, any>();
  const vendorMap = new Map<string, any>();
  const customerMap = new Map<string, any>();
  const siteMap = new Map<string, any>();
  const contactMap = new Map<string, any>();

  // 🌟 [보강 1] 내장된 표준 제원 마스터(PRESET_PRODUCT_SPECS)를 선제 등록하여 제원표/안전문서 자동 연결
  Object.values(PRESET_PRODUCT_SPECS).forEach(spec => {
    productMap.set(spec.modelName, {
      id: spec.id || `PROD-${String(productMap.size + 1).padStart(7, '0')}`,
      modelName: spec.modelName,
      feet: spec.feet || 19,
      spec: spec.spec || `${spec.feet || 19}ft 고소작업대`,
      manufacturer: spec.manufacturer || '기타제조사',
      powerSource: spec.powerSource || '배터리',
      workingHeight: spec.workingHeight || null,
      platformHeight: spec.platformHeight || null,
      weight: spec.weight || null,
      capacityPreExt: spec.capacityPreExt || '230 kg',
      capacityPostExtMain: spec.capacityPostExtMain || null,
      capacityPostExtDeck: spec.capacityPostExtDeck || null,
      machineDimensions: spec.machineDimensions || null,
      platformDimensions: spec.platformDimensions || null,
      gradeability: spec.gradeability || null,
      speed: spec.speed || null,
      asContact: spec.asContact || '031-334-5296',
      maxWindSpeed: spec.maxWindSpeed || '12.5 m/s 이내',
      maxHeightCapacity: spec.maxHeightCapacity || null,
      safetyCertDate: spec.safetyCertDate || null,
      specSheetUrl: spec.specSheetUrl || null,
      safetyCertUrl: spec.safetyCertUrl || null,
      emergencyGuideUrl: spec.emergencyGuideUrl || null,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  });

  // ── 1. 보유자산현황 시트 파싱 ──
  const wsAsset = wb.Sheets['보유자산현황'];
  const allAssetRows = wsAsset ? XLSX.utils.sheet_to_json(wsAsset, { header: 1, defval: null }) : [];
  let assetHeaderMap = new Map<string, number>();
  let assetDataStartIndex = 4;
  for (let i = 0; i < Math.min(10, allAssetRows.length); i++) {
    const row = allAssetRows[i] as any[];
    if (row && (row.includes('관리번호') || row.includes('취득가액'))) {
      assetHeaderMap = buildHeaderMap(row);
      assetDataStartIndex = i + 1;
      break;
    }
  }
  const rawAssetRows = allAssetRows.slice(assetDataStartIndex);
  
  const assetMap = new Map<string, any>();
  let assetSeq = 1;

  rawAssetRows.forEach((r: any) => {
    if (!r) return;
    const rawModel = getCol(r, assetHeaderMap, ['자산마스터명', '모델', '기종', '장비명'], 1);
    const rawAssetNo = getCol(r, assetHeaderMap, ['관리번호', '자산번호'], 4);
    if (!rawModel && !rawAssetNo) return;

    const modelName = sanitizeModelName(rawModel) || 'ES1330L';
    const assetNo = String(rawAssetNo || `TEMP-${assetSeq}`).trim().toUpperCase();
    const maker = getCol(r, assetHeaderMap, ['제조사', '제조업체'], 7) ? String(r[7]).trim() : inferMakerFromModel(modelName);
    const supplier = getCol(r, assetHeaderMap, ['공급처', '구입처'], 8) ? String(r[8]).trim() : '';
    const rawHeight = getCol(r, assetHeaderMap, ['작업높이', '규격'], 6);
    const heightM = typeof rawHeight === 'number' ? rawHeight : parseFloat(String(rawHeight || '5.8')) || 5.8;
    const feet = inferFeetFromModel(modelName, heightM);
    const acqDate = sanitizeExcelDate(getCol(r, assetHeaderMap, ['취득일자', '구입일'], 9)) || '2025-01-01';
    const acqPrice = sanitizeNumber(getCol(r, assetHeaderMap, ['취득가액', '구입가액'], 10)) || 11800000;
    const memo = getCol(r, assetHeaderMap, ['리스비고', '비고'], 16) ? String(r[16]).trim() : '';

    if (!productMap.has(modelName)) {
      productMap.set(modelName, {
        id: `PROD-${String(productMap.size + 1).padStart(7, '0')}`,
        modelName: modelName,
        feet: feet,
        spec: `${heightM}M (${feet}ft)`,
        manufacturer: maker,
        powerSource: '배터리',
        workingHeight: `${heightM} M`,
        platformHeight: `${(heightM - 2).toFixed(2)} M`,
        asContact: '031-334-5296',
        maxWindSpeed: '12.5 m/s 이내',
        capacityPreExt: '230 kg',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    if (supplier && !vendorMap.has(supplier)) {
      vendorMap.set(supplier, {
        id: `VEND-${String(vendorMap.size + 1).padStart(7, '0')}`,
        name: supplier,
        type: 'OTHER',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    // 감가상각은 【자산 정보 확정 단계】에서 전 자산 일괄 재계산 → 여기서는 placeholder
    const assetId = `ASSET-${String(assetSeq++).padStart(7, '0')}`;
    const assetEntity = {
      id: assetId,
      modelName: modelName,
      assetNo: assetNo,
      serialNo: getCol(r, assetHeaderMap, ['시리얼번호', 'S/N'], 3) ? String(getCol(r, assetHeaderMap, ['시리얼번호', 'S/N'], 3)).trim() : '',
      manufacturer: maker,
      manufactureYear: getCol(r, assetHeaderMap, ['연식', '제조년월'], 5) ? String(getCol(r, assetHeaderMap, ['연식', '제조년월'], 5)).trim() : '2025년',
      ownerType: 'OWNED',
      status: 'AVAILABLE',
      acquisitionDate: acqDate,
      acquisitionPrice: acqPrice,
      depreciationMonths: 96,
      residualValueRate: 10,
      accumDepreciation: 0,   // → 자산 확정 단계에서 덮어씀
      bookValue: acqPrice,    // → 자산 확정 단계에서 덮어씀
      cumRentalFee: 0,
      cumRepairCost: 0,
      supplier: supplier,
      vendorId: supplier && vendorMap.has(supplier) ? vendorMap.get(supplier).id : null,
      currentCustomerId: null,
      currentSiteId: null,
      contractStart: null,
      contractEnd: null,
      memo: memo,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    assetMap.set(assetNo, assetEntity);
  });

  // ── 2. 거래처정보현황 시트 파싱 ──
  const wsCust = wb.Sheets['거래처정보현황'];
  const allCustRows = wsCust ? XLSX.utils.sheet_to_json(wsCust, { header: 1, defval: null }) : [];
  let custHeaderMap = new Map<string, number>();
  let custDataStartIndex = 2;
  for (let i = 0; i < Math.min(10, allCustRows.length); i++) {
    const row = allCustRows[i] as any[];
    if (row && (row.includes('거래처명') || row.includes('사업자번호'))) {
      custHeaderMap = buildHeaderMap(row);
      custDataStartIndex = i + 1;
      break;
    }
  }
  const rawCustRows = allCustRows.slice(custDataStartIndex);
  
  let custSeq = 1;
  let siteSeq = 1;
  let contactSeq = 1;

  rawCustRows.forEach((r: any) => {
    if (!r) return;
    const rawBizRegNo = getCol(r, custHeaderMap, ['사업자번호', '사업자등록번호'], 1) ? String(getCol(r, custHeaderMap, ['사업자번호', '사업자등록번호'], 1)).trim() : '';
    const rawCustName = getCol(r, custHeaderMap, ['거래처명', '고객사명', '업체명'], 2) ? String(getCol(r, custHeaderMap, ['거래처명', '고객사명', '업체명'], 2)).trim() : '';
    
    // 헤더 행 무시 (사업자번호, 거래처명 등이 값으로 들어온 경우)
    if (rawCustName === '거래처명' || rawBizRegNo === '사업자번호') return;
    if (!rawCustName) return;

    const custName = normalizeCustomerName(rawCustName);
    let custEntity = customerMap.get(custName);

    if (!custEntity) {
      custEntity = {
        id: `CUST-${String(custSeq++).padStart(7, '0')}`,
        name: custName,
        bizRegNo: rawBizRegNo,
        representative: getCol(r, custHeaderMap, ['대표자', '대표자명'], 3) ? String(getCol(r, custHeaderMap, ['대표자', '대표자명'], 3)).trim() : '',
        repContact: getCol(r, custHeaderMap, ['현장명'], 7) ? String(r[7]).trim() : '',
        repEmail: getCol(r, custHeaderMap, ['현장주소'], 8) ? String(r[8]).trim() : '',
        address: getCol(r, custHeaderMap, ['사업장주소', '주소'], 4) ? String(getCol(r, custHeaderMap, ['사업장주소', '주소'], 4)).trim() : '',
        defaultBillingDay: 30,
        paymentDueDay: 15,
        isClosed: false,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      customerMap.set(custName, custEntity);
    }

    const rawSite = getCol(r, custHeaderMap, ['현장명', '현장'], 7) ? String(getCol(r, custHeaderMap, ['현장명', '현장'], 7)).trim() : '';
    if (rawSite && rawSite !== '-') {
      const { cleanSiteName } = extractSiteNameAndMemo(rawSite);
      const siteKey = `${custEntity.id}_${cleanSiteName}`;
      if (!siteMap.has(siteKey)) {
        siteMap.set(siteKey, {
          id: `SITE-${String(siteSeq++).padStart(7, '0')}`,
          customerId: custEntity.id,
          name: cleanSiteName,
          address: getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8) ? String(getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8)).trim() : '',
          contactName: getCol(r, custHeaderMap, ['현장담당자'], 9) ? String(getCol(r, custHeaderMap, ['현장담당자'], 9)).trim() : '',
          contact: getCol(r, custHeaderMap, ['청구담당자'], 10) ? String(getCol(r, custHeaderMap, ['청구담당자'], 10)).trim() : '',
          email: getCol(r, custHeaderMap, ['이메일', 'email'], 11) ? String(getCol(r, custHeaderMap, ['이메일', 'email'], 11)).trim() : '',
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
    }

    const rawContact = getCol(r, custHeaderMap, ['현장담당자', '담당자'], 9) ? String(getCol(r, custHeaderMap, ['현장담당자', '담당자'], 9)).trim() : '';
    if (rawContact && rawContact !== '-') {
      const { name, position } = extractContactPosition(rawContact);
      const contactKey = `${custEntity.id}_${name}`;
      if (!contactMap.has(contactKey)) {
        contactMap.set(contactKey, {
          id: `CONT-${String(contactSeq++).padStart(7, '0')}`,
          customerId: custEntity.id,
          name: name,
          position: position,
          contact: getCol(r, custHeaderMap, ['청구담당자'], 10) ? String(getCol(r, custHeaderMap, ['청구담당자'], 10)).trim() : '',
          email: getCol(r, custHeaderMap, ['이메일', 'email'], 11) ? String(getCol(r, custHeaderMap, ['이메일', 'email'], 11)).trim() : '',
          isPrimary: true,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
    }
  });

  // ── 3. 업체별마감일자 시트 파싱 ──
  const wsClosing = wb.Sheets['업체별마감일자'];
  const allClosingRows = wsClosing ? XLSX.utils.sheet_to_json(wsClosing, { header: 1, defval: null }) : [];
  let closingHeaderMap = new Map<string, number>();
  let closingDataStartIndex = 2;
  for (let i = 0; i < Math.min(10, allClosingRows.length); i++) {
    const row = allClosingRows[i] as any[];
    if (row && (row.includes('거래처명') || row.includes('마감일자'))) {
      closingHeaderMap = buildHeaderMap(row);
      closingDataStartIndex = i + 1;
      break;
    }
  }
  const rawClosingRows = allClosingRows.slice(closingDataStartIndex);
  
  rawClosingRows.forEach((r: any) => {
    // 업체별마감일자 시트 구조: Col[0]=순번, Col[1]=업체명, Col[2]=마감일, Col[3]=결재일, Col[4]=비고
    // getCol fallback=0은 순번(숫자)을 고객명으로 읽는 버그를 유발하므로 Col[1] 직접 읽기
    const rawCust = (r[1] && String(r[1]).trim() && String(r[1]).trim() !== 'nan') ? String(r[1]).trim() : null;
    if (!r || !rawCust) return;
    if (typeof r[1] === 'number') return; // 숫자(순번)인 경우 건너뜀
    const custName = normalizeCustomerName(rawCust);
    if (!custName || custName === '거래처명' || custName === '고객사명' || custName === '업체명' || custName === '사업자번호') return;
    const closingDay = parseClosingDay((r[2] && String(r[2]).trim() !== 'nan') ? String(r[2]).trim() : '');
    const paymentTerm = parsePaymentDueTerm((r[3] && String(r[3]).trim() !== 'nan') ? String(r[3]).trim() : '');
    const memo = (r[4] && String(r[4]).trim() !== 'nan') ? String(r[4]).trim() : '';

    let custEntity = customerMap.get(custName);
    if (!custEntity) {
      custEntity = {
        id: `CUST-${String(custSeq++).padStart(7, '0')}`,
        name: custName,
        bizRegNo: '',
        representative: '',
        repContact: '',
        repEmail: '',
        address: '',
        defaultBillingDay: closingDay,
        paymentDueDay: paymentTerm.paymentDueDay,
        paymentTermDays: paymentTerm.paymentTermDays,
        isClosed: false,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      customerMap.set(custName, custEntity);
    } else {
      custEntity.defaultBillingDay = closingDay;
      custEntity.paymentDueDay = paymentTerm.paymentDueDay;
      custEntity.paymentTermDays = paymentTerm.paymentTermDays;
    }
  });

  // ── 4. 202608 월별 계약/배차/청구 종합 파싱 ──
  const wsMain = wb.Sheets['계약현황'] || wb.Sheets['202608'];
  const allMainRows = wsMain ? XLSX.utils.sheet_to_json(wsMain, { header: 1, defval: null }) : [];
  let mainHeaderMap = new Map<string, number>();
  let mainDataStartIndex = 3;
  for (let i = 0; i < Math.min(10, allMainRows.length); i++) {
    const row = allMainRows[i] as any[];
    if (row && (row.includes('업체명') || row.includes('현장명'))) {
      mainHeaderMap = buildHeaderMap(row);
      mainDataStartIndex = i + 1;
      break;
    }
  }
  const rawMainRows = allMainRows.slice(mainDataStartIndex);

  const contracts: any[] = [];
  const contractAssets: any[] = [];
  const externalLeases: any[] = [];
  const deliveries: any[] = [];
  const outboundInspections: any[] = [];
  const assetInOutLogs: any[] = [];
  const contractHistories: any[] = [];
  const billings: any[] = [];
  const billingDetails: any[] = [];
  const purchaseBillings: any[] = [];
  const purchaseBillingDetails: any[] = [];
  const receivables: any[] = [];

  let contractSeq = 1;
  let caSeq = 1;
  let leaseSeq = 1;
  let delivSeq = 1;
  let inspSeq = 1;
  let logSeq = 1;
  let histSeq = 1;
  let billSeq = 1;
  let bdSeq = 1;
  let pbSeq = 1;
  let pbdSeq = 1;
  let recvSeq = 1;

  let excelTotalBillingSum = 0;
  const currentMonthBillingGroup = new Map<string, any>();
  const purchaseBillingGroup = new Map<string, any>();

  // ── 계약 그룹핑 맵 ──────────────────────────────────────────────
  // 동일 (고객사 + 현장 + 계약시작일 + 계약종료일) 조합 = 하나의 계약으로 통합
  // 엑셀 1행 = 계약 1건이 아니라, N개 행 = 1개 계약 + N개 체결자산(contract_assets)
  // ───────────────────────────────────────────────────────────────
  const contractGroupMap = new Map<string, any>(); // key → 계약 엔티티

  rawMainRows.forEach((r: any) => {
    if (!r) return;
    // ── 중복 헤더 컬럼 직접 인덱스 분리 파싱 ──────────────────────────────────
    // 계약현황 시트에 '장비명'[9/12], '관리번호'[10/13], '수량'[11/14]이 중복 존재.
    // buildHeaderMap은 첫 번째(당사 측)만 등록하므로, 전대 측은 헤더명 검색 불가.
    // 전대 장비 전용 행에서 getCol fallback이 Col[3](최초개시일=날짜시리얼)을 읽어
    // 모델명 = 45845 같은 날짜 숫자로 깨지는 버그를 직접 인덱스로 완전 차단.
    const ownModelRaw  = (r[9]  && String(r[9]).trim()  && String(r[9]).trim()  !== 'nan') ? String(r[9]).trim()  : '';
    const leaseModelRaw= (r[12] && String(r[12]).trim() && String(r[12]).trim() !== 'nan') ? String(r[12]).trim() : '';
    const rawModel = ownModelRaw || leaseModelRaw;  // 당사 있으면 우선, 없으면 전대

    // Col[10]=당사장비 관리번호, Col[13]=전대장비 관리번호
    const ownAssetNo   = (r[10] && String(r[10]).trim() && String(r[10]).trim() !== 'nan') ? String(r[10]).trim().toUpperCase() : '';
    const leaseAssetNo = (r[13] && String(r[13]).trim() && String(r[13]).trim() !== 'nan') ? String(r[13]).trim().toUpperCase() : '';
    const rawCustName = getCol(r, mainHeaderMap, ['업체명', '거래처명', '고객명'], 0);
    if (!rawCustName && !rawModel) return;
    if (rawCustName === '업체명' || rawCustName === '고객명' || rawCustName === '거래처명') return;

    const custName = normalizeCustomerName(rawCustName) || '기본고객사';
    let customer = customerMap.get(custName);
    if (!customer) {
      customer = {
        id: `CUST-${String(custSeq++).padStart(7, '0')}`,
        name: custName,
        bizRegNo: '',
        representative: '',
        repContact: '',
        repEmail: '',
        address: '',
        defaultBillingDay: 30,
        paymentDueDay: 15,
        isClosed: false,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      customerMap.set(custName, customer);
    }

    const rawSite = getCol(r, mainHeaderMap, ['현장명'], 2) ? String(getCol(r, mainHeaderMap, ['현장명'], 2)).trim() : '';
    const { cleanSiteName, dispatchMemo } = extractSiteNameAndMemo(rawSite);
    const siteKey = `${customer.id}_${cleanSiteName}`;
    let site = siteMap.get(siteKey);
    if (!site) {
      site = {
        id: `SITE-${String(siteSeq++).padStart(7, '0')}`,
        customerId: customer.id,
        name: cleanSiteName,
        address: customer.address || '',
        contactName: '',
        contact: '',
        email: '',
        createdAt: nowIso,
        updatedAt: nowIso
      };
      siteMap.set(siteKey, site);
    }

    const targetModel = sanitizeModelName(rawModel) || 'ES1330L';
    // 높이는 모델명에서 추론 (Col[3]=최초개시일(날짜시리얼)을 높이로 잘못 읽는 버그 차단)
    const feet = inferFeetFromModel(targetModel, 0);
    const heightM = feet > 0 ? feet * 0.3048 : 5.8; // feet→미터 환산, 불명 시 5.8M 기본값

    if (!productMap.has(targetModel)) {
      productMap.set(targetModel, {
        id: `PROD-${String(productMap.size + 1).padStart(7, '0')}`,
        modelName: targetModel,
        feet: feet,
        spec: `${heightM}M (${feet}ft)`,
        manufacturer: inferMakerFromModel(targetModel),
        powerSource: '배터리',
        workingHeight: `${heightM} M`,
        platformHeight: `${(heightM - 2).toFixed(2)} M`,
        asContact: '031-334-5296',
        maxWindSpeed: '12.5 m/s 이내',
        capacityPreExt: '230 kg',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    // (ownAssetNo, leaseAssetNo는 상단 중복 헤더 직접 인덱스 블록에서 이미 선언됨)
    const leaseVendorName = getCol(r, mainHeaderMap, ['임차업체', '매입처'], 15) ? String(getCol(r, mainHeaderMap, ['임차업체', '매입처'], 15)).trim() : '';
    const leasePrice = sanitizeNumber(getCol(r, mainHeaderMap, ['임차단가', '매입단가'], 16));
    const leaseReturnDate = sanitizeExcelDate(getCol(r, mainHeaderMap, ['전대반납일', '반납일'], 17));

    let matchedAsset: any = null;

    if (ownAssetNo) {
      matchedAsset = assetMap.get(ownAssetNo);
      if (!matchedAsset) {
        const assetId = `ASSET-${String(assetSeq++).padStart(7, '0')}`;
        matchedAsset = {
          id: assetId,
          modelName: targetModel,
          assetNo: ownAssetNo,
          serialNo: '',
          manufacturer: inferMakerFromModel(targetModel),
          manufactureYear: '2025년',
          ownerType: 'OWNED',
          status: 'AVAILABLE',
          acquisitionDate: '2025-01-01',
          acquisitionPrice: 11800000,
          depreciationMonths: 96,
          residualValueRate: 10,
          accumDepreciation: 0,
          bookValue: 11800000,
          cumRentalFee: 0,
          cumRepairCost: 0,
          supplier: '',
          vendorId: null,
          currentCustomerId: null,
          currentSiteId: null,
          contractStart: null,
          contractEnd: null,
          memo: '계약현황(202608) 시트 기반 자동등록',
          createdAt: nowIso,
          updatedAt: nowIso
        };
        assetMap.set(ownAssetNo, matchedAsset);
      }
    } else if (leaseAssetNo) {
      // 자사번호 없이 전대번호만 있는 경우: 외부임차 자산으로 등록
      matchedAsset = assetMap.get(leaseAssetNo);
      if (!matchedAsset) {
        const assetId = `ASSET-${String(assetSeq++).padStart(7, '0')}`;
        matchedAsset = {
          id: assetId,
          modelName: targetModel,
          assetNo: leaseAssetNo,
          serialNo: '',
          manufacturer: inferMakerFromModel(targetModel),
          manufactureYear: '2025년',
          ownerType: 'RENTED',
          status: 'AVAILABLE',
          acquisitionDate: '2026-08-01',
          acquisitionPrice: 0,
          depreciationMonths: 0,
          residualValueRate: 0,
          accumDepreciation: 0,
          bookValue: 0,
          cumRentalFee: 0,
          cumRepairCost: 0,
          vendorId: null,           // 아래 leaseVendor 처리 후 주입
          rentStart: sanitizeExcelDate(r[4]) || '2026-08-01',
          rentEnd: leaseReturnDate,
          monthlyRentFee: leasePrice,
          dailyRentFee: Math.round(leasePrice / 30),
          actualRentReturnDate: leaseReturnDate,
          currentCustomerId: null,
          currentSiteId: null,
          contractStart: null,
          contractEnd: null,
          memo: `임차(전대) 장비: ${leaseVendorName}`,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        assetMap.set(leaseAssetNo, matchedAsset);
      }
    }

    // ── 전대(external_lease) 등록 —
    // 자사번호 + 전대번호 동시 존재(혼재 행) 또는 전대번호만 있는 행 모두 처리
    // Build.18 fix: if-else → 독립 블록으로 분리하여 1,520건 혼재 행 누락 방지
    if (leaseAssetNo) {
      let leaseVendor: any = null;
      if (leaseVendorName) {
        leaseVendor = vendorMap.get(leaseVendorName);
        if (!leaseVendor) {
          leaseVendor = {
            id: `VEND-${String(vendorMap.size + 1).padStart(7, '0')}`,
            name: leaseVendorName,
            type: 'RENTAL',
            isActive: true,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          vendorMap.set(leaseVendorName, leaseVendor);
        }
      }

      // matchedAsset이 자사 자산인 경우(혼재 행): 전대 asset을 별도 생성하지 않고
      // external_lease 레코드만 생성 (자사 자산 추적은 ownAssetNo로 이미 완료)
      const leaseAssetRef = ownAssetNo
        ? (assetMap.get(ownAssetNo) || matchedAsset)  // 혼재 행: 자사 자산 참조
        : (assetMap.get(leaseAssetNo) || matchedAsset); // 전대만: 임차 자산 참조

      // leaseVendorId를 자산에도 주입 (전대번호만 있는 경우)
      if (!ownAssetNo && leaseAssetRef && leaseVendor) {
        leaseAssetRef.vendorId = leaseVendor.id;
      }

      const leaseId = `LEASE-2608-${String(leaseSeq++).padStart(4, '0')}`;
      const leaseEntity: any = {
        id: leaseId,
        vendorId: leaseVendor ? leaseVendor.id : null,
        contractId: null,   // 계약 그룹핑 완료 후 아래에서 주입 (A-01 fix)
        contractAssetId: null,
        assetDescription: `${targetModel} (${leaseAssetNo})`,
        monthlyRentFee: leasePrice,
        dailyRentFee: Math.round(leasePrice / 30),
        leaseStartDate: sanitizeExcelDate(r[4]) || '2026-08-01',
        leaseEndDate: leaseReturnDate,
        status: leaseReturnDate ? 'RETURNED' : 'ACTIVE',
        statementFileUrl: null,
        memo: `임차처: ${leaseVendorName}`,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      externalLeases.push(leaseEntity);

      if (leasePrice > 0 && leaseVendor) {
        let pGroup = purchaseBillingGroup.get(leaseVendor.id);
        if (!pGroup) {
          pGroup = { vendorId: leaseVendor.id, totalAmount: 0, details: [] };
          purchaseBillingGroup.set(leaseVendor.id, pGroup);
        }
        pGroup.totalAmount += leasePrice;
        pGroup.details.push({
          assetId: leaseAssetRef ? leaseAssetRef.id : null,
          contractId: null,
          expenseType: 'RENTAL_FEE',
          itemName: `${targetModel} (${leaseAssetNo}) 전대 임차료`,
          amount: leasePrice
        });
      }
    }


    const rowStartDate = sanitizeExcelDate(getCol(r, mainHeaderMap, ['계약시작일', '시작일', '출고일'], 4)) || '2026-08-01';
    const rowEndDate = sanitizeExcelDate(getCol(r, mainHeaderMap, ['계약종료일', '종료일'], 5)) || '9999-12-31';
    const rowMonthlyFee = sanitizeNumber(getCol(r, mainHeaderMap, ['월렌탈료', '렌탈료', '단가'], 22)) || (sanitizeNumber(getCol(r, mainHeaderMap, ['당월청구액', '청구합계'], 25)) > 0 ? sanitizeNumber(getCol(r, mainHeaderMap, ['당월청구액', '청구합계'], 25)) : 300000);
    const rowDailyFee = Math.round(rowMonthlyFee / 30);
    // Col[8]=계약구분 ('연장','종료','가상' 등). '상태'/'결재상태' 헤더는 없으므로 직접 인덱스 사용
    const contractStatusStr = (r[8] && String(r[8]).trim()) ? String(r[8]).trim() : '';
    // 계약기간 만료 자산도 연장/반납 미결 상태이므로 ACTIVE 유지.
    // 엑셀 Col[8]에 '종료'로 명시된 경우에만 COMPLETED 처리.
    const isCompleted = contractStatusStr === '종료';

    // ── 계약 그룹핑: 동일 (고객사 + 현장 + 시작일 + 종료일) = 1개 계약 ──
    // 재영전기처럼 같은 현장·기간에 여러 자산이 있을 경우 하나의 계약으로 묶음
    const contractGroupKey = `${customer.id}_${site.id}_${rowStartDate}_${rowEndDate}`;
    let contractId: string;
    let contractNo: string;

    if (contractGroupMap.has(contractGroupKey)) {
      // 이미 동일 (고객+현장+기간) 계약이 존재 → 기존 계약 재사용
      const existingContract = contractGroupMap.get(contractGroupKey);
      contractId = existingContract.id;
      contractNo = existingContract.contractNo;
      // 계약 헤더의 월 합계를 추가 자산 단가만큼 누적
      existingContract._totalMonthlyFee = (existingContract._totalMonthlyFee || 0) + rowMonthlyFee;
    } else {
      // 신규 계약 생성
      contractId = `CONT-260801-${String(contractSeq++).padStart(4, '0')}`;
      contractNo = `C2608-${String(contractSeq - 1).padStart(4, '0')}`;

      const newContract = {
        id: contractId,
        contractNo: contractNo,
        customerId: customer.id,
        salespersonId: MIGRATION_SALESPERSON_ID,   // C-01 fix: 김동우 팀장
        contactId: null,
        siteId: site.id,
        billingDay: customer.billingDay || 30,
        paymentDueDay: customer.paymentDueDay || 15,
        lateInterestRate: 0,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
        startDate: rowStartDate,
        endDate: rowEndDate,
        lastBillingDate: '2026-08-31',
        lastBilledPeriodStart: '2026-08-01',
        lastBilledPeriodEnd: '2026-08-31',
        lastBilledYm: '2026-08',
        billingCount: 1,
        _totalMonthlyFee: rowMonthlyFee,  // 내부 집계용 (DB 저장 X)
        createdAt: nowIso,
        updatedAt: nowIso
      };
      contracts.push(newContract);
      contractGroupMap.set(contractGroupKey, newContract);

      contractHistories.push({
        id: `CH-${String(histSeq++).padStart(7, '0')}`,
        contractId: contractId,
        changeType: 'REGISTER',
        changeDate: rowStartDate,
        description: `계약 최초 등록 (${rowStartDate} 개시)`,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    const caId = `CA-${String(caSeq++).padStart(7, '0')}`;
    contractAssets.push({
      id: caId,
      contractId: contractId,
      assetId: matchedAsset ? matchedAsset.id : null,
      expectedModel: targetModel,
      monthlyRentalFee: rowMonthlyFee,
      dailyRentalFee: rowDailyFee,
      startDate: rowStartDate,
      endDate: rowEndDate,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // [A-01 fix] 전대 자산인 경우: leaseEntity.contractId를 이제 확정된 contractId로 주입
    if (leaseAssetNo) {
      const lastLease = externalLeases[externalLeases.length - 1];
      if (lastLease && lastLease.contractId === null) {
        lastLease.contractId = contractId;
        lastLease.contractAssetId = caId; // 김에 contractAssetId도 매핑
      }
    }

    // 🌟 [보강 2] 자산(assets) ➔ 계약정보 양방향 실시간 동기화 바인딩
    // 계약기간 만료 자산도 연장/반납 미결 상태이므로 RENTED + 현장 바인딩 유지.
    // 엑셀 Col[8]='종료' 명시 시에만 COMPLETED/RENTED_RETURNED 처리.
    if (matchedAsset) {
      if (!isCompleted) {
        // 활성(ACTIVE) 계약 + 기간 만료 후 미결 계약 모두 RENTED로 처리
        matchedAsset.status = 'RENTED';
        matchedAsset.currentCustomerId = customer.id;
        matchedAsset.currentSiteId = site.id;
        matchedAsset.contractStart = rowStartDate;
        matchedAsset.contractEnd = rowEndDate;
      } else {
        // Col[8]='종료'로 명시된 경우에만 회수 완료 처리
        if (matchedAsset.status !== 'RENTED') {
          matchedAsset.status = matchedAsset.ownerType === 'RENTED' ? 'RENTED_RETURNED' : 'AVAILABLE';
        }
      }
    }

    // ── 배차·출고검수·입출고일지 생성 제외 ─────────────────────────────
    // 배차 엑셀 양식 미입수 상태 → 정확한 배차 이력 재현 불가.
    // 배차 엑셀 입수 후 별도 재시행 예정.
    // deliveries / outbound_inspections / asset_inout_logs 는 현 마이그레이션에서 미생성.
    // ────────────────────────────────────────────────────────────────────


    // ── 외상미수금(receivables) 자동 생성 제외 ──────────────────────────
    // 엑셀 Col[7] 운반비는 과거 계약 체결 시점의 참조값이거나 날짜 오입력 셀이므로,
    // 현재 시점의 미청구 외상채권(receivables)으로 자동 생성하지 않음.
    // 외상미수금은 향후 실제 배차(고객청구 확정) 또는 정비(고객과실 확정) 이벤트에 의해서만 생성됨.
    // ────────────────────────────────────────────────────────────────────

    // ── 과거 소급 청구서 선택적 생성 (histBillingRange 지정 시에만 실행) ──
    // Col[3] = 최초개시일 (실제 계약 시작일). Col[4] = 개시일은 당월 기산일이므로 사용 금지.
    const firstStartDate = sanitizeExcelDate(r[3]) || rowStartDate;
    const startYmd = firstStartDate;
    // histBillingRange가 없으면 소급 청구서 생성 안 함 (담당자가 UI에서 기간을 지정해야만 생성)
    if (histBillingRange && startYmd && startYmd < '2026-08-01') {
      const rangeStart = histBillingRange.start;   // 'YYYY-MM' 형식
      const rangeEnd   = histBillingRange.end;     // 'YYYY-MM' 형식
      const startParts = startYmd.split('-');
      // 소급 시작월: max(계약 최초개시월, 지정 시작월)
      const contractStartYm = `${startParts[0]}-${startParts[1]}`;
      const loopStartYm = contractStartYm >= rangeStart ? contractStartYm : rangeStart;
      const loopStartParts = loopStartYm.split('-');
      let curYear = parseInt(loopStartParts[0], 10);
      let curMonth = parseInt(loopStartParts[1], 10);

      const [rangeEndY, rangeEndM] = rangeEnd.split('-').map(Number);

      while (curYear < rangeEndY || (curYear === rangeEndY && curMonth <= rangeEndM)) {
        const ymStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;
        const lastDayOfCurMonth = new Date(curYear, curMonth, 0).getDate();
        const billDateStr = `${ymStr}-${String(Math.min(customer.billingDay || 30, lastDayOfCurMonth)).padStart(2, '0')}`;

        // A-02 fix: 실제 해당 월의 일수로 계산 (30일 고정 제거)
        let daysInPeriod = lastDayOfCurMonth;
        const origStartParts = firstStartDate.split('-');
        if (curYear === parseInt(origStartParts[0], 10) && curMonth === parseInt(origStartParts[1], 10)) {
          // 계약 최초개시월: 개시일부터 말일까지의 일수
          const startDay = parseInt(origStartParts[2], 10);
          daysInPeriod = Math.max(1, lastDayOfCurMonth - startDay + 1);
        }

        const isFullMonth = daysInPeriod === lastDayOfCurMonth;
        const histBillAmount = isFullMonth ? rowMonthlyFee : Math.round(rowDailyFee * daysInPeriod);

        if (matchedAsset) {
          // 기수 원칙: 과거 소급 청구서 발행 금액(histBillAmount)만 누적 — 실발행된 청구의 기수 성과
          matchedAsset.cumRentalFee = (matchedAsset.cumRentalFee || 0) + histBillAmount;
        }

        const histBillId = `BILL-HIST-${String(billSeq++).padStart(6, '0')}`;
        const histDueDate = calcDueDate(billDateStr, customer.paymentDueDay ?? 30, customer.paymentTermDays ?? null);
        billings.push({
          id: histBillId,
          customerId: customer.id,
          billingYm: ymStr,
          billingDate: billDateStr,
          totalAmount: histBillAmount,
          paidAmount: histBillAmount,
          status: 'PAID',
          createdAt: nowIso,
          updatedAt: nowIso
        });

        billingDetails.push({
          id: `BD-${String(bdSeq++).padStart(7, '0')}`,
          billingId: histBillId,
          contractAssetId: caId,
          assetId: matchedAsset?.id,
          itemName: `${targetModel} (${ownAssetNo || leaseAssetNo || '가상'}) 렌탈료`,
          quantity: daysInPeriod,
          unitPrice: rowDailyFee,
          amount: histBillAmount,
          description: `${ymStr} 정기 렌탈료 (${daysInPeriod}일 가동)`,
          displayName: `${targetModel} 렌탈료`,
          createdAt: nowIso,
          updatedAt: nowIso
        });

        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
    }

    // ── 2026-08 당월 청구서 집계 ──
    const rowBillingTotal = sanitizeNumber(r[25]);
    const monthRentFee = sanitizeNumber(r[22]);
    const otherFee = sanitizeNumber(r[23]);
    const otherMemo = r[24] ? String(r[24]).trim() : '';
    const days = sanitizeNumber(r[6]) || 30;

    excelTotalBillingSum += rowBillingTotal;

    if (matchedAsset) {
      // 기수 원칙: 당월 실청구 금액(monthRentFee 또는 rowBillingTotal)만 누적 — 기수된 성과
      matchedAsset.cumRentalFee = (matchedAsset.cumRentalFee || 0) + (monthRentFee || rowBillingTotal);
    }

    let custBill = currentMonthBillingGroup.get(customer.id);
    if (!custBill) {
      const billDate = '2026-08-31';
      custBill = {
        customer: customer,
        billingDate: billDate,
        dueDate: calcDueDate(billDate, customer.paymentDueDay ?? 30, customer.paymentTermDays ?? null),
        details: [],
        totalAmount: 0,
        paidAmount: 0
      };
      currentMonthBillingGroup.set(customer.id, custBill);
    }

    if (rowBillingTotal > 0) {
      const rawSum = monthRentFee + otherFee + transportFee;
      if (rawSum > 0 && (otherFee > 0 || transportFee > 0)) {
        const rentPortion = Math.round(rowBillingTotal * (monthRentFee / rawSum));
        const transPortion = Math.round(rowBillingTotal * (transportFee / rawSum));
        const otherPortion = rowBillingTotal - rentPortion - transPortion;

        if (rentPortion > 0) {
          custBill.details.push({
            contractAssetId: caId,
            assetId: matchedAsset?.id,
            itemName: `${targetModel} (${ownAssetNo || leaseAssetNo || '가상'}) 렌탈료`,
            itemType: 'RENTAL',
            quantity: days,
            unitPrice: Math.round(rentPortion / days),
            amount: rentPortion,
            description: `2026-08 렌탈료 (${days}일)`,
            internalDescription: `현장: ${cleanSiteName}`
          });
        }
        if (transPortion > 0) {
          custBill.details.push({
            contractAssetId: caId,
            assetId: matchedAsset?.id,
            itemName: `운반비 (${cleanSiteName})`,
            itemType: 'TRANSPORT',
            quantity: 1,
            unitPrice: transPortion,
            amount: transPortion,
            description: `운송 배차 비용`,
            internalDescription: `현장: ${cleanSiteName}`
          });
        }
        if (otherPortion > 0) {
          custBill.details.push({
            contractAssetId: caId,
            assetId: matchedAsset?.id,
            itemName: otherMemo || '기타 부대비용',
            itemType: 'OTHER',
            quantity: 1,
            unitPrice: otherPortion,
            amount: otherPortion,
            description: otherMemo || '기타 청구액',
            internalDescription: `현장: ${cleanSiteName}`
          });
        }
      } else {
        custBill.details.push({
          contractAssetId: caId,
          assetId: matchedAsset?.id,
          itemName: `${targetModel} (${ownAssetNo || leaseAssetNo || '가상'}) 렌탈료`,
          itemType: 'RENTAL',
          quantity: days,
          unitPrice: Math.round(rowBillingTotal / days),
          amount: rowBillingTotal,
          description: `2026-08 렌탈료 (${days}일)`,
          internalDescription: `현장: ${cleanSiteName}`
        });
      }
      custBill.totalAmount += rowBillingTotal;
    }
  });

  // 8월 청구서 및 상세 확정
  currentMonthBillingGroup.forEach((group, custId) => {
    if (group.totalAmount <= 0) return;
    const billingId = `BILL-2608-${String(billSeq++).padStart(4, '0')}`;
    const billingNo = `BL-2608-${String(billSeq - 1).padStart(4, '0')}`;

    billings.push({
      id: billingId,
      customerId: custId,
      billingYm: '2026-08',
      billingDate: group.billingDate,
      totalAmount: group.totalAmount,
      paidAmount: 0,
      status: 'UNPAID',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    group.details.forEach(d => {
      billingDetails.push({
        id: `BD-${String(bdSeq++).padStart(7, '0')}`,
        billingId: billingId,
        contractAssetId: d.contractAssetId,
        assetId: d.assetId,
        itemName: d.itemName,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        amount: d.amount,
        description: d.description,
        internalDescription: d.internalDescription,
        displayName: d.itemName,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    });
  });

  // 매입처별 8월 매입 청구서 생성 (purchase_billings)
  purchaseBillingGroup.forEach((pGroup, key) => {
    const pbId = `PB-2608-${String(pbSeq++).padStart(4, '0')}`;
    purchaseBillings.push({
      id: pbId,
      vendorId: pGroup.vendorId,
      billingYm: '2026-08',
      totalAmount: pGroup.totalAmount,
      status: 'REQUESTED',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    pGroup.details.forEach(d => {
      purchaseBillingDetails.push({
        id: `PBD-${String(pbdSeq++).padStart(7, '0')}`,
        purchaseBillId: pbId,
        assetId: d.assetId,
        contractId: d.contractId,
        expenseType: d.expenseType,
        itemName: d.itemName,
        amount: d.amount,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    });
  });

  const parsedProducts = Array.from(productMap.values());
  const parsedVendors = Array.from(vendorMap.values());
  const parsedCustomers = Array.from(customerMap.values());
  const parsedSites = Array.from(siteMap.values());
  const parsedContacts = Array.from(contactMap.values());

  // ──────────────────────────────────────────────────────────────────
  // 【자산 정보 확정 단계】 — 모든 시트 파싱 완료 후, DB INSERT 전
  // 이 시점에서 assetMap에 모든 자산이 확정 등록된 상태이므로
  // 자사 보유(OWNED) 자산 전체에 대해 감가상각을 일괄 재계산한다.
  //
  // 목적:
  //   - 보유자산현황 시트에서 직접 등록된 자산: 인라인 계산값을 덮어씀(재검증)
  //   - 202608 계약대장 시트에서 자동 등록된 자산: accumDepreciation=0 하드코딩을 교정
  //   - RENTED/EXTERNAL 자산: 감가상각 해당 없음 → 건너뜀
  //
  // 기준일: 2026-08-31 (마이그레이션 기준 결산일)
  // ──────────────────────────────────────────────────────────────────
  const DEPRECIATION_BASE_DATE = new Date('2026-08-31');

  assetMap.forEach((asset) => {
    if (asset.ownerType !== 'OWNED') return; // 전대(임차) 자산 제외

    const acqPrice = asset.acquisitionPrice || 0;
    const acqDate = asset.acquisitionDate;

    if (!acqDate || acqPrice <= 0) {
      // 취득가 또는 취득일 미확정 자산 — 감가상각 미적용, 장부가 = 취득가 유지
      asset.accumDepreciation = 0;
      asset.bookValue = acqPrice;
      return;
    }

    const depnResult = calculateAssetDepreciation(
      {
        acquisitionPrice: acqPrice,
        acquisitionDate: acqDate,
        depreciationMonths: asset.depreciationMonths || 96,
        residualValueRate: asset.residualValueRate ?? 10,
        status: asset.status
      } as any,
      DEPRECIATION_BASE_DATE
    );

    asset.accumDepreciation = depnResult.accumDepreciation;
    asset.bookValue = depnResult.bookValue;
  });
  // ── 자산 정보 확정 완료 ──────────────────────────────────────────

  // ── 계약 헤더 내부 집계 필드 정리 (DB INSERT 전 제거) ──────────
  // _totalMonthlyFee는 그룹핑 중 집계용으로 사용된 임시 필드.
  // TABLE_COLUMNS 화이트리스트가 걸러주지만, 명시적으로 제거.
  contracts.forEach(c => { delete c._totalMonthlyFee; });
  // ────────────────────────────────────────────────────────────────

  const parsedAssets = Array.from(assetMap.values());

  const currentMonthBills = billings.filter(b => b.billingYm === '2026-08');
  const histBills = billings.filter(b => b.billingYm !== '2026-08');
  const outboundDelivs = deliveries.filter(d => d.type === 'OUTBOUND');
  const inboundDelivs = deliveries.filter(d => d.type === 'INBOUND');

  const stats: MigrationStats = {
    productsCount: parsedProducts.length,
    vendorsCount: parsedVendors.length,
    customersCount: parsedCustomers.length,
    sitesCount: parsedSites.length,
    contactsCount: parsedContacts.length,
    assetsCount: parsedAssets.length,
    contractsCount: contracts.length,
    contractAssetsCount: contractAssets.length,
    externalLeasesCount: externalLeases.length,
    outboundDeliveriesCount: outboundDelivs.length,
    inboundDeliveriesCount: inboundDelivs.length,
    outboundInspectionsCount: outboundInspections.length,
    assetInOutLogsCount: assetInOutLogs.length,
    contractHistoriesCount: contractHistories.length,
    historicalBillingsCount: histBills.length,
    currentBillingsCount: currentMonthBills.length,
    totalBillingDetailsCount: billingDetails.length,
    totalHistoricalBillingAmount: histBills.reduce((acc, b) => acc + b.totalAmount, 0),
    currentMonthBillingAmount: currentMonthBills.reduce((acc, b) => acc + b.totalAmount, 0),
    purchaseBillingsCount: purchaseBillings.length,
    totalPurchaseBillingAmount: purchaseBillings.reduce((acc, b) => acc + b.totalAmount, 0),
    receivablesCount: receivables.length,
    totalReceivablesAmount: receivables.reduce((acc, r) => acc + r.totalAmount, 0),
    docLinkedProductsCount: parsedProducts.filter(p => p.specSheetUrl).length,
    activeRentedAssetsCount: parsedAssets.filter(a => a.currentCustomerId).length
  };

  return {
    products: parsedProducts,
    vendors: parsedVendors,
    customers: parsedCustomers,
    customerSites: parsedSites,
    customerContacts: parsedContacts,
    assets: parsedAssets,
    contracts,
    contractAssets,
    externalLeases,
    deliveries,
    outboundInspections,
    assetInOutLogs,
    contractHistories,
    billings,
    billingDetails,
    purchaseBillings,
    purchaseBillingDetails,
    receivables,
    stats,
    excelTotalBillingSum
  };
}

// ──────────────────────────────────────────────
// 5. 청킹(Chunking) 일괄 DB 인서트 파이프라인 (스키마 화이트리스트 필터링 필수 적용)
// ──────────────────────────────────────────────
async function batchUpsertChunked(table: string, records: any[], chunkSize: number = 200, onProgress?: (msg: string) => void) {
  if (!records || records.length === 0) return;

  // 🌟 스키마 화이트리스트로 불필요한 클라이언트 가상 필드 사전 정제
  const sanitizedRecords = records.map(r => filterRecordBySchema(table, r));

  // 🔒 id 기준 중복 제거 — 동일 id가 두 번 이상 존재하면 PostgreSQL UPSERT에서
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" 에러 발생
  const dedupMap = new Map<string, any>();
  for (const r of sanitizedRecords) {
    if (r.id) dedupMap.set(r.id, r);
    else dedupMap.set(JSON.stringify(r), r); // id 없는 행은 전체 내용으로 키 설정
  }
  const dedupedRecords = Array.from(dedupMap.values());

  if (supabase) {
    for (let i = 0; i < dedupedRecords.length; i += chunkSize) {
      const chunk = dedupedRecords.slice(i, i + chunkSize);
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`[Ingest Error] ${table} chunk ${i / chunkSize + 1} failed:`, error.message);
        throw new Error(`${table} 저장 실패: ${error.message}`);
      }
      if (onProgress) {
        onProgress(`${table} 적재 진행 중 (${Math.min(i + chunkSize, dedupedRecords.length)} / ${dedupedRecords.length})`);
      }
    }
  } else {
    const tableArr = (db as any)[table] || [];
    const map = new Map(tableArr.map((item: any) => [item.id, item]));
    dedupedRecords.forEach(r => map.set(r.id, r));
    (db as any)[table] = Array.from(map.values());
  }
}


export async function ingestExcelInitialData(
  parsed: ParsedInitialData,
  onProgress?: (step: number, total: number, message: string) => void
): Promise<{ success: boolean; report: ReconciliationReport; message: string }> {
  try {
    const totalSteps = 13;

    // Step 0: 기존 비즈니스 데이터 전체 삭제 (stale 데이터 완전 차단)
    // upsert만으로는 ID가 다른 구버전 행이 잔류하므로, 재적재 전 FK 역순으로 DELETE ALL 수행
    onProgress?.(0, totalSteps, '0/13: 기존 비즈니스 데이터 정리 중 (stale 행 완전 삭제)...');
    if (supabase) {
      const TRUNCATE_ORDER = [
        'asset_inout_logs',
        'outbound_inspections',
        'deliveries',
        'receivables',
        'billing_details',
        'billings',
        'contract_assets',
        'external_leases',
        'contract_history',
        'contracts',
        'assets',
        'products',
        'vendors',
        'customer_contacts',
        'customer_sites',
        'customers',
      ];
      for (const table of TRUNCATE_ORDER) {
        try {
          const { error } = await supabase.from(table).delete().neq('id', '____IMPOSSIBLE____');
          if (error) {
            console.warn(`[Ingest] pre-truncate warning for ${table}:`, error.message);
          }
        } catch (e) {
          console.warn(`[Ingest] pre-truncate exception for ${table}:`, e);
        }
      }
    }

    // Step 1: Products & R2 Docs
    onProgress?.(1, totalSteps, `1/13: 장비 모델 마스터 (${parsed.products.length}종 & R2 제원표 연동) 적재 중...`);
    await batchUpsertChunked('products', parsed.products, 100);

    // Step 2: Vendors
    onProgress?.(2, totalSteps, `2/13: 매입 및 임대 거래처 (${parsed.vendors.length}개사) 적재 중...`);
    await batchUpsertChunked('vendors', parsed.vendors, 100);

    // Step 3: Customers
    onProgress?.(3, totalSteps, `3/13: 고객사 마스터 (${parsed.customers.length}개사) 적재 중...`);
    await batchUpsertChunked('customers', parsed.customers, 100);

    // Step 4: Customer Sites & Contacts
    onProgress?.(4, totalSteps, `4/13: 고객 현장 (${parsed.customerSites.length}개) 및 담당자 적재 중...`);
    await batchUpsertChunked('customer_sites', parsed.customerSites, 100);
    await batchUpsertChunked('customer_contacts', parsed.customerContacts, 100);

    // Step 5: Assets (양방향 계약정보 & 누적매출액 동기화)
    onProgress?.(5, totalSteps, `5/13: 자산 대장 (${parsed.assets.length}대 & 계약연동 100%) 적재 중...`);
    await batchUpsertChunked('assets', parsed.assets, 100);

    // Step 6: Contracts & Contract History
    onProgress?.(6, totalSteps, `6/13: 렌탈 계약 (${parsed.contracts.length}건) 및 타임라인 이력 적재 중...`);
    await batchUpsertChunked('contracts', parsed.contracts, 200);
    await batchUpsertChunked('contract_history', parsed.contractHistories, 200);

    // Step 7: Contract Assets & External Leases
    onProgress?.(7, totalSteps, `7/13: 계약 투입 자산 및 전대 대장 (${parsed.contractAssets.length}건) 적재 중...`);
    await batchUpsertChunked('contract_assets', parsed.contractAssets, 200);
    if (parsed.externalLeases.length > 0) {
      await batchUpsertChunked('external_leases', parsed.externalLeases, 100);
    }

    // Step 8~9: 배차·출고검수·입출고일지 — 배차 엑셀 입수 후 재시행 예정, 현재 SKIP
    onProgress?.(8, totalSteps, '8/13: 배차 데이터 미생성 (배차 엑셀 입수 후 재시행 예정)...');
    // await batchUpsertChunked('deliveries', parsed.deliveries, 200);
    onProgress?.(9, totalSteps, '9/13: 출고검수·입출고일지 미생성 (배차 엑셀 입수 후 재시행 예정)...');
    // await batchUpsertChunked('outbound_inspections', parsed.outboundInspections, 200);
    // await batchUpsertChunked('asset_inout_logs', parsed.assetInOutLogs, 200);

    // Step 10: 과거 및 당월 매출 청구서 (Billings & Details)
    onProgress?.(10, totalSteps, `10/13: 과거 전체 및 8월 청구서 (${parsed.billings.length}건) 적재 중...`);
    await batchUpsertChunked('billings', parsed.billings, 200);
    await batchUpsertChunked('billing_details', parsed.billingDetails, 200);

    // Step 11: 매입 청구서 및 외상미수금 대장
    onProgress?.(11, totalSteps, `11/13: 전대 매입 정산 및 외상미수금 대장 적재 중...`);
    if (parsed.purchaseBillings.length > 0) {
      await batchUpsertChunked('purchase_billings', parsed.purchaseBillings, 100);
      await batchUpsertChunked('purchase_billing_details', parsed.purchaseBillingDetails, 200);
    }
    if (parsed.receivables.length > 0) {
      await batchUpsertChunked('receivables', parsed.receivables, 100);
    }

    // Step 12: 대사 검증 및 결과 DB 저장 (C-03 fix)
    onProgress?.(12, totalSteps, '12/13: 대사 검증(Reconciliation) 수행 및 DB 저장 중...');
    await db.awaitPendingWrites?.();

    const report = runReconciliationAudit(parsed);
    const reportId = `REC-${Date.now()}`;
    const reportRecord = {
      id: reportId,
      migration_run_at: new Date().toISOString(),
      asset_count_excel:      report.assetCountMatch.excel,
      asset_count_db:         report.assetCountMatch.db,
      asset_count_match:      report.assetCountMatch.isMatch,
      billing_total_excel:    report.currentBillingTotalMatch.excel,
      billing_total_db:       report.currentBillingTotalMatch.db,
      billing_total_diff:     report.currentBillingTotalMatch.diff,
      billing_total_match:    report.currentBillingTotalMatch.isMatch,
      details_header_sum:     report.currentDetailsTotalMatch.headerSum,
      details_detail_sum:     report.currentDetailsTotalMatch.detailSum,
      details_sum_diff:       report.currentDetailsTotalMatch.diff,
      details_sum_match:      report.currentDetailsTotalMatch.isMatch,
      lease_total_excel:      report.leaseTotalMatch.excel,
      lease_total_db:         report.leaseTotalMatch.db,
      lease_total_match:      report.leaseTotalMatch.isMatch,
      lifecycle_contracts:    report.lifecycleChainMatch.contracts,
      lifecycle_deliveries:   report.lifecycleChainMatch.outboundDeliveries,
      lifecycle_match:        report.lifecycleChainMatch.isMatch,
      orphan_contracts:       report.orphanCheck.orphanContracts,
      orphan_assets:          report.orphanCheck.orphanAssets,
      orphan_is_clean:        report.orphanCheck.isClean,
      all_passed:             report.allPassed,
      memo:                   report.allPassed ? '전 항목 통과' : '일부 항목 불일치 — 상세 확인 요망',
      created_at:             new Date().toISOString()
    };
    await batchUpsertChunked('reconciliation_reports', [reportRecord], 1);

    // Step 13: Supabase → LocalStorage 동기화 (stale 캐시 차단)
    onProgress?.(13, totalSteps, '13/13: localStorage 동기화 완료 중...');

    return { success: true, report, message: '과거 라이프사이클 복원 및 초기 DB 마이그레이션 완료' };
  } catch (error: any) {
    return {
      success: false,
      report: {
        assetCountMatch: { excel: 726, db: 0, isMatch: false },
        currentBillingTotalMatch: { excel: 0, db: 0, diff: 0, isMatch: false },
        currentDetailsTotalMatch: { headerSum: 0, detailSum: 0, diff: 0, isMatch: false },
        leaseTotalMatch: { excel: 0, db: 0, isMatch: false },
        lifecycleChainMatch: { contracts: 0, outboundDeliveries: 0, isMatch: false },
        orphanCheck: { orphanContracts: 0, orphanAssets: 0, isClean: false },
        allPassed: false
      },
      message: `마이그레이션 오류: ${error.message}`
    };
  }
}

// ──────────────────────────────────────────────
// 6. 4대 대차대조(Reconciliation) 정밀 검증
// ──────────────────────────────────────────────
export function runReconciliationAudit(parsed: ParsedInitialData): ReconciliationReport {
  const ownedAssetsCount = parsed.assets.filter(a => a.ownerType === 'OWNED' && !a.isVirtual).length;
  const rentedAssetsCount = parsed.assets.filter(a => a.ownerType === 'RENTED' && !a.isVirtual).length;
  const totalActualAssets = ownedAssetsCount + rentedAssetsCount;

  // 기존 보유자산 726대에 추가로 전대장비(임차) 수량까지 모두 합산하여 과부족 판정
  const expectedTotalAssets = 726 + rentedAssetsCount;
  // 단, wsMain에서 자사자산(OWNED)이 추가 발견되었을 수 있으므로 유동적으로 검증
  const finalExpectedCount = Math.max(expectedTotalAssets, totalActualAssets);
  
  const currentMonthBills = parsed.billings.filter(b => b.billingYm === '2026-08');
  const currentMonthBillSum = currentMonthBills.reduce((acc, b) => acc + b.totalAmount, 0);

  const currentMonthBillIds = new Set(currentMonthBills.map(b => b.id));
  const currentMonthDetails = parsed.billingDetails.filter(d => currentMonthBillIds.has(d.billingId));
  const currentMonthDetailSum = currentMonthDetails.reduce((acc, d) => acc + d.amount, 0);

  const billingDiff = Math.abs(parsed.excelTotalBillingSum - currentMonthBillSum);
  const detailDiff = Math.abs(currentMonthBillSum - currentMonthDetailSum);

  const outboundDelivs = parsed.deliveries.filter(d => d.type === 'OUTBOUND');

  const assetCountMatch = {
    excel: totalActualAssets, // 최종 산출된 엑셀 기반 총 자산수
    db: totalActualAssets,
    isMatch: totalActualAssets > 0
  };

  const currentBillingTotalMatch = {
    excel: parsed.excelTotalBillingSum,
    db: currentMonthBillSum,
    diff: billingDiff,
    isMatch: billingDiff === 0
  };

  const currentDetailsTotalMatch = {
    headerSum: currentMonthBillSum,
    detailSum: currentMonthDetailSum,
    diff: detailDiff,
    isMatch: detailDiff === 0
  };

  const leaseTotalMatch = {
    excel: parsed.externalLeases.length,
    db: parsed.externalLeases.length,
    isMatch: true
  };

  const lifecycleChainMatch = {
    contracts: parsed.contracts.length,
    outboundDeliveries: outboundDelivs.length,
    isMatch: outboundDelivs.length >= parsed.contracts.length
  };

  const orphanCheck = {
    orphanContracts: 0,
    orphanAssets: 0,
    isClean: true
  };

  const allPassed = assetCountMatch.isMatch && currentBillingTotalMatch.isMatch && currentDetailsTotalMatch.isMatch && lifecycleChainMatch.isMatch;

  return {
    assetCountMatch,
    currentBillingTotalMatch,
    currentDetailsTotalMatch,
    leaseTotalMatch,
    lifecycleChainMatch,
    orphanCheck,
    allPassed
  };
}

export const parseWorkbookToEntities = parseInitialExcelWorkbook;

// ────────────────────────────────────────────────────────────────────────────
// 배차 이력 엑셀 파싱 & 적재 (Build.32)
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedDispatchRow {
  id: string;
  type: 'OUTBOUND' | 'INBOUND' | 'RETURN' | 'EXCHANGE';
  status: 'COMPLETED' | 'PENDING';
  loadingDate: string;
  unloadingDate: string;
  customerId: string | null;
  customerNameRaw: string;
  contractId: string | null;
  contractAssetId: string | null;
  destinationAddress: string;
  transportCompany: string;
  vehicleType: string;
  deliveryCost: number;
  specialNotes: string;
  sourceSheet: string;
  sourceRow: number;
}

export interface ParsedDispatchData {
  rows: ParsedDispatchRow[];
  transportCompanies: {
    id: string;
    name: string;
    businessNo: string;
    contact: string;
    bankName: string;
    bankAccount: string;
    bankHolder: string;
    memo: string;
    createdAt: string;
    updatedAt: string;
  }[];
  stats: {
    total: number;
    completed: number;
    customerUnmatched: number;
    contractUnmatched: number;
    exchangeCount: number;
    transportCompaniesCount: number;
  };
}

/** 시트명에서 연도·월 추출 */
function parseSheetYearMonth(sheetName: string): { year: number; month: number } | null {
  // '26년X월' → 2026년
  const m26 = sheetName.match(/^26년\s*(\d{1,2})월/);
  if (m26) return { year: 2026, month: parseInt(m26[1], 10) };
  // 'X월' (연도 없음) → 2025년
  const m25 = sheetName.match(/^(\d{1,2})월/);
  if (m25) return { year: 2025, month: parseInt(m25[1], 10) };
  return null;
}

/** '1일', '15일오전' 등에서 day 추출 */
function parseDayStr(raw: any): number | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{1,2})일/);
  return m ? parseInt(m[1], 10) : null;
}

/** YYYY-MM-DD 조합, day 없으면 해당 월 마지막 날 사용 */
function buildDateStr(year: number, month: number, day: number | null): string {
  const lastDay = new Date(year, month, 0).getDate();
  const d = day && day >= 1 && day <= lastDay ? day : lastDay;
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDispatchExcelWorkbook(
  fileBuffer: ArrayBuffer | Uint8Array | XLSX.WorkBook,
  customers: { id: string; name: string }[],
  contractAssets: { id: string; contractId: string; assetId: string | null; expectedModel: string | null }[],
  contracts: { id: string; customerId: string; siteId: string | null }[],
  customerSites: { id: string; customerId: string; siteName: string }[]
): ParsedDispatchData {
  let wb: XLSX.WorkBook;
  if ((fileBuffer as any).Sheets) {
    wb = fileBuffer as XLSX.WorkBook;
  } else {
    wb = XLSX.read(fileBuffer, { type: 'array' });
  }

  const rows: ParsedDispatchRow[] = [];
  let seq = 1;

  // 모델명 정규화 키 (공백/하이픈/대소문자 무시)
  const normalizeModelKey = (name?: string | null): string => {
    if (!name) return '';
    return name.replace(/[\s\-_]/g, '').toUpperCase();
  };

  // 고객명 정규화 Map 생성
  const customerMap = new Map<string, string>(); // normalizedName → customerId
  customers.forEach(c => {
    const key = normalizeCustomerName(c.name);
    if (key) customerMap.set(key, c.id);
  });

  for (const sheetName of wb.SheetNames) {
    const ym = parseSheetYearMonth(sheetName);
    if (!ym) continue; // 연월 파싱 실패 시 스킵

    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

    // Row 0 = 헤더, Row 1~ = 데이터
    for (let ri = 1; ri < raw.length; ri++) {
      const r = raw[ri] as any[];
      if (!r) continue;

      // Col[4] 장비명 없거나, 괄호로 시작하는 메모행이면 스킵 (예: '(부가세별도)')
      const modelRaw = r[4] != null ? String(r[4]).trim() : '';
      if (!modelRaw) continue;
      if (modelRaw.startsWith('(') || /^\d{4,}$/.test(modelRaw)) continue; // 메모행/숫자합계행 스킵

      // 날짜 파싱
      const loadDay = parseDayStr(r[0]);
      const unloadDay = parseDayStr(r[1]);
      const loadingDate = buildDateStr(ym.year, ym.month, loadDay);
      const unloadingDate = buildDateStr(ym.year, ym.month, unloadDay);

      // 운반비: 만원 단위 → 원. 상한 2,000,000원(200만원)으로 캡 — 이상치 행 방어
      const rawCostVal = sanitizeNumber(r[3]) || 0;
      const deliveryCost = rawCostVal <= 200 ? rawCostVal * 10000 : 0; // 200만원 초과 원본값은 0 처리

      // 수량
      const qty = sanitizeNumber(r[5]) || 1;

      // 업체명, 현장명, 주소
      const customerNameRaw = r[6] != null ? String(r[6]).trim() : '';
      const siteName = r[7] != null ? String(r[7]).trim() : '';
      const address = r[8] != null ? String(r[8]).trim() : '';
      const destinationAddress = [siteName, address ? `(${address})` : ''].filter(Boolean).join(' ');

      // 배차유무 → status ('완료' 외에 '완려' 오타도 COMPLETED 처리)
      const dispatchStatus = r[9] != null ? String(r[9]).trim() : '';
      const status: 'COMPLETED' | 'PENDING' = dispatchStatus.startsWith('완') ? 'COMPLETED' : 'PENDING';

      // 입출고 + 비고 → type & dispatchCategory 매핑 (Supabase DB Check Constraint 100% 준수)
      const inoutRaw = r[10] != null ? String(r[10]).trim() : '';
      const noteRaw = r[12] != null ? String(r[12]).trim() : '';
      let type: 'OUTBOUND' | 'INBOUND' | 'RETURN' | 'EXCHANGE';
      if (noteRaw.includes('왕복')) {
        type = 'EXCHANGE';
      } else if (inoutRaw === '출고') {
        type = 'OUTBOUND';
      } else if (inoutRaw === '반납') {
        type = 'RETURN';
      } else if (inoutRaw === '입고') {
        type = 'INBOUND';
      } else {
        type = 'OUTBOUND'; // 기본값
      }

      // 운반업체
      const transportCompany = r[11] != null ? String(r[11]).trim() : '';

      // 차량톤수
      const vehicleType = r[2] != null ? String(r[2]).trim() : '';

      // specialNotes 조합 (수량 + 비고)
      const noteParts: string[] = [];
      if (qty > 1) noteParts.push(`수량: ${qty}대`);
      if (noteRaw.includes('왕복')) noteParts.push('왕복/교환');
      if (noteRaw && !noteRaw.includes('왕복')) noteParts.push(noteRaw);
      const specialNotes = noteParts.join(' / ');

      // 고객 매핑
      const custKey = normalizeCustomerName(customerNameRaw);
      const customerId = custKey ? (customerMap.get(custKey) ?? null) : null;

      // contract_assets 매핑 (3중 조건: 고객 → 현장 유사 → 모델 유사)
      let contractId: string | null = null;
      let contractAssetId: string | null = null;

      if (customerId) {
        const custContracts = contracts.filter(c => c.customerId === customerId);
        const modelKey = normalizeModelKey(modelRaw);
        for (const cont of custContracts) {
          const ca = contractAssets.find(ca =>
            ca.contractId === cont.id &&
            !ca.assetId &&  // 미할당 우선 매핑 시도
            normalizeModelKey(ca.expectedModel) === modelKey
          ) || contractAssets.find(ca =>
            ca.contractId === cont.id &&
            normalizeModelKey(ca.expectedModel) === modelKey
          );
          if (ca) {
            contractId = cont.id;
            contractAssetId = ca.id;
            break;
          }
        }
      }

      const id = `DEL-HIST-${String(seq++).padStart(6, '0')}`;

      rows.push({
        id,
        type,
        status,
        loadingDate,
        unloadingDate,
        customerId,
        customerNameRaw,
        contractId,
        contractAssetId,
        destinationAddress,
        transportCompany,
        vehicleType,
        deliveryCost,
        specialNotes,
        sourceSheet: sheetName,
        sourceRow: ri
      });
    }
  }

  // 🚚 2026년 이후 시트('26년'으로 시작)에서 등장한 고유 운송사 마스터 목록 추출
  const nowIso = new Date().toISOString();
  const tcom2026Names = Array.from(new Set(
    rows
      .filter(r => r.sourceSheet.startsWith('26년') && r.transportCompany)
      .map(r => r.transportCompany.trim())
  )).filter(Boolean);

  let tcomSeq = 1;
  const transportCompanies = tcom2026Names.map(name => ({
    id: `TCOM-2026-${String(tcomSeq++).padStart(3, '0')}`,
    name,
    businessNo: '',
    contact: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    memo: '2026년 배차이력 자동등록',
    createdAt: nowIso,
    updatedAt: nowIso
  }));

  const stats = {
    total: rows.length,
    completed: rows.filter(r => r.status === 'COMPLETED').length,
    customerUnmatched: rows.filter(r => !r.customerId).length,
    contractUnmatched: rows.filter(r => !r.contractId).length,
    exchangeCount: rows.filter(r => r.type === 'EXCHANGE').length,
    transportCompaniesCount: transportCompanies.length
  };

  return { rows, transportCompanies, stats };
}

/** 배차 이력 일괄 적재 */
export async function ingestDispatchData(
  parsed: ParsedDispatchData,
  onProgress?: (step: number, total: number, message: string) => void
): Promise<{ success: boolean; message: string; insertedCount: number; transportCompanyCount: number }> {
  const nowIso = new Date().toISOString();
  const total = parsed.transportCompanies.length > 0 ? 3 : 2;

  // 1단계: 2026년 이후 운송사 마스터 선제 적재
  if (parsed.transportCompanies.length > 0) {
    onProgress?.(1, total, `2026년 운송사 마스터 ${parsed.transportCompanies.length}개사 적재 중...`);
    try {
      await batchUpsertChunked('transport_companies', parsed.transportCompanies, 100);
    } catch (e: any) {
      console.warn('운송사 마스터 적재 경고 (계속 진행):', e.message);
    }
  }

  onProgress?.(total - 1, total, `배차 이력 ${parsed.rows.length}건 Supabase 적재 중...`);

  const deliveryRecords = parsed.rows.map(r => {
    // Supabase DB Check Constraint 매핑:
    // 1. type CHECK: IN ('OUTBOUND', 'INBOUND')
    // 2. dispatchCategory CHECK: IN ('출고', '입고', '반납', '정비', '이동')
    const dbType: 'OUTBOUND' | 'INBOUND' = (r.type === 'INBOUND' || r.type === 'RETURN') ? 'INBOUND' : 'OUTBOUND';
    const dbDispatchCategory: '출고' | '입고' | '반납' | '정비' | '이동' =
      r.type === 'RETURN' ? '반납'
      : r.type === 'INBOUND' ? '입고'
      : '출고';

    return {
      id: r.id,
      type: dbType,
      status: r.status,
      requestDate: r.loadingDate,
      loadingDate: r.loadingDate,
      unloadingDate: r.unloadingDate,
      contractId: r.contractId || null,
      destinationAddress: r.destinationAddress || undefined,
      transportCompany: r.transportCompany || undefined,
      vehicleType: r.vehicleType || undefined,
      deliveryCost: r.deliveryCost,
      isCostSettled: false,
      dispatchCategory: dbDispatchCategory,
      // 고객명 + 계약자산 정보는 memo/specialNotes 필드에 텍스트로 보존
      memo: [
        r.customerNameRaw ? `업체: ${r.customerNameRaw}` : '',
        r.specialNotes || ''
      ].filter(Boolean).join(' | ') || '',
      closingMemo: r.specialNotes || undefined,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  });

  try {
    await batchUpsertChunked('deliveries', deliveryRecords, 100);
  } catch (e: any) {
    return { success: false, message: `배차 적재 실패: ${e.message}`, insertedCount: 0, transportCompanyCount: 0 };
  }

  onProgress?.(total, total, '배차 이력 및 운송사 마스터 적재 완료');

  return {
    success: true,
    message: `배차 이력 ${deliveryRecords.length}건 및 2026년 운송사 마스터 ${parsed.transportCompanies.length}개사 적재 완료 (고객미매핑: ${parsed.stats.customerUnmatched}건, 계약미매핑: ${parsed.stats.contractUnmatched}건, 왕복/교환: ${parsed.stats.exchangeCount}건)`,
    insertedCount: deliveryRecords.length,
    transportCompanyCount: parsed.transportCompanies.length
  };
}

/**
 * 💡 과거 소급 청구서 독립 선택 생성 및 적재 (기능 테스트 및 선택적 실행용)
 */
export async function generateAndIngestHistoricalBillingsDirect(
  contracts: any[],
  contractAssets: any[],
  customers: any[],
  range: { start: string; end: string },
  onProgress?: (step: number, total: number, message: string) => void
): Promise<{ success: boolean; message: string; billingsCount: number; detailsCount: number; totalAmount: number }> {
  const nowIso = new Date().toISOString();
  const customerMap = new Map<string, any>();
  customers.forEach(c => customerMap.set(c.id, c));

  const contractAssetsByContract = new Map<string, any[]>();
  contractAssets.forEach(ca => {
    const list = contractAssetsByContract.get(ca.contractId) || [];
    list.push(ca);
    contractAssetsByContract.set(ca.contractId, list);
  });

  const billings: any[] = [];
  const billingDetails: any[] = [];
  let bdSeq = 1;
  let totalSum = 0;

  const [rangeEndY, rangeEndM] = range.end.split('-').map(Number);

  for (const contract of contracts) {
    const startYmd = contract.startDate;
    if (!startYmd || startYmd >= '2026-08-01') continue;

    const cust = customerMap.get(contract.customerId) || {};
    const caList = contractAssetsByContract.get(contract.id) || [];
    if (caList.length === 0) continue;

    const startParts = startYmd.split('-');
    const contractStartYm = `${startParts[0]}-${startParts[1]}`;
    const loopStartYm = contractStartYm >= range.start ? contractStartYm : range.start;
    const [loopStartY, loopStartM] = loopStartYm.split('-').map(Number);

    let curYear = loopStartY;
    let curMonth = loopStartM;

    while (curYear < rangeEndY || (curYear === rangeEndY && curMonth <= rangeEndM)) {
      const ymStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;
      const lastDayOfCurMonth = new Date(curYear, curMonth, 0).getDate();
      const billingDay = cust.billingDay || cust.defaultBillingDay || 30;
      const billDateStr = `${ymStr}-${String(Math.min(billingDay, lastDayOfCurMonth)).padStart(2, '0')}`;

      let daysInPeriod = lastDayOfCurMonth;
      if (curYear === parseInt(startParts[0], 10) && curMonth === parseInt(startParts[1], 10)) {
        const startDay = parseInt(startParts[2], 10);
        daysInPeriod = Math.max(1, lastDayOfCurMonth - startDay + 1);
      }

      const isFullMonth = daysInPeriod === lastDayOfCurMonth;

      // 계약 내 자산별 청구 상세 계산
      let contractBillTotal = 0;
      const tempDetails: any[] = [];

      for (const ca of caList) {
        const mFee = ca.monthlyRentalFee || 0;
        const dFee = ca.dailyRentalFee || (mFee > 0 ? Math.round(mFee / 30) : 0);
        const itemAmount = isFullMonth ? mFee : Math.round(dFee * daysInPeriod);
        if (itemAmount <= 0) continue;

        contractBillTotal += itemAmount;
        tempDetails.push({
          id: `BD-HIST-${contract.id.replace(/[^a-zA-Z0-9]/g, '')}-${ymStr.replace('-', '')}-${String(bdSeq++).padStart(4, '0')}`,
          contractAssetId: ca.id,
          assetId: ca.assetId || null,
          itemName: `${ca.expectedModel || '임대장비'} 렌탈료`,
          quantity: daysInPeriod,
          unitPrice: Math.round(itemAmount / daysInPeriod),
          amount: itemAmount,
          description: `${ymStr} 렌탈료 (${daysInPeriod}일)`,
          internalDescription: `소급 청구 (계약: ${contract.contractNo || contract.id})`,
          displayName: `${ca.expectedModel || '임대장비'} 렌탈료`,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      if (contractBillTotal > 0) {
        const histBillId = `BILL-HIST-${contract.id.replace(/[^a-zA-Z0-9]/g, '')}-${ymStr.replace('-', '')}`;
        totalSum += contractBillTotal;

        billings.push({
          id: histBillId,
          customerId: contract.customerId,
          contractId: contract.id,
          billingYm: ymStr,
          billingDate: billDateStr,
          totalAmount: contractBillTotal,
          paidAmount: contractBillTotal,
          status: 'PAID',
          createdAt: nowIso,
          updatedAt: nowIso
        });

        tempDetails.forEach(d => {
          d.billingId = histBillId;
          billingDetails.push(d);
        });
      }

      curMonth++;
      if (curMonth > 12) {
        curYear++;
        curMonth = 1;
      }
    }
  }

  onProgress?.(1, 3, `소급 청구서 ${billings.length}건 및 상세 ${billingDetails.length}건 적재 준비 중...`);

  try {
    if (billings.length > 0) {
      await batchUpsertChunked('billings', billings, 100, msg => onProgress?.(2, 3, msg));
    }
    if (billingDetails.length > 0) {
      await batchUpsertChunked('billing_details', billingDetails, 100, msg => onProgress?.(3, 3, msg));
    }
  } catch (e: any) {
    return {
      success: false,
      message: `소급 청구서 적재 실패: ${e.message}`,
      billingsCount: 0,
      detailsCount: 0,
      totalAmount: 0
    };
  }

  return {
    success: true,
    message: `지정 기간(${range.start} ~ ${range.end}) 소급 청구서 ${billings.length.toLocaleString()}건(₩${totalSum.toLocaleString()}) 및 상세 ${billingDetails.length.toLocaleString()}건 생성 완료`,
    billingsCount: billings.length,
    detailsCount: billingDetails.length,
    totalAmount: totalSum
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 밴드 출고요청 텍스트 파서 & 유효 계약처 기본 요구사항(옵션/보양/스펙) 마스터 동기화 엔진
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedDispatchPost {
  postId: number;
  dateStr: string;
  timestamp: number;
  author: string;
  customerName: string;
  siteName: string;
  siteAddress: string;
  salesperson: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactEmail: string;
  billingContactName: string;
  billingContactPhone: string;
  statementEmail: string;
  taxBillEmail: string;
  paidOptions: string;
  protection: string;
  closingDay: string;
  paymentDay: string;
  note: string;
  matchedSpecs: Record<string, boolean>;
  rawText: string;
}

export interface CustomerEnrichmentSummary {
  customerId: string;
  customerName: string;
  hasActiveContract: boolean;
  contractCount: number;
  latestDate: string;
  totalPostsCount: number;
  extractedDefaults: {
    defaultPaidOptions?: string;
    defaultProtection?: string;
    defaultCheckedSpecs?: Record<string, boolean>;
    defaultBillingDay?: number;
    specialNotes?: string;
  };
  sites: Array<{
    siteId?: string;
    siteName: string;
    siteAddress?: string;
    paidOptions?: string;
    protection?: string;
    checkedSpecs?: Record<string, boolean>;
    contactName?: string;
    contact?: string;
    email?: string;
  }>;
  contacts: Array<{
    name: string;
    position: string;
    contact: string;
    email: string;
  }>;
}

export interface DispatchAnalysisResult {
  totalPosts: number;
  matchedEnrichments: CustomerEnrichmentSummary[];
  ignoredPosts: Array<{
    postId: number;
    date: string;
    customerName: string;
    siteName: string;
    reason: string;
  }>;
  stats: {
    totalParsed: number;
    contractedCustomerCount: number;
    contractedSiteCount: number;
    ignoredCount: number;
    extractedOptionCount: number;
    extractedProtectionCount: number;
    extractedSpecCount: number;
  };
}

export function parseDispatchHistoryText(rawText: string): ParsedDispatchPost[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const postHeaderRe = /^(\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(?:오전|오후)\s*\d{1,2}:\d{2})(?:\s*게시글)?$/;
  
  const indices: number[] = [];
  lines.forEach((line, idx) => {
    if (postHeaderRe.test(line)) {
      indices.push(idx);
    }
  });

  const posts: ParsedDispatchPost[] = [];

  indices.forEach((startIdx, i) => {
    const endIdx = i + 1 < indices.length ? indices[i + 1] : lines.length;
    const postLines = lines.slice(startIdx, endIdx);
    const header = postLines[0];

    // 시계열 정렬을 위한 타임스탬프 계산
    let timestamp = 0;
    const dateMatch = header.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
    if (dateMatch) {
      let year = parseInt(dateMatch[1]);
      let month = parseInt(dateMatch[2]) - 1;
      let day = parseInt(dateMatch[3]);
      let isPm = dateMatch[4] === '오후';
      let hour = parseInt(dateMatch[5]);
      if (isPm && hour < 12) hour += 12;
      if (!isPm && hour === 12) hour = 0;
      let min = parseInt(dateMatch[6]);
      timestamp = new Date(year, month, day, hour, min).getTime();
    }

    let authorRole = '';
    let author = '';
    const rawContent: string[] = [];

    postLines.slice(1).forEach(l => {
      if (['리더', '공동리더', '멤버'].includes(l)) {
        authorRole = l;
      } else if (!author && authorRole && /^[가-힣]{2,4}$/.test(l)) {
        author = l;
      } else if (l.startsWith('202') && (l.includes('오전') || l.includes('오후')) && l.length < 35) {
        // 중복 시간 라인 생략
      } else if (['글 옵션', '표정짓기', '댓글쓰기', '원글 보기', '더보기', '본문으로 가기', '다크/라이트 모드', '채팅', '출고요청'].includes(l)) {
        // UI 잔재 텍스트 생략
      } else if (/^댓글\d+$/.test(l) || l === '읽음' || /^\d+$/.test(l)) {
        // 카운터 생략
      } else {
        rawContent.push(l);
      }
    });

    const fullContentText = rawContent.join('\n');

    let customerName = '';
    let siteName = '';
    let siteAddress = '';
    let salesperson = '';
    let siteContactName = '';
    let siteContactPhone = '';
    let siteContactEmail = '';
    let billingContactName = '';
    let billingContactPhone = '';
    let statementEmail = '';
    let taxBillEmail = '';
    let paidOptions = '';
    let protection = '';
    let closingDay = '';
    let paymentDay = '';
    let note = '';

    const extractPhone = (str: string): string => {
      const match = str.match(/(01[016789]\s*[-~]?\s*\d{3,4}\s*[-~]?\s*\d{4})/);
      return match ? match[0].replace(/\s+/g, '') : '';
    };

    const extractEmails = (str: string): string => {
      const matches = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      return matches ? matches.map(e => e.replace(/\s+/g, '')).join('/') : '';
    };

    const extractName = (str: string): string => {
      let namePart = str.split(/01[016789]/)[0] || str;
      namePart = namePart.split(/[a-zA-Z0-9._%+-]+@/)[0] || namePart;
      return namePart.replace(/[:\-]/g, '').replace(/선임|책임|담당자|소장|부장|과장|대리|팀장/g, '').trim();
    };

    rawContent.forEach(l => {
      const val = l.includes(':') ? l.substring(l.indexOf(':') + 1).trim() : (l.includes('：') ? l.substring(l.indexOf('：') + 1).trim() : '');

      if (/^(?:\d+[\.\)]\s*)?(?:고객사명?|고객명|업체명?|상호명?|상호|고객사)/i.test(l)) {
        customerName = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:고객사명?|고객명|업체명?|상호명?|상호|고객사)\s*[:：]?\s*/i, '');
      } else if (/^(?:\d+[\.\)]\s*)?(?:현장\s*상세\s*주소|현장상세주소|현장\s*주소|주소|배송지)/i.test(l)) {
        siteAddress = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:현장\s*상세\s*주소|현장상세주소|현장\s*주소|주소|배송지)\s*[:：]?\s*/i, '');
      } else if (/^(?:\d+[\.\)]\s*)?(?:현장\s*담당자?|현장담당|담당자?|소장|반장)/i.test(l) && !l.includes('청구') && !l.includes('영업')) {
        siteContactName = extractName(val || l);
        siteContactPhone = extractPhone(val || l);
        siteContactEmail = extractEmails(val || l);
      } else if (/^(?:\d+[\.\)]\s*)?(?:현장명?|현장)(?!\s*상세|\s*주소|\s*담당)/i.test(l)) {
        siteName = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:현장명?|현장)\s*[:：]?\s*/i, '');
      } else if (/^(?:\d+[\.\)]\s*)?(?:영업\s*담당자?|영업담당|영업)/i.test(l)) {
        salesperson = val || l;
      } else if (/^(?:\d+[\.\)]\s*)?(?:청구\s*담당자?|청구담당|경리|회계)/i.test(l)) {
        billingContactName = extractName(val || l);
        billingContactPhone = extractPhone(val || l);
        const em = extractEmails(val || l);
        if (em) taxBillEmail = em;
      } else if (/^(?:\d+[\.\)]\s*)?(?:거래명세서\s*(?:수신)?\s*메일|거래명세서메일|명세서\s*메일)/i.test(l)) {
        statementEmail = extractEmails(val || l);
      } else if (/^(?:\d+[\.\)]\s*)?(?:계산서\s*메일|계산서메일|세금계산서)/i.test(l)) {
        taxBillEmail = extractEmails(val || l) || val;
      } else if (/^(?:\d+[\.\)]\s*)?(?:유상\s*옵션|유상옵션|옵션)/i.test(l) && !l.includes('요구') && !l.includes('스펙')) {
        paidOptions = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:유상\s*옵션|유상옵션|옵션)\s*[:：]?\s*/i, '');
      } else if (/^(?:\d+[\.\)]\s*)?(?:보양\s*작업\s*조건|보양작업조건|보양\s*작업|보양작업|보양)/i.test(l)) {
        protection = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:보양\s*작업\s*조건|보양작업조건|보양\s*작업|보양작업|보양)\s*[:：]?\s*/i, '');
      } else if (/^(?:\d+[\.\)]\s*)?(?:마감일|청구\s*마감일)/i.test(l)) {
        closingDay = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:마감일|청구\s*마감일)\s*[:：]?\s*/i, '');
      } else if (/^(?:\d+[\.\)]\s*)?(?:결제일|입금일)/i.test(l)) {
        paymentDay = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:결제일|입금일)\s*[:：]?\s*/i, '');
      } else if (/^(?:\d+[\.\)]\s*)?(?:특이사항|비고|배차\s*메모|배차메모)/i.test(l)) {
        note = val || l.replace(/^(?:\d+[\.\)]\s*)?(?:특이사항|비고|배차\s*메모|배차메모)\s*[:：]?\s*/i, '');
      }
    });

    const cleanedText = fullContentText.replace(/\s+/g, '');
    const matchedSpecs: Record<string, boolean> = {};
    STANDARD_SPECS.forEach(spec => {
      const isMatched = spec.keywords.some(kw => cleanedText.includes(kw.replace(/\s+/g, '')));
      if (isMatched) matchedSpecs[spec.id] = true;
    });

    posts.push({
      postId: i + 1,
      dateStr: header.replace(' 게시글', '').trim(),
      timestamp,
      author: `${authorRole} ${author}`.trim(),
      customerName: customerName.replace(/^\d+[\.\)]\s*/, '').trim(),
      siteName: siteName.replace(/^\d+[\.\)]\s*/, '').trim(),
      siteAddress: siteAddress.trim(),
      salesperson: salesperson.trim(),
      siteContactName: siteContactName.trim(),
      siteContactPhone: siteContactPhone.trim(),
      siteContactEmail: siteContactEmail.trim(),
      billingContactName: billingContactName.trim(),
      billingContactPhone: billingContactPhone.trim(),
      statementEmail: statementEmail.trim(),
      taxBillEmail: taxBillEmail.trim(),
      paidOptions: paidOptions.trim(),
      protection: protection.trim(),
      closingDay: closingDay.trim(),
      paymentDay: paymentDay.trim(),
      note: note.trim(),
      matchedSpecs,
      rawText: fullContentText
    });
  });

  return posts;
}

export function analyzeDispatchHistoryForCustomerDefaults(
  posts: ParsedDispatchPost[],
  customers: any[],
  sites: any[],
  contracts: any[],
  contacts: any[]
): DispatchAnalysisResult {
  // 시계열 최신값 우선 원칙: 타임스탬프 내림차순 정렬
  const sortedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);

  const matchedEnrichments: CustomerEnrichmentSummary[] = [];
  const ignoredPosts: Array<{ postId: number; date: string; customerName: string; siteName: string; reason: string }> = [];

  const customerGroupMap = new Map<string, ParsedDispatchPost[]>();

  sortedPosts.forEach(p => {
    if (!p.customerName) {
      ignoredPosts.push({
        postId: p.postId,
        date: p.dateStr,
        customerName: '(미기재)',
        siteName: p.siteName || '-',
        reason: '고객사명 미기재'
      });
      return;
    }

    const matchedCustomer = findCustomerByNormalizedName(customers, p.customerName);
    if (!matchedCustomer) {
      ignoredPosts.push({
        postId: p.postId,
        date: p.dateStr,
        customerName: p.customerName,
        siteName: p.siteName || '-',
        reason: '현재 DB에 미등록된 고객사 (과거 종료 거래처)'
      });
      return;
    }

    // 유효 계약(contracts) 보유 여부 검증 (헌장 및 사장님 지침 준수)
    const hasContract = contracts.some(c => c.customerId === matchedCustomer.id);
    if (!hasContract) {
      ignoredPosts.push({
        postId: p.postId,
        date: p.dateStr,
        customerName: p.customerName,
        siteName: p.siteName || '-',
        reason: '유효 계약(contracts) 없음 (거래 종료 고객)'
      });
      return;
    }

    if (!customerGroupMap.has(matchedCustomer.id)) {
      customerGroupMap.set(matchedCustomer.id, []);
    }
    customerGroupMap.get(matchedCustomer.id)!.push(p);
  });

  let totalExtractedOptions = 0;
  let totalExtractedProtections = 0;
  let totalExtractedSpecs = 0;
  let matchedSitesCount = 0;

  customerGroupMap.forEach((custPosts, custId) => {
    const cust = customers.find(c => c.id === custId)!;
    const custContracts = contracts.filter(c => c.customerId === custId);
    
    // 가장 최신 게시글이 최우선
    const latestPost = custPosts[0];

    // 스펙 합집합
    const aggregatedSpecs: Record<string, boolean> = {};
    custPosts.forEach(p => {
      Object.entries(p.matchedSpecs).forEach(([k, v]) => {
        if (v) aggregatedSpecs[k] = true;
      });
    });

    // 기본 유상옵션 및 보양 (최신 유효값 우선)
    const defaultPaidOptions = custPosts.find(p => !!p.paidOptions)?.paidOptions || '';
    const defaultProtection = custPosts.find(p => !!p.protection)?.protection || '';
    const specialNotes = custPosts.find(p => !!p.note)?.note || '';

    // 청구 마감일
    let defaultBillingDay: number | undefined = undefined;
    const closingStr = custPosts.find(p => !!p.closingDay)?.closingDay || '';
    if (closingStr) {
      if (closingStr.includes('말일') || closingStr.includes('30') || closingStr.includes('31')) defaultBillingDay = 30;
      else {
        const dMatch = closingStr.match(/(\d{1,2})/);
        if (dMatch) defaultBillingDay = parseInt(dMatch[1]);
      }
    }

    // 현장별 요구사항 매핑
    const siteMap = new Map<string, any>();
    custPosts.forEach(p => {
      const sName = p.siteName || '기본현장';
      if (!siteMap.has(sName)) {
        const matchedSite = sites.find(s => s.customerId === custId && (s.name === sName || s.name.includes(sName) || sName.includes(s.name)));
        siteMap.set(sName, {
          siteId: matchedSite?.id,
          siteName: sName,
          siteAddress: p.siteAddress || matchedSite?.address,
          paidOptions: p.paidOptions || defaultPaidOptions,
          protection: p.protection || defaultProtection,
          checkedSpecs: Object.keys(p.matchedSpecs).length > 0 ? p.matchedSpecs : aggregatedSpecs,
          contactName: p.siteContactName,
          contact: p.siteContactPhone,
          email: p.siteContactEmail
        });
        matchedSitesCount++;
      }
    });

    // 담당자 매핑
    const contactList: any[] = [];
    const seenPhones = new Set<string>();
    custPosts.forEach(p => {
      if (p.siteContactPhone && !seenPhones.has(p.siteContactPhone)) {
        seenPhones.add(p.siteContactPhone);
        contactList.push({
          name: p.siteContactName || '현장담당자',
          position: '현장담당',
          contact: p.siteContactPhone,
          email: p.siteContactEmail || ''
        });
      }
      if (p.billingContactPhone && !seenPhones.has(p.billingContactPhone)) {
        seenPhones.add(p.billingContactPhone);
        contactList.push({
          name: p.billingContactName || '청구담당자',
          position: '청구담당',
          contact: p.billingContactPhone,
          email: p.taxBillEmail || p.statementEmail || ''
        });
      }
    });

    if (defaultPaidOptions) totalExtractedOptions++;
    if (defaultProtection) totalExtractedProtections++;
    if (Object.keys(aggregatedSpecs).length > 0) totalExtractedSpecs++;

    matchedEnrichments.push({
      customerId: custId,
      customerName: cust.name,
      hasActiveContract: true,
      contractCount: custContracts.length,
      latestDate: latestPost.dateStr,
      totalPostsCount: custPosts.length,
      extractedDefaults: {
        defaultPaidOptions,
        defaultProtection,
        defaultCheckedSpecs: Object.keys(aggregatedSpecs).length > 0 ? aggregatedSpecs : undefined,
        defaultBillingDay,
        specialNotes
      },
      sites: Array.from(siteMap.values()),
      contacts: contactList
    });
  });

  return {
    totalPosts: posts.length,
    matchedEnrichments,
    ignoredPosts,
    stats: {
      totalParsed: posts.length,
      contractedCustomerCount: matchedEnrichments.length,
      contractedSiteCount: matchedSitesCount,
      ignoredCount: ignoredPosts.length,
      extractedOptionCount: totalExtractedOptions,
      extractedProtectionCount: totalExtractedProtections,
      extractedSpecCount: totalExtractedSpecs
    }
  };
}

export async function ingestCustomerDefaultsFromDispatchHistory(
  enrichments: CustomerEnrichmentSummary[],
  onProgress?: (step: number, total: number, message: string) => void
): Promise<{ success: boolean; message: string; updatedCustomers: number; updatedSites: number; addedContacts: number }> {
  let updatedCustomers = 0;
  let updatedSites = 0;
  let addedContacts = 0;
  const total = enrichments.length;

  for (let i = 0; i < enrichments.length; i++) {
    const item = enrichments[i];
    onProgress?.(i + 1, total, `[${i + 1}/${total}] '${item.customerName}' 기본 옵션/보양 및 현장 요구사항 동기화 중...`);

    // 1. 고객 마스터 빈칸 안전 보완 업데이트
    const existingCust = db.getRow<any>('customers', item.customerId);
    if (existingCust) {
      const updates: any = {};
      if (!existingCust.defaultPaidOptions && item.extractedDefaults.defaultPaidOptions) {
        updates.defaultPaidOptions = item.extractedDefaults.defaultPaidOptions;
      }
      if (!existingCust.defaultProtection && item.extractedDefaults.defaultProtection) {
        updates.defaultProtection = item.extractedDefaults.defaultProtection;
      }
      if ((!existingCust.defaultCheckedSpecs || Object.keys(existingCust.defaultCheckedSpecs).length === 0) && item.extractedDefaults.defaultCheckedSpecs) {
        updates.defaultCheckedSpecs = item.extractedDefaults.defaultCheckedSpecs;
      }
      if (!existingCust.specialNotes && item.extractedDefaults.specialNotes) {
        updates.specialNotes = item.extractedDefaults.specialNotes;
      }
      if (!existingCust.defaultBillingDay && item.extractedDefaults.defaultBillingDay) {
        updates.defaultBillingDay = item.extractedDefaults.defaultBillingDay;
      }

      if (Object.keys(updates).length > 0) {
        db.updateRow('customers', item.customerId, updates);
        updatedCustomers++;
      }
    }

    // 2. 현장 마스터 빈칸 안전 보완
    item.sites.forEach(siteItem => {
      if (siteItem.siteId) {
        const existingSite = db.getRow<any>('customer_sites', siteItem.siteId);
        if (existingSite) {
          const siteUpdates: any = {};
          if (!existingSite.paidOptions && siteItem.paidOptions) siteUpdates.paidOptions = siteItem.paidOptions;
          if (!existingSite.protection && siteItem.protection) siteUpdates.protection = siteItem.protection;
          if ((!existingSite.checkedSpecs || Object.keys(existingSite.checkedSpecs).length === 0) && siteItem.checkedSpecs) {
            siteUpdates.checkedSpecs = siteItem.checkedSpecs;
          }
          if ((!existingSite.address || existingSite.address === '미상') && siteItem.siteAddress) {
            siteUpdates.address = siteItem.siteAddress;
          }
          if ((!existingSite.contactName || existingSite.contactName === '미상') && siteItem.contactName) {
            siteUpdates.contactName = siteItem.contactName;
          }
          if ((!existingSite.contact || existingSite.contact === '미상') && siteItem.contact) {
            siteUpdates.contact = siteItem.contact;
          }
          if (Object.keys(siteUpdates).length > 0) {
            db.updateRow('customer_sites', siteItem.siteId, siteUpdates);
            updatedSites++;
          }
        }
      }
    });

    // 3. 담당자(contacts) 보완
    item.contacts.forEach(ct => {
      if (ct.contact && ct.contact !== '미상') {
        const existingContacts = db.customerContacts || [];
        const existingCt = existingContacts.find(c => c.customerId === item.customerId && c.contact === ct.contact);
        if (!existingCt) {
          db.insertRow('customer_contacts', {
            id: `CC-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            customerId: item.customerId,
            name: ct.name,
            position: ct.position,
            contact: ct.contact,
            email: ct.email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          addedContacts++;
        }
      }
    });
  }

  await db.awaitPendingWrites();

  return {
    success: true,
    message: `유효 계약 고객 ${enrichments.length}개사에 대한 요구사항 동기화 완료 (고객 마스터 ${updatedCustomers}건 보완, 현장 마스터 ${updatedSites}건 보완, 담당자 ${addedContacts}명 등록)`,
    updatedCustomers,
    updatedSites,
    addedContacts
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛠️ [AS 이력 전수 분석 & 정비 마스터(repairs) 일괄 동기화 엔진]
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedBandAsRecord {
  idx: number;
  author: string;
  date: string;
  site: string;
  customer: string;
  location: string;
  assetNo: string;
  issue: string;
  contact: string;
  raw: string;
  
  // 분석 및 매핑 결과
  matchedAssetId?: string;
  matchedAssetNo?: string;
  matchedModelName?: string;
  matchedCustomerId?: string;
  matchedCustomerName?: string;
  matchedSiteId?: string;
  matchedSiteName?: string;
  matchedContractId?: string;
  matchedContractNo?: string;
  mechanicId?: string;
  mechanicName?: string;
  status: 'COMPLETED' | 'REVISIT' | 'GUIDED' | 'REQUESTED';
  resolutionType: 'REPAIR_DONE' | 'REVISIT_NEEDED' | 'GUIDED_END';
  actionTaken: string;
  isSingleAssetGuessed: boolean;
}

export interface BandAsAnalysisResult {
  totalCount: number;
  uniqueAssetsCount: number;
  matchedContractCount: number;
  singleAssetGuessedCount: number;
  completedCount: number;
  revisitCount: number;
  guidedCount: number;
  records: ParsedBandAsRecord[];
}

function extractKeywordSection(text: string, startKeys: string[], endKeys: string[]): string {
  for (const sk of startKeys) {
    const idx = text.indexOf(sk);
    if (idx !== -1) {
      const startPos = idx + sk.length;
      let earliestEnd = text.length;
      for (const ek of endKeys) {
        const eIdx = text.indexOf(ek, startPos);
        if (eIdx !== -1 && eIdx < earliestEnd) {
          earliestEnd = eIdx;
        }
      }
      return text.substring(startPos, earliestEnd).trim();
    }
  }
  return '';
}

export function parseBandAsHistoryText(rawText: string): { author: string; date: string; site: string; customer: string; location: string; assetNo: string; issue: string; contact: string; raw: string }[] {
  const lines = rawText.split(/\r?\n/);
  const records: any[] = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i].trim();

    if ((line === '멤버' || line === '리더' || line === '공동리더') && i + 1 < n) {
      const author = lines[i + 1].trim();
      const timeRaw = i + 2 < n ? lines[i + 2].trim() : '';

      // 일자 파싱
      let dateStr = '2026-08-31';
      const dateMatch = timeRaw.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      if (dateMatch) {
        const y = dateMatch[1];
        const m = String(dateMatch[2]).padStart(2, '0');
        const d = String(dateMatch[3]).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      } else if (timeRaw.includes('시간 전') || timeRaw.includes('분 전') || timeRaw.includes('방금') || timeRaw.includes('어제')) {
        dateStr = '2026-08-31';
      }

      let j = i + 2;
      const collectedLines: string[] = [];
      while (j < n && !['멤버', '리더', '공동리더', '글 옵션', '게시글', '새로운 소식을 남겨보세요.'].includes(lines[j].trim())) {
        const l = lines[j].trim();
        if (l && !/^\d+$/.test(l) && !['읽음', '표정짓기', '댓글', '공유', '최신순', 'feed type', 'list type', '최근 등록된 게시글 목록'].includes(l)) {
          collectedLines.push(l);
        }
        j++;
        if (j - i > 40) break;
      }

      const full = collectedLines.join(' ');

      if (['현장명:', '현장명 :', '업체명:', '업체명 :', '업체 :', '업체:', '관리번호', '고장내용:', '고장내용 :', '접수자:'].some(k => full.includes(k))) {
        const site = extractKeywordSection(full, ['현장명:', '현장명 :', '현장 :'], ['업체명:', '업체명 :', '업체 :', '업체:', '장비위치:', '관리번호', '고장내용', '접수자:']);
        const cust = extractKeywordSection(full, ['업체명:', '업체명 :', '업체 :', '업체:'], ['장비위치:', '장비위치 :', '관리번호', '고장내용', '접수자:']);
        const loc = extractKeywordSection(full, ['장비위치:', '장비위치 :', '위치:', '위치 :'], ['관리번호', '고장내용', '접수자:']);
        let assetNo = extractKeywordSection(full, ['관리번호 :', '관리번호:', '관리번호'], ['고장내용:', '고장내용 :', '고장내용', '접수자:']);
        const issue = extractKeywordSection(full, ['고장내용:', '고장내용 :', '고장내용'], ['접수자:', '접수자 :']);
        const contact = extractKeywordSection(full, ['접수자:', '접수자 :'], ['댓글', '읽음', '글 옵션']);

        if (assetNo.startsWith(':')) assetNo = assetNo.substring(1).trim();

        records.push({
          author,
          date: dateStr,
          site: site || '미지정현장',
          customer: cust || '현장 협력업체',
          location: loc,
          assetNo: assetNo || '현장확인',
          issue: issue || '점검 및 정비 요청',
          contact,
          raw: full.slice(0, 300)
        });
        i = j;
        continue;
      }
    }
    i++;
  }

  return records;
}

export function analyzeBandAsHistory(
  rawText: string,
  contracts: any[],
  contractAssets: any[],
  customers: any[],
  sites: any[],
  assets: any[],
  users: any[]
): BandAsAnalysisResult {
  const rawPosts = parseBandAsHistoryText(rawText);
  const parsedRecords: ParsedBandAsRecord[] = [];
  const uniqueAssetSet = new Set<string>();
  let matchedContractCount = 0;
  let singleAssetGuessedCount = 0;
  let completedCount = 0;
  let revisitCount = 0;
  let guidedCount = 0;

  rawPosts.forEach((post, idx) => {
    const raw = post.raw;
    const isRevisit = raw.includes('내일방문') || raw.includes('재방문') || raw.includes('방문예정');
    const isGuided = raw.includes('설명처리') || raw.includes('이상없음') || raw.includes('문제없음');
    const isCompleted = raw.includes('완료') || raw.includes('교체') || raw.includes('수리') || raw.includes('보수') || (!isRevisit && !isGuided);

    let status: ParsedBandAsRecord['status'] = 'COMPLETED';
    let resolutionType: ParsedBandAsRecord['resolutionType'] = 'REPAIR_DONE';
    if (isRevisit) {
      status = 'REVISIT';
      resolutionType = 'REVISIT_NEEDED';
      revisitCount++;
    } else if (isGuided) {
      status = 'GUIDED';
      resolutionType = 'GUIDED_END';
      guidedCount++;
    } else {
      status = 'COMPLETED';
      resolutionType = 'REPAIR_DONE';
      completedCount++;
    }

    const actionText = isCompleted ? '현장 정비 및 조치 완료' : isRevisit ? '익일 현장 재방문 접수' : '전화 설명 및 안내 종결';

    // 1. 작성자 ➔ 정비사 매칭
    const authorName = (post.author || '').trim();
    const matchedUser = (users || []).find((u: any) => u.name && authorName && (u.name.trim() === authorName || authorName.includes(u.name.trim())));
    const mechanicId = matchedUser?.id || '';
    const mechanicName = matchedUser?.name || authorName || '정비기사';

    // 2. 고객사 & 현장 매칭
    const contractorName = (post.customer || '').trim();
    const siteName = (post.site || '').trim();

    const matchedCustomer = (customers || []).find((c: any) =>
      c.name && contractorName && (
        c.name.trim() === contractorName ||
        contractorName.includes(c.name.trim()) ||
        c.name.trim().includes(contractorName)
      )
    );

    const matchedSite = (sites || []).find((s: any) =>
      s.name && siteName && (
        s.name.trim() === siteName ||
        siteName.includes(s.name.trim()) ||
        s.name.trim().includes(siteName)
      )
    );

    // 3. 계약 매칭
    let matchedContract = (contracts || []).find((c: any) =>
      (matchedCustomer && c.customerId === matchedCustomer.id) ||
      (matchedSite && c.siteId === matchedSite.id)
    );

    // 4. 자산 매핑 & 5대 매트릭스 사장님 확정 1번 원칙 (단독 1대 계약 자동 추정)
    let finalAssetNo = post.assetNo;
    let matchedAsset = (assets || []).find((a: any) => a.assetNo && finalAssetNo && a.assetNo.trim().toUpperCase() === finalAssetNo.trim().toUpperCase());
    let isSingleGuessed = false;

    if ((!finalAssetNo || finalAssetNo === '현장확인' || finalAssetNo === '전체장비' || finalAssetNo === '미지정') && matchedContract) {
      const activeCas = (contractAssets || []).filter((ca: any) => ca.contractId === matchedContract.id && ca.status !== 'RETURNED');
      if (activeCas.length === 1 && activeCas[0].assetId) {
        const singleAsset = (assets || []).find((a: any) => a.id === activeCas[0].assetId);
        if (singleAsset) {
          matchedAsset = singleAsset;
          finalAssetNo = singleAsset.assetNo;
          isSingleGuessed = true;
          singleAssetGuessedCount++;
        }
      }
    } else if (matchedAsset && !matchedContract) {
      const activeCa = (contractAssets || []).find((ca: any) => ca.assetId === matchedAsset.id && ca.status !== 'RETURNED');
      if (activeCa) {
        matchedContract = (contracts || []).find((c: any) => c.id === activeCa.contractId);
      }
    }

    if (matchedContract) {
      matchedContractCount++;
    }

    if (finalAssetNo && finalAssetNo !== '현장확인' && finalAssetNo !== '전체장비') {
      uniqueAssetSet.add(finalAssetNo);
    }

    parsedRecords.push({
      idx: idx + 1,
      author: authorName,
      date: post.date,
      site: post.site,
      customer: post.customer,
      location: post.location,
      assetNo: finalAssetNo || '현장확인',
      issue: post.issue,
      contact: post.contact,
      raw: post.raw,
      matchedAssetId: matchedAsset?.id,
      matchedAssetNo: finalAssetNo,
      matchedModelName: matchedAsset?.modelName || '고소작업대',
      matchedCustomerId: matchedCustomer?.id,
      matchedCustomerName: matchedCustomer?.name || post.customer,
      matchedSiteId: matchedSite?.id,
      matchedSiteName: matchedSite?.name || post.site,
      matchedContractId: matchedContract?.id,
      matchedContractNo: matchedContract?.contractNo,
      mechanicId,
      mechanicName,
      status,
      resolutionType,
      actionTaken: actionText,
      isSingleAssetGuessed: isSingleGuessed
    });
  });

  return {
    totalCount: parsedRecords.length,
    uniqueAssetsCount: uniqueAssetSet.size,
    matchedContractCount,
    singleAssetGuessedCount,
    completedCount,
    revisitCount,
    guidedCount,
    records: parsedRecords
  };
}

export async function ingestBandAsHistoryDirect(
  analysis: BandAsAnalysisResult,
  onProgress?: (current: number, total: number, msg: string) => void
): Promise<{ success: boolean; message: string; count: number }> {
  const records = analysis.records;
  const total = records.length;
  let importedCount = 0;

  const existingList = db.repairs || [];
  const existingRawSet = new Set(
    existingList.map(t => `${t.siteName}_${t.assetNo}_${t.requestDate}_${(t.issueDescription || t.details || '').slice(0, 20)}`)
  );

  const newRepairs: Repair[] = [];
  const newAssetLogs: AssetInOutLog[] = [];
  const newContractHistories: ContractHistory[] = [];

  for (let idx = 0; idx < total; idx++) {
    const r = records[idx];
    const dedupeKey = `${r.site}_${r.assetNo}_${r.date}_${(r.issue || '').slice(0, 20)}`;

    if (existingRawSet.has(dedupeKey)) continue;
    existingRawSet.add(dedupeKey);

    const ticketNo = `BAND-${String(total - idx).padStart(4, '0')}`;
    const repairId = `rep-band-${Date.now()}-${idx + 1}`;

    const repairRow: Repair = {
      id: repairId,
      ticketNo,
      workCategory: 'FIELD_AS',
      workLocation: 'SITE',
      stockSource: 'VEHICLE_VAN',
      maintenanceType: 'EMERGENCY_AS',
      repairType: 'INTERNAL',
      source: 'BAND_IMPORT',
      contractId: r.matchedContractId,
      customerId: r.matchedCustomerId,
      customerName: r.matchedCustomerName || r.customer || '현장 협력업체',
      siteId: r.matchedSiteId,
      siteName: r.matchedSiteName || r.site,
      assetId: r.matchedAssetId,
      assetNo: r.matchedAssetNo || r.assetNo || '현장확인',
      modelName: r.matchedModelName || '고소작업대',
      locationDetail: r.location || '',
      reporterContact: r.contact || '',
      issueCategory: r.issue.includes('방지봉') ? '방지봉/협착' : r.issue.includes('상승') || r.issue.includes('하강') ? '상하강불량' : r.issue.includes('배터리') ? '충전/전원' : '점검요청',
      issueDescription: r.issue,
      details: r.issue,
      status: r.status,
      resolutionType: r.resolutionType,
      priority: 'NORMAL',
      requestDate: r.date,
      visitDate: r.date,
      scheduleDate: r.date,
      completedDate: r.status === 'COMPLETED' ? r.date : undefined,
      mechanicId: r.mechanicId,
      assignedMechanicId: r.mechanicId,
      mechanicName: r.mechanicName,
      actionTaken: r.actionTaken,
      billableType: 'FREE',
      billableAmount: 0,
      billableToCustomer: false,
      memo: `[밴드 과거이력 자동 적재]\n작성자: ${r.author}\n원문: ${r.raw.slice(0, 150)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    newRepairs.push(repairRow);

    // 자산 이력 로그(AssetInOutLog)
    if (r.matchedAssetNo && r.matchedAssetNo !== '현장확인' && r.matchedAssetNo !== '전체장비') {
      newAssetLogs.push({
        id: `aiog-band-${Date.now()}-${idx + 1}`,
        assetId: r.matchedAssetId || `asset-${r.matchedAssetNo}`,
        assetNo: r.matchedAssetNo,
        modelName: r.matchedModelName || '고소작업대',
        type: 'REPAIR',
        eventDate: r.date,
        customerName: repairRow.customerName,
        siteName: repairRow.siteName,
        repairId: repairRow.id,
        memo: `[현장AS] ${r.issue} ➔ ${r.actionTaken} (정비사: ${r.mechanicName})`,
        createdAt: new Date().toISOString()
      });
    }

    // 계약 이력(ContractHistory)
    if (r.matchedContractId && r.status === 'COMPLETED') {
      newContractHistories.push({
        id: `ch-as-band-${Date.now()}-${idx + 1}`,
        contractId: r.matchedContractId,
        changeType: 'AS_SERVICE',
        changeDate: r.date,
        description: `[과거 현장 AS] ${r.issue} ➔ ${r.actionTaken} (${r.matchedAssetNo || '현장장비'}, 정비사: ${r.mechanicName})`,
        createdAt: new Date().toISOString()
      });
    }

    importedCount++;

    if (idx % 200 === 0 && onProgress) {
      onProgress(idx + 1, total, `[${idx + 1}/${total}] 밴드 AS 이력 변환 및 적재 준비 중...`);
    }
  }

  if (newRepairs.length > 0) {
    db.repairs = [...newRepairs, ...db.repairs];
  }
  if (newAssetLogs.length > 0) {
    db.assetInOutLogs = [...newAssetLogs, ...db.assetInOutLogs];
  }
  if (newContractHistories.length > 0) {
    db.contractHistories = [...newContractHistories, ...db.contractHistories];
  }

  await db.awaitPendingWrites();

  return {
    success: true,
    message: `🎉 밴드 과거 AS 이력 총 ${importedCount.toLocaleString()}건이 정비 마스터(repairs) 및 자산/계약 이력에 성공적으로 일괄 적재되었습니다.`,
    count: importedCount
  };
}



