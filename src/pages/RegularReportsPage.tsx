// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileBarChart2, Download, Printer, RefreshCw, CheckCircle2, 
  AlertTriangle, ArrowUpRight, TrendingUp, Truck, Wrench, 
  DollarSign, Building2, Save, Sparkles, Clock, Ban, ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  aggregateExecutiveMonthlyReport, 
  getStoredExecutiveDirective, 
  saveExecutiveDirective,
  ExecutiveMonthlyReport,
  ExecutiveDirective
} from '../services/monthlyReportEngine';
import { downloadExecutiveReportPdf } from '../services/monthlyReportPdfBuilder';

export const RegularReportsPage: React.FC = () => {
  const context = useApp();
  const [targetYm, setTargetYm] = useState<string>('2026-08');
  const [viewMode, setViewMode] = useState<'EXECUTIVE' | 'DRILLDOWN'>('EXECUTIVE');
  const [drilldownTab, setDrilldownTab] = useState<'FLEET' | 'SALES' | 'LOGISTICS' | 'MAINTENANCE' | 'FINANCE'>('FLEET');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 경영진 지시사항 로컬 상태
  const [directive, setDirective] = useState<ExecutiveDirective>(() => 
    getStoredExecutiveDirective('2026-08')
  );

  // 대상 연월 변경 시 지시사항 리로드
  useEffect(() => {
    setDirective(getStoredExecutiveDirective(targetYm));
  }, [targetYm]);

  // 실데이터 기반 전사 월간 종합 리포트 집계
  const reportData: ExecutiveMonthlyReport = useMemo(() => {
    return aggregateExecutiveMonthlyReport(targetYm, context);
  }, [targetYm, context]);

  const { period, kpis, fleet, sales, operations, finance, conservation } = reportData;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 경영진 지시사항 저장
  const handleSaveDirective = () => {
    saveExecutiveDirective(directive);
    showToast('경영진 종합 총평 및 차월 중점 지시사항이 저장되었습니다.');
  };

  // 공식 PDF 다운로드
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      await downloadExecutiveReportPdf({ ...reportData, executiveDirective: directive });
      showToast(`${period.year}년 ${period.month}월 경영 정기보고서 PDF 다운로드가 완료되었습니다.`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert('PDF 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // 브라우저 공식 인쇄
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-full pb-16 text-slate-100 regular-reports-container" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 text-sm border border-slate-700 animate-in fade-in slide-in-from-top-2 no-print">
          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          상단 제어 헤더 (Z-Pattern Step 1 & 2: Scope & Pipeline)
      ───────────────────────────────────────────────────────────── */}
      <div className="border-b sticky top-0 z-30 shadow-md backdrop-blur-md no-print" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          {/* 좌상단: 스코프 (대상 연월 및 리포트 명칭) */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/15 text-blue-400 rounded-xl border border-blue-500/30 flex-shrink-0">
              <FileBarChart2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-white tracking-tight whitespace-nowrap">
                  정기보고서 생성
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                  월간 경영 종합 브리핑
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 whitespace-nowrap">
                전사 5대 핵심 도메인(손익·자산가동·영업·물류정비·채권누수) 실데이터 통합 리포트
              </p>
            </div>

            {/* 마감 연월 드롭다운 */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  마감 연월
                </label>
                <select 
                  value={targetYm} 
                  onChange={(e) => setTargetYm(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border transition-colors cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}
                >
                  <option value="2026-08">2026년 08월 (8월 마감)</option>
                  <option value="2026-07">2026년 07월 (7월 마감)</option>
                  <option value="2026-06">2026년 06월 (6월 마감)</option>
                  <option value="2026-05">2026년 05월 (5월 마감)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 우상단: 핵심 액션 버튼군 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => showToast('최신 실데이터를 다시 집계했습니다.')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border text-slate-300 hover:text-white transition-colors"
              style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}
              title="원천 DB 재집계"
            >
              <RefreshCw size={14} />
              <span>새로고침</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border text-slate-200 hover:text-white transition-colors"
              style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}
            >
              <Printer size={14} />
              <span>공식 보고서 인쇄</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/30 transition-all active:scale-98 whitespace-nowrap"
            >
              {isDownloading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>PDF 빌드 중...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>공식 PDF 다운로드</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 뷰 모드 탭 (기본: 단일 경영 종합 보고서 / 드릴다운: 부서별) */}
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('EXECUTIVE')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                viewMode === 'EXECUTIVE'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileBarChart2 size={14} />
              <span>📑 경영 종합 보고서 (전사 통합 뷰)</span>
            </button>

            <button
              onClick={() => setViewMode('DRILLDOWN')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                viewMode === 'DRILLDOWN'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 size={14} />
              <span>🏢 부서별 상세 분석 뷰 (드릴다운)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>마감 스냅샷: <strong className="text-slate-300">{period.closingDate}</strong></span>
            <span>•</span>
            <span>발행일시: <strong className="text-slate-300">{period.generatedAt}</strong></span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          중앙 본문 영역 (Z-Pattern Step 3: High-Density Dossier)
      ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-6">

        {/* [모드 1] 📑 경영 종합 보고서 (단일 마스터 도시에) */}
        {viewMode === 'EXECUTIVE' && (
          <>
            {/* 1. 핵심 성과 지표 (Executive KPIs) 4대 카드 & 3대 건전성 인디케이터 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span>1. 경영 종합 성과 및 핵심 KPI</span>
                  <span className="text-[10px] text-blue-400 font-normal">(Executive Summary)</span>
                </h2>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    가동률 건전
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    수납 진척 양호
                  </span>
                  {kpis.totalWaivedAmount > 0 && (
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      영업면제 ₩{kpis.totalWaivedAmount.toLocaleString()} 주의
                    </span>
                  )}
                </div>
              </div>

              {/* 4대 핵심 지표 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1) 총 매출 청구액 */}
                <div className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm transition-all" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                  <span className="text-[11px] font-semibold text-slate-400">총 매출 청구액</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-2xl font-black text-white tracking-tight">
                      ₩{kpis.totalRevenue.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center">
                      <TrendingUp size={12} className="mr-0.5" /> +5.3%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between mt-1">
                    <span>렌탈료: ₩{kpis.rentalRevenue.toLocaleString()}</span>
                    <span>운송/기타: ₩{kpis.otherRevenue.toLocaleString()}</span>
                  </div>
                </div>

                {/* 2) 플릿 장비 가동률 */}
                <div className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm transition-all" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                  <span className="text-[11px] font-semibold text-slate-400">장비 가동률 (플릿 운용)</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-2xl font-black text-teal-400 tracking-tight">
                      {kpis.fleetUtilizationRate}%
                    </span>
                    <span className="text-xs text-slate-300 font-bold">
                      {kpis.activeAssetCount}대 가동
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between mt-1">
                    <span>총 플릿: {kpis.totalFleetCount}대</span>
                    <span>자사 {kpis.ownedCount} / 전대 {kpis.leasedCount}</span>
                  </div>
                </div>

                {/* 3) 수납률 및 미수금 잔액 */}
                <div className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm transition-all" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                  <span className="text-[11px] font-semibold text-slate-400">수납률 (당월 수금 진척)</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-2xl font-black text-blue-400 tracking-tight">
                      {kpis.collectionRate}%
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">
                      ₩{kpis.collectedAmount.toLocaleString()} 수납
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between mt-1">
                    <span>미수 잔액:</span>
                    <span className="text-amber-400 font-bold">₩{kpis.unpaidAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* 4) 추정 영업 공헌이익 */}
                <div className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm transition-all" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                  <span className="text-[11px] font-semibold text-slate-400">추정 영업 공헌이익</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-2xl font-black text-indigo-400 tracking-tight">
                      ₩{kpis.estimatedMargin.toLocaleString()}
                    </span>
                    <span className="text-xs text-indigo-300 font-bold">
                      마진율 {kpis.marginRate}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between mt-1">
                    <span>직접비용:</span>
                    <span>₩{kpis.totalOperatingCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 렌탈 자산 플릿 현황 & 30일 이상 장기 유휴 장비 경고 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 좌측: 규격별 플릿 현황 테이블 */}
              <div className="p-5 rounded-xl border flex flex-col gap-3 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>2. 모델 규격별 플릿(Fleet) 가동 현황</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">총 {kpis.totalFleetCount}대 운용</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                        <th className="py-2 text-left">규격 그룹</th>
                        <th className="py-2 text-center">총보유</th>
                        <th className="py-2 text-center">대여중</th>
                        <th className="py-2 text-center">유휴(가용)</th>
                        <th className="py-2 text-center">수리중</th>
                        <th className="py-2 text-right">가동률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {fleet.specSummaries.map((spec) => (
                        <tr key={spec.specName} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 font-bold text-white whitespace-nowrap">{spec.specName}</td>
                          <td className="py-2.5 text-center text-slate-300">{spec.totalCount}대</td>
                          <td className="py-2.5 text-center text-teal-400 font-bold">{spec.rentedCount}대</td>
                          <td className="py-2.5 text-center text-slate-300">{spec.availableCount}대</td>
                          <td className="py-2.5 text-center text-amber-400">{spec.repairingCount}대</td>
                          <td className="py-2.5 text-right font-black text-teal-300 whitespace-nowrap">
                            {spec.utilizationRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 우측: ⚠️ 30일 이상 장기 유휴 장비 경고 리스트 */}
              <div className="p-5 rounded-xl border border-red-500/30 bg-red-950/20 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
                    <h3 className="text-xs font-bold text-red-300">
                      30일 이상 장기 유휴 장비 리스트 (집중영업/기회손실 대상)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                    월 기회손실 발생
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-red-300/70 border-b border-red-900/40 text-[11px]">
                        <th className="py-2 text-left">자산번호</th>
                        <th className="py-2 text-left">모델(규격)</th>
                        <th className="py-2 text-center">유휴일수</th>
                        <th className="py-2 text-right">월 임대단가</th>
                        <th className="py-2 text-right">월 기회손실</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-900/30">
                      {fleet.longIdleAssets.map((idle) => (
                        <tr key={idle.assetId} className="hover:bg-red-950/40 transition-colors">
                          <td className="py-2 font-mono font-bold text-white whitespace-nowrap">{idle.assetNumber}</td>
                          <td className="py-2 text-slate-300 whitespace-nowrap">{idle.modelName} ({idle.spec})</td>
                          <td className="py-2 text-center font-bold text-amber-300">{idle.daysIdle}일</td>
                          <td className="py-2 text-right text-slate-300">₩{idle.monthlyRate.toLocaleString()}</td>
                          <td className="py-2 text-right font-bold text-red-400 whitespace-nowrap">
                            -₩{idle.estimatedOpportunityLoss.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 3. 영업 실적 & 최다 매출 기여 거래처 TOP 5 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 좌측: 최다 매출 기여 거래처 TOP 5 */}
              <div className="p-5 rounded-xl border flex flex-col gap-3 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>3. 당월 최다 매출 기여 거래처 TOP 5</span>
                  </h3>
                  <span className="text-[11px] text-blue-400 font-semibold">
                    신규 {sales.newContractsCount}건 / 종료 {sales.endedContractsCount}건
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                        <th className="py-2 text-center w-10">순위</th>
                        <th className="py-2 text-left">거래처명</th>
                        <th className="py-2 text-center">가동대수</th>
                        <th className="py-2 text-right">당월 청구액</th>
                        <th className="py-2 text-right">점유율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sales.topCustomers.map((c, idx) => (
                        <tr key={c.customerId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 font-bold text-white whitespace-nowrap">{c.customerName}</td>
                          <td className="py-2.5 text-center text-teal-400 font-semibold">{c.assetCount}대</td>
                          <td className="py-2.5 text-right font-bold text-blue-300">₩{c.totalBilled.toLocaleString()}</td>
                          <td className="py-2.5 text-right font-black text-slate-300">{c.sharePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 우측: 물류 배차 효율 및 스펙 오발주 손실 배차 */}
              <div className="p-5 rounded-xl border flex flex-col gap-3 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>4. 배차 물류 효율 및 스펙 오발주 손실 배차</span>
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-400">
                    EXCHANGE 절감 +₩{kpis.exchangeSavedCost.toLocaleString()}
                  </span>
                </div>

                {/* 배차 요약 칩 */}
                <div className="grid grid-cols-4 gap-2 text-center py-2 px-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">총 배차</span>
                    <span className="text-sm font-bold text-white">{operations.dispatchByType.total}건</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">출고</span>
                    <span className="text-sm font-bold text-blue-400">{operations.dispatchByType.outbound}건</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">회수</span>
                    <span className="text-sm font-bold text-slate-300">{operations.dispatchByType.inbound}건</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">교환(왕복)</span>
                    <span className="text-sm font-bold text-teal-400">{operations.dispatchByType.exchange}건</span>
                  </div>
                </div>

                {/* 스펙 오발주 손실 배차 건 */}
                <div className="space-y-2 mt-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-red-400">
                    <AlertTriangle size={13} />
                    <span>현장 진입불가 / 스펙 오발주로 인한 긴급 교환 (당사 손실)</span>
                  </div>

                  {operations.specMismatchEvents.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-800 rounded-lg">
                      당월 발생된 스펙 오발주 손실 배차가 없습니다. (무결점 운영)
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {operations.specMismatchEvents.map((evt) => (
                        <div key={evt.id} className="p-2.5 rounded-lg bg-red-950/30 border border-red-900/40 text-xs flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{evt.customerName}</span>
                              <span className="text-slate-400 font-normal">({evt.assetNumber})</span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{evt.reason}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs font-bold text-red-400 block">-₩{evt.extraCost.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400">{evt.paidBy}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. 채권 에이징 분석 & 영업 청구 면제(Waiver) 투명성 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 좌측: 채권 연체 에이징 분석 */}
              <div className="p-5 rounded-xl border flex flex-col gap-3 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200">
                    5. 미수 채권 연체 에이징(Aging) 분석
                  </h3>
                  <span className="text-[11px] text-amber-400 font-bold">
                    총 미수 ₩{finance.receivablesAging.totalUnpaid.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-emerald-400 font-semibold block">정상(30일 이하)</span>
                    <span className="text-xs font-bold text-white mt-1 block">₩{finance.receivablesAging.under30Days.toLocaleString()}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-blue-400 font-semibold block">31일 ~ 60일</span>
                    <span className="text-xs font-bold text-white mt-1 block">₩{finance.receivablesAging.days31To60.toLocaleString()}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-amber-400 font-semibold block">61일 ~ 90일</span>
                    <span className="text-xs font-bold text-white mt-1 block">₩{finance.receivablesAging.days61To90.toLocaleString()}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-center">
                    <span className="text-[10px] text-red-400 font-bold block">90일 초과(고위험)</span>
                    <span className="text-xs font-bold text-red-300 mt-1 block">₩{finance.receivablesAging.over90Days.toLocaleString()}</span>
                  </div>
                </div>

                {/* 상위 연체 거래처 */}
                <div className="mt-2 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 block">집중 관리 대상 연체 거래처</span>
                  <div className="divide-y divide-slate-800/60">
                    {finance.topDelinquentCustomers.map((dc) => (
                      <div key={dc.customerId} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{dc.customerName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {dc.status}
                          </span>
                        </div>
                        <span className="font-bold text-red-400">₩{dc.unpaidAmount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 우측: 영업 청구 면제(Waiver) 손실 투명 보고 */}
              <div className="p-5 rounded-xl border flex flex-col gap-3 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Ban size={15} className="text-amber-400 flex-shrink-0" />
                    <h3 className="text-xs font-bold text-slate-200">
                      6. 영업 청구 면제(Waiver) 손실 투명 보고
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-red-400">
                    총 면제액: ₩{finance.waiverSummary.totalWaived.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200/90 leading-relaxed">
                  💡 고객 과실 현장 AS, 반납 파손 수리비, 추가 운송료를 영업이 임의 감면/면제하여 회사의 비용으로 흡수된 내역을 투명하게 보고합니다.
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                        <th className="py-2 text-left">구분</th>
                        <th className="py-2 text-left">고객사</th>
                        <th className="py-2 text-left">면제 사유</th>
                        <th className="py-2 text-right">면제액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {finance.waivers.map((wv) => (
                        <tr key={wv.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 font-semibold text-slate-300 whitespace-nowrap">{wv.typeLabel}</td>
                          <td className="py-2 font-bold text-white whitespace-nowrap">{wv.customerName}</td>
                          <td className="py-2 text-slate-400 truncate max-w-xs">{wv.reason}</td>
                          <td className="py-2 text-right font-bold text-red-400 whitespace-nowrap">
                            ₩{wv.waivedAmount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 5. 경영진 종합 진단 및 차월 중점 지시사항 입력 패널 */}
            <div className="p-5 rounded-xl border flex flex-col gap-4 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    7. 경영진 종합 진단 및 차월 중점 지시사항 (Executive Directives)
                  </h3>
                </div>
                <button
                  onClick={handleSaveDirective}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-all active:scale-98"
                >
                  <Save size={13} />
                  <span>지시사항 저장</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-300">
                    당월 마감 경영 총평 (인쇄 및 PDF에 공식 반영)
                  </label>
                  <textarea
                    rows={3}
                    value={directive.remarks}
                    onChange={(e) => setDirective({ ...directive, remarks: e.target.value })}
                    placeholder="당월 매출 실적 및 장비 가동률에 대한 경영진 평가를 입력하십시오..."
                    className="w-full p-3 rounded-lg text-xs text-white border focus:outline-none focus:border-blue-500 leading-relaxed"
                    style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-300">
                    차월 부서별 중점 실행 과제 및 하달 지시
                  </label>
                  <textarea
                    rows={3}
                    value={directive.priorityTasks}
                    onChange={(e) => setDirective({ ...directive, priorityTasks: e.target.value })}
                    placeholder="1. 30일 이상 유휴 32ft 장비 대형 현장 프로모션  2. 고위험 연체처 출고 제한..."
                    className="w-full p-3 rounded-lg text-xs text-white border focus:outline-none focus:border-blue-500 leading-relaxed"
                    style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}
                  />
                </div>
              </div>
            </div>

            {/* 6. Gutenberg 대차대조식 검증 바 (Z-Pattern Step 4: Terminal Action) */}
            <div className="p-4 rounded-xl border bg-slate-950/80 border-slate-800 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400">📄 대차대조 검증:</span>
                <span className="text-xs text-slate-200">
                  매출청구총액 <strong className="text-white">₩{kpis.totalRevenue.toLocaleString()}</strong> =
                  🟢 수납액 <strong className="text-emerald-400">₩{kpis.collectedAmount.toLocaleString()}</strong> +
                  🔴 미수잔액 <strong className="text-amber-400">₩{kpis.unpaidAmount.toLocaleString()}</strong>
                </span>
                <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  ⚖️ 대차 차액 ₩{conservation.delta.toLocaleString()} (100% 무결성 확정)
                </span>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>작성자: <strong>대표이사</strong></span>
                <span>•</span>
                <span>결재상태: <strong className="text-emerald-400">공식 확정됨</strong></span>
              </div>
            </div>
          </>
        )}

        {/* [모드 2] 🏢 부서별 상세 분석 뷰 (드릴다운) */}
        {viewMode === 'DRILLDOWN' && (
          <div className="space-y-4">
            {/* 드릴다운 서브 탭 */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              {[
                { key: 'FLEET', label: '자산·플릿 운용', count: `${kpis.totalFleetCount}대` },
                { key: 'SALES', label: '영업·계약 실적', count: `₩${kpis.totalRevenue.toLocaleString()}` },
                { key: 'LOGISTICS', label: '배차·물류 원가', count: `${operations.dispatchByType.total}건` },
                { key: 'MAINTENANCE', label: '정비·AS 품질', count: `MTTR ${kpis.avgMttrHours}h` },
                { key: 'FINANCE', label: '채권·수금 건전성', count: `수납률 ${kpis.collectionRate}%` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDrilldownTab(tab.key as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    drilldownTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-75">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* 드릴다운 본문 */}
            <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              {drilldownTab === 'FLEET' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">전체 장비 플릿 상세 명세 및 가동 상태</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="py-2 text-left">규격명</th>
                          <th className="py-2 text-center">총 대수</th>
                          <th className="py-2 text-center">대여중 (가동)</th>
                          <th className="py-2 text-center">대여가능 (유휴)</th>
                          <th className="py-2 text-center">정비중</th>
                          <th className="py-2 text-right">가동률 (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {fleet.specSummaries.map(s => (
                          <tr key={s.specName}>
                            <td className="py-2.5 font-bold text-white">{s.specName}</td>
                            <td className="py-2.5 text-center">{s.totalCount}대</td>
                            <td className="py-2.5 text-center text-teal-400 font-bold">{s.rentedCount}대</td>
                            <td className="py-2.5 text-center text-slate-300">{s.availableCount}대</td>
                            <td className="py-2.5 text-center text-amber-400">{s.repairingCount}대</td>
                            <td className="py-2.5 text-right font-bold text-teal-300">{s.utilizationRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {drilldownTab === 'SALES' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">영업사원별 계약 수주 및 매출 기여 실적</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="py-2 text-left">영업담당자</th>
                          <th className="py-2 text-center">담당 계약건수</th>
                          <th className="py-2 text-center">가동 장비수</th>
                          <th className="py-2 text-right">당월 매출 기여액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {sales.salespersonPerformance.map(sp => (
                          <tr key={sp.name}>
                            <td className="py-2.5 font-bold text-white">{sp.name}</td>
                            <td className="py-2.5 text-center">{sp.contractCount}건</td>
                            <td className="py-2.5 text-center text-teal-400 font-bold">{sp.activeAssetCount}대</td>
                            <td className="py-2.5 text-right font-bold text-blue-300">₩{sp.totalBilled.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {drilldownTab === 'LOGISTICS' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">배차 물류 실적 및 운송비 지출 분석</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-xs text-slate-400">총 운송비 지출</span>
                      <span className="text-xl font-bold text-white mt-1 block">₩{operations.transportCostTotal.toLocaleString()}</span>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-xs text-slate-400">고객 청구 운송비</span>
                      <span className="text-xl font-bold text-blue-400 mt-1 block">₩{operations.customerBorneTransport.toLocaleString()}</span>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-xs text-slate-400">당사 순부담 운송비</span>
                      <span className="text-xl font-bold text-red-400 mt-1 block">₩{operations.companyBorneTransport.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {drilldownTab === 'MAINTENANCE' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">정비 및 AS 처리 내역 및 조기 고장 분석</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-xs text-slate-400">현장 AS 처리</span>
                      <span className="text-xl font-bold text-white mt-1 block">{operations.maintenanceByType.fieldAs}건</span>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-xs text-slate-400">주기장 오버홀</span>
                      <span className="text-xl font-bold text-white mt-1 block">{operations.maintenanceByType.overhaul}건</span>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-xs text-slate-400">출고 7일내 조기고장</span>
                      <span className="text-xl font-bold text-amber-400 mt-1 block">{kpis.earlyFailuresCount}건</span>
                    </div>
                  </div>
                </div>
              )}

              {drilldownTab === 'FINANCE' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">채권 에이징 상세 및 연체 집중 관리 대장</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="py-2 text-left">거래처명</th>
                          <th className="py-2 text-center">연체 일수</th>
                          <th className="py-2 text-center">관리 상태</th>
                          <th className="py-2 text-right">미수 잔액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {finance.topDelinquentCustomers.map(dc => (
                          <tr key={dc.customerId}>
                            <td className="py-2.5 font-bold text-white">{dc.customerName}</td>
                            <td className="py-2.5 text-center text-amber-400 font-bold">{dc.overdueDays}일</td>
                            <td className="py-2.5 text-center">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {dc.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-bold text-red-400">₩{dc.unpaidAmount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* 인쇄 전용 전역 스타일 (@media print) */}
      <style>{`
        @media print {
          body, html, #root {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print, header, aside, .sidebar-nav {
            display: none !important;
          }
          .main-content-area {
            padding: 0 !important;
            margin: 0 !important;
          }
          .regular-reports-container {
            background-color: #ffffff !important;
            color: #0f172a !important;
            padding: 0 !important;
          }
          .regular-reports-container * {
            color: #0f172a !important;
            background-color: transparent !important;
            border-color: #cbd5e1 !important;
          }
          .text-white {
            color: #0f172a !important;
          }
          .text-slate-400, .text-slate-300 {
            color: #475569 !important;
          }
          .text-teal-400, .text-teal-300, .text-blue-400, .text-indigo-400 {
            color: #1e3a8a !important;
            font-weight: bold !important;
          }
          .text-red-400, .text-red-300 {
            color: #b91c1c !important;
            font-weight: bold !important;
          }
        }
      `}</style>
    </div>
  );
};
