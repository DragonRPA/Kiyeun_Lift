import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, ArrowDownRight, ArrowUpRight, AlertTriangle, 
  Layers, CheckCircle, RefreshCw, Landmark, HelpCircle 
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
  const { hasPermission } = useApp();
  const canSave = hasPermission('billing', 'save');

  // 기초 주거래 통장 정보
  const [kookminBalance, setKookminBalance] = useState(12850000);
  const [shinhanBalance, setShinhanBalance] = useState(4500000);
  const [safetyThreshold, setSafetyThreshold] = useState(10000000); // 안전자금 임계치: 1,000만 원

  const totalStartingBalance = kookminBalance + shinhanBalance;

  // 30일 일별 현금흐름 데이터 시뮬레이션
  const [forecastList, setForecastList] = useState<DailyForecast[]>([]);

  useEffect(() => {
    // 30일 타임라인 생성
    const list: DailyForecast[] = [];
    let currentBalance = totalStartingBalance;
    const today = new Date();

    for (let i = 1; i <= 30; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateString = targetDate.toISOString().split('T')[0];

      let inflow = 0;
      let inflowDetail = '';
      let opex = 0;
      let opexDetail = '';
      let capex = 0;
      let capexDetail = '';

      // 모의 스케줄러 설정 (납기 및 지출일 지정)
      if (i === 4) {
        inflow = 8500000;
        inflowDetail = '현대건설(주) 기성금 수납';
      } else if (i === 10) {
        inflow = 14500000;
        inflowDetail = '대우건설(주) 렌탈 청구수납';
      } else if (i === 15) {
        opex = 18500000;
        opexDetail = '임직원 월 급여 지급(인사팀)';
      } else if (i === 20) {
        opex = 8450000;
        opexDetail = '임차 장비 대금 정산';
      } else if (i === 24) {
        capex = 45000000; // 고액 장비 CAPEX 투자 발생
        capexDetail = '고소작업대 2대 추가 신규 취득';
      } else if (i === 27) {
        inflow = 15200000;
        inflowDetail = '포스코이앤씨(주) 청구 미수 수납';
      } else if (i === 30) {
        opex = 1500000;
        opexDetail = '사무실 월세 자동이체';
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
  }, [totalStartingBalance, safetyThreshold]);

  // 합산 연산
  const totalInflow = forecastList.reduce((sum, item) => sum + item.inflow, 0);
  const totalOpex = forecastList.reduce((sum, item) => sum + item.opex, 0);
  const totalCapex = forecastList.reduce((sum, item) => sum + item.capex, 0);
  const finalBalance = totalStartingBalance + totalInflow - totalOpex - totalCapex;

  // 부도 위험 여부 및 위험일자 트래킹
  const criticalItem = forecastList.find(item => item.cumulative < 0);

  return (
    <div>
      {/* 상단 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '22px', fontWeight: '800' }}>데일리 CashFlow 분석 및 30일 시뮬레이션</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>안전자금 마진 설정:</span>
            <input 
              type="number" 
              value={safetyThreshold} 
              onChange={e => setSafetyThreshold(parseInt(e.target.value) || 0)}
              style={{ width: '100px', padding: '4px 8px', fontSize: '12px' }}
            />
            <span>원</span>
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
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>주거래 통장 현재고</span>
            <Landmark size={18} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0' }}>
            {totalStartingBalance.toLocaleString()}원
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '4px' }}>
            <span>국민: 12.8M</span>
            <span>신한: 4.5M</span>
          </div>
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

        {/* 최종 30일 후 잔액 */}
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

        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
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
    </div>
  );
};
