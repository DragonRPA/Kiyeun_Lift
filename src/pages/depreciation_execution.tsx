// src/pages/depreciation_execution.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, Calculator, Calendar, CheckCircle2, History, AlertCircle, ShieldAlert } from 'lucide-react';
import { calculateAssetDepreciation } from '../services/db';

export const DepreciationExecution: React.FC = () => {
  const { assets, depreciationLogs, executeMonthlyDepreciation, cancelMonthlyDepreciation, currentUser, hasPermission, showErrorModal } = useApp();
  const canExecute = hasPermission('depreciation_execution', 'save') || hasPermission('billing', 'save') || currentUser?.role === 'ADMIN';

  const todayYm = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
  const [selectedYm, setSelectedYm] = useState<string>(todayYm);
  const [note, setNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 대상 연월 마감 완료 여부
  const isAlreadyExecuted = depreciationLogs.some(l => l.depreciationYm === selectedYm);
  const executedLog = depreciationLogs.find(l => l.depreciationYm === selectedYm);

  // 사전 시뮬레이션: 당사자산 중 당월 상각 대상 자산 수 및 예상 총상각액
  const ownedAssets = assets.filter(a => a.ownerType === 'OWNED');
  let estimatedCount = 0;
  let estimatedTotalDepn = 0;

  // 마감 연월의 말일 시점 Date 생성
  const [ymYear, ymMonth] = selectedYm.split('-').map(Number);
  const closingDate = new Date(ymYear, ymMonth, 0, 23, 59, 59, 999);

  ownedAssets.forEach(asset => {
    const cost = asset.acquisitionPrice || 0;
    if (cost <= 0 || !asset.acquisitionDate || !asset.depreciationMonths || asset.depreciationMonths <= 0) return;

    // 1. 취득일자 검증: 마감 연월 말일보다 미래 취득 자산 제외
    const acqDate = new Date(asset.acquisitionDate);
    if (isNaN(acqDate.getTime()) || acqDate > closingDate) return;

    // 2. 매각 여부 및 매각일자 검증: 매각 상태이거나 매각일이 마감 연월 이전인 경우 상각 중단
    if (asset.status === 'SOLD' || asset.disposalDate) {
      const dispDateStr = asset.disposalDate ? asset.disposalDate.substring(0, 7) : '';
      if (dispDateStr && dispDateStr < selectedYm) return;
    }

    const residualRate = asset.residualValueRate ?? 0;
    const residualValue = Math.round(cost * (residualRate / 100));
    const depreciableAmount = cost - residualValue;
    if (depreciableAmount <= 0) return;

    const monthlyDepn = depreciableAmount / asset.depreciationMonths;
    if (monthlyDepn <= 0) return;

    // 3. 취득일부터 마감연월까지의 전체 경과월수 정밀 계산
    let yearsDiff = closingDate.getFullYear() - acqDate.getFullYear();
    let monthsDiff = closingDate.getMonth() - acqDate.getMonth();
    let totalElapsedMonths = yearsDiff * 12 + monthsDiff + 1; // 취득당월 포함

    if (totalElapsedMonths < 1) totalElapsedMonths = 1;

    if ((asset.status === 'SOLD' || asset.disposalDate) && asset.disposalDate) {
      const dispDate = new Date(asset.disposalDate);
      if (!isNaN(dispDate.getTime()) && dispDate <= closingDate) {
        let dispYears = dispDate.getFullYear() - acqDate.getFullYear();
        let dispMonths = dispDate.getMonth() - acqDate.getMonth();
        totalElapsedMonths = Math.max(1, dispYears * 12 + dispMonths + 1);
      }
    }

    const effectiveElapsed = Math.min(totalElapsedMonths, asset.depreciationMonths);
    const targetAccum = Math.min(depreciableAmount, Math.round(monthlyDepn * effectiveElapsed));
    const currentAccum = asset.accumDepreciation || 0;

    const actualDepn = Math.max(0, targetAccum - currentAccum);
    if (actualDepn <= 0) return;

    estimatedTotalDepn += actualDepn;
    estimatedCount++;
  });

  const handleExecute = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (isProcessing) return;

    if (isAlreadyExecuted) {
      alert(`선택하신 [${selectedYm}] 연월은 이미 감가상각 결산 마감이 완료되었습니다.`);
      return;
    }

    if (!confirm(`[${selectedYm}] 연월의 당사자산 감가상각 결산 마감을 실행하시겠습니까?\n\n- 대상 자산: ${estimatedCount}대\n- 당월 감가상각 총액: ₩${estimatedTotalDepn.toLocaleString()}\n\n(※ 각 자산의 누적상각액 및 장부가치가 실제 데이터로 업데이트됩니다.)`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await executeMonthlyDepreciation(selectedYm, note);
      alert(`✅ [${selectedYm}] 당월 감가상각 결산 마감이 완결되었습니다!\n\n• 반영 자산: ${res.count}대\n• 당월 상각 총액: ₩${res.totalAmount.toLocaleString()}`);
      setNote('');
    } catch (err: any) {
      showErrorModal(`⚠️ 감가상각 마감 실패:\n${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelExecution = async () => {
    if (!isAlreadyExecuted) return;
    if (!confirm(`⚠️ [${selectedYm}] 연월의 감가상각 결산 마감을 취소(롤백)하시겠습니까?\n\n- 취소 시 해당 월의 DepreciationLog가 삭제되고,\n- 모든 당사자산의 장부가치 및 누적상각액이 이전 월말 상태로 복원됩니다.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await cancelMonthlyDepreciation(selectedYm);
      alert(`✅ [${selectedYm}] 감가상각 결산 마감이 성공적으로 취소되고 자산 장부가치가 복원되었습니다.`);
    } catch (err: any) {
      // showErrorModal handled in context
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '13px' }}>
      
      {/* 타이틀 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px' }}>
            <TrendingUp size={22} color="var(--primary)" /> 월말 자산 감가상각 결산 마감 관리
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            매월 말일 의도적으로 당월 감가상각을 일괄 계산하여 <strong>각 자산의 누적상각액 및 장부가치를 실제 데이터로 확정</strong>합니다.
          </p>
        </div>
      </div>

      {/* 2열 레이아웃 (상단 결산 실행 카드 + 하단 결산 이력 리스트) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        
        {/* [왼쪽] 당월 감가상각 마감 실행 대시보드 */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-card)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calculator size={17} /> 당월 감가상각 결산 실행
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}>📌 결산 마감 연월:</label>
              <input
                type="month"
                value={selectedYm}
                onChange={e => setSelectedYm(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 'bold' }}
              />
            </div>

            {isAlreadyExecuted ? (
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> [해당 연월 마감 완료] {executedLog?.executedAt.substring(0, 10)} 마감됨 (상각액: ₩{executedLog?.totalDepreciationAmount.toLocaleString()})
                </div>
                {canExecute && (
                  <button
                    type="button"
                    onClick={handleCancelExecution}
                    disabled={isProcessing}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    결산 마감 취소 (롤백)
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#2563eb', fontSize: '12px' }}>
                ℹ️ 미마감 상태입니다. 마감 실행 시 대상 당사자산의 장부가치가 당월분만큼 차감됩니다.
              </div>
            )}
          </div>

          {/* 예상 결산 시뮬레이션 지표 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>상각 대상 당사자산</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>{estimatedCount} 대</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>예상 당월 감가상각 총액</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>₩ {estimatedTotalDepn.toLocaleString()}</div>
            </div>
          </div>

          {/* 비고 메모 */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>📝 결산 비고 메모</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="예: 2026년 7월 정기 월말 감가상각 마감"
              disabled={isAlreadyExecuted}
              style={{ width: '100%', fontSize: '12px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
            />
          </div>

          {/* 마감 실행 버튼 */}
          <button
            className="btn-primary"
            onClick={handleExecute}
            disabled={!canExecute || isAlreadyExecuted || isProcessing}
            style={{
              padding: '12px', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              backgroundColor: isAlreadyExecuted ? 'var(--text-muted)' : 'var(--primary)'
            }}
          >
            <TrendingUp size={16} /> {isProcessing ? '상각 마감 처리 중...' : isAlreadyExecuted ? '해당 연월 결산 마감 완료됨' : '🚀 당월 감가상각 결산 마감 실행'}
          </button>
        </div>

        {/* [오른쪽] 안내 및 마감 원칙 규정 카드 */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-card)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
            <ShieldAlert size={16} color="var(--warning)" /> 회계 ERP 감가상각 결산 원칙
          </h3>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.65', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <strong>1. 수시 연산 배제 및 고정 데이터 보존</strong><br />
              자산 관리 대장의 조회 성능을 극대화하기 위해 기존의 매 렌더링 수시 계산 방식을 전면 배제하고, 실제 DB에 저장된 <code>accumDepreciation</code> 및 <code>bookValue</code> 스냅샷 값을 사용합니다.
            </div>

            <div>
              <strong>2. 월 1회 월말 수동 마감 실행</strong><br />
              경영관리 담당자가 매월 말일 당월 감가상각 마감을 실행하면, 당사 소유 자산(`OWNED`)에 한해 정액법 기준으로 당월 감가상각액이 자동 산출되어 자산 레코드가 업데이트됩니다.
            </div>

            <div>
              <strong>3. 상각 잔존가액 한도 준수</strong><br />
              취득가액과 잔존가치율에 기반한 상각 한도(잔존가액)에 도달한 자산은 더 이상 감가상각이 발생하지 않으며 장부가치가 잔존가액으로 고정됩니다.
            </div>
          </div>
        </div>

      </div>

      {/* 하단: 감가상각 결산 이력 대장 테이블 */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <History size={16} /> 월별 감가상각 결산 마감 이력 ({depreciationLogs.length}건)
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '8px', textAlign: 'center' }}>이력 ID</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>마감 연월</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>마감 실행일시</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>실행자</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>대상 자산수</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>당월 상각 총액</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>비고 메모</th>
              </tr>
            </thead>
            <tbody>
              {depreciationLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    아직 실행된 감가상각 결산 마감 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                depreciationLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>{log.id}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}>{log.depreciationYm}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{log.executedAt.substring(0, 19).replace('T', ' ')}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{log.executedBy || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{log.targetAssetCount} 대</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                      ₩ {log.totalDepreciationAmount.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{log.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
