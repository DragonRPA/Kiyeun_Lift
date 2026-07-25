import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { supabase, db } from '../services/db';
import * as XLSX from 'xlsx';
import {
  DatabaseIcon,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Loader,
  Info,
  Trash2,
} from 'lucide-react';

// ──────────────────────────────────────────────
// 테이블 스키마 정의
// ──────────────────────────────────────────────
type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date';

interface FieldDef {
  key: string;                 // DB 컬럼 (영문)
  label: string;               // CSV 헤더에 표시될 한글 라벨
  type: FieldType;
  required: boolean;
  enumValues?: string[];        // 영문 enum 값 배열
  enumKorean?: string[];        // 한글 enum 라벨 (enumValues 순서와 동일)
  example: string;             // 영문 예시(내부 사용)
  description?: string;
}

interface TableDef {
  key: string;
  label: string;
  supabaseTable: string;
  fields: FieldDef[];
  sampleRows: Record<string, string>[]; // 양식에 포함될 샘플 데이터 2~3행
}

import schemaSql from '../../schema.sql?raw';

// Supabase 검증용 동적 SQL 스키마 파서
function parseSqlSchema(sql: string) {
  const tables: Record<string, { columns: string[]; columnsWithTypes: Record<string, string>; createSql: string }> = {};
  
  // 주석 제거
  const cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  // CREATE TABLE 매칭 regex
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase().trim();
    const body = match[2];
    const createSql = match[0].trim();
    
    const lines = body.split('\n');
    const columns: string[] = [];
    const columnsWithTypes: Record<string, string> = {};
    
    lines.forEach(line => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      
      const colMatch = cleanLine.match(/^(?:"([^"]+)"|(\w+))\s+([\s\S]+)$/);
      if (colMatch) {
        const colName = colMatch[1] || colMatch[2];
        let colDef = colMatch[3].trim();
        if (colDef.endsWith(',')) {
          colDef = colDef.slice(0, -1).trim();
        }
        
        const upperCol = colName.toUpperCase();
        if (['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK'].includes(upperCol)) {
          return;
        }
        
        columns.push(colName);
        columnsWithTypes[colName] = colDef;
      }
    });
    
    tables[tableName] = {
      columns,
      columnsWithTypes,
      createSql
    };
  }
  return tables;
}

const TABLE_LABEL_MAP: Record<string, string> = {
  departments: '부서',
  users: '사용자 (임직원)',
  vendors: '거래처 (매입처/임대처)',
  permissions: '권한 설정',
  customers: '고객사',
  customer_contacts: '고객 담당자',
  customer_sites: '고객 현장',
  products: '제품 (모델)',
  assets: '자산 (장비)',
  consumables: '소모품 마스터',
  consumable_purchase_requests: '소모품 구매 신청',
  consumable_purchase_items: '소모품 구매 신청 상세',
  consumable_logs: '소모품 입출고 로그',
  contracts: '렌탈 계약',
  contract_assets: '계약 투입 장비',
  contract_history: '계약 변경 이력',
  deliveries: '운송/출고 관리',
  billings: '매출 청구',
  billing_details: '매출 청구 상세',
  purchase_billings: '매입 청구',
  purchase_billing_details: '매입 청구 상세',
  payments: '수금/지급 정보',
  repairs: '수리/정비 마스터',
  repair_consumables: '수리 사용 소모품',
  announcements: '공지사항',
  announcement_reads: '공지사항 조회 이력',
  work_instructions: '작업 지시서',
  collaboration_requests: '협업 요청',
  collaboration_request_history: '협업 요청 이력',
  bank_transactions: '은행 계좌 거래 내역',
  bank_matching_rules: '계좌 내역 매칭 규칙',
  asset_inout_logs: '장비 입출고 일지',
  consumable_purchases: '소모품 매입 내역',
  transport_companies: '운송 업체',
  transport_drivers: '운송 기사',
  todos: 'ToDo 할일',
  google_configs: '구글 드라이브 연동 정보',
  cash_flow_snapshots: '캐시플로우 스냅샷',
};

const COLUMN_LABEL_MAP: Record<string, string> = {
  id: 'ID',
  name: '이름/명칭',
  bizRegNo: '사업자등록번호',
  isClosed: '폐업여부',
  address: '주소',
  representative: '대표자명',
  repContact: '대표연락처',
  repEmail: '대표이메일',
  createdAt: '생성일시',
  updatedAt: '수정일시',
  customerId: '고객사 ID',
  position: '직급/직책',
  contact: '연락처',
  email: '이메일',
  contactName: '담당자명',
  modelName: '모델명',
  feet: '피트수',
  spec: '규격/스펙/제원',
  manufacturer: '제조사',
  safetyCertUrl: '안전인증서링크',
  specSheetUrl: '제원표링크',
  emergencyGuideUrl: '비상조작방법링크',
  isActive: '사용여부',
  assetNo: '관리번호(자산번호)',
  serialNo: '제조번호(시리얼)',
  ownerType: '소유유형(OWNED/RENTED)',
  status: '상태',
  acquisitionDate: '취득일자',
  acquisitionPrice: '취득금액(원)',
  depreciationMonths: '감가상각상태(월)',
  residualValueRate: '잔존가치율',
  accumDepreciation: '누적감가상각액',
  bookValue: '장부가치',
  vendorId: '거래처(매입/임차) ID',
  rentStart: '임차시작일',
  rentEnd: '임차종료일',
  monthlyRentFee: '월임차료',
  dailyRentFee: '일임차료',
  actualRentReturnDate: '실제임차반납일',
  memo: '메모/비고',
  stockQty: '재고수량',
  unit: '단위',
  unitPrice: '기준매입단가',
  contractNo: '계약번호',
  contactId: '담당자 ID',
  siteId: '현장 ID',
  startDate: '시작일자',
  endDate: '종료일자',
  billingDay: '청구마감일(일)',
  statementClosingDay: '명세서마감일(일)',
  contractAssetId: '계약장비 ID',
  deliveryDate: '운송일자',
  deliveryType: '출고구분(DELIVERY/RETURN)',
  transportDriverId: '운송기사 ID',
  freightFee: '운임비(원)',
  billNo: '청구번호',
  billingDate: '청구발행일자',
  totalAmount: '총금액(원)',
  vat: '부가세(원)',
  billingId: '청구 ID',
  amount: '금액(원)',
  paymentDate: '수납/지급일자',
  paymentType: '구분(RECEIPT/DISBURSEMENT)',
  paymentMethod: '결제수단',
  bankTransactionId: '은행거래 ID',
  repairDate: '수리정비일자',
  repairType: '구분(PREVENTIVE/BREAKDOWN)',
  description: '정비내용설명',
  cost: '정비비용(원)',
  repairedBy: '정비담당자명',
  repairId: '수리정비 ID',
  consumableId: '소모품 ID',
  quantity: '수량',
  title: '제목',
  content: '내용',
  authorId: '작성자 ID',
  announcementId: '공지사항 ID',
  userId: '사용자 ID',
  readAt: '조회일시',
  assignedUserId: '담당자 ID',
  deadline: '마감기한',
  requestType: '요청구분',
  refTable: '참조테이블',
  refId: '참조레코드 ID',
  requestId: '요청 ID',
  statusBefore: '이전상태',
  statusAfter: '변경상태',
  transactionDate: '거래일자',
  withdrawal: '출금액(원)',
  deposit: '입금액(원)',
  balance: '잔액(원)',
  summary: '적요/거래내용',
  branch: '거래점명',
  ruleName: '규칙명',
  keyword: '키워드',
  targetType: '대상구분',
  targetId: '대상코드 ID',
  logType: '구분(IN/OUT)',
  logDate: '입출고일자',
  driverName: '기사명',
  driverContact: '기사연락처',
  licenseNo: '면허번호',
  carNo: '차량번호',
  isPartner: '협력업체여부',
  task: '할일내용',
  isCompleted: '완료여부',
  completedAt: '완료일시',
  folderId: '구글드라이브 폴더 ID',
  snapshotDate: '스냅샷기준일',
  startingBalance: '기초잔액',
  projectedInflow: '예상매출수금',
  projectedOpex: '예상운영지출',
  projectedCapex: '예상투자지출',
  projectedFinalBalance: '예상기말잔액',
  notes: '비고/참고사항',
};

function getDynamicTableSchemas(): TableDef[] {
  const currentSchemas = parseSqlSchema(schemaSql);
  return Object.keys(currentSchemas).map(tableName => {
    const schemaDef = currentSchemas[tableName];
    
    // 엑셀 템플릿 양식 작성 시 createdAt, updatedAt 수동 입력 제외 (시스템 자동 주입)
    const columnsToUse = schemaDef.columns.filter(col => col !== 'createdAt' && col !== 'updatedAt');

    const fields: FieldDef[] = columnsToUse.map(col => {
      const colDef = schemaDef.columnsWithTypes[col] || '';
      
      let type: FieldType = 'string';
      if (colDef.includes('BOOLEAN')) {
        type = 'boolean';
      } else if (colDef.includes('INTEGER') || colDef.includes('DOUBLE PRECISION') || colDef.includes('BIGINT') || colDef.includes('REAL') || colDef.includes('NUMERIC')) {
        type = 'number';
      } else if (col === 'createdAt' || col === 'updatedAt' || col.endsWith('Date') || col.endsWith('At') || colDef.includes('DATE') || colDef.includes('TIMESTAMP')) {
        type = 'date';
      } else if (colDef.includes('CHECK')) {
        type = 'enum';
      }
      
      let enumValues: string[] | undefined = undefined;
      let enumKorean: string[] | undefined = undefined;
      if (type === 'enum') {
        const inMatch = colDef.match(/IN\s*\(([^)]+)\)/i);
        if (inMatch) {
          enumValues = inMatch[1].split(',').map(s => s.replace(/['"\s]/g, ''));
          enumKorean = enumValues.map(v => v);
        }
      }
      
      const required = colDef.includes('NOT NULL') && !colDef.includes('DEFAULT');
      
      let example = 'sample';
      if (col === 'id') {
        let prefix = '';
        switch (tableName) {
          case 'products': prefix = 'PROD-'; break;
          case 'customers': prefix = 'CUST-'; break;
          case 'assets': prefix = 'ASSET-'; break;
          case 'customer_sites': prefix = 'SITE-'; break;
          case 'customer_contacts': prefix = 'CONT-'; break;
          case 'contracts': prefix = 'CONTR-'; break;
          case 'vendors': prefix = 'VND-'; break;
          default:
            prefix = tableName.slice(0, 4).toUpperCase() + '-';
        }
        example = `${prefix}0000001`;
      } else if (type === 'number') {
        example = '100';
      } else if (type === 'boolean') {
        example = 'true';
      } else if (type === 'date') {
        example = new Date().toISOString().slice(0, 10);
      } else if (enumValues && enumValues.length > 0) {
        example = enumValues[0];
      }
      
      return {
        key: col,
        label: COLUMN_LABEL_MAP[col] || col,
        type,
        required,
        enumValues,
        enumKorean,
        example,
        description: colDef
      };
    });
    
    const sampleRows: Record<string, string>[] = [];
    for (let i = 1; i <= 2; i++) {
      const row: Record<string, string> = {};
      fields.forEach(f => {
        if (f.key === 'id') {
          let prefix = '';
          switch (tableName) {
            case 'products': prefix = 'PROD-'; break;
            case 'customers': prefix = 'CUST-'; break;
            case 'assets': prefix = 'ASSET-'; break;
            case 'customer_sites': prefix = 'SITE-'; break;
            case 'customer_contacts': prefix = 'CONT-'; break;
            case 'contracts': prefix = 'CONTR-'; break;
            case 'vendors': prefix = 'VND-'; break;
            default:
              prefix = tableName.slice(0, 4).toUpperCase() + '-';
          }
          row[f.key] = `${prefix}${String(i).padStart(7, '0')}`;
        } else if (f.type === 'number') {
          row[f.key] = String(10 * i);
        } else if (f.type === 'boolean') {
          row[f.key] = 'true';
        } else if (f.type === 'date') {
          row[f.key] = new Date().toISOString();
        } else if (f.enumValues && f.enumValues.length > 0) {
          row[f.key] = f.enumValues[(i - 1) % f.enumValues.length];
        } else {
          row[f.key] = `샘플_${f.label}_${i}`;
        }
      });
      sampleRows.push(row);
    }
    
    return {
      key: tableName,
      label: `${TABLE_LABEL_MAP[tableName] || tableName} (${tableName})`,
      supabaseTable: tableName,
      fields,
      sampleRows
    };
  });
}

const TABLE_SCHEMAS: TableDef[] = getDynamicTableSchemas();

function mapKoreanRowToEnglish(row: Record<string, string>, schema: TableDef): Record<string, string> {
  const mapped: Record<string, string> = {};
  schema.fields.forEach(field => {
    let val = row[field.key];
    if (val === undefined || val === null) {
      val = row[field.label];
    }
    if (val === undefined || val === null) {
      const keys = Object.keys(row);
      const foundKey = keys.find(k => k.toLowerCase() === field.key.toLowerCase() || k.trim() === field.label.trim());
      if (foundKey) val = row[foundKey];
    }
    
    if (val === undefined || val === null) {
      val = '';
    } else {
      val = String(val).trim();
    }
    
    if (field.type === 'boolean') {
      if (val === '예' || val === 'true' || val === 'TRUE' || val === '1') {
        val = 'true';
      } else if (val === '아니오' || val === 'false' || val === 'FALSE' || val === '0') {
        val = 'false';
      }
    }
    
    if (field.type === 'enum') {
      if (field.enumValues) {
        if (field.enumKorean) {
          const idx = field.enumKorean.indexOf(val);
          if (idx >= 0) {
            val = field.enumValues[idx];
          }
        }
        
        if (field.key === 'ownerType') {
          if (val === '당사자산' || val === '당사' || val === 'OWNED') val = 'OWNED';
          if (val === '임차자산' || val === '임차' || val === 'RENTED') val = 'RENTED';
        }
        if (field.key === 'status' && schema.key === 'assets') {
          if (val === '대기중' || val === '대기' || val === 'AVAILABLE') val = 'AVAILABLE';
          if (val === '렌트중' || val === '임대중' || val === 'RENTED') val = 'RENTED';
          if (val === '정비중' || val === 'REPAIRING') val = 'REPAIRING';
          if (val === '반납완료' || val === 'RENTED_RETURNED') val = 'RENTED_RETURNED';
          if (val === '매각' || val === 'SOLD') val = 'SOLD';
        }
        if (field.key === 'type' && schema.key === 'deliveries') {
          if (val === '출고' || val === 'OUTBOUND') val = 'OUTBOUND';
          if (val === '입고' || val === '회수' || val === 'INBOUND') val = 'INBOUND';
          if (val === '교체' || val === 'EXCHANGE') val = 'EXCHANGE';
          if (val === '이동' || val === 'MOVEMENT') val = 'MOVEMENT';
        }
        if (field.key === 'status' && schema.key === 'deliveries') {
          if (val === '요청' || val === '요청됨' || val === 'REQUESTED') val = 'REQUESTED';
          if (val === '배차' || val === '배차됨' || val === 'DISPATCHED') val = 'DISPATCHED';
          if (val === '완료' || val === '완료됨' || val === 'COMPLETED') val = 'COMPLETED';
        }
        if (field.key === 'status' && schema.key === 'contracts') {
          if (val === '활성' || val === '계약중' || val === 'ACTIVE') val = 'ACTIVE';
          if (val === '연장' || val === '연장됨' || val === 'EXTENDED') val = 'EXTENDED';
          if (val === '단축' || val === '단축됨' || val === 'SHORTENED') val = 'SHORTENED';
          if (val === '승계' || val === '승계됨' || val === 'SUCCEEDED') val = 'SUCCEEDED';
          if (val === '완료' || val === '종료' || val === 'COMPLETED') val = 'COMPLETED';
        }
      }
    }
    
    mapped[field.key] = val;
  });
  return mapped;
}

// ──────────────────────────────────────────────
// 유효성 검사 유틸
// ──────────────────────────────────────────────
interface ValidationError {
  row: number;
  field: string;
  message: string;
}

function generateNextIdForUpload(tableName: string, index: number): string {
  let prefix = '';
  switch (tableName) {
    case 'products': prefix = 'PROD-'; break;
    case 'customers': prefix = 'CUST-'; break;
    case 'assets': prefix = 'ASSET-'; break;
    case 'customer_sites': prefix = 'SITE-'; break;
    case 'customer_contacts': prefix = 'CONT-'; break;
    case 'contracts': prefix = 'CONTR-'; break;
    case 'vendors': prefix = 'VND-'; break;
    default:
      prefix = tableName.slice(0, 4).toUpperCase() + '-';
  }
  const timestamp = Date.now().toString().slice(-4);
  const seq = String(index + 1).padStart(4, '0');
  return `${prefix}${timestamp}${seq}`;
}

function validateRows(rows: Record<string, string>[], schema: TableDef): ValidationError[] {
  const errors: ValidationError[] = [];
  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 헤더가 1행, 데이터는 2행부터
    schema.fields.forEach((field) => {
      const val = row[field.key];
      // 필수 필드 누락 (id 제외 - id는 비어있으면 자동 채번)
      if (field.required && field.key !== 'id' && (val === undefined || val === null || val.trim() === '')) {
        errors.push({ row: rowNum, field: field.label, message: '필수값이 비어 있습니다.' });
        return;
      }
      if (val === undefined || val === null || val.trim() === '') return; // 선택 필드, 비어있으면 통과

      // 타입 검사
      if (field.type === 'number' && isNaN(Number(val))) {
        errors.push({ row: rowNum, field: field.label, message: `숫자여야 합니다. (입력값: "${val}")` });
      }
      if (field.type === 'boolean' && val !== 'true' && val !== 'false') {
        errors.push({ row: rowNum, field: field.label, message: `true 또는 false 여야 합니다. (입력값: "${val}")` });
      }
      if (field.type === 'enum' && field.enumValues && !field.enumValues.includes(val.trim())) {
        errors.push({ row: rowNum, field: field.label, message: `허용값: [${field.enumValues.join(', ')}]. (입력값: "${val}")` });
      }
    });
  });
  return errors;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

function convertRow(row: Record<string, string>, schema: TableDef, index: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  schema.fields.forEach(field => {
    const val = row[field.key];
    if (val === undefined || val === null || val.trim() === '') {
      result[field.key] = null;
      return;
    }
    if (field.type === 'number') result[field.key] = Number(val);
    else if (field.type === 'boolean') result[field.key] = val === 'true';
    else result[field.key] = val.trim();
  });

  if (!result.id) {
    result.id = generateNextIdForUpload(schema.key, index);
  }

  const nowIso = new Date().toISOString();
  if (!result.createdAt) result.createdAt = nowIso;
  if (!result.updatedAt) result.updatedAt = nowIso;
  return result;
}

export const DevDataUploader: React.FC = () => {
  const { currentUser, showErrorModal } = useApp();
  const [selectedTableKey, setSelectedTableKey] = useState<string>('customers');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationDone, setValidationDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null);
  const [lastUploadErrorDetails, setLastUploadErrorDetails] = useState<string | null>(null);
  const [lastBulkUploadErrorDetails, setLastBulkUploadErrorDetails] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ──── Supabase 실시간 DB 스키마 정합성 검증 도구 상태 ────
  const [checkingSchema, setCheckingSchema] = useState(false);
  const [schemaAuditResults, setSchemaAuditResults] = useState<{ table: string; status: 'OK' | 'MISSING' | 'MISMATCH'; message: string }[] | null>(null);
  const [generatedPatchSql, setGeneratedPatchSql] = useState('');

  const schemaTableCount = React.useMemo(() => {
    try {
      return Object.keys(parseSqlSchema(schemaSql)).length;
    } catch (e) {
      return 0;
    }
  }, []);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isConnected = !!supabase;
  const schema = TABLE_SCHEMAS.find(t => t.key === selectedTableKey)!;

  // ──── CSV 양식 다운로드 ────
  // ----- CSV 한글 헤더·값 변환 유틸 -----
  const valueToKorean = (value: string, field: FieldDef): string => {
    if (field.type === 'boolean') {
      return value === 'true' ? '예' : '아니오';
    }
    if (field.type === 'enum' && field.enumKorean) {
      const idx = field.enumValues?.indexOf(value);
      return idx !== undefined && idx >= 0 ? field.enumKorean[idx] : value;
    }
    return value;
  };

  const koreanToEnglish = (value: string, field: FieldDef): string => {
    if (field.type === 'boolean') {
      return value === '예' ? 'true' : 'false';
    }
    if (field.type === 'enum' && field.enumKorean) {
      const idx = field.enumKorean.indexOf(value);
      return idx >= 0 && field.enumValues ? field.enumValues[idx] : value;
    }
    return value;
  };

  const handleDownloadTemplate = () => {
    // 헤더는 한글 라벨 사용
    const headers = schema.fields.map(f => f.label).join(',');
    let sampleLines: string;
    if (schema.sampleRows && schema.sampleRows.length > 0) {
      sampleLines = schema.sampleRows.map(row =>
        schema.fields.map(f => `"${valueToKorean(row[f.key] ?? '', f)}"`).join(',')
      ).join('\n');
    } else {
      sampleLines = schema.fields.map(f => `"${valueToKorean(f.example, f)}"`).join(',');
    }
    const csv = `${headers}\n${sampleLines}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTableKey}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  // ──── 파일 선택 ────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationDone(false);
    setValidationErrors([]);
    setUploadResult(null);
    setLastUploadErrorDetails(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows } = parseCSV(text);
      // Map Korean columns & values to English keys & standard values
      const mapped = rows.map(r => mapKoreanRowToEnglish(r, schema));
      setParsedRows(mapped);
    };
    reader.readAsText(file, 'utf-8');
  };

  // ──── 유효성 검사 ────
  const handleValidate = () => {
    const errors = validateRows(parsedRows, schema);
    setValidationErrors(errors);
    setValidationDone(true);
  };

  // ──── Supabase Upsert ────
  const handleUpload = async () => {
    if (!supabase || validationErrors.length > 0) return;
    setUploading(true);
    setUploadResult(null);
    setLastUploadErrorDetails(null);
    let successCount = 0;
    let failedCount = 0;
    let errDetailsMsg = '';

    const converted = parsedRows.map((row, idx) => convertRow(row, schema, idx));

    // Update local DB cache too
    const currentLocalData = (db as any)[selectedTableKey] || [];
    const updatedLocalData = [...currentLocalData];
    converted.forEach((newRow: any) => {
      const idx = updatedLocalData.findIndex((r: any) => r.id === newRow.id);
      if (idx >= 0) {
        updatedLocalData[idx] = { ...updatedLocalData[idx], ...newRow };
      } else {
        updatedLocalData.push(newRow);
      }
    });
    (db as any)[selectedTableKey] = updatedLocalData;

    // 50개씩 배치 업로드
    const batchSize = 50;
    for (let i = 0; i < converted.length; i += batchSize) {
      const batch = converted.slice(i, i + batchSize);
      const { error } = await supabase
        .from(schema.supabaseTable)
        .upsert(batch as any[], { onConflict: 'id' });
      if (error) {
        failedCount += batch.length;
        console.error('Upsert error:', error);
        errDetailsMsg = `[테이블: ${schema.supabaseTable}]\n[Supabase 에러 코드: ${error.code || '미지정'}]\n[메시지: ${error.message}]\n[상세 내역: ${error.details || '없음'}]\n[도움말 힌트: ${error.hint || '없음'}]`;
      } else {
        successCount += batch.length;
      }
    }
    setUploadResult({ success: successCount, failed: failedCount });
    if (errDetailsMsg) {
      setLastUploadErrorDetails(errDetailsMsg);
    }
    setUploading(false);
  };

  // ──── 전체 테이블 일괄 관리 (Excel) 상태 및 핸들러 ────
  const [bulkParsedData, setBulkParsedData] = useState<Record<string, Record<string, string>[]>>({});
  const [bulkValidationErrors, setBulkValidationErrors] = useState<{ sheet: string; row: number; field: string; message: string }[]>([]);
  const [bulkValidationDone, setBulkValidationDone] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number } | null>(null);
  const [bulkFileName, setBulkFileName] = useState('');
  const [downloadingBulk, setDownloadingBulk] = useState(false);



  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBulkTemplate = () => {
    const wb = XLSX.utils.book_new();
    TABLE_SCHEMAS.forEach(t => {
      const headers = t.fields.map(f => f.label);
      const data = [headers];
      
      if (t.sampleRows && t.sampleRows.length > 0) {
        t.sampleRows.forEach(row => {
          const rowData = t.fields.map(f => valueToKorean(row[f.key] ?? '', f));
          data.push(rowData);
        });
      } else {
        const rowData = t.fields.map(f => valueToKorean(f.example, f));
        data.push(rowData);
      }
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, t.key);
    });
    XLSX.writeFile(wb, `all_tables_template.xlsx`);
  };

  const handleDownloadBulkCurrent = async () => {
    setDownloadingBulk(true);
    try {
      const wb = XLSX.utils.book_new();
      
      await Promise.all(TABLE_SCHEMAS.map(async (t) => {
        let dataArray: any[] = [];
        if (supabase) {
          const { data, error } = await supabase.from(t.supabaseTable).select('*');
          if (error) {
            console.error(`Download error for ${t.key}:`, error);
          }
          dataArray = (data && data.length > 0) ? data : (db as any)[t.key] || [];
        } else {
          dataArray = (db as any)[t.key] || [];
        }
        
        const headers = t.fields.map(f => f.label);
        const data = [headers];
        
        (dataArray || []).forEach(row => {
          const rowData = t.fields.map(f => {
            const val = row[f.key];
            if (val === undefined || val === null) return '';
            return valueToKorean(String(val), f);
          });
          data.push(rowData);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, t.key);
      }));
      
      XLSX.writeFile(wb, `all_tables_current_data.xlsx`);
    } catch (err) {
      console.error("Bulk download error:", err);
      alert("데이터 다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloadingBulk(false);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkValidationDone(false);
    setBulkValidationErrors([]);
    setBulkUploadResult(null);
    setLastBulkUploadErrorDetails(null);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const parsedData: Record<string, Record<string, string>[]> = {};
        workbook.SheetNames.forEach(sheetName => {
          const schema = TABLE_SCHEMAS.find(t => t.key === sheetName);
          if (!schema) return;
          
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
          
          const cleanRows = rows.map(row => {
            const cleanRow: Record<string, string> = {};
            Object.keys(row).forEach(k => {
              cleanRow[k] = String(row[k]);
            });
            return cleanRow;
          });
          
          const mappedRows = cleanRows.map(r => mapKoreanRowToEnglish(r, schema));
          parsedData[sheetName] = mappedRows;
        });
        
        setBulkParsedData(parsedData);
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        alert("엑셀 파일 파싱 중 오류가 발생했습니다.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkValidate = () => {
    const errors: { sheet: string; row: number; field: string; message: string }[] = [];
    
    Object.keys(bulkParsedData).forEach(sheetName => {
      const schema = TABLE_SCHEMAS.find(t => t.key === sheetName)!;
      const sheetRows = bulkParsedData[sheetName];
      const sheetErrors = validateRows(sheetRows, schema);
      sheetErrors.forEach(err => {
        errors.push({
          sheet: schema.label,
          row: err.row,
          field: err.field,
          message: err.message
        });
      });
    });
    
    setBulkValidationErrors(errors);
    setBulkValidationDone(true);
  };

  const handleBulkUpload = async () => {
    if (!supabase || bulkValidationErrors.length > 0) return;
    setBulkUploading(true);
    setBulkUploadResult(null);
    setLastBulkUploadErrorDetails(null);
    
    let totalSuccess = 0;
    let totalFailed = 0;
    let errDetailsMsg = '';
    
    try {
      for (const sheetName of Object.keys(bulkParsedData)) {
        const schema = TABLE_SCHEMAS.find(t => t.key === sheetName)!;
        const sheetRows = bulkParsedData[sheetName];
        const converted = sheetRows.map((row, idx) => convertRow(row, schema, idx));
        
        // Update local DB cache for this sheet
        const currentLocalData = (db as any)[sheetName] || [];
        const updatedLocalData = [...currentLocalData];
        converted.forEach((newRow: any) => {
          const idx = updatedLocalData.findIndex((r: any) => r.id === newRow.id);
          if (idx >= 0) {
            updatedLocalData[idx] = { ...updatedLocalData[idx], ...newRow };
          } else {
            updatedLocalData.push(newRow);
          }
        });
        (db as any)[sheetName] = updatedLocalData;

        const batchSize = 50;
        for (let i = 0; i < converted.length; i += batchSize) {
          const batch = converted.slice(i, i + batchSize);
          const { error } = await supabase
            .from(schema.supabaseTable)
            .upsert(batch as any[], { onConflict: 'id' });
          if (error) {
            totalFailed += batch.length;
            console.error(`Bulk upsert error for ${schema.supabaseTable}:`, error);
            errDetailsMsg += `[시트/테이블: ${schema.supabaseTable}]\n[Supabase 에러 코드: ${error.code || '미지정'}]\n[메시지: ${error.message}]\n[상세 내역: ${error.details || '없음'}]\n\n`;
          } else {
            totalSuccess += batch.length;
          }
        }
      }
      setBulkUploadResult({ success: totalSuccess, failed: totalFailed });
      if (errDetailsMsg) {
        setLastBulkUploadErrorDetails(errDetailsMsg);
      }
    } catch (err: any) {
      console.error("Bulk upload failed:", err);
      showErrorModal(`⚠️ 일괄 업로드 처리 중 예외 발생:\n\n${err?.message || err}`);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleClearAllTables = async () => {
    for (let i = 1; i <= 5; i++) {
      const confirmed = window.confirm(`[경고] 정말 전체 테이블의 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다. (${i}/5)`);
      if (!confirmed) {
        alert('데이터 삭제가 취소되었습니다.');
        return;
      }
    }
    
    setBulkUploading(true);
    try {
      await db.clearAllTables();
      alert('모든 테이블의 데이터가 삭제되었습니다.');
      // Reset state
      setBulkParsedData({});
      setBulkValidationErrors([]);
      setBulkValidationDone(false);
      setBulkUploadResult(null);
      setBulkFileName('');
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    } catch (err) {
      console.error("Clear all error:", err);
      alert('데이터 초기화 중 오류가 발생했습니다.');
    } finally {
      setBulkUploading(false);
    }
  };



// ──── 현재 DB 다운로드 ────
  const handleDownloadCurrent = async () => {
    let dataArray: any[] = [];
    if (supabase) {
      const { data, error } = await supabase.from(schema.supabaseTable).select('*');
      if (error) {
        console.error('Download error (Supabase):', error);
        // fallback to local DB on error
      }
      dataArray = (data && data.length > 0) ? data : (db as any)[selectedTableKey] || [];
    } else {
      dataArray = (db as any)[selectedTableKey] || [];
    }
    generateCsvAndDownload(dataArray);
  };

  // Helper to convert rows to CSV and trigger download
  const generateCsvAndDownload = (dataArray: any[]) => {
    const headers = schema.fields.map(f => f.label).join(',');
    const rows = (dataArray || []).map(row =>
      schema.fields.map(f => {
        const val = row[f.key];
        if (val === undefined || val === null) return '';
        if (f.type === 'boolean') return val ? '예' : '아니오';
        if (f.type === 'enum' && f.enumKorean) {
          const idx = f.enumValues?.indexOf(val);
          return idx !== undefined && idx >= 0 ? f.enumKorean[idx] : val;
        }
        return val;
      }).join(',')
    ).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTableKey}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ──── 전체 데이터 삭제 ────
  const handleClearTable = async () => {
    for (let i = 1; i <= 5; i++) {
      const confirmed = window.confirm(`정말 전체 데이터를 삭제하시겠습니까? (${i}/5)`);
      if (!confirmed) {
        alert('데이터 삭제가 취소되었습니다.');
        return;
      }
    }
    if (!supabase) return;
    const { error } = await supabase.from(schema.supabaseTable).delete().neq('id', '');
    if (error) {
      console.error('Clear table error:', error);
      alert('데이터 삭제에 실패했습니다.');
    } else {
      alert('전체 데이터가 삭제되었습니다.');
    }
  };

  // ──── Supabase 실시간 DB 스키마 정합성 검증 도구 핸들러 ────
  // ──── Supabase 실시간 DB 스키마 정합성 검증 도구 핸들러 ────
  const handleVerifySchema = async () => {
    if (!supabase) return;
    setCheckingSchema(true);
    const audit: { table: string; status: 'OK' | 'MISSING' | 'MISMATCH'; message: string }[] = [];
    let sqlPatch = '';

    // PostgREST 에러 메시지로부터 누락된 칼럼명을 안전하게 파싱하는 헬퍼
    const extractColumnName = (errMsg: string): string | null => {
      const cleanMsg = errMsg.replace(/\\"/g, '"');
      const quoteMatch = cleanMsg.match(/column "([^"]+)"/i);
      if (quoteMatch) return quoteMatch[1];
      const columnWordMatch = cleanMsg.match(/column\s+([^\s]+)\s+does\s+not\s+exist/i);
      if (columnWordMatch) {
        const word = columnWordMatch[1];
        return word.includes('.') ? (word.split('.').pop() || word) : word;
      }
      return null;
    };

    try {
      const currentSchemas = parseSqlSchema(schemaSql);
      for (const table of Object.keys(currentSchemas)) {
        const schemaDef = currentSchemas[table];
        
        // 1. 테이블 존재 여부 검사
        const { error: tableError } = await supabase!.from(table).select('id').limit(0);
        
        if (tableError && (tableError.code === '42P01' || tableError.message.includes('does not exist'))) {
          audit.push({
            table,
            status: 'MISSING',
            message: '테이블이 Supabase에 존재하지 않습니다.'
          });
          sqlPatch += `-- [생성] ${table} 테이블 추가\n${schemaDef.createSql}\n\n`;
          continue;
        }

        // 2. 컬럼 누락 여부 검증 (일괄 Select 및 에러 메시지 기반 점진적 누락 색출 - 초고속 최적화)
        let activeCols = [...schemaDef.columns];
        const missingCols: string[] = [];
        let success = false;

        for (let attempt = 0; attempt < 20; attempt++) {
          if (activeCols.length === 0) {
            success = true;
            break;
          }
          
          const selectStr = activeCols.map(c => `"${c}"`).join(',');
          const { error: colError } = await supabase!.from(table).select(selectStr).limit(0);
          
          if (!colError) {
            success = true;
            break;
          }

          const missingColName = extractColumnName(colError.message);
          if (missingColName && activeCols.includes(missingColName)) {
            missingCols.push(missingColName);
            activeCols = activeCols.filter(c => c !== missingColName);
          } else {
            // 파싱 불가능한 에러는 컬럼 누락이 아니므로 중단
            break;
          }
        }

        if (missingCols.length > 0) {
          audit.push({
            table,
            status: 'MISMATCH',
            message: `컬럼 누락 (${missingCols.length}개): ${missingCols.join(', ')}`
          });
          
          sqlPatch += `-- [보완] ${table} 테이블 누락 컬럼 추가 DDL\n`;
          missingCols.forEach(col => {
            const colDef = schemaDef.columnsWithTypes[col] || 'TEXT';
            // 기존 데이터가 있는 상태에서도 성공적으로 칼럼이 추가될 수 있도록 NOT NULL 제약조건 제거 및 기본값 확보
            let colType = colDef.replace(/NOT NULL/gi, '').trim();
            sqlPatch += `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${col}" ${colType};\n`;
          });
          sqlPatch += `\n`;
        } else if (success) {
          audit.push({
            table,
            status: 'OK',
            message: '정상 (테이블 및 모든 컬럼 일치)'
          });
        } else {
          audit.push({
            table,
            status: 'MISMATCH',
            message: '검증 도중 예기치 못한 스키마 조회가 실패했습니다.'
          });
        }
      }
      setSchemaAuditResults(audit);
      setGeneratedPatchSql(sqlPatch);
    } catch (err) {
      console.error('Schema check failed:', err);
      alert('스키마 검증 중 오류가 발생했습니다.');
    } finally {
      setCheckingSchema(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <AlertTriangle size={40} style={{ margin: '0 auto 16px' }} />
        <h3>접근 권한 없음</h3>
        <p>이 메뉴는 ADMIN 역할만 접근 가능합니다.</p>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <DatabaseIcon size={22} color="var(--primary)" />
        <h2 style={{ fontWeight: '800', fontSize: '20px' }}>개발자 도구 - Supabase 데이터 업로더</h2>
      </div>

      {/* Supabase 연결 상태 배너 */}
      {!isConnected && (
        <div style={{
          backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)'
        }}>
          <AlertTriangle size={18} />
          <span><strong>Supabase 미연결:</strong> <code>VITE_SUPABASE_URL</code> 및 <code>VITE_SUPABASE_ANON_KEY</code> 환경변수를 설정해야 업로드가 활성화됩니다.</span>
        </div>
      )}
      {isConnected && (
        <div style={{
          backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e',
          borderRadius: '8px', padding: '10px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px', color: '#15803d'
        }}>
          <CheckCircle size={16} />
          <span>Supabase 연결됨 — 업로드 준비 완료</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── 좌측 패널: 테이블 선택 + 컬럼 정보 ── */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontWeight: '700', marginBottom: '14px', fontSize: '15px' }}>① 테이블 선택</h3>
          <select
            value={selectedTableKey}
            onChange={e => {
              setSelectedTableKey(e.target.value);
              setParsedRows([]);
              setValidationDone(false);
              setValidationErrors([]);
              setUploadResult(null);
              setFileName('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            style={{ width: '100%', padding: '8px', marginBottom: '20px' }}
          >
            {TABLE_SCHEMAS.map(t => (
              <option key={t.key} value={t.key}>{t.label} ({t.supabaseTable})</option>
            ))}
          </select>

          <h3 style={{ fontWeight: '700', marginBottom: '10px', fontSize: '15px' }}>컬럼 정보</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto' }}>
            {schema.fields.map(f => (
              <div key={f.key} style={{
                padding: '8px 10px', borderRadius: '6px',
                backgroundColor: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{f.key}</span>
                  <span style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
                    backgroundColor: f.required ? 'var(--danger)' : '#6b7280',
                    color: '#fff'
                  }}>{f.required ? '필수' : '선택'}</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {f.label} · <span style={{ fontStyle: 'italic' }}>{f.type}</span>
                  {f.enumValues && <span> · [{f.enumValues.join('|')}]</span>}
                </div>
                {f.description && <div style={{ color: '#9ca3af', marginTop: '2px' }}>{f.description}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* ── 우측 패널: 업로드 흐름 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* STEP 1: 양식 다운로드 */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '12px', fontSize: '15px' }}>② CSV 양식 다운로드</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              헤더 + 예시 데이터 1행이 포함된 CSV 파일을 다운로드합니다.<br />
              예시 행을 참고하여 데이터를 작성한 후 저장하세요.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button onClick={handleDownloadTemplate} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={15} /> {schema.label} 양식 다운로드 ({selectedTableKey}_template.csv)
              </button>

              {/* 신규 버튼: 현재 DB 다운로드 */}
              <button onClick={handleDownloadCurrent} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={15} /> 현재 DB 다운로드 ({selectedTableKey}_data.csv)
              </button>

              {/* 신규 버튼: 전체 데이터 삭제 */}
              <button onClick={handleClearTable} className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={15} /> 전체 데이터 삭제
              </button>
            </div>
          </div>

          {/* STEP 2: 파일 선택 */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '12px', fontSize: '15px' }}>③ 파일 선택 및 유효성 검사</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleValidate}
                disabled={parsedRows.length === 0}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: parsedRows.length === 0 ? 0.5 : 1 }}
              >
                <FileText size={15} /> 유효성 검사 실행
              </button>
            </div>

            {fileName && parsedRows.length > 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                📄 <strong>{fileName}</strong> — 총 <strong>{parsedRows.length}행</strong> 인식됨
              </div>
            )}

            {/* 검사 결과 */}
            {validationDone && (
              <div>
                {validationErrors.length === 0 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '6px', color: '#15803d'
                  }}>
                    <CheckCircle size={18} />
                    <span>유효성 검사 통과! {parsedRows.length}개 행 모두 오류 없음.</span>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px', color: 'var(--danger)',
                      marginBottom: '10px'
                    }}>
                      <XCircle size={18} />
                      <span>오류 {validationErrors.length}건 발견. 파일 수정 후 다시 업로드하세요.</span>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {validationErrors.map((err, i) => (
                        <div key={i} style={{
                          fontSize: '12px', padding: '6px 10px', borderRadius: '4px',
                          backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)'
                        }}>
                          <span style={{ color: 'var(--danger)', fontWeight: '700' }}>[{err.row}행]</span>
                          {' '}<span style={{ color: 'var(--text-secondary)' }}>{err.field}</span>
                          {' — '}{err.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 3: 업로드 */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '12px', fontSize: '15px' }}>④ Supabase 업로드 (Upsert)</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              id가 이미 존재하면 <strong>수정(Update)</strong>, 없으면 <strong>신규 삽입(Insert)</strong>합니다.
            </p>
            <button
              onClick={handleUpload}
              disabled={!isConnected || !validationDone || validationErrors.length > 0 || uploading}
              className="btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: (!isConnected || !validationDone || validationErrors.length > 0 || uploading) ? 0.4 : 1,
                backgroundColor: 'var(--success, #22c55e)'
              }}
            >
              {uploading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
              {uploading ? '업로드 중...' : `Supabase에 ${parsedRows.length}건 삽입/수정`}
            </button>

            {uploadResult && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    flex: 1, padding: '14px', borderRadius: '8px', textAlign: 'center',
                    backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e'
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#15803d' }}>{uploadResult.success}</div>
                    <div style={{ fontSize: '12px', color: '#15803d' }}>성공</div>
                  </div>
                  <div style={{
                    flex: 1, padding: '14px', borderRadius: '8px', textAlign: 'center',
                    backgroundColor: uploadResult.failed > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-body)',
                    border: uploadResult.failed > 0 ? '1px solid var(--danger)' : '1px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: uploadResult.failed > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{uploadResult.failed}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>실패</div>
                  </div>
                </div>

                {uploadResult.failed > 0 && lastUploadErrorDetails && (
                  <button
                    onClick={() => showErrorModal(`⚠️ 엑셀 데이터 업로드 실패 원인 상세 분석:\n\n${lastUploadErrorDetails}`)}
                    className="btn-danger"
                    style={{
                      width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '6px', fontSize: '12px', padding: '8px 12px'
                    }}
                  >
                    🔍 실패 원인 자세히 보기 (오류 복사)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '30px 0 20px 0' }} />

      <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <DatabaseIcon size={20} color="var(--primary)" />
          <h3 style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>전체 테이블 일괄 관리 (Excel)</h3>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)'
        }}>
          <Info size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
          <span>엑셀 파일(`.xlsx`)의 각 시트명은 <code>customers</code>, <code>contacts</code>, <code>sites</code> 등 테이블명이어야 합니다. 첫 행의 컬럼명은 한글 라벨 또는 영문 키를 지원합니다.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '20px' }}>
          {/* Zone 1: 다운로드 및 백업 */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 6px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>다운로드 및 백업</h4>
            <button onClick={handleDownloadBulkTemplate} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Download size={14} /> 전체 테이블 양식 다운로드
            </button>
            <button onClick={handleDownloadBulkCurrent} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} disabled={downloadingBulk}>
              {downloadingBulk ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
              전체 테이블 현재 데이터 다운로드
            </button>
          </div>

          {/* Zone 2: 일괄 파일 업로드 및 검사 */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 6px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>일괄 파일 업로드 및 검사</h4>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleBulkFileChange}
              style={{ width: '100%' }}
            />
            {bulkFileName && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                선택된 파일: <strong>{bulkFileName}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleBulkValidate}
                disabled={Object.keys(bulkParsedData).length === 0}
                className="btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: Object.keys(bulkParsedData).length === 0 ? 0.5 : 1 }}
              >
                <FileText size={14} /> 유효성 검사
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={!isConnected || !bulkValidationDone || bulkValidationErrors.length > 0 || bulkUploading}
                className="btn-success"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  opacity: (!isConnected || !bulkValidationDone || bulkValidationErrors.length > 0 || bulkUploading) ? 0.5 : 1,
                  backgroundColor: 'var(--success, #22c55e)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                {bulkUploading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                일괄 업서트 실행
              </button>
            </div>

            {/* Bulk validation result UI */}
            {bulkValidationDone && (
              <div style={{ marginTop: '8px' }}>
                {bulkValidationErrors.length === 0 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
                    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '6px', color: '#15803d', fontSize: '12px'
                  }}>
                    <CheckCircle size={14} />
                    <span>검사 완료: 모든 테이블 오류 없음!</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
                      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px', color: 'var(--danger)', fontSize: '12px'
                    }}>
                      <XCircle size={14} />
                      <span>검사 실패: 오류 {bulkValidationErrors.length}건 발견</span>
                    </div>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {bulkValidationErrors.slice(0, 10).map((err, i) => (
                        <div key={i} style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                          <strong>[{err.sheet} - {err.row}행]</strong> {err.field}: {err.message}
                        </div>
                      ))}
                      {bulkValidationErrors.length > 10 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '2px' }}>
                          외 {bulkValidationErrors.length - 10}건의 오류가 더 있습니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {bulkUploadResult && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.1)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px', color: '#15803d' }}>
                    성공: <strong>{bulkUploadResult.success}</strong> 건
                  </div>
                  <div style={{ flex: 1, backgroundColor: bulkUploadResult.failed > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-body)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px', color: bulkUploadResult.failed > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    실패: <strong>{bulkUploadResult.failed}</strong> 건
                  </div>
                </div>

                {bulkUploadResult.failed > 0 && lastBulkUploadErrorDetails && (
                  <button
                    onClick={() => showErrorModal(`⚠️ 엑셀 일괄 업로드 실패 원인 상세 분석:\n\n${lastBulkUploadErrorDetails}`)}
                    className="btn-danger"
                    style={{
                      width: '100%', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '4px', fontSize: '11px', padding: '6px 10px'
                    }}
                  >
                    🔍 실패 원인 자세히 보기 (오류 복사)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Zone 3: 위험 영역 */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 6px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--danger)' }}>위험 영역 (Danger Zone)</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              DB의 모든 테이블 데이터를 영구히 초기화합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <button onClick={handleClearAllTables} className="btn-danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: 'auto' }}>
              <Trash2 size={14} /> 전체 테이블 초기화 (Clear All)
            </button>
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '30px 0 20px 0' }} />

      {/* Supabase 실시간 DB 스키마 정합성 검증 도구 */}
      <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <DatabaseIcon size={20} color="var(--primary)" />
          <h3 style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>🔍 Supabase 실시간 DB 스키마 정합성 검증 도구</h3>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', margin: 0 }}>
          코드베이스에서 정의된 {schemaTableCount}개 데이터 테이블의 실제 Supabase 내 존재 여부 및 컬럼 구조를 실시간 검증합니다. 부정합이 있을 시 Supabase SQL Editor에 입력할 DDL 패치 쿼리를 자동 생성합니다.
        </p>

        <button
          onClick={handleVerifySchema}
          disabled={!isConnected || checkingSchema}
          className="btn-primary"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px',
            opacity: (!isConnected || checkingSchema) ? 0.5 : 1
          }}
        >
          {checkingSchema ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <DatabaseIcon size={16} />}
          {checkingSchema ? '스키마 정합성 검증 중...' : '실시간 DB 구조 검증 실행'}
        </button>

        {schemaAuditResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '60px' }}>번호</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>테이블명</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>상태</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>검증 결과 명세</th>
                  </tr>
                </thead>
                <tbody>
                  {schemaAuditResults.map((result, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}><code>{result.table}</code></td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                          backgroundColor: result.status === 'OK' ? 'rgba(34,197,94,0.1)' : result.status === 'MISMATCH' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                          color: result.status === 'OK' ? '#15803d' : result.status === 'MISMATCH' ? '#b45309' : 'var(--danger)'
                        }}>
                          {result.status === 'OK' ? '정상' : result.status === 'MISMATCH' ? '구조 불일치' : '테이블 누락'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {generatedPatchSql ? (
              <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(239,68,68,0.02)', border: '1px dashed var(--danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontWeight: '700', fontSize: '14px', color: 'var(--danger)', margin: 0 }}>⚠️ 스키마 복구 DDL 패치 쿼리</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPatchSql);
                      alert('클립보드에 복사되었습니다. Supabase SQL Editor에 붙여넣어 실행하세요.');
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    SQL 코드 복사
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', margin: 0 }}>
                  아래 SQL 패치 코드를 복사하여 Supabase의 SQL Editor에 붙여넣고 실행(Run)하면 부정합 상태인 테이블/컬럼이 정상 구조로 즉시 신설/보완됩니다.
                </p>
                <textarea
                  readOnly
                  value={generatedPatchSql}
                  style={{
                    width: '100%', height: '200px', fontFamily: 'monospace', fontSize: '12px',
                    backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                    borderRadius: '4px', padding: '10px', resize: 'vertical'
                  }}
                />
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: '8px', color: '#15803d'
              }}>
                <CheckCircle size={16} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>검증 결과 완전성 충족: Supabase 데이터베이스와 코드베이스 스키마가 100% 일치합니다. 추가 DDL 패치가 필요하지 않습니다.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
