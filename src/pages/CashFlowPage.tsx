import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, ArrowDownRight, ArrowUpRight, AlertTriangle, 
  Layers, CheckCircle, RefreshCw, Landmark, HelpCircle,
  Camera, Trash2, Calendar, FileText, PlusCircle, Clock,
  ChevronLeft, ChevronRight, BarChart2
} from 'lucide-react';

interface DailyForecast {
  date: string;
  inflow: number;
  inflowDetail: string;
  opex: number;
  opexDetail: string;
  capex: number;
  capexDetail: string;
  net: number;
  cumulative: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export const CashFlowPage: React.FC = () => {
  const { hasPermission, cashFlowSnapshots, saveCashFlowSnapshot, deleteCashFlowSnapshot, bankTransactions } = useApp();
  const canSave = hasPermission('billing', 'save');

  // 화면 탭 관리
  const [activeSubTab, setActiveSubTab] = useState<'FORECAST' | 'HISTORY'>('FORECAST');

  // 기초 주거래 통장 정보 (오늘 기준)
  const [kookminBalance, setKookminBalance] = useState(12850000);
  const [shinhanBalance, setShinhanBalance] = useState(4500000);
  const [safetyThreshold, setSafetyThreshold] = useState(10000000); // 안전자금 임계치: 1,000만 원

  const totalTodayBalance = kookminBalance + shinhanBalance;

  // 타임라인 기준 오프셋 (단위: 일)
  // 0: 오늘, -180: 6개월 전, 180: 6개월 후
  const [startOffsetDays, setStartOffsetDays] = useState<number>(0);

  // 30일 일별 현금흐름 데이터 시뮬레이션
  const [forecastList, setForecastList] = useState<DailyForecast[]>([]);

  // 스냅샷 비고 입력 모달
  const [showSnapModal, setShowSnapModal] = useState(false);
  const [snapNotes, setSnapNotes] = useState('');

  // 차트 툴팁 제어 상태
  const [hoveredPoint, setHoveredPoint] = useState<{ item: DailyForecast; x: number; y: number } | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  // 현재 슬라이더가 지정하는 시점의 기준일 계산
  const getFocusDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + startOffsetDays);
    return d;
  };

  const focusDate = getFocusDate();
  const focusDateString = focusDate.toISOString().split('T')[0];

  useEffect(() => {
    // 1. 기준일 시점의 시작 잔액 계산 (역산 로직 포함)
    let startingBalance = totalTodayBalance;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (startOffsetDays > 0) {
      // 미래 시점의 시작 잔액: 오늘부터 기준일까지의 예정된 수지 타산을 누적 가산하여 구함
      for (let offset = 0; offset < startOffsetDays; offset++) {
        const tempDate = new Date(today);
        tempDate.setDate(today.getDate() + offset);
        const tempDateStr = tempDate.toISOString().split('T')[0];

        // 미래의 예정 거래내역 계산
        const { inflow, opex, capex } = queryForecastData(offset, tempDateStr);
        startingBalance += (inflow - opex - capex);
      }
    } else if (startOffsetDays < 0) {
      // 과거 시점의 시작 잔액: 오늘 잔액에서 기준일과 오늘 사이의 실제 일어난 입출금을 역산
      // 기준일 이후 실제 발생한 입금은 차감하고, 출금은 더함
      const targetOffset = Math.abs(startOffsetDays);
      for (let offset = 1; offset <= targetOffset; offset++) {
        const tempDate = new Date(today);
        tempDate.setDate(today.getDate() - offset);
        const tempDateStr = tempDate.toISOString().split('T')[0];

        // 해당 과거 날짜의 실제 발생 거래 내역 조회 (bankTransactions 활용)
        const histTx = bankTransactions.filter(tx => tx.transactionDate.startsWith(tempDateStr));
        const totalDeposits = histTx.reduce((sum, tx) => sum + tx.depositAmount, 0);
        const totalWithdrawals = histTx.reduce((sum, tx) => sum + tx.withdrawAmount, 0);

        startingBalance = startingBalance - totalDeposits + totalWithdrawals;
      }
    }

    // 2. 기준일로부터 30일간의 전망 타임라인 시뮬레이션
    const list: DailyForecast[] = [];
    let currentBalance = startingBalance;

    for (let i = 1; i <= 30; i++) {
      const targetDate = new Date(focusDate);
      targetDate.setDate(focusDate.getDate() + i);
      const dateString = targetDate.toISOString().split('T')[0];

      let inflow = 0;
      let inflowDetail = '';
      let opex = 0;
      let opexDetail = '';
      let capex = 0;
      let capexDetail = '';

      // 기준일 대비 해당 날짜가 오늘보다 과거인지 미래인지에 따라 집계 출처 분기
      const isPastDate = new Date(dateString) <= today;

      if (isPastDate) {
        // 실제 통장 이력 집계
        const histTx = bankTransactions.filter(tx => tx.transactionDate.startsWith(dateString));
        if (histTx.length > 0) {
          const deposit = histTx.reduce((sum, tx) => sum + tx.depositAmount, 0);
          const withdraw = histTx.reduce((sum, tx) => sum + tx.withdrawAmount, 0);

          if (deposit > 0) {
            inflow = deposit;
            inflowDetail = histTx.filter(t => t.depositAmount > 0).map(t => `${t.senderName} 입금`).join(', ');
          }
          if (withdraw > 0) {
            opex = withdraw;
            opexDetail = histTx.filter(t => t.withdrawAmount > 0).map(t => `${t.senderName} 지출`).join(', ');
          }
        }
      } else {
        // 미래 전망 시뮬레이션 (기준일과 오늘의 차이를 감안한 미래 날짜 매핑 계산)
        const dayDifferenceFromToday = Math.round((new Date(dateString).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const projected = queryForecastData(dayDifferenceFromToday, dateString);
        inflow = projected.inflow;
        inflowDetail = projected.inflowDetail;
        opex = projected.opex;
        opexDetail = projected.opexDetail;
        capex = projected.capex;
        capexDetail = projected.capexDetail;
      }

      const net = inflow - opex - capex;
      currentBalance += net;

      // 안전/주의/경보 상태 판단
      let status: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
      if (currentBalance < 0) {
        status = 'CRITICAL';
      } else if (currentBalance < safetyThreshold) {
        status = 'WARNING';
      }

      list.push({
        date: dateString,
        inflow,
        inflowDetail,
        opex,
        opexDetail,
        capex,
        capexDetail,
        net,
        cumulative: currentBalance,
        status
      });
    }

    setForecastList(list);
  }, [totalTodayBalance, safetyThreshold, startOffsetDays, bankTransactions]);

  // 미래 일자별 모의 시뮬레이션 지표 제공용 헬퍼 함수
  const queryForecastData = (daysFromToday: number, dateString: string) => {
    let inflow = 0;
    let inflowDetail = '';
    let opex = 0;
    let opexDetail = '';
    let capex = 0;
    let capexDetail = '';

    // 특정 주기 반복성 데이터 및 수납일 매핑
    const dayOfMonth = parseInt(dateString.split('-')[2]);

    if (dayOfMonth === 5) {
      inflow = 8500000;
      inflowDetail = '현대건설(주) 기성금 수납예정';
    } else if (dayOfMonth === 10) {
      inflow = 14500000;
      inflowDetail = '대우건설(주) 렌탈 청구수납예정';
    } else if (dayOfMonth === 15) {
      opex = 18500000;
      opexDetail = '임직원 월 정기급여 정산일';
    } else if (dayOfMonth === 20) {
      opex = 8450000;
      opexDetail = '임차 고소장비 대금 정산';
    } else if (dayOfMonth === 25) {
      inflow = 15200000;
      inflowDetail = '포스코이앤씨(주) 미수금 회수예정';
    } else if (dayOfMonth === 30) {
      opex = 1500000;
      opexDetail = '사무실 임차료(원세) 자동이체';
    }

    // 1회성 대형 CAPEX 모의 지출 스케줄링 (8월 초 등)
    if (dateString.endsWith('08-05')) {
      capex = 45000000;
      capexDetail = '고소작업대 2대 추가 도입 (설비투자)';
    }

    return { inflow, inflowDetail, opex, opexDetail, capex, capexDetail };
  };

  // 합산 연산 (현재 전망 구간)
  const totalInflow = forecastList.reduce((sum, item) => sum + item.inflow, 0);
  const totalOpex = forecastList.reduce((sum, item) => sum + item.opex, 0);
  const totalCapex = forecastList.reduce((sum, item) => sum + item.capex, 0);
  const startingBalanceAtFocus = forecastList.length > 0 ? (forecastList[0].cumulative - forecastList[0].net) : totalTodayBalance;
  const finalBalance = startingBalanceAtFocus + totalInflow - totalOpex - totalCapex;

  const criticalItem = forecastList.find(item => item.cumulative < 0);

  // 스냅샷 저장
  const handleSaveSnapshotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCashFlowSnapshot({
      snapshotDate: focusDateString,
      startingBalance: startingBalanceAtFocus,
      projectedInflow: totalInflow,
      projectedOpex: totalOpex,
      projectedCapex: totalCapex,
      projectedFinalBalance: finalBalance,
      notes: snapNotes
    });

    alert(`기준일(${focusDateString})자 현금흐름 예측 스냅샷이 성공적으로 저장되었습니다.`);
    setShowSnapModal(false);
    setSnapNotes('');
  };

  // 차트 마우스 마우스 오버 포인트 계산 (SVG 상대 좌표 좌표)
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartRef.current || forecastList.length === 0) return;
    const svg = chartRef.current;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    
    // 차트 여백 정의 (가로: 좌 50px, 우 20px)
    const paddingLeft = 60;
    const paddingRight = 20;
    const chartWidth = rect.width - paddingLeft - paddingRight;

    // 마우스가 실제 차트 영역 내에 있는가?
    if (clientX < paddingLeft || clientX > rect.width - paddingRight) {
      setHoveredPoint(null);
      return;
    }

    // 마우스 위치에 가장 가까운 인덱스 계산
    const pct = (clientX - paddingLeft) / chartWidth;
    const rawIndex = pct * (forecastList.length - 1);
    const index = Math.min(Math.max(Math.round(rawIndex), 0), forecastList.length - 1);
    
    const item = forecastList[index];

    // 해당 항목의 Y 좌표 역산
    const minBal = Math.min(0, ...forecastList.map(p => p.cumulative)) * 1.1;
    const maxBal = Math.max(safetyThreshold * 2, ...forecastList.map(p => p.cumulative)) * 1.1;
    const balRange = maxBal - minBal || 1;
    const chartHeight = 180; // 실제 데이터 렌더링 세로폭
    const paddingTop = 20;

    const y = paddingTop + chartHeight - ((item.cumulative - minBal) / balRange) * chartHeight;
    const x = paddingLeft + (index / (forecastList.length - 1)) * chartWidth;

    setHoveredPoint({ item, x, y });
  };

  // SVG 차트 패스 생성용 데이터 사전 연산
  const generateSvgPaths = () => {
    if (forecastList.length === 0) return { linePath: '', areaPath: '', zeroY: 0, safetyY: 0, points: [], maxBal: 0, minBal: 0 };

    const paddingLeft = 60;
    const paddingRight = 20;
    const chartWidth = 550; // 고정된 뷰박스 기준 너비
    const chartHeight = 180;
    const paddingTop = 20;

    const minBal = Math.min(0, ...forecastList.map(p => p.cumulative)) * 1.1;
    const maxBal = Math.max(safetyThreshold * 2, ...forecastList.map(p => p.cumulative)) * 1.1;
    const balRange = maxBal - minBal || 1;

    // 일치 좌표 수집
    const points = forecastList.map((item, idx) => {
      const x = paddingLeft + (idx / (forecastList.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - ((item.cumulative - minBal) / balRange) * chartHeight;
      return { x, y };
    });

    // 라인 패스 패스 연결
    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // 면적 영역 패스 연결 (바닥 라인으로 돌아와서 닫기)
    const baselineY = paddingTop + chartHeight - ((0 - minBal) / balRange) * chartHeight;
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

    // 0선 및 안전 임계선 Y 좌표 좌표
    const zeroY = paddingTop + chartHeight - ((0 - minBal) / balRange) * chartHeight;
    const safetyY = paddingTop + chartHeight - ((safetyThreshold - minBal) / balRange) * chartHeight;

    return { linePath, areaPath, zeroY, safetyY, points, maxBal, minBal };
  };

  const { linePath, areaPath, zeroY, safetyY, points, maxBal, minBal } = generateSvgPaths();

  return (
    <div>
      {/* 상단 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '22px', fontWeight: '800' }}>데일리 CashFlow 분석 및 30일 시뮬레이션</h2>
        </div>
      </div>

      {/* 탭 구조 분할 */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', paddingBottom: '8px' }}>
        <button 
          className={activeSubTab === 'FORECAST' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveSubTab('FORECAST')}
          style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <BarChart2 size={15} /> 30일 현금흐름 예측 시뮬레이션 & 차트
        </button>
        <button 
          className={activeSubTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveSubTab('HISTORY')}
          style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Clock size={15} /> 과거 예측 스냅샷 회고 분석 대장
        </button>
      </div>

      {activeSubTab === 'FORECAST' && (
        <>
          {/* 과거 6개월 ~ 미래 6개월 타임라인 슬라이더 조절바 (1인칭 고급 컨트롤) */}
          <div className="card" style={{ margin: '0 0 20px 0', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="var(--primary)" />
                <strong style={{ fontSize: '14px' }}>유동성 분석 타임라인 범위 조절 (과거 6개월 ~ 미래 6개월)</strong>
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--primary)', fontWeight: 'bold' }}>
                {startOffsetDays === 0 ? (
                  <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                    📅 오늘 시점 기준 (Today)
                  </span>
                ) : startOffsetDays < 0 ? (
                  <span style={{ color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                    ⏪ 과거 실적 조회 중 ({Math.abs(startOffsetDays)}일 전인 {focusDateString})
                  </span>
                ) : (
                  <span style={{ color: 'var(--success)', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                    ⏩ 미래 자금 예측 중 ({startOffsetDays}일 후인 {focusDateString})
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setStartOffsetDays(prev => Math.max(prev - 30, -180))}
                style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={14} /> 1개월 과거로
              </button>

              <input 
                type="range" 
                min="-180" 
                max="180" 
                value={startOffsetDays} 
                onChange={e => setStartOffsetDays(parseInt(e.target.value))}
                style={{ flex: 1, height: '6px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}
              />

              <button 
                className="btn-secondary" 
                onClick={() => setStartOffsetDays(prev => Math.min(prev + 30, 180))}
                style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                1개월 미래로 <ChevronRight size={14} />
              </button>

              <button 
                className="btn-secondary" 
                onClick={() => setStartOffsetDays(0)}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)', borderColor: 'var(--primary)' }}
              >
                오늘로 회귀
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'start', marginBottom: '20px' }}>
            
            {/* 좌측: 순수 SVG 기반 프리미엄 자금 그래프 */}
            <div className="card" style={{ margin: 0, height: '272px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="card-title" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  📈 자금 유동성 추이 시각화 (30일 스냅)
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>시작: {focusDateString}</span>
              </div>

              <div style={{ position: 'relative' }}>
                <svg 
                  ref={chartRef}
                  viewBox="0 0 630 220" 
                  width="100%" 
                  height="210"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ overflow: 'visible', cursor: 'crosshair' }}
                >
                  <defs>
                    {/* 상단 안전영역 그라데이션 */}
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* 가로 그리드선 */}
                  <line x1="60" y1="20" x2="610" y2="20" stroke="var(--border-color)" strokeDasharray="3" />
                  <line x1="60" y1="65" x2="610" y2="65" stroke="var(--border-color)" strokeDasharray="3" />
                  <line x1="60" y1="110" x2="610" y2="110" stroke="var(--border-color)" strokeDasharray="3" />
                  <line x1="60" y1="155" x2="610" y2="155" stroke="var(--border-color)" strokeDasharray="3" />
                  <line x1="60" y1="200" x2="610" y2="200" stroke="var(--border-color)" strokeDasharray="3" />

                  {/* Y축 축 라벨 */}
                  <text x="50" y="24" fontSize="9" textAnchor="end" fill="var(--text-muted)">{Math.round(maxBal/1000000)}M</text>
                  <text x="50" y="114" fontSize="9" textAnchor="end" fill="var(--text-muted)">{Math.round((maxBal + minBal)/2/1000000)}M</text>
                  <text x="50" y="204" fontSize="9" textAnchor="end" fill="var(--text-muted)">{Math.round(minBal/1000000)}M</text>

                  {/* 안전자금 마진 임계선 (안전 임계치선) */}
                  {safetyY >= 20 && safetyY <= 200 && (
                    <>
                      <line x1="60" y1={safetyY} x2="610" y2={safetyY} stroke="var(--warning)" strokeWidth="1" strokeDasharray="4 4" />
                      <text x="62" y={safetyY - 4} fontSize="8.5" fill="var(--warning)" fontWeight="600">안전마진선</text>
                    </>
                  )}

                  {/* 부도위험선 (Zero-line) */}
                  {zeroY >= 20 && zeroY <= 200 && (
                    <>
                      <line x1="60" y1={zeroY} x2="610" y2={zeroY} stroke="var(--danger)" strokeWidth="1.5" />
                      <text x="575" y={zeroY - 4} fontSize="8.5" fill="var(--danger)" fontWeight="800">부도위험선</text>
                    </>
                  )}

                  {/* 채워진 면적 패스 */}
                  <path d={areaPath} fill="url(#areaGrad)" />

                  {/* 30일 잔고 곡선 곡선 */}
                  <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" />

                  {/* 데이터 포인트 점 */}
                  {points.map((p, idx) => (
                    <circle 
                      key={idx} 
                      cx={p.x} 
                      cy={p.y} 
                      r="2.5" 
                      fill="var(--bg-card)" 
                      stroke="var(--primary)" 
                      strokeWidth="1.5" 
                    />
                  ))}

                  {/* 인터랙티브 마우스 호버 가이드라인 및 서클 */}
                  {hoveredPoint && (
                    <>
                      <line 
                        x1={hoveredPoint.x} 
                        y1="20" 
                        x2={hoveredPoint.x} 
                        y2="200" 
                        stroke="var(--primary)" 
                        strokeWidth="1" 
                        strokeDasharray="2 2"
                      />
                      <circle 
                        cx={hoveredPoint.x} 
                        cy={hoveredPoint.y} 
                        r="5.5" 
                        fill="var(--primary)" 
                      />
                    </>
                  )}
                </svg>

                {/* 실시간 SVG 차트 툴팁 레이어 팝업 */}
                {hoveredPoint && (
                  <div style={{
                    position: 'absolute',
                    top: `${hoveredPoint.y - 65}px`,
                    left: `${hoveredPoint.x - 30}px`,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    pointerEvents: 'none',
                    lineHeight: '1.4',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <strong style={{ color: 'var(--primary-light)' }}>{hoveredPoint.item.date}</strong><br/>
                    • 누적고: <strong>{hoveredPoint.item.cumulative.toLocaleString()}원</strong><br/>
                    • 수지차: <span style={{ color: hoveredPoint.item.net >= 0 ? '#4ade80' : '#f87171' }}>
                      {hoveredPoint.item.net >= 0 ? `+${hoveredPoint.item.net.toLocaleString()}` : hoveredPoint.item.net.toLocaleString()}원
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 핵심 마진 조율 패널 및 스냅샷 저장 기능 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ margin: 0, padding: '16px' }}>
                <h3 className="card-title" style={{ fontSize: '13px', marginBottom: '12px' }}>📊 시뮬레이션 잔고 제어 옵션</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>안전자금 마진 설정:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input 
                        type="number" 
                        value={safetyThreshold} 
                        onChange={e => setSafetyThreshold(parseInt(e.target.value) || 0)}
                        style={{ width: '100px', padding: '4px', fontSize: '12px', textAlign: 'right' }}
                      />
                      <span style={{ fontSize: '12px' }}>원</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>국민은행 기초잔고:</span>
                    <input 
                      type="number" 
                      value={kookminBalance} 
                      onChange={e => setKookminBalance(parseInt(e.target.value) || 0)}
                      style={{ width: '120px', padding: '4px', fontSize: '12px', textAlign: 'right' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>신한은행 기초잔고:</span>
                    <input 
                      type="number" 
                      value={shinhanBalance} 
                      onChange={e => setShinhanBalance(parseInt(e.target.value) || 0)}
                      style={{ width: '120px', padding: '4px', fontSize: '12px', textAlign: 'right' }}
                    />
                  </div>

                  {canSave && (
                    <button 
                      className="btn-primary" 
                      onClick={() => setShowSnapModal(true)}
                      style={{ width: '100%', fontSize: '12.5px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Camera size={14} /> 현 시점({focusDateString}) 스냅샷 저장
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* 부도/자금 부족 크리티컬 경보 알림창 */}
          {criticalItem && (
            <div 
              className="card" 
              style={{ 
                margin: '0 0 24px 0', 
                backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                border: '2px solid var(--danger)',
                padding: '20px',
                borderRadius: '10px'
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <AlertTriangle size={28} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ color: 'var(--danger)', fontSize: '16px', fontWeight: '800', margin: 0 }}>
                    🚨 자금 고갈(부도 위험) 경보 발생
                  </h4>
                  <p style={{ fontSize: '13.5px', marginTop: '6px', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    향후 30일 시뮬레이션 결과, <strong>{criticalItem.date}</strong> 전후로 누적 잔고가 마이너스로 전환되어 
                    자금 유동성이 일시 고갈되는 시나리오가 감지되었습니다.<br/>
                    예상 부족 자금 규모는 최고 약 <strong style={{ color: 'var(--danger)' }}>{Math.abs(criticalItem.cumulative).toLocaleString()}원</strong>에 달합니다. 
                    설비 자산 투자(CAPEX) 일정 보류 또는 미수금 조기 수납을 권장합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 주거래 통장 잔액 및 종합 요약 카드 피드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {/* 주거래 잔액 */}
            <div className="card" style={{ margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>기준일 시점 시작고</span>
                <Landmark size={18} color="var(--primary)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0' }}>
                {startingBalanceAtFocus.toLocaleString()}원
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>통장 잔액 기반 오프셋 누적고</span>
            </div>

            {/* 30일 내 수납 예정 */}
            <div className="card" style={{ margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>30일 내 수납 예정 (Inflow)</span>
                <ArrowUpRight size={18} color="var(--success)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--success)' }}>
                +{totalInflow.toLocaleString()}원
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>납기 기한 미수금 건 연동</span>
            </div>

            {/* 30일 내 지출 예정 */}
            <div className="card" style={{ margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>30일 내 일반 지출 (OPEX)</span>
                <ArrowDownRight size={18} color="var(--warning)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--warning)' }}>
                -{totalOpex.toLocaleString()}원
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>월 고정/변동 비용 정산분</span>
            </div>

            {/* 30일 내 CAPEX */}
            <div className="card" style={{ margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>설비자산 투자예정 (CAPEX)</span>
                <Layers size={18} color="var(--danger)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--danger)' }}>
                -{totalCapex.toLocaleString()}원
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>장비 신규 취득 투자 규모</span>
            </div>

            {/* 최종 30일 후 예상 잔액 */}
            <div className="card" style={{ margin: 0, padding: '16px', backgroundColor: finalBalance < 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>30일 후 예상 잔액</span>
                {finalBalance < 0 ? <AlertTriangle size={18} color="var(--danger)" /> : <CheckCircle size={18} color="var(--success)" />}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: finalBalance < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {finalBalance.toLocaleString()}원
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>시뮬레이션 누적 최종고</span>
            </div>
          </div>

          {/* 일자별 예측 시뮬레이션 테이블 목록 */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">30일 캘린더 기준 예측 타임라인</h3>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>매일 오전 1회 자동 파싱 및 예측 시뮬레이터 구동 결과</span>
            </div>

            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-app)', zIndex: 10 }}>
                    <th>날짜</th>
                    <th>수납정산(입금)</th>
                    <th>일반매입(출금 - OPEX)</th>
                    <th>자산설비투자 (CAPEX)</th>
                    <th>일일 수지차</th>
                    <th style={{ textAlign: 'right' }}>예상 누적 잔고</th>
                    <th style={{ textAlign: 'center' }}>안전 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastList.map(item => (
                    <tr 
                      key={item.date} 
                      style={{ 
                        backgroundColor: item.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.02)' : item.status === 'WARNING' ? 'rgba(245, 158, 11, 0.01)' : 'transparent' 
                      }}
                    >
                      <td><strong>{item.date}</strong></td>
                      <td>
                        {item.inflow > 0 ? (
                          <div>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>+{item.inflow.toLocaleString()}원</span><br/>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>({item.inflowDetail})</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>
                        {item.opex > 0 ? (
                          <div>
                            <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>-{item.opex.toLocaleString()}원</span><br/>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>({item.opexDetail})</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>
                        {item.capex > 0 ? (
                          <div>
                            <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>-{item.capex.toLocaleString()}원</span><br/>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>({item.capexDetail})</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 'bold', color: item.net > 0 ? 'var(--success)' : item.net < 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                        {item.net > 0 ? `+${item.net.toLocaleString()}` : item.net < 0 ? item.net.toLocaleString() : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: item.status === 'CRITICAL' ? 'var(--danger)' : item.status === 'WARNING' ? 'var(--warning)' : 'var(--text-main)' }}>
                        {item.cumulative.toLocaleString()}원
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                          backgroundColor: item.status === 'SAFE' ? 'rgba(34, 197, 94, 0.1)' : item.status === 'WARNING' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: item.status === 'SAFE' ? 'var(--success)' : item.status === 'WARNING' ? 'var(--warning)' : 'var(--danger)'
                        }}>
                          {item.status === 'SAFE' ? '안전' : item.status === 'WARNING' ? '자금주의' : '부도위험'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 과거 예측 이력 회고 탭 */}
      {activeSubTab === 'HISTORY' && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">현금흐름 모의예측 동결 이력 (Snapshots)</h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>과거 시점의 유동성 분석 및 경영지령 메모 추적 대장</span>
          </div>

          <table style={{ width: '100%', fontSize: '12.5px' }}>
            <thead>
              <tr>
                <th>스냅샷 작성 기준일</th>
                <th>작업 시점 주거래고</th>
                <th>30일내 수납예정</th>
                <th>30일내 일반지출</th>
                <th>30일내 CAPEX</th>
                <th style={{ textAlign: 'right' }}>30일 후 예상누적잔고</th>
                <th>대표이사 분석 의견 및 비고</th>
                <th style={{ textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {cashFlowSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    저장된 과거 현금흐름 예측 스냅샷이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                cashFlowSnapshots.map(snap => (
                  <tr key={snap.id} style={{ backgroundColor: snap.projectedFinalBalance < 0 ? 'rgba(239, 68, 68, 0.01)' : 'transparent' }}>
                    <td><strong>{snap.snapshotDate}</strong></td>
                    <td>{snap.startingBalance.toLocaleString()}원</td>
                    <td style={{ color: 'var(--success)', fontWeight: '600' }}>+{snap.projectedInflow.toLocaleString()}원</td>
                    <td style={{ color: 'var(--warning)', fontWeight: '600' }}>-{snap.projectedOpex.toLocaleString()}원</td>
                    <td style={{ color: 'var(--danger)', fontWeight: '600' }}>-{snap.projectedCapex.toLocaleString()}원</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: snap.projectedFinalBalance < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {snap.projectedFinalBalance.toLocaleString()}원
                    </td>
                    <td style={{ maxWidth: '220px', fontSize: '11.5px', lineHeight: '1.4' }}>
                      {snap.notes || <span style={{ color: 'var(--text-muted)' }}>기재 없음</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn-secondary" 
                        onClick={() => {
                          if (confirm('해당 스냅샷 이력을 정말 삭제하시겠습니까?')) {
                            deleteCashFlowSnapshot(snap.id);
                          }
                        }}
                        style={{ padding: '4px 8px', fontSize: '11.5px', color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 스냅샷 저장 작성 모달 */}
      {showSnapModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSaveSnapshotSubmit} className="card" style={{ width: '100%', maxWidth: '450px', padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '12px' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={18} color="var(--primary)" /> 오늘의 CashFlow 전망 스냅샷 동결
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', fontSize: '12.5px', lineHeight: '1.5' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <strong>저장될 예측 분석 지표:</strong><br/>
                • 기초 통장잔고: {startingBalanceAtFocus.toLocaleString()}원<br/>
                • 30일내 수납예정: +{totalInflow.toLocaleString()}원<br/>
                • 30일내 지출예정: -{totalOpex.toLocaleString()}원<br/>
                • 30일내 CAPEX예정: -{totalCapex.toLocaleString()}원<br/>
                • 30일 후 최종잔고: <strong style={{ color: finalBalance < 0 ? 'var(--danger)' : 'var(--success)' }}>{finalBalance.toLocaleString()}원</strong>
              </div>

              <div>
                <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block' }}>대표이사 분석 메모 (경영 지침)</label>
                <textarea 
                  rows={4}
                  value={snapNotes}
                  onChange={e => setSnapNotes(e.target.value)}
                  placeholder="예: 현대건설 기성금 850만 원 미납 시 8/10일 기해 장비 신규도입 CAPEX 보류 필요."
                  style={{ width: '100%', padding: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowSnapModal(false)}>취소</button>
              <button type="submit" className="btn-primary">스냅샷 저장</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
