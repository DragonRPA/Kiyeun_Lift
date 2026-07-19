import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/db';
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
} from 'lucide-react';

// ──────────────────────────────────────────────
// 테이블 스키마 정의
// ──────────────────────────────────────────────
type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  enumValues?: string[];
  example: string;
  description?: string;
}

interface TableDef {
  key: string;
  label: string;
  supabaseTable: string;
  fields: FieldDef[];
}

const TABLE_SCHEMAS: TableDef[] = [
  {
    key: 'customers',
    label: '고객사',
    supabaseTable: 'customers',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'CUST-001', description: '고유 식별자 (임의 문자열)' },
      { key: 'name', label: '고객사명', type: 'string', required: true, example: '(주)한국건설' },
      { key: 'bizRegNo', label: '사업자번호', type: 'string', required: true, example: '123-45-67890' },
      { key: 'isClosed', label: '폐업여부', type: 'boolean', required: true, example: 'false', description: 'true 또는 false' },
      { key: 'address', label: '주소', type: 'string', required: true, example: '서울시 강남구 테헤란로 123' },
      { key: 'representative', label: '대표자', type: 'string', required: true, example: '홍길동' },
      { key: 'repContact', label: '대표연락처', type: 'string', required: true, example: '02-1234-5678' },
      { key: 'repEmail', label: '대표이메일', type: 'string', required: false, example: 'ceo@company.com' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'contacts',
    label: '고객 담당자',
    supabaseTable: 'customer_contacts',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'CONT-001' },
      { key: 'customerId', label: '고객사 ID', type: 'string', required: true, example: 'CUST-001', description: 'customers.id 참조' },
      { key: 'name', label: '담당자명', type: 'string', required: true, example: '김담당' },
      { key: 'position', label: '직책', type: 'string', required: true, example: '과장' },
      { key: 'contact', label: '연락처', type: 'string', required: true, example: '010-1234-5678' },
      { key: 'email', label: '이메일', type: 'string', required: false, example: 'manager@company.com' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'sites',
    label: '현장',
    supabaseTable: 'customer_sites',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'SITE-001' },
      { key: 'customerId', label: '고객사 ID', type: 'string', required: true, example: 'CUST-001' },
      { key: 'name', label: '현장명', type: 'string', required: true, example: '강남 본사 신축공사' },
      { key: 'address', label: '현장주소', type: 'string', required: true, example: '서울시 강남구 역삼동 100' },
      { key: 'contactName', label: '현장담당자', type: 'string', required: false, example: '이현장' },
      { key: 'contact', label: '현장연락처', type: 'string', required: false, example: '010-9876-5432' },
      { key: 'email', label: '현장이메일', type: 'string', required: false, example: 'site@company.com' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'products',
    label: '제품 (모델)',
    supabaseTable: 'products',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'PROD-001' },
      { key: 'modelName', label: '모델명', type: 'string', required: true, example: 'HY-15S' },
      { key: 'feet', label: '피트수', type: 'number', required: true, example: '15' },
      { key: 'spec', label: '규격/스펙', type: 'string', required: false, example: '전기식, 최대하중 2000kg' },
      { key: 'manufacturer', label: '제조사', type: 'string', required: false, example: '현대로지스틱스' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'assets',
    label: '자산 (장비)',
    supabaseTable: 'assets',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'ASSET-001' },
      { key: 'modelName', label: '모델명', type: 'string', required: true, example: 'HY-15S' },
      { key: 'assetNo', label: '관리번호', type: 'string', required: true, example: 'KL-2024-001' },
      { key: 'serialNo', label: '제조번호', type: 'string', required: false, example: 'SN20240001' },
      { key: 'manufacturer', label: '제조사', type: 'string', required: false, example: '현대로지스틱스' },
      { key: 'ownerType', label: '소유유형', type: 'enum', required: true, example: 'OWNED', enumValues: ['OWNED', 'RENTED'], description: 'OWNED=당사자산, RENTED=임차자산' },
      { key: 'status', label: '상태', type: 'enum', required: true, example: 'AVAILABLE', enumValues: ['AVAILABLE', 'RENTED', 'REPAIRING', 'RENTED_RETURNED', 'SOLD'] },
      { key: 'acquisitionDate', label: '취득일', type: 'date', required: false, example: '2024-01-15' },
      { key: 'acquisitionPrice', label: '취득가(원)', type: 'number', required: false, example: '15000000' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
      { key: 'updatedAt', label: '수정일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'contracts',
    label: '계약',
    supabaseTable: 'contracts',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'CT-001' },
      { key: 'contractNo', label: '계약번호', type: 'string', required: true, example: 'CT-2024-001' },
      { key: 'customerId', label: '고객사 ID', type: 'string', required: true, example: 'CUST-001' },
      { key: 'contactId', label: '담당자 ID', type: 'string', required: false, example: 'CONT-001' },
      { key: 'siteId', label: '현장 ID', type: 'string', required: false, example: 'SITE-001' },
      { key: 'startDate', label: '계약시작일', type: 'date', required: true, example: '2024-01-01' },
      { key: 'endDate', label: '계약종료일', type: 'date', required: true, example: '2024-12-31' },
      { key: 'billingDay', label: '청구마감일', type: 'number', required: true, example: '30' },
      { key: 'status', label: '상태', type: 'enum', required: true, example: 'ACTIVE', enumValues: ['ACTIVE', 'EXTENDED', 'SHORTENED', 'SUCCEEDED', 'COMPLETED'] },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
      { key: 'updatedAt', label: '수정일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'contractAssets',
    label: '계약 장비',
    supabaseTable: 'contractAssets',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'CA-001' },
      { key: 'contractId', label: '계약 ID', type: 'string', required: true, example: 'CT-001' },
      { key: 'assetId', label: '자산 ID', type: 'string', required: false, example: 'ASSET-001' },
      { key: 'expectedModel', label: '요청 모델명', type: 'string', required: false, example: 'HY-15S' },
      { key: 'monthlyRentalFee', label: '월렌탈료(원)', type: 'number', required: true, example: '800000' },
      { key: 'dailyRentalFee', label: '일렌탈료(원)', type: 'number', required: true, example: '30000' },
      { key: 'startDate', label: '시작일', type: 'date', required: true, example: '2024-01-01' },
      { key: 'endDate', label: '종료일', type: 'date', required: true, example: '2024-12-31' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'deliveries',
    label: '배차/출고',
    supabaseTable: 'deliveries',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'DEL-001' },
      { key: 'contractId', label: '계약 ID', type: 'string', required: false, example: 'CT-001' },
      { key: 'type', label: '배차유형', type: 'enum', required: true, example: 'OUTBOUND', enumValues: ['OUTBOUND', 'INBOUND', 'EXCHANGE', 'MOVEMENT'] },
      { key: 'status', label: '상태', type: 'enum', required: true, example: 'REQUESTED', enumValues: ['REQUESTED', 'DISPATCHED', 'COMPLETED'] },
      { key: 'requestDate', label: '요청일', type: 'date', required: true, example: '2024-01-10' },
      { key: 'scheduledDate', label: '예정일', type: 'date', required: false, example: '2024-01-12' },
      { key: 'transportCompany', label: '운송거래처', type: 'string', required: false, example: '대한물류' },
      { key: 'vehicleNo', label: '차량번호', type: 'string', required: false, example: '서울82가 1234' },
      { key: 'driverName', label: '기사명', type: 'string', required: false, example: '홍길동' },
      { key: 'driverContact', label: '기사연락처', type: 'string', required: false, example: '010-1111-2222' },
      { key: 'deliveryCost', label: '운송비(원)', type: 'number', required: true, example: '250000' },
      { key: 'isCostSettled', label: '정산완료여부', type: 'boolean', required: true, example: 'false' },
      { key: 'memo', label: '메모', type: 'string', required: false, example: '신규 출고' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
      { key: 'updatedAt', label: '수정일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'transportCompanies',
    label: '운송 거래처',
    supabaseTable: 'transportCompanies',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'TC-001' },
      { key: 'name', label: '거래처명', type: 'string', required: true, example: '대한물류' },
      { key: 'businessNo', label: '사업자번호', type: 'string', required: false, example: '123-45-67890' },
      { key: 'contact', label: '연락처', type: 'string', required: false, example: '1588-0001' },
      { key: 'memo', label: '비고', type: 'string', required: false, example: '주요 파트너' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'transportDrivers',
    label: '운송 기사',
    supabaseTable: 'transportDrivers',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, example: 'TD-001' },
      { key: 'companyId', label: '운송거래처 ID', type: 'string', required: true, example: 'TC-001', description: 'transportCompanies.id 참조' },
      { key: 'driverName', label: '기사명', type: 'string', required: true, example: '홍길동' },
      { key: 'driverContact', label: '연락처', type: 'string', required: false, example: '010-1111-2222' },
      { key: 'vehicleNo', label: '차량번호', type: 'string', required: false, example: '서울82가 1234' },
      { key: 'vehicleType', label: '차량종류', type: 'string', required: false, example: '5톤 셀프로더' },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
  },
];

// ──────────────────────────────────────────────
// 유효성 검사 유틸
// ──────────────────────────────────────────────
interface ValidationError {
  row: number;
  field: string;
  message: string;
}

function validateRows(rows: Record<string, string>[], schema: TableDef): ValidationError[] {
  const errors: ValidationError[] = [];
  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 헤더가 1행, 데이터는 2행부터
    schema.fields.forEach((field) => {
      const val = row[field.key];
      // 필수 필드 누락
      if (field.required && (val === undefined || val === null || val.trim() === '')) {
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

function convertRow(row: Record<string, string>, schema: TableDef): Record<string, unknown> {
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
  return result;
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────
export const DevDataUploader: React.FC = () => {
  const { currentUser } = useApp();
  const [selectedTableKey, setSelectedTableKey] = useState<string>('customers');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationDone, setValidationDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isConnected = !!supabase;
  const schema = TABLE_SCHEMAS.find(t => t.key === selectedTableKey)!;

  // ──── CSV 양식 다운로드 ────
  const handleDownloadTemplate = () => {
    const headers = schema.fields.map(f => f.key).join(',');
    const example = schema.fields.map(f => `"${f.example}"`).join(',');
    const csv = `${headers}\n${example}`;
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
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows } = parseCSV(text);
      setParsedRows(rows);
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
    let successCount = 0;
    let failedCount = 0;
    const converted = parsedRows.map(row => convertRow(row, schema));

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
      } else {
        successCount += batch.length;
      }
    }
    setUploadResult({ success: successCount, failed: failedCount });
    setUploading(false);
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
            <button onClick={handleDownloadTemplate} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={15} /> {schema.label} 양식 다운로드 ({selectedTableKey}_template.csv)
            </button>
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
              {uploading ? '업로드 중...' : `Supabase에 ${parsedRows.length}건 Upsert`}
            </button>

            {uploadResult && (
              <div style={{ marginTop: '14px', display: 'flex', gap: '12px' }}>
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
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>실패 (콘솔 확인)</div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
