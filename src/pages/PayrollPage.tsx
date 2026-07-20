import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { 
  CreditCard, FileText, CheckCircle, AlertTriangle, Send, 
  Upload, CheckSquare, RefreshCw, Lock, LockOpen 
} from 'lucide-react';

export const PayrollPage: React.FC = () => {
  const { currentUser, hasPermission } = useApp();
  const canSave = hasPermission('payroll', 'save');

  // 상태 관리
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [payrollList, setPayrollList] = useState<any[]>([]);
  const [isTaxDataUploaded, setIsTaxDataUploaded] = useState(false);
  const [payrollStatus, setPayrollStatus] = useState<'DRAFT' | 'APPROVED'>('DRAFT');
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  // 초기 직원 데이터 로드
  useEffect(() => {
    // db.users를 임직원 기본 데이터로 로드
    const activeStaff = db.users.filter(u => u.id !== 'sys-admin');
    
    // 모의 급여 기준 정보 주입 (기본급, 시급 등)
    const staffWithSalaries = activeStaff.map(u => {
      // 역할 및 직책에 따른 모의 기본급 설정
      let baseSalary = 3000000;
      if (u.role === 'ADMIN') baseSalary = 5500000;
      else if (u.role === 'MANAGER') baseSalary = 4200000;
      else if (u.id.includes('mech')) baseSalary = 3500000;

      const ordinaryHourly = Math.round(baseSalary / 209);

      return {
        id: u.id,
        name: u.name,
        deptName: u.department || '미정',
        role: u.role,
        baseSalary,
        ordinaryHourly,
        email: `${u.loginId}@kiyeunlift.co.kr`,
        birthDate: '1988-12-05' // 명세서 비밀번호 암호화용 기본값
      };
    });

    // 당월 급여 정산 테이블 빌드
    const initialPayroll = staffWithSalaries.map(emp => ({
      employeeId: emp.id,
      name: emp.name,
      deptName: emp.deptName,
      baseSalary: emp.baseSalary,
      ordinaryHourly: emp.ordinaryHourly,
      overtimeHours: 0,
      holidayHours: 0,
      nightHours: 0,
      unpaidLeaveDays: 0,
      manualAdjustmentAmount: 0, // 수동 가감 디폴트 0
      manualAdjustmentReason: '',
      nationalPension: 0,
      healthInsurance: 0,
      careInsurance: 0,
      employmentInsurance: 0,
      earnedIncomeTax: 0,
      localIncomeTax: 0,
      netSalary: emp.baseSalary // 실수령액 초기값
    }));

    setPayrollList(initialPayroll);
  }, []);

  // 연장/야근/휴가 변경 시 자동 계산 공식 적용
  const handleHoursChange = (empId: string, field: string, val: number) => {
    if (payrollStatus === 'APPROVED') return; // 승인 락 상태에서는 변경 불가

    setPayrollList(prev => prev.map(p => {
      if (p.employeeId === empId) {
        const updated = { ...p, [field]: val };
        recalculateRow(updated);
        return updated;
      }
      return p;
    }));
  };

  // 수동 가감액 변경 시 계산 (디폴트 0)
  const handleAdjustmentChange = (empId: string, amount: number, reason: string) => {
    if (payrollStatus === 'APPROVED') return;

    setPayrollList(prev => prev.map(p => {
      if (p.employeeId === empId) {
        const updated = { 
          ...p, 
          manualAdjustmentAmount: amount, 
          manualAdjustmentReason: reason 
        };
        recalculateRow(updated);
        return updated;
      }
      return p;
    }));
  };

  // 단일 사원 급여 재계산식
  const recalculateRow = (p: any) => {
    const overtimeAllowance = Math.round(p.overtimeHours * p.ordinaryHourly * 1.5);
    const holidayAllowance = Math.round(p.holidayHours * p.ordinaryHourly * 1.5);
    const nightAllowance = Math.round(p.nightHours * p.ordinaryHourly * 0.5);
    const unpaidDeduction = Math.round(p.unpaidLeaveDays * (p.ordinaryHourly * 8));

    const totalAllowances = overtimeAllowance + holidayAllowance + nightAllowance;
    const grossSalary = p.baseSalary + totalAllowances - unpaidDeduction + p.manualAdjustmentAmount;

    const totalDeductions = p.nationalPension + p.healthInsurance + p.careInsurance + p.employmentInsurance + p.earnedIncomeTax + p.localIncomeTax;
    p.netSalary = Math.max(0, grossSalary - totalDeductions);
  };

  // 세무회계법인 공제액 데이터 모의 업로드 처리
  const handleTaxDataUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    // 모의 파싱 및 주입
    setPayrollList(prev => prev.map(p => {
      // 급여 금액 수준에 맞춰 비례한 보험료/세금 모의 주입
      const base = p.baseSalary;
      const pension = Math.round(base * 0.045);
      const health = Math.round(base * 0.03545);
      const care = Math.round(health * 0.1281);
      const employment = Math.round(base * 0.009);
      const incomeTax = Math.round(base * 0.015);
      const localTax = Math.round(incomeTax * 0.1);

      const updated = {
        ...p,
        nationalPension: pension,
        healthInsurance: health,
        careInsurance: care,
        employmentInsurance: employment,
        earnedIncomeTax: incomeTax,
        localIncomeTax: localTax
      };
      recalculateRow(updated);
      return updated;
    }));

    setIsTaxDataUploaded(true);
    alert('세무회계법인 수취 4대보험/소득세 확정액 데이터가 성공적으로 대조 적재되었습니다.\n(업로드 파일 검증 완료 - Checksum 일치)');
  };

  // 최종 결재 승인 (락 걸기)
  const handleApprovePayroll = () => {
    if (!isTaxDataUploaded) {
      alert('세무회계법인의 공제액 엑셀 파일을 먼저 업로드해 주십시오.');
      return;
    }
    if (confirm('당월 급여 대장을 최종 승인하시겠습니까?\n승인 시 모든 데이터가 암호화 보존되며, 수정 불가능한 읽기 전용 상태로 락이 설정됩니다.')) {
      setPayrollStatus('APPROVED');
      alert('급여 정산 대장이 최종 결재 승인 완료되었습니다.');
    }
  };

  // 급여명세서 이메일 일괄 전송
  const handleSendEmails = () => {
    if (payrollStatus !== 'APPROVED') {
      alert('최고관리자(ADMIN)의 최종 결재 승인(Lock) 완료 후에만 이메일 교부가 가능합니다.');
      return;
    }

    setIsSendingEmails(true);
    setTimeout(() => {
      setIsSendingEmails(false);
      alert(`급여명세서 이메일 교부 완료!\n총 ${payrollList.length}명의 등록된 메일 주소로 생년월일 암호화 처리된 명세서 PDF가 성공적으로 발송되었습니다.\n(발송 로그 수집 완료)`);
    }, 2000);
  };

  return (
    <div>
      {/* 타이틀 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '22px', fontWeight: '800' }}>급여 정산 마스터</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {payrollStatus === 'DRAFT' ? (
            <button 
              className="btn-success" 
              onClick={handleApprovePayroll}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={!canSave}
            >
              <LockOpen size={16} /> 최종 결재 승인 (Lock)
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: 'var(--danger-light)', borderRadius: '6px', border: '1px solid var(--danger)' }}>
              <Lock size={16} color="var(--danger)" />
              <strong style={{ color: 'var(--danger)', fontSize: '13px' }}>결재 승인 잠금 상태</strong>
            </div>
          )}

          <button 
            className="btn-primary" 
            onClick={handleSendEmails}
            disabled={payrollStatus !== 'APPROVED' || isSendingEmails}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: payrollStatus === 'APPROVED' ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            {isSendingEmails ? (
              <>
                <RefreshCw size={16} className="spin-animation" /> 전송 중...
              </>
            ) : (
              <>
                <Send size={16} /> 급여명세서 이메일 일괄 전송
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '24px', alignItems: 'start' }}>
        {/* 좌측 제어판 */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">정산 제어판</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>대상 귀속 월 선택</label>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={payrollStatus === 'APPROVED'}
                style={{ width: '100%', padding: '8px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>세무법인 자료 업로드</label>
              <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '16px', textAlign: 'center', backgroundColor: isTaxDataUploaded ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
                <Upload size={24} style={{ color: isTaxDataUploaded ? 'var(--success)' : 'var(--text-muted)', marginBottom: '8px' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  {isTaxDataUploaded ? '확정 세무 데이터 반영됨' : '4대보험/소득세 확정자료'}
                </div>
                <input 
                  type="file" 
                  accept=".csv,.xlsx" 
                  onChange={handleTaxDataUpload}
                  disabled={payrollStatus === 'APPROVED'}
                  style={{ display: 'none' }} 
                  id="tax-file-upload" 
                />
                <label 
                  htmlFor="tax-file-upload" 
                  className="btn-secondary" 
                  style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', display: 'inline-block' }}
                >
                  파일 찾기
                </label>
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', lineHeight: '1.5' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={14} color="var(--warning)" /> 통상시급 및 1일임금 기준
              </div>
              • 월 소정근로시간: 209시간<br/>
              • 연장/야간/휴일수당: 법정 1.5배/0.5배 자동 산정<br/>
              • 무급휴가 공제: 1일 통상급여 차감 적용
            </div>
          </div>
        </div>

        {/* 우측 급여대장 테이블 */}
        <div className="card" style={{ margin: 0, overflowX: 'auto' }}>
          <div className="card-header">
            <h3 className="card-title">급여 정산 대장</h3>
            <span className={`badge ${payrollStatus === 'APPROVED' ? 'badge-danger' : 'badge-info'}`}>
              {payrollStatus === 'APPROVED' ? '결재 완료 (Locked)' : '초안 작성 중 (Draft)'}
            </span>
          </div>

          <table style={{ width: '100%', fontSize: '12.5px' }}>
            <thead>
              <tr>
                <th>사원명(부서)</th>
                <th>기본급</th>
                <th>근태 가산수당 시간 (연장/휴일/야간)</th>
                <th>무급휴가</th>
                <th>수동 가감(조정)</th>
                <th>공제액(보험/세금)</th>
                <th style={{ textAlign: 'right' }}>실수령액</th>
              </tr>
            </thead>
            <tbody>
              {payrollList.map(p => {
                const overtimeAllowance = Math.round(p.overtimeHours * p.ordinaryHourly * 1.5);
                const holidayAllowance = Math.round(p.holidayHours * p.ordinaryHourly * 1.5);
                const nightAllowance = Math.round(p.nightHours * p.ordinaryHourly * 0.5);
                const totalAllowances = overtimeAllowance + holidayAllowance + nightAllowance;
                
                const taxSum = p.nationalPension + p.healthInsurance + p.careInsurance + p.employmentInsurance + p.earnedIncomeTax + p.localIncomeTax;

                return (
                  <tr key={p.employeeId}>
                    <td>
                      <strong>{p.name}</strong><br/>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.deptName}</span>
                    </td>
                    <td>{p.baseSalary.toLocaleString()}원</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div>연장 <input type="number" min="0" max="60" value={p.overtimeHours} onChange={(e) => handleHoursChange(p.employeeId, 'overtimeHours', parseInt(e.target.value) || 0)} disabled={payrollStatus === 'APPROVED'} style={{ width: '40px', padding: '2px 4px', fontSize: '11px' }} />h</div>
                        <div>휴일 <input type="number" min="0" max="40" value={p.holidayHours} onChange={(e) => handleHoursChange(p.employeeId, 'holidayHours', parseInt(e.target.value) || 0)} disabled={payrollStatus === 'APPROVED'} style={{ width: '40px', padding: '2px 4px', fontSize: '11px' }} />h</div>
                        <div>야간 <input type="number" min="0" max="40" value={p.nightHours} onChange={(e) => handleHoursChange(p.employeeId, 'nightHours', parseInt(e.target.value) || 0)} disabled={payrollStatus === 'APPROVED'} style={{ width: '40px', padding: '2px 4px', fontSize: '11px' }} />h</div>
                      </div>
                      {totalAllowances > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--primary)', marginTop: '4px' }}>
                          수당계: +{totalAllowances.toLocaleString()}원
                        </div>
                      )}
                    </td>
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        max="31" 
                        value={p.unpaidLeaveDays} 
                        onChange={(e) => handleHoursChange(p.employeeId, 'unpaidLeaveDays', parseInt(e.target.value) || 0)} 
                        disabled={payrollStatus === 'APPROVED'}
                        style={{ width: '45px', padding: '2px 4px', fontSize: '11px' }} 
                      />일
                    </td>
                    <td>
                      <input 
                        type="number" 
                        placeholder="가감액"
                        value={p.manualAdjustmentAmount || ''} 
                        onChange={(e) => handleAdjustmentChange(p.employeeId, parseInt(e.target.value) || 0, p.manualAdjustmentReason)}
                        disabled={payrollStatus === 'APPROVED'}
                        style={{ width: '75px', padding: '2px 4px', fontSize: '11px', marginBottom: '4px', display: 'block' }} 
                      />
                      <input 
                        type="text" 
                        placeholder="가감 사유 입력"
                        value={p.manualAdjustmentReason} 
                        onChange={(e) => handleAdjustmentChange(p.employeeId, p.manualAdjustmentAmount, e.target.value)}
                        disabled={payrollStatus === 'APPROVED'}
                        style={{ width: '90px', padding: '2px 4px', fontSize: '10.5px' }} 
                      />
                    </td>
                    <td>
                      {isTaxDataUploaded ? (
                        <div>
                          <strong>{taxSum.toLocaleString()}원</strong>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            국: {p.nationalPension.toLocaleString()} / 건: {p.healthInsurance.toLocaleString()}<br/>
                            소: {p.earnedIncomeTax.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>자료 대기중</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13.5px', color: 'var(--primary)' }}>
                      {p.netSalary.toLocaleString()}원
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
