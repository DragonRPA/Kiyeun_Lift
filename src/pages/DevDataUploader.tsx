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
    sampleRows: [
      { id: 'CUST-001', name: '(주)한국건설', bizRegNo: '123-45-67890', isClosed: 'false', address: '서울시 강남구 테헤란로 123', representative: '홍길동', repContact: '02-1234-5678', repEmail: 'ceo@hankook.com', createdAt: '2024-01-15T09:00:00.000Z' },
      { id: 'CUST-002', name: '대우시스템즈(주)', bizRegNo: '234-56-78901', isClosed: 'false', address: '서울시 서초구 서초대로 456', representative: '이영희', repContact: '02-2345-6789', repEmail: 'ceo@daewoo.com', createdAt: '2024-02-10T09:00:00.000Z' },
      { id: 'CUST-003', name: '(주)삼성엔지니어링', bizRegNo: '345-67-89012', isClosed: 'false', address: '경기도 수원시 영통대로 789', representative: '김철수', repContact: '031-345-6789', repEmail: '', createdAt: '2024-03-05T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'CONT-001', customerId: 'CUST-001', name: '김담당', position: '과장', contact: '010-1234-5678', email: 'kim@hankook.com', createdAt: '2024-01-15T09:00:00.000Z' },
      { id: 'CONT-002', customerId: 'CUST-001', name: '이부장', position: '부장', contact: '010-2345-6789', email: 'lee@hankook.com', createdAt: '2024-01-15T09:00:00.000Z' },
      { id: 'CONT-003', customerId: 'CUST-002', name: '박팀장', position: '팀장', contact: '010-3456-7890', email: '', createdAt: '2024-02-10T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'SITE-001', customerId: 'CUST-001', name: '강남 본사 신축공사', address: '서울시 강남구 역삼동 100', contactName: '이현장', contact: '010-9876-5432', email: 'site1@hankook.com', createdAt: '2024-01-16T09:00:00.000Z' },
      { id: 'SITE-002', customerId: 'CUST-001', name: '영등포IFC 실내공사', address: '서울시 영등포구 국제금융로 10', contactName: '권현장', contact: '010-8765-4321', email: '', createdAt: '2024-02-01T09:00:00.000Z' },
      { id: 'SITE-003', customerId: 'CUST-002', name: '수원 공장 증축', address: '경기도 수원시 영통구 제조로 55', contactName: '미상', contact: '031-111-2222', email: '', createdAt: '2024-02-12T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'PROD-001', modelName: 'HY-15S', feet: '15', spec: '전기식, 최대하중 2000kg', manufacturer: '현대로지스틱스', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'PROD-002', modelName: 'HY-20E', feet: '20', spec: '전기식 관절, 최대하중 1500kg', manufacturer: '현대로지스틱스', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'PROD-003', modelName: 'SL-30D', feet: '30', spec: '디젤, 최대하중 2500kg', manufacturer: '시리우스코리아', createdAt: '2024-01-01T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'ASSET-001', modelName: 'HY-15S', assetNo: 'KL-2024-001', serialNo: 'SN20240001', manufacturer: '현대로지스틱스', ownerType: 'OWNED', status: 'RENTED', acquisitionDate: '2024-01-10', acquisitionPrice: '15000000', createdAt: '2024-01-10T09:00:00.000Z', updatedAt: '2024-06-01T09:00:00.000Z' },
      { id: 'ASSET-002', modelName: 'HY-15S', assetNo: 'KL-2024-002', serialNo: 'SN20240002', manufacturer: '현대로지스틱스', ownerType: 'OWNED', status: 'AVAILABLE', acquisitionDate: '2024-01-10', acquisitionPrice: '15000000', createdAt: '2024-01-10T09:00:00.000Z', updatedAt: '2024-01-10T09:00:00.000Z' },
      { id: 'ASSET-003', modelName: 'SL-30D', assetNo: 'KL-2024-003', serialNo: '', manufacturer: '시리우스코리아', ownerType: 'RENTED', status: 'RENTED', acquisitionDate: '', acquisitionPrice: '', createdAt: '2024-02-01T09:00:00.000Z', updatedAt: '2024-02-01T09:00:00.000Z' },
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
      { key: 'statementClosingDay', label: '명세서마감일', type: 'number', required: false, example: '25' },
      { key: 'status', label: '상태', type: 'enum', required: true, example: 'ACTIVE', enumValues: ['ACTIVE', 'EXTENDED', 'SHORTENED', 'SUCCEEDED', 'COMPLETED'] },
      { key: 'createdAt', label: '생성일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
      { key: 'updatedAt', label: '수정일시', type: 'date', required: true, example: '2024-01-01T00:00:00.000Z' },
    ],
    sampleRows: [
      { id: 'CT-001', contractNo: 'CT-2024-001', customerId: 'CUST-001', contactId: 'CONT-001', siteId: 'SITE-001', startDate: '2024-01-01', endDate: '2024-12-31', billingDay: '30', statementClosingDay: '25', status: 'ACTIVE', createdAt: '2024-01-01T09:00:00.000Z', updatedAt: '2024-01-01T09:00:00.000Z' },
      { id: 'CT-002', contractNo: 'CT-2024-002', customerId: 'CUST-002', contactId: 'CONT-003', siteId: 'SITE-003', startDate: '2024-02-15', endDate: '2025-02-14', billingDay: '25', statementClosingDay: '20', status: 'ACTIVE', createdAt: '2024-02-15T09:00:00.000Z', updatedAt: '2024-02-15T09:00:00.000Z' },
      { id: 'CT-003', contractNo: 'CT-2023-099', customerId: 'CUST-001', contactId: '', siteId: 'SITE-002', startDate: '2023-06-01', endDate: '2024-05-31', billingDay: '30', statementClosingDay: '25', status: 'COMPLETED', createdAt: '2023-06-01T09:00:00.000Z', updatedAt: '2024-05-31T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'CA-001', contractId: 'CT-001', assetId: 'ASSET-001', expectedModel: 'HY-15S', monthlyRentalFee: '800000', dailyRentalFee: '30000', startDate: '2024-01-01', endDate: '2024-12-31', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'CA-002', contractId: 'CT-001', assetId: 'ASSET-002', expectedModel: 'HY-15S', monthlyRentalFee: '800000', dailyRentalFee: '30000', startDate: '2024-01-01', endDate: '2024-12-31', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'CA-003', contractId: 'CT-002', assetId: '', expectedModel: 'SL-30D', monthlyRentalFee: '1200000', dailyRentalFee: '45000', startDate: '2024-02-15', endDate: '2025-02-14', createdAt: '2024-02-15T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'DEL-001', contractId: 'CT-001', type: 'OUTBOUND', status: 'COMPLETED', requestDate: '2024-01-10', scheduledDate: '2024-01-12', transportCompany: '대한물류', vehicleNo: '서울82가 1234', driverName: '홍길동', driverContact: '010-1111-2222', deliveryCost: '250000', isCostSettled: 'true', memo: '신규 출고', createdAt: '2024-01-10T09:00:00.000Z', updatedAt: '2024-01-12T18:00:00.000Z' },
      { id: 'DEL-002', contractId: 'CT-002', type: 'OUTBOUND', status: 'DISPATCHED', requestDate: '2024-02-20', scheduledDate: '2024-02-22', transportCompany: '민국운수', vehicleNo: '경기99바 5678', driverName: '이김담', driverContact: '010-3333-4444', deliveryCost: '300000', isCostSettled: 'false', memo: '', createdAt: '2024-02-20T09:00:00.000Z', updatedAt: '2024-02-20T09:00:00.000Z' },
      { id: 'DEL-003', contractId: 'CT-003', type: 'INBOUND', status: 'REQUESTED', requestDate: '2024-05-25', scheduledDate: '2024-05-31', transportCompany: '', vehicleNo: '', driverName: '', driverContact: '', deliveryCost: '0', isCostSettled: 'false', memo: '계약 만료 회수', createdAt: '2024-05-25T09:00:00.000Z', updatedAt: '2024-05-25T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'TC-001', name: '대한물류', businessNo: '123-45-67890', contact: '1588-0001', memo: '주요 파트너', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'TC-002', name: '민국운수', businessNo: '234-56-78901', contact: '1588-0002', memo: '', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'TC-003', name: '코리아트랜스', businessNo: '345-67-89012', contact: '02-9999-8888', memo: '대형 화물 전문', createdAt: '2024-03-01T09:00:00.000Z' },
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
    sampleRows: [
      { id: 'TD-001', companyId: 'TC-001', driverName: '홍길동', driverContact: '010-1111-1111', vehicleNo: '서울82가 1111', vehicleType: '5톤 셀프로더', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'TD-002', companyId: 'TC-002', driverName: '홍길동', driverContact: '010-2222-2222', vehicleNo: '경기99바 2222', vehicleType: '1톤 화물차', createdAt: '2024-01-01T09:00:00.000Z' },
      { id: 'TD-003', companyId: 'TC-001', driverName: '김기사', driverContact: '010-3333-3333', vehicleNo: '서울82가 3333', vehicleType: '2.5톤', createdAt: '2024-01-01T09:00:00.000Z' },
    ],
  },
];

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

import schemaSql from '../../schema.sql?raw';

// ──────────────────────────────────────────────
// Supabase 검증용 동적 SQL 스키마 파서
// ──────────────────────────────────────────────
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
    let successCount = 0;
    let failedCount = 0;
    const converted = parsedRows.map(row => convertRow(row, schema));

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
      } else {
        successCount += batch.length;
      }
    }
    setUploadResult({ success: successCount, failed: failedCount });
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
  const [generatingTestData, setGeneratingTestData] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [testDataLogs, setTestDataLogs] = useState<string[]>([]);
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
    
    let totalSuccess = 0;
    let totalFailed = 0;
    
    try {
      for (const sheetName of Object.keys(bulkParsedData)) {
        const schema = TABLE_SCHEMAS.find(t => t.key === sheetName)!;
        const sheetRows = bulkParsedData[sheetName];
        const converted = sheetRows.map(row => convertRow(row, schema));
        
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
          } else {
            totalSuccess += batch.length;
          }
        }
      }
      setBulkUploadResult({ success: totalSuccess, failed: totalFailed });
    } catch (err) {
      console.error("Bulk upload failed:", err);
      alert("업로드 중 오류가 발생했습니다.");
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

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    setTestDataLogs(prev => [...prev, `[${time}] ${prefix} ${message}`]);
  };

  const TABLE_COLUMNS: Record<string, string[]> = {
    products: ['id', 'modelName', 'feet', 'spec', 'manufacturer', 'createdAt'],
    assets: ['id', 'modelName', 'assetNo', 'serialNo', 'manufacturer', 'ownerType', 'status', 'acquisitionDate', 'acquisitionPrice', 'depreciationMonths', 'residualValueRate', 'accumDepreciation', 'bookValue', 'vendorId', 'rentStart', 'rentEnd', 'monthlyRentFee', 'dailyRentFee', 'actualRentReturnDate', 'memo', 'createdAt', 'updatedAt'],
    customers: ['id', 'name', 'bizRegNo', 'isClosed', 'address', 'representative', 'repContact', 'repEmail', 'driveFolderId', 'prepaidBalance', 'createdAt'],
    customer_contacts: ['id', 'customerId', 'name', 'position', 'contact', 'email', 'createdAt'],
    customer_sites: ['id', 'customerId', 'name', 'address', 'contactName', 'contact', 'email', 'createdAt'],
    contracts: ['id', 'contractNo', 'customerId', 'salespersonId', 'contactId', 'siteId', 'startDate', 'endDate', 'billingDay', 'status', 'driveFolderId', 'createdAt', 'updatedAt'],
    contract_assets: ['id', 'contractId', 'assetId', 'monthlyRentalFee', 'dailyRentalFee', 'startDate', 'endDate', 'createdAt'],
    deliveries: ['id', 'contractId', 'assetIds', 'transportVendorId', 'type', 'status', 'requestDate', 'loadingTime', 'unloadingTime', 'vehicleType', 'driverName', 'driverContact', 'deliveryCost', 'purchaseBillId', 'memo', 'createdAt', 'updatedAt'],
    billings: ['id', 'customerId', 'billingYm', 'billingDate', 'totalAmount', 'paidAmount', 'status', 'createdAt', 'updatedAt'],
    billing_details: ['id', 'billingId', 'contractAssetId', 'assetId', 'itemName', 'quantity', 'unitPrice', 'amount', 'description', 'createdAt'],
    payments: ['id', 'billingId', 'paymentDate', 'amount', 'method', 'memo', 'createdAt'],
    bank_transactions: ['id', 'transactionDate', 'senderName', 'depositAmount', 'withdrawAmount', 'memo', 'matchedBillingId', 'matchingType', 'createdAt'],
    consumables: ['id', 'modelName', 'stockQty', 'unit', 'unitPrice', 'vendorId', 'createdAt', 'updatedAt'],
    consumable_logs: ['id', 'consumableId', 'type', 'quantity', 'unitPrice', 'vendorId', 'userId', 'targetAssetId', 'purchaseItemId', 'evidenceFileUrl', 'actionDate', 'description', 'createdAt'],
    consumable_purchases: ['id', 'consumableId', 'modelName', 'requestedQty', 'unitPrice', 'requestDate', 'sellerName', 'status', 'acceptedDate', 'completedDate', 'requesterId', 'requesterName', 'accepterId', 'accepterName', 'inbounderName', 'receivedQty', 'statementFileUrl', 'createdAt', 'updatedAt'],
    repairs: ['id', 'assetId', 'mechanicId', 'repairType', 'vendorId', 'outboundDate', 'completedDate', 'estimateFileUrl', 'requestDate', 'status', 'details', 'isCustomerFault', 'faultImageUrl', 'laborHours', 'costTotal', 'billableToCustomer', 'billingAmount', 'billingId', 'purchaseBillId', 'createdAt', 'updatedAt'],
    repair_consumables: ['id', 'repairId', 'consumableId', 'quantity', 'unitPrice', 'cost']
  };

  const bulkUploadTable = async (tableName: string, rows: any[]) => {
    if (!supabase || rows.length === 0) return;
    const allowed = TABLE_COLUMNS[tableName];
    if (!allowed) {
      throw new Error(`테이블 정의 [${tableName}]를 스키마 맵에서 찾을 수 없습니다.`);
    }

    const sanitized = rows.map((r) => {
      const newRow: any = {};
      allowed.forEach(k => {
        if (r[k] !== undefined) {
          newRow[k] = r[k];
        }
      });

      // 외래키 혹은 관계 속성 디버깅 보완
      if (tableName === 'repairs' && r.totalCost !== undefined) {
        newRow.costTotal = r.totalCost;
      }
      if (tableName === 'billing_details' && r.assetId === undefined && r.contractAssetId) {
        const parts = String(r.contractAssetId).split('-');
        if (parts.length >= 4) {
          newRow.assetId = `testdata-asset-${parts[3]}`;
        }
      }

      return newRow;
    });

    const chunkSize = 200;
    for (let i = 0; i < sanitized.length; i += chunkSize) {
      const chunk = sanitized.slice(i, i + chunkSize);
      const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`Supabase bulk insert failed for ${tableName} at index ${i}:`, error);
        throw new Error(`Supabase Upsert 실패 [테이블: ${tableName}, 에러코드: ${error.code}, 메시지: ${error.message}]`);
      }
    }
  };

  const handleGenerateTestData = async () => {
    const confirmed = window.confirm("전체 통합 프로세스 테스트용 대규모 연관 모의 데이터를 생성하시겠습니까? 데이터 정합성과 외래키 제약조건이 실시간으로 확인 및 계산되어 로컬 및 Supabase로 일괄 업로드됩니다.");
    if (!confirmed) return;

    setGeneratingTestData(true);
    setTestDataLogs([]);
    addLog("통합 테스트 데이터 생성 시나리오 구동 시작...", "info");
    try {
      // 1. 제품 생성 (90종)
      addLog("1단계: 제품(Product) 90종 명세 생성 중...", "info");
      const products: any[] = [];
      for (let i = 1; i <= 90; i++) {
        products.push({
          id: `testdata-prod-${i}`,
          modelName: `TST-MODEL-${i.toString().padStart(2, '0')}`,
          feet: (i % 6 + 6) * 2,
          spec: `기연테스트 규격 고소작업대 ${i}호형`,
          manufacturer: ['GENIE', 'SKYJACK', 'JLG', 'HAULOTTE'][i % 4],
          isActive: true,
          createdAt: new Date('2026-01-01').toISOString()
        });
      }

      addLog("제품 90종 메모리 인스턴스 준비 완료.", "success");
      // 2. 자산 생성 (1,000개)
      setGenerationProgress("2. 자산 1,000개 생성 중...");
      addLog("2단계: 자산(Asset) 1,000개 연동 명세 생성 중...", "info");
      const assets: any[] = [];
      for (let i = 1; i <= 1000; i++) {
        const prod = products[i % products.length];
        assets.push({
          id: `testdata-asset-${i}`,
          modelName: prod.modelName,
          assetNo: `TST-EQ-${i.toString().padStart(4, '0')}`,
          serialNo: `SN-TST-${i.toString().padStart(4, '0')}`,
          manufacturer: prod.manufacturer,
          ownerType: i % 20 === 0 ? 'RENTED' : 'OWNED', // 5% Rented, 95% Owned
          status: 'AVAILABLE',
          maintenanceScore: Math.floor(Math.random() * 30),
          acquisitionDate: '2025-01-01',
          acquisitionPrice: 16000000,
          depreciationMonths: 60,
          residualValueRate: 10,
          accumDepreciation: 4000000,
          bookValue: 12000000,
          cumRentalFee: 0,
          cumRepairCost: 0,
          createdAt: new Date('2025-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      addLog("자산 1,000개 메모리 인스턴스 준비 완료. (당사 950개 / 임차 50개)", "success");
      // 3. 고객사 생성 (200사)
      setGenerationProgress("3. 고객사 200개 및 담당자/현장 각 1,000개 생성 중...");
      addLog("3단계: 가상 고객사(Customer) 200개 및 하위 담당자/현장 각 1,000개 분할 생성 중...", "info");
      const customers: any[] = [];
      for (let i = 1; i <= 200; i++) {
        customers.push({
          id: `testdata-cust-${i}`,
          name: `(주)기연테스트건설 ${i}호점`,
          bizRegNo: `999-88-${i.toString().padStart(5, '0')}`,
          isClosed: false,
          address: `인천광역시 남동구 남동서로 ${i}번길`,
          representative: `김대표${i}`,
          repContact: `010-8888-${i.toString().padStart(4, '0')}`,
          repEmail: `ceo_t${i}@example.com`,
          transactionStatus: 'ALLOWED',
          createdAt: new Date('2025-01-01').toISOString()
        });
      }

      // 4. 담당자 (1,000개) 및 현장 (1,000개) 생성
      const contacts: any[] = [];
      const sites: any[] = [];
      for (let i = 1; i <= 1000; i++) {
        const custIdx = (i % 200) + 1;
        contacts.push({
          id: `testdata-contact-${i}`,
          customerId: `testdata-cust-${custIdx}`,
          name: `최담당${i}`,
          position: ['대리', '과장', '차장', '부장'][i % 4],
          contact: `010-7777-${i.toString().padStart(4, '0')}`,
          email: `contact_${i}@example.com`,
          isActive: i % 10 !== 0,
          createdAt: new Date('2025-01-01').toISOString()
        });

        sites.push({
          id: `testdata-site-${i}`,
          customerId: `testdata-cust-${custIdx}`,
          name: `TST-인천 송도 신축현장 ${i}구역`,
          address: `인천 연수구 송도동 ${i}`,
          contactName: `이소장${i}`,
          contact: `010-6666-${i.toString().padStart(4, '0')}`,
          email: `site_${i}@example.com`,
          isActive: i % 10 !== 0,
          createdAt: new Date('2025-01-01').toISOString()
        });
      }

      addLog("고객담당자 1,000명 및 공사현장 1,000개 생성 성공.", "success");
      // 5. 계약 및 자산 매칭, 배차 입출고 이력 생성 (600건)
      setGenerationProgress("4. 계약 600건 및 물류/배차 이력 1,500건 계산 중...");
      addLog("4단계: 계약 600건, 계약자산 1,000건, 배차(출/입고) 물류 이력 1,500건 생성 중...", "info");
      const contracts: any[] = [];
      const contractAssets: any[] = [];
      const deliveries: any[] = [];

      const startTs = new Date('2026-01-01').getTime();
      const endTs = new Date('2026-07-19').getTime();
      const step = (endTs - startTs) / 599;

      let assetPointer = 1;

      for (let i = 1; i <= 600; i++) {
        const custIdx = (i % 200) + 1;
        const siteId = `testdata-site-${((custIdx - 1) * 5) + (i % 5) + 1}`;
        const contactId = `testdata-contact-${((custIdx - 1) * 5) + (i % 5) + 1}`;

        const startD = new Date(startTs + (i - 1) * step);
        const startDateStr = startD.toISOString().split('T')[0];

        const duration = 10 + (i % 9) * 10; // 10 to 90 days
        const endD = new Date(startD);
        endD.setDate(startD.getDate() + duration);
        const endDateStr = endD.toISOString().split('T')[0];

        const billingDay = [15, 20, 25, 30][i % 4];
        const statementClosingDay = billingDay === 30 ? 25 : billingDay - 5;

        const contractId = `testdata-contract-${i}`;
        const isEnded = new Date(endDateStr) < new Date('2026-07-21');

        contracts.push({
          id: contractId,
          contractNo: `TST-CTR-2026-${i.toString().padStart(4, '0')}`,
          customerId: `testdata-cust-${custIdx}`,
          contactId,
          siteId,
          startDate: startDateStr,
          endDate: endDateStr,
          billingDay,
          statementClosingDay,
          status: isEnded ? 'COMPLETED' : 'ACTIVE',
          createdAt: startD.toISOString(),
          updatedAt: new Date().toISOString()
        });

        // 계약당 자산 매칭 (1~2대)
        const assetCount = (i % 2) + 1;
        for (let j = 0; j < assetCount; j++) {
          if (assetPointer > 1000) break;
          const asset = assets[assetPointer - 1];

          if (!isEnded) {
            asset.status = 'RENTED';
            asset.currentCustomerId = `testdata-cust-${custIdx}`;
            asset.currentSiteId = siteId;
            asset.contractStart = startDateStr;
            asset.contractEnd = endDateStr;
            asset.billingDay = billingDay;
            asset.monthlyRentalFee = 450000;
            asset.dailyRentalFee = 15000;
          }

          const contractAssetId = `testdata-ca-${i}-${j}`;
          contractAssets.push({
            id: contractAssetId,
            contractId,
            assetId: asset.id,
            monthlyRentalFee: 450000,
            dailyRentalFee: 15000,
            startDate: startDateStr,
            endDate: endDateStr,
            createdAt: startD.toISOString()
          });

          // 출고 배차 (OUTBOUND)
          deliveries.push({
            id: `testdata-del-out-${i}-${j}`,
            contractId,
            assetIds: asset.id,
            type: 'OUTBOUND',
            status: 'COMPLETED',
            requestDate: startDateStr,
            scheduledDate: startDateStr,
            transportCompany: '대한물류',
            vehicleType: '5톤 셀프로더',
            vehicleNo: '서울82가 1111',
            driverName: '홍길동',
            driverContact: '010-1111-1111',
            deliveryCost: 150000,
            deliveryCostConfirmed: 150000,
            isCostSettled: true,
            memo: '테스트 출고 기연 배차 완료',
            createdAt: startD.toISOString(),
            updatedAt: startD.toISOString()
          });

          // 입고 배차 (INBOUND)
          if (isEnded) {
            deliveries.push({
              id: `testdata-del-in-${i}-${j}`,
              contractId,
              assetIds: asset.id,
              type: 'INBOUND',
              status: 'COMPLETED',
              requestDate: endDateStr,
              scheduledDate: endDateStr,
              transportCompany: '민국운수',
              vehicleType: '1톤 화물차',
              vehicleNo: '경기99바 2222',
              driverName: '홍길동',
              driverContact: '010-2222-2222',
              deliveryCost: 150000,
              deliveryCostConfirmed: 150000,
              isCostSettled: true,
              memo: '테스트 회수 완료',
              createdAt: endD.toISOString(),
              updatedAt: endD.toISOString()
            });
          } else {
            deliveries.push({
              id: `testdata-del-in-${i}-${j}`,
              contractId,
              assetIds: asset.id,
              type: 'INBOUND',
              status: Math.random() > 0.5 ? 'DISPATCHED' : 'REQUESTED',
              requestDate: endDateStr,
              scheduledDate: endDateStr,
              transportCompany: '대한물류',
              vehicleType: '2.5톤',
              vehicleNo: '서울82가 3333',
              driverName: '김기사',
              driverContact: '010-3333-3333',
              deliveryCost: 150000,
              isCostSettled: false,
              memo: '회수 예정 배차 대기',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }

          assetPointer++;
        }
      }

      addLog(`계약 600개, 매핑 계약자산 ${contractAssets.length}개, 배차지시 1,500건 역산 성공.`, "success");
      // 6. 청구 및 수납 내역 생성
      setGenerationProgress("5. 기성 청구 대장 및 결제/수납 2,000건 생성 중...");
      addLog("5단계: 매달 정산일에 부합하는 매출 기성 청구(Billing) 및 수납대장 역산 중...", "info");
      const billings: any[] = [];
      const billingDetails: any[] = [];
      const payments: any[] = [];
      const bankTransactions: any[] = [];

      contracts.forEach(contract => {
        const start = new Date(contract.startDate);
        const end = new Date(contract.endDate);
        const limit = new Date(end < new Date('2026-07-20') ? end : new Date('2026-07-20'));

        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= limit) {
          const year = current.getFullYear();
          const month = current.getMonth();
          const billingYm = `${year}-${String(month + 1).padStart(2, '0')}`;

          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 0);

          const calcStart = start > monthStart ? start : monthStart;
          const calcEnd = limit < monthEnd ? limit : monthEnd;

          const days = Math.floor((calcEnd.getTime() - calcStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          if (days > 0) {
            const billingId = `testdata-bill-${contract.id}-${billingYm}`;
            const linkedCA = contractAssets.filter(ca => ca.contractId === contract.id);
            const totalAmount = linkedCA.length * 15000 * days;

            billings.push({
              id: billingId,
              customerId: contract.customerId,
              contractId: contract.id,
              billingYm,
              billingDate: `${year}-${String(month + 1).padStart(2, '0')}-${contract.billingDay}`,
              totalAmount,
              paidAmount: 0,
              status: 'UNPAID',
              createdAt: calcEnd.toISOString(),
              updatedAt: calcEnd.toISOString()
            });

            linkedCA.forEach((ca, idx) => {
              billingDetails.push({
                id: `testdata-bd-${billingId}-${idx}`,
                billingId,
                contractAssetId: ca.id,
                itemName: `장비렌탈료 (${ca.assetId})`,
                quantity: days,
                unitPrice: 15000,
                amount: 15000 * days,
                description: `${calcStart.toISOString().split('T')[0]} ~ ${calcEnd.toISOString().split('T')[0]} 렌탈료`,
                createdAt: calcEnd.toISOString()
              });
            });
          }
          current.setMonth(current.getMonth() + 1);
        }
      });

      // 결제 및 수납 매칭 시뮬레이션
      billings.forEach(bill => {
        const isPastMonth = bill.billingYm < '2026-07';
        const rand = Math.random();

        if (isPastMonth) {
          if (rand > 0.1) {
            bill.status = 'PAID';
            bill.paidAmount = bill.totalAmount;

            const payDate = new Date(bill.billingDate);
            payDate.setDate(payDate.getDate() + 5);
            const payDateStr = payDate.toISOString().split('T')[0];

            payments.push({
              id: `testdata-pay-${bill.id}`,
              billingId: bill.id,
              paymentDate: payDateStr,
              amount: bill.totalAmount,
              method: 'BANK_TRANSFER',
              memo: '인터넷뱅킹 이체 수납',
              createdAt: payDate.toISOString()
            });

            bankTransactions.push({
              id: `testdata-bt-${bill.id}`,
              transactionDate: `${payDateStr} 10:00:00`,
              senderName: `(주)기연테스트건설 ${bill.customerId.split('-')[2]}호점`,
              depositAmount: bill.totalAmount,
              withdrawAmount: 0,
              memo: '테스트 기성 입금',
              matchedBillingId: bill.id,
              matchingType: 'AUTO',
              createdAt: payDate.toISOString()
            });
          } else if (rand > 0.05) {
            bill.status = 'PARTIAL';
            bill.paidAmount = Math.floor(bill.totalAmount / 2);
          }
        } else {
          // 7월 당월 청구 (미수금 회수 분석 시나리오용 40% 미납 처리)
          if (rand > 0.6) {
            bill.status = 'PAID';
            bill.paidAmount = bill.totalAmount;
          } else if (rand > 0.4) {
            bill.status = 'PARTIAL';
            bill.paidAmount = Math.floor(bill.totalAmount / 2);
          }
        }
      });

      addLog(`청구서 ${billings.length}건, 기성내역 ${billingDetails.length}건 정밀 계산 완료.`, "success");
      // 7. 소모품 & 구매신청 생성
      setGenerationProgress("6. 소모품 목록 및 구매 신청 300건 생성 중...");
      addLog("6단계: 정비 자재용 소모품(Consumable) 10종 및 구매 신청 200건 생성 중...", "info");
      const consumables: any[] = [];
      const consumableLogs: any[] = [];
      const consumablePurchases: any[] = [];

      for (let i = 1; i <= 10; i++) {
        consumables.push({
          id: `testdata-consumable-${i}`,
          modelName: `TST-CONSUM-PART-${i}`,
          stockQty: 100,
          unit: '개',
          unitPrice: 15000 + i * 3000,
          supplier: '가나상사',
          createdAt: new Date('2025-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      for (let i = 1; i <= 200; i++) {
        const con = consumables[i % consumables.length];
        const reqDateStr = new Date(startTs + Math.random() * (endTs - startTs)).toISOString().split('T')[0];
        const isComp = i % 10 !== 0;

        consumablePurchases.push({
          id: `testdata-conpur-${i}`,
          consumableId: con.id,
          modelName: con.modelName,
          requestedQty: 10,
          unitPrice: con.unitPrice,
          requestDate: reqDateStr,
          sellerName: '가나상사',
          status: isComp ? 'COMPLETED' : 'REQUESTED',
          receivedQty: isComp ? 10 : 0,
          requesterId: 'sys-admin',
          requesterName: '시스템관리자',
          createdAt: new Date(reqDateStr).toISOString(),
          updatedAt: new Date(reqDateStr).toISOString()
        });

        if (isComp) {
          consumableLogs.push({
            id: `testdata-cl-${i}`,
            consumableId: con.id,
            type: 'INBOUND',
            quantity: 10,
            unitPrice: con.unitPrice,
            supplier: '가나상사',
            userId: 'sys-admin',
            actionDate: reqDateStr,
            description: '모의 테스트 입고',
            createdAt: new Date(reqDateStr).toISOString()
          });
        }
      }

      addLog(`소모품 및 자재 구매이력 200건 매핑 성공.`, "success");
      // 8. 정비 내역 & 외주정비비
      setGenerationProgress("7. 정비 보고서 및 외주 정비 내역 200건 생성 중...");
      addLog("7단계: 내수/외주 자산 정비 보고서(Repair) 150건 결합 중...", "info");
      const repairs: any[] = [];
      const repairConsumables: any[] = [];

      for (let i = 1; i <= 150; i++) {
        const assetIdx = i * 6;
        if (assetIdx > 1000) break;
        const asset = assets[assetIdx - 1];

        const reqDateStr = new Date(startTs + Math.random() * (endTs - startTs)).toISOString().split('T')[0];
        const isCompleted = i % 5 !== 0;
        const isExt = i % 3 === 0;

        repairs.push({
          id: `testdata-rep-${i}`,
          assetId: asset.id,
          mechanicId: 'sys-admin',
          repairType: isExt ? 'EXTERNAL' : 'INTERNAL',
          vendorId: isExt ? 'V-001' : undefined,
          requestDate: reqDateStr,
          repairDate: isCompleted ? reqDateStr : undefined,
          completedDate: isCompleted ? reqDateStr : undefined,
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          details: isExt ? '외주 유압 실린더 재생 수리' : '상부 컨트롤러 배선 접점 정비',
          totalCost: isExt ? 350000 : 30000,
          billableToCustomer: false,
          createdAt: new Date(reqDateStr).toISOString(),
          updatedAt: new Date(reqDateStr).toISOString()
        });

        if (!isExt) {
          const con = consumables[i % consumables.length];
          repairConsumables.push({
            id: `testdata-rc-${i}`,
            repairId: `testdata-rep-${i}`,
            consumableId: con.id,
            quantity: 1,
            unitPrice: con.unitPrice,
            cost: con.unitPrice
          });
        }
      }

      // 9. 로컬 저장 적용
      setGenerationProgress("8. 로컬 스토리지 데이터 동기화 중...");
      addLog("8단계: 로컬 스토리지(localStorage) 데이터 병합 반영 중...", "info");
      db.products = [...db.products.filter(p => !p.id.startsWith('testdata-')), ...products];
      db.assets = [...db.assets.filter(a => !a.id.startsWith('testdata-')), ...assets];
      db.customers = [...db.customers.filter(c => !c.id.startsWith('testdata-')), ...customers];
      db.contacts = [...db.contacts.filter(c => !c.id.startsWith('testdata-')), ...contacts];
      db.sites = [...db.sites.filter(s => !s.id.startsWith('testdata-')), ...sites];
      db.contracts = [...db.contracts.filter(c => !c.id.startsWith('testdata-')), ...contracts];
      db.contractAssets = [...db.contractAssets.filter(ca => !ca.id.startsWith('testdata-')), ...contractAssets];
      db.deliveries = [...db.deliveries.filter(d => !d.id.startsWith('testdata-')), ...deliveries];
      db.billings = [...db.billings.filter(b => !b.id.startsWith('testdata-')), ...billings];
      db.billingDetails = [...db.billingDetails.filter(bd => !bd.id.startsWith('testdata-')), ...billingDetails];
      db.payments = [...db.payments.filter(p => !p.id.startsWith('testdata-')), ...payments];
      db.bankTransactions = [...db.bankTransactions.filter(bt => !bt.id.startsWith('testdata-')), ...bankTransactions];
      db.consumables = [...db.consumables.filter(c => !c.id.startsWith('testdata-')), ...consumables];
      db.consumableLogs = [...db.consumableLogs.filter(cl => !cl.id.startsWith('testdata-')), ...consumableLogs];
      db.consumablePurchases = [...db.consumablePurchases.filter(cp => !cp.id.startsWith('testdata-')), ...consumablePurchases];
      db.repairs = [...db.repairs.filter(r => !r.id.startsWith('testdata-')), ...repairs];
      db.repairConsumables = [...db.repairConsumables.filter(rc => !rc.id.startsWith('testdata-')), ...repairConsumables];
      addLog("로컬 캐시 메모리 병합 및 디스크 쓰기 완료.", "success");

      // 10. Supabase 동기화
      if (supabase) {
        setGenerationProgress("9. Supabase 원격 데이터베이스 업로드 중...");
        addLog("9단계: 원격 Supabase DB 일괄 동기화 (Upsert Batch) 시도 중...", "info");
        await bulkUploadTable('products', products); addLog("products 업서트 완료", "success");
        await bulkUploadTable('assets', assets); addLog("assets 업서트 완료", "success");
        await bulkUploadTable('customers', customers); addLog("customers 업서트 완료", "success");
        await bulkUploadTable('customer_contacts', contacts); addLog("customer_contacts 업서트 완료", "success");
        await bulkUploadTable('customer_sites', sites); addLog("customer_sites 업서트 완료", "success");
        await bulkUploadTable('contracts', contracts); addLog("contracts 업서트 완료", "success");
        await bulkUploadTable('contract_assets', contractAssets); addLog("contract_assets 업서트 완료", "success");
        await bulkUploadTable('deliveries', deliveries); addLog("deliveries 업서트 완료", "success");
        await bulkUploadTable('billings', billings); addLog("billings 업서트 완료", "success");
        await bulkUploadTable('billing_details', billingDetails); addLog("billing_details 업서트 완료", "success");
        await bulkUploadTable('payments', payments); addLog("payments 업서트 완료", "success");
        await bulkUploadTable('bank_transactions', bankTransactions); addLog("bank_transactions 업서트 완료", "success");
        await bulkUploadTable('consumables', consumables); addLog("consumables 업서트 완료", "success");
        await bulkUploadTable('consumable_logs', consumableLogs); addLog("consumable_logs 업서트 완료", "success");
        await bulkUploadTable('consumable_purchases', consumablePurchases); addLog("consumable_purchases 업서트 완료", "success");
        await bulkUploadTable('repairs', repairs); addLog("repairs 업서트 완료", "success");
        await bulkUploadTable('repair_consumables', repairConsumables); addLog("repair_consumables 업서트 완료", "success");
        addLog("원격 Supabase 데이터베이스 동기화 완벽 완료!", "success");
      } else {
        addLog("Supabase 연결 미확인: 원격 동기화 생략 (로컬 모드)", "info");
      }

      addLog("🎉 통합 프로세스 데이터 시나리오 생성 완료! 모든 기능 테스트 가능.", "success");
      alert("10,000건 이상의 프로세스 통합 테스트용 모의 데이터가 성공적으로 생성 및 동기화되었습니다!");
    } catch (err: any) {
      console.error(err);
      addLog(`데이터 생성 오류 발생: ${err.message || err}`, "error");
      if (err.stack) {
        addLog(`스택 추적: ${err.stack}`, "error");
      }
      alert("데이터 생성 중 오류가 발생했습니다. 로그 콘솔 창을 확인해 주십시오.");
    } finally {
      setGeneratingTestData(false);
      setGenerationProgress("");
    }
  };

  const handleDeleteTestData = async () => {
    const confirmed = window.confirm("정말 생성된 모든 테스트용 모의 데이터(IDs가 testdata-로 시작하는 항목)를 삭제하시겠습니까? 로컬 및 원격 데이터가 모두 영구 제거됩니다.");
    if (!confirmed) return;

    setGeneratingTestData(true);
    setGenerationProgress("테스트 데이터 일괄 제거 및 동기화 중...");
    try {
      const tables = [
        'products', 'assets', 'customers', 'contacts', 'sites', 'contracts',
        'contractAssets', 'deliveries', 'billings', 'billingDetails', 'payments',
        'bankTransactions', 'consumables', 'consumableLogs', 'consumablePurchases', 'repairs', 'repairConsumables'
      ];

      const mapping: Record<string, string> = {
        products: 'products',
        assets: 'assets',
        customers: 'customers',
        contacts: 'customer_contacts',
        sites: 'customer_sites',
        contracts: 'contracts',
        contractAssets: 'contract_assets',
        deliveries: 'deliveries',
        billings: 'billings',
        billingDetails: 'billing_details',
        payments: 'payments',
        bankTransactions: 'bank_transactions',
        consumables: 'consumables',
        consumableLogs: 'consumable_logs',
        consumablePurchases: 'consumable_purchases',
        repairs: 'repairs',
        repairConsumables: 'repair_consumables'
      };

      // 1. 로컬 데이터 삭제
      db.products = db.products.filter(p => !p.id.startsWith('testdata-'));
      db.assets = db.assets.filter(a => !a.id.startsWith('testdata-'));
      db.customers = db.customers.filter(c => !c.id.startsWith('testdata-'));
      db.contacts = db.contacts.filter(c => !c.id.startsWith('testdata-'));
      db.sites = db.sites.filter(s => !s.id.startsWith('testdata-'));
      db.contracts = db.contracts.filter(c => !c.id.startsWith('testdata-'));
      db.contractAssets = db.contractAssets.filter(ca => !ca.id.startsWith('testdata-'));
      db.deliveries = db.deliveries.filter(d => !d.id.startsWith('testdata-'));
      db.billings = db.billings.filter(b => !b.id.startsWith('testdata-'));
      db.billingDetails = db.billingDetails.filter(bd => !bd.id.startsWith('testdata-'));
      db.payments = db.payments.filter(p => !p.id.startsWith('testdata-'));
      db.bankTransactions = db.bankTransactions.filter(bt => !bt.id.startsWith('testdata-'));
      db.consumables = db.consumables.filter(c => !c.id.startsWith('testdata-'));
      db.consumableLogs = db.consumableLogs.filter(cl => !cl.id.startsWith('testdata-'));
      db.consumablePurchases = db.consumablePurchases.filter(cp => !cp.id.startsWith('testdata-'));
      db.repairs = db.repairs.filter(r => !r.id.startsWith('testdata-'));
      db.repairConsumables = db.repairConsumables.filter(rc => !rc.id.startsWith('testdata-'));

      // 2. Supabase 데이터 삭제
      if (supabase) {
        for (const key of tables) {
          const tableName = mapping[key];
          if (tableName) {
            const { error } = await supabase.from(tableName).delete().like('id', 'testdata-%');
            if (error) {
              console.error(`Supabase bulk delete failed for ${tableName}:`, error);
            }
          }
        }
      }

      alert("모든 테스트용 데이터가 성공적으로 일괄 삭제되었습니다!");
    } catch (err) {
      console.error(err);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setGeneratingTestData(false);
      setGenerationProgress("");
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
  const handleVerifySchema = async () => {
    if (!supabase) return;
    setCheckingSchema(true);
    const audit: { table: string; status: 'OK' | 'MISSING' | 'MISMATCH'; message: string }[] = [];
    let sqlPatch = '';

    try {
      const currentSchemas = parseSqlSchema(schemaSql);
      for (const table of Object.keys(currentSchemas)) {
        const schemaDef = currentSchemas[table];
        
        // 1. 테이블 존재 여부 검사
        const { error: tableError } = await supabase!.from(table).select('*').limit(0);
        
        if (tableError && (tableError.code === '42P01' || tableError.message.includes('does not exist'))) {
          audit.push({
            table,
            status: 'MISSING',
            message: '테이블이 Supabase에 존재하지 않습니다.'
          });
          sqlPatch += `-- [생성] ${table} 테이블 추가\n${schemaDef.createSql}\n\n`;
          continue;
        }

        // 2. 컬럼 누락 여부 검증 (각 컬럼별 limit 0 쿼리)
        const missingCols: string[] = [];
        await Promise.all(schemaDef.columns.map(async (col) => {
          const { error: colError } = await supabase!.from(table).select(col).limit(0);
          if (colError && (colError.message.includes('column') || colError.message.includes('does not exist'))) {
            missingCols.push(col);
          }
        }));

        if (missingCols.length > 0) {
          audit.push({
            table,
            status: 'MISMATCH',
            message: `컬럼 누락 (${missingCols.length}개): ${missingCols.join(', ')}`
          });
          
          sqlPatch += `-- [보완] ${table} 테이블 누락 컬럼 추가 DDL\n`;
          missingCols.forEach(col => {
            const colDef = schemaDef.columnsWithTypes[col] || 'TEXT';
            let colType = 'TEXT';
            if (colDef.includes('PRIMARY KEY')) {
              colType = 'TEXT PRIMARY KEY';
            } else if (colDef.includes('REFERENCES')) {
              colType = colDef;
            } else if (colDef.includes('CHECK')) {
              colType = colDef;
            } else if (colDef.includes('BOOLEAN')) {
              colType = 'BOOLEAN NOT NULL DEFAULT FALSE';
            } else if (colDef.includes('DOUBLE PRECISION')) {
              colType = 'DOUBLE PRECISION NOT NULL DEFAULT 0';
            } else if (colDef.includes('INTEGER')) {
              colType = 'INTEGER';
            } else if (colDef.includes('NOT NULL')) {
              colType = 'TEXT NOT NULL';
            }
            sqlPatch += `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${col}" ${colType};\n`;
          });
          sqlPatch += `\n`;
        } else {
          audit.push({
            table,
            status: 'OK',
            message: '정상 (테이블 및 모든 컬럼 일치)'
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <div style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.1)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px', color: '#15803d' }}>
                  성공: <strong>{bulkUploadResult.success}</strong> 건
                </div>
                <div style={{ flex: 1, backgroundColor: bulkUploadResult.failed > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-body)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px', color: bulkUploadResult.failed > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  실패: <strong>{bulkUploadResult.failed}</strong> 건
                </div>
              </div>
            )}
          </div>

          {/* Zone 3: 통합 테스트 데이터 관리 */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 6px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--primary)' }}>📋 통합 테스트 시나리오 데이터 관리</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              고객사 200개, 자산 1,000개, 제품 90종, 계약 600건, 배차/정비/청구/소모품 등 <strong>총 10,000건 이상의 상호 정합성이 연동된 검증용 대형 가상 데이터셋</strong>을 일괄 생성하거나 삭제합니다.
            </p>
            {generatingTestData && (
              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600', padding: '4px 8px', backgroundColor: 'var(--primary-light)', borderRadius: '4px' }}>
                ⏳ {generationProgress}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
              <button 
                onClick={handleGenerateTestData} 
                disabled={generatingTestData}
                className="btn-primary" 
                style={{ width: '100%', fontSize: '12.5px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: generatingTestData ? 0.5 : 1 }}
              >
                {generatingTestData ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <DatabaseIcon size={14} />}
                절차적(CoT) 테스트 데이터 생성
              </button>
              <button 
                onClick={handleDeleteTestData}
                disabled={generatingTestData}
                className="btn-secondary" 
                style={{ width: '100%', fontSize: '12.5px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                <Trash2 size={14} /> 생성된 테스트 데이터 일괄 삭제
              </button>
            </div>
            {testDataLogs.length > 0 && (
              <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>🖥️ 실시간 실행 로그 터미널</span>
                  <button 
                    onClick={() => setTestDataLogs([])} 
                    style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    터미널 비우기
                  </button>
                </div>
                <div style={{
                  backgroundColor: '#0f172a',
                  color: '#38bdf8',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '10px',
                  borderRadius: '6px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  lineHeight: '1.5',
                  border: '1px solid #1e293b',
                  textAlign: 'left'
                }}>
                  {testDataLogs.map((log, idx) => {
                    let color = '#38bdf8'; // info
                    if (log.includes('✅')) color = '#4ade80'; // success
                    if (log.includes('❌')) color = '#f87171'; // error
                    return (
                      <div key={idx} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {log}
                      </div>
                    );
                  })}
                </div>
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
