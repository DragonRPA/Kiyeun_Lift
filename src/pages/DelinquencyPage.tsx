import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, Todo } from '../services/db';
import { 
  AlertTriangle, PhoneCall, Mail, Truck, CheckCircle, 
  Clock, Plus, Upload, Trash2, ArrowRight, UserCheck, ShieldAlert,
  Calendar, DollarSign, Award, ThumbsUp, ThumbsDown
} from 'lucide-react';

interface Delinquency {
  id: string;
  customerId: string;
  customerName: string;
  responsibleEmployeeId: string;
  responsibleEmployeeName: string;
  totalOverdueAmount: number;
  oldestOverdueDate: string;
  overdueDays: number;
  status: 'ACTIVE' | 'RESOLVED';
  lastActionDate?: string;
  lastActionType?: string;
  todoId?: string;
}

interface ActionLog {
  id: string;
  delinquencyId: string;
  actionType: 'CALL' | 'NOTICE_SENT' | 'VISIT' | 'LEGAL';
  actionDetails: string;
  proofFileName?: string;
  recordedBy: string;
  mandateType: 'CEO_AUTO_MANDATE';
  createdAt: string;
  
  // 입금 약속 세부 속성 (신설)
  promiseDate?: string;
  promiseAmount?: number;
  promiseStatus?: 'PENDING' | 'KEPT' | 'BROKEN';
}

export const DelinquencyPage: React.FC = () => {
  const { currentUser, hasPermission } = useApp();
  const canSave = hasPermission('billing', 'save');

  // 상태 관리
  const [delinquencies, setDelinquencies] = useState<Delinquency[]>([]);
  const [selectedDelinquency, setSelectedDelinquency] = useState<Delinquency | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  
  // 신규 조치 입력 폼
  const [newActionType, setNewActionType] = useState<'CALL' | 'NOTICE_SENT' | 'VISIT' | 'LEGAL'>('CALL');
  const [newActionDetails, setNewActionDetails] = useState('');
  const [proofFile, setProofFile] = useState<string>('');

  // 입금 약속 기입 폼
  const [hasPromise, setHasPromise] = useState(false);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState(0);
  const [promiseContactPerson, setPromiseContactPerson] = useState('');

  // 1. 초기 모의 데이터 로드
  useEffect(() => {
    const initialDelinquencies: Delinquency[] = [
      {
        id: 'del_001',
        customerId: 'cust-1',
        customerName: '현대건설(주) 신포항 현장',
        responsibleEmployeeId: 'manager',
        responsibleEmployeeName: '김영업 과장',
        totalOverdueAmount: 5200000,
        oldestOverdueDate: '2026-06-15',
        overdueDays: 36,
        status: 'ACTIVE',
        lastActionDate: '2026-07-02',
        lastActionType: '전화 독촉',
        todoId: 'todo_del_001'
      },
      {
        id: 'del_002',
        customerId: 'cust-2',
        customerName: '대우건설(주) 포항북구 신항',
        responsibleEmployeeId: 'user',
        responsibleEmployeeName: '이영업 대리',
        totalOverdueAmount: 3450000,
        oldestOverdueDate: '2026-07-05',
        overdueDays: 16,
        status: 'ACTIVE',
        lastActionDate: '2026-07-04',
        lastActionType: '방문 실사',
        todoId: 'todo_del_002'
      }
    ];

    setDelinquencies(initialDelinquencies);

    const initialLogs: ActionLog[] = [
      {
        id: 'act_log_1',
        delinquencyId: 'del_001',
        actionType: 'CALL',
        actionDetails: '1차 현장 박소장 유선 통화. 현금 집행 일정 조율 후 7월 25일까지 3,000,000원 선지급 약속 받음.',
        recordedBy: '김영업 과장',
        mandateType: 'CEO_AUTO_MANDATE',
        createdAt: '2026-07-02 14:30:00',
        promiseDate: '2026-07-25',
        promiseAmount: 3000000,
        promiseStatus: 'PENDING'
      },
      {
        id: 'act_log_2',
        delinquencyId: 'del_002',
        actionType: 'VISIT',
        actionDetails: '직접 현장 사무실 방문하여 회계 담당자와 대면 면담. 7월 15일 전액 수납을 약속했었으나 파기됨.',
        recordedBy: '이영업 대리',
        mandateType: 'CEO_AUTO_MANDATE',
        createdAt: '2026-07-04 11:20:00',
        promiseDate: '2026-07-15',
        promiseAmount: 3450000,
        promiseStatus: 'BROKEN' // 이미 파기된 약속
      }
    ];

    setActionLogs(initialLogs);
  }, []);

  const handleSelectDelinquency = (del: Delinquency) => {
    setSelectedDelinquency(del);
    setNewActionDetails('');
    setProofFile('');
    setHasPromise(false);
    setPromiseDate('');
    setPromiseAmount(0);
    setPromiseContactPerson('');
  };

  // 조치 기록 및 상담 약속 등록
  const handleRegisterAction = () => {
    if (!selectedDelinquency) return;
    if (!newActionDetails.trim()) {
      alert('상담 조치 상세 내역을 입력해 주십시오.');
      return;
    }

    const newLog: ActionLog = {
      id: `act_log_${Date.now()}`,
      delinquencyId: selectedDelinquency.id,
      actionType: newActionType,
      actionDetails: `${promiseContactPerson ? `[대상: ${promiseContactPerson}] ` : ''}${newActionDetails}`,
      proofFileName: proofFile || undefined,
      recordedBy: currentUser?.name || '담당영업',
      mandateType: 'CEO_AUTO_MANDATE',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      promiseDate: hasPromise ? promiseDate : undefined,
      promiseAmount: hasPromise ? promiseAmount : undefined,
      promiseStatus: hasPromise ? 'PENDING' : undefined
    };

    // 1. 조치 로그 등록
    setActionLogs(prev => [...prev, newLog]);

    // 2. 연체 대장 정보 업데이트
    setDelinquencies(prev => prev.map(d => {
      if (d.id === selectedDelinquency.id) {
        return {
          ...d,
          status: 'RESOLVED',
          lastActionDate: newLog.createdAt.split(' ')[0],
          lastActionType: newActionType === 'CALL' ? '전화 독촉' : newActionType === 'NOTICE_SENT' ? '최고장 송달' : newActionType === 'VISIT' ? '방문 실사' : '법적 조치'
        };
      }
      return d;
    }));

    // 3. ToDo 완료 처리
    if (selectedDelinquency.todoId) {
      db.updateRow<Todo>('todos', selectedDelinquency.todoId, { isCompleted: true });
    }

    alert(`상담 및 조치 조서가 등록되었습니다.${hasPromise ? '\n지정된 수납 약속일정에 맞게 자동 입금 대조 엔진이 가동됩니다.' : ''}`);
    setSelectedDelinquency(null);
  };

  // 모의 입금 매칭 테스트 (준수 또는 파기 시뮬레이션)
  const handleSimulatePromise = (logId: string, simulateType: 'KEPT' | 'BROKEN') => {
    setActionLogs(prev => prev.map(log => {
      if (log.id === logId) {
        return { ...log, promiseStatus: simulateType };
      }
      return log;
    }));

    if (simulateType === 'BROKEN') {
      alert(`🚨 [입금 약속 위반 감지]\n약속일자 경과 시점까지 입금이 매칭되지 않아 상태가 [약속 위반(BROKEN)]으로 강제 변환되었습니다.\n\n경영자 지령령에 의거하여 담당 영업사원에게 즉시 '재상담 및 채권 회수 조서 작성' ToDo가 자동 재할당되었습니다.`);
    } else {
      alert(`🟢 [입금 약속 이행 완료]\n은행 통장 입금 전표 대조 결과 약속한 자금(${actionLogs.find(l => l.id === logId)?.promiseAmount?.toLocaleString()}원)의 매칭이 완료되어 [이행 완료(KEPT)] 처리되었습니다.`);
    }
  };

  // 통계 지표 연산
  const totalPromises = actionLogs.filter(l => l.promiseStatus).length;
  const keptPromises = actionLogs.filter(l => l.promiseStatus === 'KEPT').length;
  const brokenPromises = actionLogs.filter(l => l.promiseStatus === 'BROKEN').length;
  const promiseKeptRate = totalPromises > 0 ? Math.round((keptPromises / (keptPromises + brokenPromises || 1)) * 100) : 0;

  return (
    <div>
      {/* 상단 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={24} color="var(--danger)" />
          <h2 style={{ fontSize: '22px', fontWeight: '800' }}>미수 채권 연체 상담 및 약속이행 추적</h2>
        </div>
      </div>

      {/* 약속 이행률 KPI 지표 요약판 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ margin: 0, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>수납 합의 약속 건수</span>
            <Calendar size={18} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0' }}>
            {totalPromises}건
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>연체 상담을 통한 입금 약속 계약총수</span>
        </div>

        <div className="card" style={{ margin: 0, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>약속 준수 (Promise Kept)</span>
            <ThumbsUp size={18} color="var(--success)" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--success)' }}>
            {keptPromises}건
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>기한 내 정상 입금 매칭 완료 건</span>
        </div>

        <div className="card" style={{ margin: 0, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>약속 위반 (Promise Broken)</span>
            <ThumbsDown size={18} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--danger)' }}>
            {brokenPromises}건
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>기한 경과 미입금 독촉 재지령 발행 건</span>
        </div>

        <div className="card" style={{ margin: 0, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>전사 수납 약속 이행률</span>
            <Award size={18} color="var(--warning)" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--warning)' }}>
            {promiseKeptRate}%
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>총 완료건 중 이행률 성과 지표</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* 좌측: 전사 연체 대장 목록 */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 className="card-title">연체 채권 관리 대장</h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>기한경과 즉시 대표이사 명령 강제 ToDo 발행됨</span>
          </div>

          <table style={{ width: '100%', fontSize: '12.5px' }}>
            <thead>
              <tr>
                <th>연체 거래처명</th>
                <th>담당 영업사원</th>
                <th>연체 총액</th>
                <th>최초 연체일 (경과일수)</th>
                <th>최근 조치 현황</th>
                <th>대표이사 지령 ToDo</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {delinquencies.map(d => {
                const isMyDebt = currentUser?.id === d.responsibleEmployeeId || currentUser?.role === 'ADMIN';

                return (
                  <tr 
                    key={d.id} 
                    style={{ 
                      backgroundColor: d.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.01)' : 'transparent',
                      opacity: isMyDebt ? 1 : 0.5
                    }}
                  >
                    <td>
                      <strong>{d.customerName}</strong>
                    </td>
                    <td>{d.responsibleEmployeeName}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--danger)' }}>
                      {d.totalOverdueAmount.toLocaleString()}원
                    </td>
                    <td>
                      {d.oldestOverdueDate}<br/>
                      <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 'bold' }}>
                        ({d.overdueDays}일 연체 중)
                      </span>
                    </td>
                    <td>
                      {d.lastActionDate ? (
                        <span>{d.lastActionType} ({d.lastActionDate})</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>조치 기록 없음</span>
                      )}
                    </td>
                    <td>
                      {d.status === 'ACTIVE' ? (
                        <span style={{ 
                          fontSize: '10.5px', color: 'var(--danger)', fontWeight: 'bold', 
                          padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '2px'
                        }}>
                          👑 대표이사 지시 (진행중)
                        </span>
                      ) : (
                        <span style={{ 
                          fontSize: '10.5px', color: 'var(--success)', fontWeight: 'bold', 
                          padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.08)',
                          border: '1px solid rgba(34, 197, 94, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '2px'
                        }}>
                          ✔️ 조치 완료 (결재됨)
                        </span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn-secondary" 
                        onClick={() => handleSelectDelinquency(d)}
                        disabled={!isMyDebt || !canSave}
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                      >
                        상담 및 조치
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 우측: 상담 등록 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {selectedDelinquency ? (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', color: 'var(--danger)' }}>
                  [상담 일지 작성] {selectedDelinquency.customerName}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.03)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', lineHeight: '1.6' }}>
                  <strong>👑 대표이사 자동 명령 지시 통제</strong><br/>
                  본 거래처는 연체 {selectedDelinquency.overdueDays}일이 경과하여 대표이사 명의의 채권회수 지령 ToDo가 자동 발부되었습니다. 조치 증빙 등록 전에는 할 일을 마감할 수 없습니다.
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>조치 유형</label>
                  <select 
                    value={newActionType} 
                    onChange={e => setNewActionType(e.target.value as any)}
                    style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
                  >
                    <option value="CALL">전화 독촉 (상담)</option>
                    <option value="NOTICE_SENT">독촉장/최고장 공문 송달</option>
                    <option value="VISIT">거래처 직접 방문 실사</option>
                    <option value="LEGAL">법적 절차 이행 (가압류 등)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>고객사 대화 상대방</label>
                  <input 
                    type="text" 
                    placeholder="예: 박소장, 김대리"
                    value={promiseContactPerson}
                    onChange={e => setPromiseContactPerson(e.target.value)}
                    style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
                  />
                </div>

                {/* 상담 수납 약속 등록 옵션 */}
                <div style={{ border: '1px dashed var(--border-color)', padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.01)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={hasPromise} 
                      onChange={e => setHasPromise(e.target.checked)} 
                    />
                    <span>구체적인 입금 약속 정보 등록</span>
                  </label>

                  {hasPromise && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>입금 약속일</label>
                          <input 
                            type="date" 
                            value={promiseDate} 
                            onChange={e => setPromiseDate(e.target.value)}
                            style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>약속 금액</label>
                          <input 
                            type="number" 
                            value={promiseAmount} 
                            onChange={e => setPromiseAmount(parseInt(e.target.value) || 0)}
                            style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>조치 증빙 서류 업로드</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="첨부파일 명세 (예: 최고장_송달증명.pdf)"
                      value={proofFile}
                      onChange={e => setProofFile(e.target.value)}
                      style={{ flex: 1, padding: '6px', fontSize: '12.5px' }}
                    />
                    <label className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Upload size={14} /> 첨부
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>상담 상세 내용</label>
                  <textarea 
                    rows={3}
                    value={newActionDetails}
                    onChange={e => setNewActionDetails(e.target.value)}
                    placeholder="담당자와 통화/면담하여 합의한 수납 조건 등을 상세히 기술하십시오."
                    style={{ width: '100%', padding: '8px', fontSize: '12.5px', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button className="btn-primary" onClick={handleRegisterAction} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <CheckCircle size={15} /> 조치사항 저장 & ToDo 완료
                  </button>
                  <button className="btn-secondary" onClick={() => setSelectedDelinquency(null)} style={{ padding: '8px 12px' }}>
                    취소
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ margin: 0, padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <ShieldAlert size={28} style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--text-muted)' }} />
              좌측 대장에서 상담할 연체 거래처를 선택해 주십시오.
            </div>
          )}

          {/* 선택 거래처의 과거 조치 이력 및 입금 약속 관리 타임라인 */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">상담 이력 및 입금 약속 추적</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '250px', overflowY: 'auto', fontSize: '12.2px' }}>
              {actionLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>기록된 이력이 없습니다.</div>
              ) : (
                actionLogs.map(log => (
                  <div key={log.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <strong>{log.actionType === 'CALL' ? '📞 유선 상담' : log.actionType === 'VISIT' ? '🏢 방문 면담' : '✉️ 공문 최고'}</strong>
                      <span>{log.createdAt}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: '1.4' }}>{log.actionDetails}</p>
                    
                    {/* 약속 상태 표시 */}
                    {log.promiseDate && (
                      <div style={{ 
                        marginTop: '6px', padding: '6px 8px', borderRadius: '4px', 
                        backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
                      }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>합의된 입금 약속:</span><br/>
                          <strong>{log.promiseDate}</strong> / <strong style={{ color: 'var(--primary)' }}>{log.promiseAmount?.toLocaleString()}원</strong>
                        </div>
                        <div>
                          {log.promiseStatus === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button 
                                className="btn-secondary" 
                                onClick={() => handleSimulatePromise(log.id, 'KEPT')}
                                style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', border: 'none' }}
                              >
                                이행
                              </button>
                              <button 
                                className="btn-secondary" 
                                onClick={() => handleSimulatePromise(log.id, 'BROKEN')}
                                style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none' }}
                              >
                                위반
                              </button>
                            </div>
                          ) : (
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 'bold',
                              backgroundColor: log.promiseStatus === 'KEPT' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: log.promiseStatus === 'KEPT' ? 'var(--success)' : 'var(--danger)'
                            }}>
                              {log.promiseStatus === 'KEPT' ? '🟢 약속 이행됨' : '🔴 약속 파기됨'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      기록자: {log.recordedBy} | 상태: {log.mandateType === 'CEO_AUTO_MANDATE' ? '👑 대표이사 지시건 해결' : '일반'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
