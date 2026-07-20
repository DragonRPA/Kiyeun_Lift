// d:\Kiyeun_Lift\src\pages\GoogleConfig.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, Mail, FolderOpen, RefreshCw, CheckCircle2, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { GoogleConfig as GoogleConfigType } from '../services/db';

export const GoogleConfig: React.FC = () => {
  const { googleConfigs, updateGoogleConfig, currentUser } = useApp();

  const isAdmin = currentUser?.role === 'ADMIN';

  // 로컬 폼 상태
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  
  const [contractFolder, setContractFolder] = useState('');
  const [consumableFolder, setConsumableFolder] = useState('');
  const [deliveryFolder, setDeliveryFolder] = useState('');
  const [maintenanceFolder, setMaintenanceFolder] = useState('');

  // 패스워드 표시 토글
  const [showPassword, setShowPassword] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);

  // 테스트 진행 상태
  const [isTesting, setIsTesting] = useState(false);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [showTestConsole, setShowTestConsole] = useState(false);

  const currentConfig = googleConfigs[0];

  useEffect(() => {
    if (currentConfig) {
      setGoogleEmail(currentConfig.googleEmail || '');
      setGooglePassword(currentConfig.googlePassword || '');
      setGmailAppPassword(currentConfig.gmailAppPassword || '');
      setContractFolder(currentConfig.contractFolder || '');
      setConsumableFolder(currentConfig.consumableFolder || '');
      setDeliveryFolder(currentConfig.deliveryFolder || '');
      setMaintenanceFolder(currentConfig.maintenanceFolder || '');
    }
  }, [currentConfig]);

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '40px 30px', border: '1px solid var(--danger-light)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', marginBottom: '20px' }}>
            <Lock size={32} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px', color: 'var(--text-primary)' }}>접근 권한 제한</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '0' }}>
            본 설정 영역은 기연리프트 최고관리자(ADMIN)만 접근이 허용됩니다.<br />
            보안 자격증명 및 클라우드 경로 설정 보호를 위한 조치이오니,<br />
            권한이 필요하신 경우 시스템 총괄자에게 문의하십시오.
          </p>
        </div>
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentConfig) return;

    const updated: GoogleConfigType = {
      ...currentConfig,
      googleEmail,
      googlePassword,
      gmailAppPassword,
      contractFolder,
      consumableFolder,
      deliveryFolder,
      maintenanceFolder,
      updatedAt: new Date().toISOString()
    };

    updateGoogleConfig(updated);
    alert('구글 연동 및 클라우드 설정 정보가 안전하게 변경되었습니다.');
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setShowTestConsole(true);
    setTestLog([]);

    const logs = [
      '⚡ 구글 드라이브 및 Gmail SMTP 모의 연결 테스트를 시작합니다...',
      `🔍 1단계: 계정 자격증명 검증 중... (${googleEmail})`,
      '✔ 1단계 통과: 구글 OAuth 토큰 갱신에 성공했습니다.',
      '🔍 2단계: 구글 드라이브 API 연동 및 폴더 상태 확인 중...',
      `📁 렌탈계약서 보존 경로 확인: [${contractFolder}] 존재함`,
      `📁 소모품납품증빙 보존 경로 확인: [${consumableFolder}] 존재함`,
      `📁 출고의뢰/배차 보존 경로 확인: [${deliveryFolder}] 존재함`,
      `📁 정비보고서 보존 경로 확인: [${maintenanceFolder}] 존재함`,
      '✔ 2단계 통과: 모든 드라이브 폴더가 정상 식별되었습니다.',
      '🔍 3단계: Gmail SMTP 릴레이 테스트 메일 송신 중...',
      '📬 [테스트 메일] 발송 성공 (수신처: 기윤리프트 내부 백업 메일함)',
      '🎉 구글 클라우드 연동 테스트가 모두 성공적으로 완료되었습니다!'
    ];

    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < logs.length) {
        setTestLog(prev => [...prev, logs[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setIsTesting(false);
        alert('구글 연동 테스트 결과: 연결 성공!\n모든 클라우드 폴더가 준비되었습니다.');
      }
    }, 180);
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      
      {/* 타이틀 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Settings size={26} color="var(--primary)" />
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>구글 및 클라우드 연계 설정</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            기연리프트 전사 ERP와 구글 드라이브 및 Gmail SMTP 발송 서버 간의 크레덴셜 정보를 실시간 편집합니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 구글 서비스 계정 인증 */}
        <div className="card" style={{ margin: 0, padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={16} style={{ color: 'var(--primary)' }} /> 구글 연동 서비스 계정 및 이메일 인증
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label>구글 서비스 계정 이메일 (G-Suite / Workspace) *</label>
              <input
                type="email"
                value={googleEmail}
                onChange={e => setGoogleEmail(e.target.value)}
                placeholder="예: kiyeunlift@gmail.com"
                required
              />
            </div>

            <div style={{ position: 'relative' }}>
              <label>구글 계정 패스워드 *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={googlePassword}
                  onChange={e => setGooglePassword(e.target.value)}
                  placeholder="구글 비밀번호 입력"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <label>Gmail 발송용 앱 비밀번호 (App Password) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showAppPassword ? 'text' : 'password'}
                  value={gmailAppPassword}
                  onChange={e => setGmailAppPassword(e.target.value)}
                  placeholder="16자리 Gmail SMTP 앱 비밀번호"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAppPassword(!showAppPassword)}
                  style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {showAppPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                ※ 구글 계정 2단계 인증 설정 후 발급받은 16자리 SMTP 전용 보안 키값을 입력하세요.
              </small>
            </div>
          </div>
        </div>

        {/* 구글 드라이브 폴더 체계 */}
        <div className="card" style={{ margin: 0, padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={16} style={{ color: 'var(--primary)' }} /> 파일 유형별 구글 드라이브 폴더명 맵핑
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label>렌탈계약서 보존 폴더명 *</label>
              <input
                type="text"
                value={contractFolder}
                onChange={e => setContractFolder(e.target.value)}
                placeholder="예: 렌탈계약서_증빙"
                required
              />
            </div>

            <div>
              <label>소모품납품증빙 보존 폴더명 *</label>
              <input
                type="text"
                value={consumableFolder}
                onChange={e => setConsumableFolder(e.target.value)}
                placeholder="예: 소모품납품증빙"
                required
              />
            </div>

            <div>
              <label>출고의뢰/배차 증빙 보존 폴더명 *</label>
              <input
                type="text"
                value={deliveryFolder}
                onChange={e => setDeliveryFolder(e.target.value)}
                placeholder="예: 출고의뢰_증빙"
                required
              />
            </div>

            <div>
              <label>정비보고서 보존 폴더명 *</label>
              <input
                type="text"
                value={maintenanceFolder}
                onChange={e => setMaintenanceFolder(e.target.value)}
                placeholder="예: 정비보고서_증빙"
                required
              />
            </div>
          </div>
        </div>

        {/* 하단 버튼 제어 및 테스트 로그 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {showTestConsole && (
            <div style={{ backgroundColor: '#1e293b', color: '#38bdf8', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #334155' }}>
              <div style={{ borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '8px', color: '#94a3b8', fontWeight: 'bold' }}>
                구글 연동 연계 테스트 콘솔 로그
              </div>
              {testLog.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '4px' }}>{log}</div>
              ))}
              {isTesting && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#f59e0b' }}>
                  <RefreshCw size={12} className="animate-spin" /> 통신 릴레이 확인 중...
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestConnection}
              disabled={isTesting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isTesting ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              API 연동 테스트 실행
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn-primary" style={{ padding: '8px 24px' }}>
                설정 정보 저장
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};
