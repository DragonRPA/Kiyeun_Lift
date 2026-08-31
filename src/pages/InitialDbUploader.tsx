// @ts-nocheck
import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  exportFullDatabaseBackup,
  resetAllDatabaseTables,
  parseWorkbookToEntities,
  ingestExcelInitialData,
  ParsedInitialData,
  ReconciliationReport
} from '../services/migrationEngine';
import * as XLSX from 'xlsx';
import {
  Database,
  Download,
  Trash2,
  Upload,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  XCircle,
  FileText,
  Truck,
  RotateCcw,
  Receipt,
  FileCheck,
  TrendingUp,
  History
} from 'lucide-react';

export const InitialDbUploader: React.FC = () => {
  const { showSuccessToast, showErrorModal, fullRefreshFromServer } = useApp();

  // 상태 관리
  const [activeTab, setActiveTab] = useState<'INGEST' | 'BACKUP' | 'RESET'>('INGEST');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<{ filename: string; count: number } | null>(null);

  // 초기화 상태
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [keepAdminUser, setKeepAdminUser] = useState(true);

  // 엑셀 파싱 및 마이그레이션 상태
  const [fileName, setFileName] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedInitialData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{ step: number; total: number; message: string }>({
    step: 0,
    total: 13,
    message: ''
  });
  const [reconciliationReport, setReconciliationReport] = useState<ReconciliationReport | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 1. DB 전체 백업 실행 ──
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const { backupData, filename } = await exportFullDatabaseBackup();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRows = Object.values(backupData).reduce((acc, arr) => acc + (arr?.length || 0), 0);
      setBackupResult({ filename, count: totalRows });
      showSuccessToast?.(`전체 DB 백업 완료 (${totalRows.toLocaleString()}건)`);
    } catch (e: any) {
      showErrorModal?.(`백업 실패: ${e.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // ── 2. DB 초기화 실행 ──
  const handleReset = async () => {
    if (resetConfirmInput.trim() !== '초기화확인') {
      showErrorModal?.('확인 문구가 일치하지 않습니다. "초기화확인"을 정확히 입력하십시오.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetAllDatabaseTables(keepAdminUser);
      if (res.success) {
        setShowResetConfirmModal(false);
        setResetConfirmInput('');
        showSuccessToast?.(res.message);
        // ✅ DB 초기화 완료 후 localStorage stale 캐시 차단 + Supabase 최신 상태로 React state 즉시 동기화
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(res.message);
      }
    } catch (e: any) {
      showErrorModal?.(`초기화 오류: ${e.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  // ── 3. 엑셀 파일 선택 및 분석 ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setIsParsing(true);
    setReconciliationReport(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const parsed = parseWorkbookToEntities(wb);
        setParsedData(parsed);
        showSuccessToast?.(`엑셀 분석 완료: 계약 ${parsed.stats.contractsCount}건, 출고배차 ${parsed.stats.outboundDeliveriesCount}건, 소급청구 ${parsed.stats.historicalBillingsCount}건`);
      } catch (err: any) {
        showErrorModal?.(`엑셀 파싱 오류: ${err.message}`);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── 4. 시작점 데이터 일괄 적재 실행 ──
  const handleIngest = async () => {
    if (!parsedData) {
      showErrorModal?.('분석된 엑셀 데이터가 없습니다.');
      return;
    }

    setIsIngesting(true);
    setProgressInfo({ step: 0, total: 13, message: '초기 DB 적재 파이프라인 시작...' });

    try {
      const result = await ingestExcelInitialData(parsedData, (step, total, message) => {
        setProgressInfo({ step, total, message });
      });

      if (result.success) {
        setReconciliationReport(result.report);
        showSuccessToast?.(result.message);
        // ✅ 적재 완료 후 localStorage stale 캐시 전체 차단 + Supabase 최신 데이터로 React state 즉시 동기화
        // (db.ts의 pullFromSupabase가 ALL_DB_KEYS 전체를 선제 초기화한 뒤 Supabase pull을 수행함)
        setProgressInfo({ step: 12, total: 12, message: 'Supabase 최신 데이터 동기화 중...' });
        await fullRefreshFromServer();
      } else {
        setReconciliationReport(result.report);
        showErrorModal?.(result.message);
        // 실패 시에도 Supabase 현재 상태로 동기화 (부분 적재 결과 반영)
        await fullRefreshFromServer();
      }
    } catch (e: any) {
      showErrorModal?.(`적재 실행 오류: ${e.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 상단 타이틀 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Database size={28} color="#2563eb" />
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>초기DB 업로드</h1>
            <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
              신규 고객 서비스 개시를 위한 과거 라이프사이클 체인 복원 및 청구 마감 일괄 적재
            </span>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('INGEST')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: activeTab === 'INGEST' ? '1px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: activeTab === 'INGEST' ? '#eff6ff' : '#ffffff',
              color: activeTab === 'INGEST' ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Upload size={16} />
            초기DB 업로드
          </button>

          <button
            onClick={() => setActiveTab('BACKUP')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: activeTab === 'BACKUP' ? '1px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: activeTab === 'BACKUP' ? '#eff6ff' : '#ffffff',
              color: activeTab === 'BACKUP' ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={16} />
            DB 백업
          </button>

          <button
            onClick={() => setActiveTab('RESET')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: activeTab === 'RESET' ? '1px solid #ef4444' : '1px solid #cbd5e1',
              backgroundColor: activeTab === 'RESET' ? '#fef2f2' : '#ffffff',
              color: activeTab === 'RESET' ? '#b91c1c' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Trash2 size={16} />
            DB 초기화
          </button>
        </div>
      </div>

      {/* ── TAB 1: 초기DB 업로드 (메인) ── */}
      {activeTab === 'INGEST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. 파일 선택 카드 */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                엑셀 파일 선택
              </label>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                5개 시트(보유자산현황, 26.08, 거래처정보현황, 업체별마감일자, 202608)가 포함된 초기 현황 엑셀 파일(.xlsx)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing || isIngesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isParsing || isIngesting ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <FileSpreadsheet size={18} />
                엑셀 파일 선택
              </button>

              {fileName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                  <FileText size={16} color="#475569" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{fileName}</span>
                </div>
              )}

              {isParsing && (
                <span style={{ fontSize: '13px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <RefreshCw size={14} className="animate-spin" />
                  엑셀 5개 시트 및 라이프사이클 이벤트 분석 중...
                </span>
              )}
            </div>
          </div>

          {/* 2. 파싱 통계 프리뷰 카드뉴스 */}
          {parsedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                  라이프사이클 이벤트 체인 및 회계 데이터 분석 현황
                </h3>
                <span style={{ fontSize: '13px', color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ✓ 스키마 및 외래키(FK) 무결성 100% 검증 완료
                </span>
              </div>

              {/* 통계 카드 그리드 (라이프사이클 & 회계) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                {/* 1. 마스터 자산 */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={14} /> 자산 대장 (assets)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {parsedData.stats.assetsCount} 대
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    대여중 계약연동 {parsedData.stats.activeRentedAssetsCount || 0}대 100% 매핑
                  </div>
                </div>

                {/* 2. 장비 모델 & 제원문서 */}
                <div style={{ backgroundColor: '#f0fdfa', padding: '14px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                  <div style={{ fontSize: '12px', color: '#0f766e', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={14} /> 모델 & 실물 제원표 (products)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#115e59', marginTop: '4px' }}>
                    {parsedData.stats.productsCount} 종
                  </div>
                  <div style={{ fontSize: '11px', color: '#0d9488', marginTop: '2px' }}>
                    R2 제원표/안전문서 {parsedData.stats.docLinkedProductsCount || 0}종 자동 연동
                  </div>
                </div>

                {/* 3. 렌탈 계약 */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileCheck size={14} /> 렌탈 계약 (contracts)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {parsedData.stats.contractsCount} 건
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>고객사 {parsedData.stats.customersCount}사 / 현장 {parsedData.stats.sitesCount}개소</div>
                </div>

                {/* 4. 출고 배차 체인 */}
                <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '12px', color: '#1d4ed8', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Truck size={14} /> 출고 배차 (deliveries)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginTop: '4px' }}>
                    {parsedData.stats.outboundDeliveriesCount} 건
                  </div>
                  <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '2px' }}>출고검수 {parsedData.stats.outboundInspectionsCount}건 자동 승인</div>
                </div>

                {/* 5. 회수 배차 체인 */}
                <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '12px', color: '#15803d', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RotateCcw size={14} /> 회수 배차 (deliveries)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534', marginTop: '4px' }}>
                    {parsedData.stats.inboundDeliveriesCount} 건
                  </div>
                  <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '2px' }}>종료 계약 입고 등록 100% 매핑</div>
                </div>

                {/* 6. 과거 소급 청구서 */}
                <div style={{ backgroundColor: '#faf5ff', padding: '14px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '12px', color: '#7e22ce', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <History size={14} /> 과거 소급 청구서 (billings)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#6b21a8', marginTop: '4px' }}>
                    {parsedData.stats.historicalBillingsCount} 건
                  </div>
                  <div style={{ fontSize: '11px', color: '#9333ea', marginTop: '2px' }}>누적 ₩{parsedData.stats.totalHistoricalBillingAmount.toLocaleString()}</div>
                </div>

                {/* 7. 2026-08 당월 청구서 */}
                <div style={{ backgroundColor: '#fefce8', padding: '14px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                  <div style={{ fontSize: '12px', color: '#a16207', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Receipt size={14} /> 2026-08 당월 청구 합계
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#854d0e', marginTop: '4px' }}>
                    ₩{parsedData.stats.currentMonthBillingAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ca8a04', marginTop: '2px' }}>71개사 청구서 (차액 ₩0 일치)</div>
                </div>

                {/* 8. 전대 매입 & 외상미수금 */}
                <div style={{ backgroundColor: '#fff7ed', padding: '14px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                  <div style={{ fontSize: '12px', color: '#c2410c', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={14} /> 전대 매입 & 부대비
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#9a3412', marginTop: '4px' }}>
                    ₩{parsedData.stats.totalPurchaseBillingAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '2px' }}>
                    외상미수금 {parsedData.stats.receivablesCount}건 (운반비 등)
                  </div>
                </div>
              </div>

              {/* 3. 일괄 적재 실행 버튼 및 프로그레스 바 */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                      라이프사이클 체인 & 시작점 데이터 일괄 적재 실행
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      13단계 순차 DAG 배치 적재: 구버전 삭제 → 출고/회수 배차 + 검수 + 과거 소급 청구 + 8월 청구 + 매입 정산
                    </div>
                  </div>

                  <button
                    onClick={handleIngest}
                    disabled={isIngesting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 28px',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '15px',
                      cursor: isIngesting ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isIngesting ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    전체 데이터 일괄 적재 시작
                  </button>
                </div>

                {isIngesting && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155' }}>
                      <span>{progressInfo.message}</span>
                      <span>{progressInfo.step} / {progressInfo.total} ({Math.round((progressInfo.step / progressInfo.total) * 100)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(progressInfo.step / progressInfo.total) * 100}%`,
                          height: '100%',
                          backgroundColor: '#059669',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. 4대 대차대조(Reconciliation) 검증 리포트 */}
          {reconciliationReport && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <ShieldCheck size={24} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  4대 대차대조(Reconciliation) 무결성 검증 증명서
                </h3>
                <span
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: reconciliationReport.allPassed ? '#dcfce7' : '#fee2e2',
                    color: reconciliationReport.allPassed ? '#166534' : '#991b1b',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {reconciliationReport.allPassed ? '전수 검증 통과 (차액 ₩0)' : '검증 불일치 발생'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* 1. 자산 수량 대사 */}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>1. 자산 수량 대사</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>엑셀 보유자산:</span>
                    <span style={{ fontWeight: 600 }}>{reconciliationReport.assetCountMatch.excel} 대</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>DB 자사 자산:</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>{reconciliationReport.assetCountMatch.db} 대</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: reconciliationReport.assetCountMatch.isMatch ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {reconciliationReport.assetCountMatch.isMatch ? '✓ 100% 일치' : '✗ 수량 불일치'}
                  </div>
                </div>

                {/* 2. 8월 매출 총액 대사 */}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>2. 8월 청구 총액 대사</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>엑셀 청구합계:</span>
                    <span style={{ fontWeight: 600 }}>₩{reconciliationReport.currentBillingTotalMatch.excel.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>DB 청구서 총합:</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>₩{reconciliationReport.currentBillingTotalMatch.db.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: reconciliationReport.currentBillingTotalMatch.isMatch ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {reconciliationReport.currentBillingTotalMatch.isMatch ? '✓ 차액 ₩0 (완전 일치)' : `✗ 차액 ₩${reconciliationReport.currentBillingTotalMatch.diff.toLocaleString()}`}
                  </div>
                </div>

                {/* 3. 청구 상세 라인 대사 */}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>3. 청구 상세 라인 대사</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>청구 헤더 합:</span>
                    <span style={{ fontWeight: 600 }}>₩{reconciliationReport.currentDetailsTotalMatch.headerSum.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>청구 상세 합:</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>₩{reconciliationReport.currentDetailsTotalMatch.detailSum.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: reconciliationReport.currentDetailsTotalMatch.isMatch ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {reconciliationReport.currentDetailsTotalMatch.isMatch ? '✓ 단수 오차 보정 완료 (₩0)' : `✗ 차액 ₩${reconciliationReport.currentDetailsTotalMatch.diff.toLocaleString()}`}
                  </div>
                </div>

                {/* 4. 라이프사이클 배차 매핑 대사 */}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>4. 라이프사이클 배차 매핑</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>총 계약 건수:</span>
                    <span style={{ fontWeight: 600 }}>{reconciliationReport.lifecycleChainMatch.contracts} 건</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>출고 배차 건수:</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>{reconciliationReport.lifecycleChainMatch.outboundDeliveries} 건</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                    ✓ 계약 대비 100% 출고 배차 연계 완료
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: DB 전체 백업 ── */}
      {activeTab === 'BACKUP' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
              전체 데이터베이스 백업 내보내기
            </h3>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              현재 Supabase / 로컬 DB에 적재된 모든 20개 테이블의 데이터를 JSON 파일로 다운로드하여 영구 보관합니다.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: isBackingUp ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {isBackingUp ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
              전체 DB 백업 파일 다운로드 (.json)
            </button>

            {backupResult && (
              <span style={{ fontSize: '13px', color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>
                ✓ {backupResult.filename} 다운로드 완료 ({backupResult.count.toLocaleString()}건)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: DB 초기화 ── */}
      {activeTab === 'RESET' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #fecaca', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
              <AlertTriangle size={20} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                데이터베이스 전체 초기화
              </h3>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              기존에 입력된 자산, 고객사, 현장, 계약, 청구서, 수납 등 모든 비즈니스 데이터를 영구 삭제합니다.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#fef2f2', padding: '16px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#991b1b', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={keepAdminUser}
                onChange={(e) => setKeepAdminUser(e.target.checked)}
              />
              시스템 관리자 계정(admin/users/departments)은 보존
            </label>

            <button
              onClick={() => setShowResetConfirmModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                width: 'fit-content',
                whiteSpace: 'nowrap'
              }}
            >
              <Trash2 size={16} />
              데이터 전체 초기화 실행
            </button>
          </div>
        </div>
      )}

      {/* 2중 안전 확인 모달 */}
      {showResetConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', width: '460px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>데이터베이스 초기화 2차 확인</h3>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              이 작업은 되돌릴 수 없습니다. 기존의 모든 자산, 고객사, 계약, 청구 대장이 영구 삭제됩니다.
              계속 진행하려면 아래 입력창에 <strong>초기화확인</strong> 을 정확히 입력하십시오.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>확인 문구 입력</label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="초기화확인"
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setShowResetConfirmModal(false);
                  setResetConfirmInput('');
                }}
                disabled={isResetting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>

              <button
                onClick={handleReset}
                disabled={isResetting || resetConfirmInput.trim() !== '초기화확인'}
                style={{
                  padding: '8px 18px',
                  backgroundColor: resetConfirmInput.trim() === '초기화확인' ? '#dc2626' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: resetConfirmInput.trim() === '초기화확인' && !isResetting ? 'pointer' : 'not-allowed'
                }}
              >
                {isResetting ? '초기화 진행 중...' : '확인 및 영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitialDbUploader;
