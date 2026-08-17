// src/components/AgentHeaderBadge.tsx
// (주)기연리프트 최상단 글로벌 헤더 에이전트 미니 상태 배지 및 원클릭 드롭다운

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Download, RefreshCw, Shield, ChevronDown, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { EXPECTED_AGENT_VERSION, AGENT_DOWNLOAD_URL, AGENT_CERT_URL, AGENT_INSTALL_BAT_URL, restartLocalAgent } from '../services/agentService';

interface Props {
  currentUser?: {
    loginId?: string;
    name?: string;
  } | null;
}

export const AgentHeaderBadge: React.FC<Props> = ({ currentUser }) => {
  const [agentStatus, setAgentStatus] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
  const [agentVersion, setAgentVersion] = useState<string>('');
  const [agentCallsign, setAgentCallsign] = useState<string>('');
  const [isRestarting, setIsRestarting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOpenMenu, setIsOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 3초 주기 헬스체크 및 실시간 콜사인 바인딩
  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        const userCallsign = currentUser?.loginId || currentUser?.name || 'admin';
        const res = await fetch(`http://127.0.0.1:5175/health?callsign=${encodeURIComponent(userCallsign)}`, {
          method: 'GET',
          signal: AbortSignal.timeout(1500),
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setAgentStatus('ONLINE');
            setAgentVersion(data.version || '');
            setAgentCallsign(data.callsign || userCallsign);
          }
          return;
        }
      } catch (e) {}
      if (isMounted) {
        setAgentStatus('OFFLINE');
        setAgentVersion('');
        setAgentCallsign('');
      }
    };

    check();
    const interval = setInterval(check, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpenMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLatest = agentStatus === 'ONLINE' && agentVersion === EXPECTED_AGENT_VERSION;
  const isOutdated = agentStatus === 'ONLINE' && !isLatest;

  // 1단계: 인증서 다운로드
  const handleDownloadCert = () => {
    try {
      const link1 = document.createElement('a');
      link1.href = AGENT_CERT_URL;
      link1.download = 'KiyeunLift_Root.cer';
      document.body.appendChild(link1);
      link1.click();
      document.body.removeChild(link1);

      setTimeout(() => {
        const link2 = document.createElement('a');
        link2.href = AGENT_INSTALL_BAT_URL;
        link2.download = 'install-cert.bat';
        document.body.appendChild(link2);
        link2.click();
        document.body.removeChild(link2);
      }, 300);
    } catch (e) {
      alert('인증서 다운로드 실패');
    }
  };

  // 2단계: 에이전트 다운로드
  const handleDownloadExe = () => {
    setIsDownloading(true);
    try {
      const link = document.createElement('a');
      link.href = AGENT_DOWNLOAD_URL;
      link.download = 'KiyeunAgent.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('에이전트 다운로드 실패');
    } finally {
      setTimeout(() => setIsDownloading(false), 1500);
    }
  };

  // 핫 재시작
  const handleRestart = async () => {
    setIsRestarting(true);
    await restartLocalAgent();
    setTimeout(() => {
      setIsRestarting(false);
      setIsOpenMenu(false);
    }, 2000);
  };

  // 버전 약식 변환 헬퍼 (예: v1.100.0.Build.217 -> v1.100)
  const toShortVer = (ver: string) => {
    if (!ver) return '';
    const match = ver.match(/v\d+\.\d+/);
    return match ? match[0] : ver.split('.Build')[0];
  };

  const shortCurrent = toShortVer(agentVersion);
  const shortExpected = toShortVer(EXPECTED_AGENT_VERSION);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* 🟢 최신 정상 상태 배지 (콜사인 생략 & 약식 버전) */}
      {isLatest && (
        <button
          type="button"
          onClick={() => setIsOpenMenu(!isOpenMenu)}
          style={{
            padding: '5px 10px',
            borderRadius: '20px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            color: '#15803d',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          title={`에이전트 ${agentVersion} 정상 가동 중 (클릭 시 관리)`}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
          <span>에이전트 {shortCurrent}</span>
          <ChevronDown size={11} />
        </button>
      )}

      {/* 🟡 구버전 가동 중 배지 (버전 차이 약식 표기: v1.98 ➔ v1.100) */}
      {isOutdated && (
        <button
          type="button"
          onClick={() => setIsOpenMenu(!isOpenMenu)}
          style={{
            padding: '5px 10px',
            borderRadius: '20px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          title={`에이전트 업데이트 필요 (현재: ${agentVersion} ➔ 최신: ${EXPECTED_AGENT_VERSION})`}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span>
          <span>{shortCurrent || '구버전'} ➔ {shortExpected}</span>
          <ChevronDown size={11} />
        </button>
      )}

      {/* 🔴 미실행 (오프라인) 상태 배지 */}
      {agentStatus === 'OFFLINE' && (
        <button
          type="button"
          onClick={() => setIsOpenMenu(!isOpenMenu)}
          style={{
            padding: '5px 10px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          title={`로컬 에이전트 미실행 (최신: ${EXPECTED_AGENT_VERSION})`}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span>
          <span>에이전트 미실행</span>
          <ChevronDown size={11} />
        </button>
      )}

      {/* ═══ 클릭 시 열리는 미니 팝오버 메뉴 ═══ */}
      {isOpenMenu && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          zIndex: 9999,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          width: '320px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          color: 'var(--text-primary)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800' }}>
              <Bot size={16} color="var(--primary)" />
              로컬 사이드카 에이전트 상태
            </div>
            <button type="button" onClick={() => setIsOpenMenu(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>

          {/* 상태 정보 표기 */}
          <div style={{ background: 'var(--bg-app)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>연결 상태:</span>
              <span style={{ fontWeight: '800', color: agentStatus === 'ONLINE' ? '#16a34a' : '#dc2626' }}>
                {agentStatus === 'ONLINE' ? '🟢 가동중 (ONLINE)' : '🔴 미실행 (OFFLINE)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>현재 버전:</span>
              <span style={{ fontWeight: '700' }}>{agentVersion || '없음'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>최신 요구 버전:</span>
              <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{EXPECTED_AGENT_VERSION}</span>
            </div>
            {agentCallsign && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>작업자(콜사인):</span>
                <span style={{ fontWeight: '700' }}>{agentCallsign}</span>
              </div>
            )}
          </div>

          {/* 액션 버튼 그룹 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agentStatus === 'OFFLINE' && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadCert}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Shield size={13} color="#0284c7" />
                  1단계: 🛡️ 보안 인증서 등록 (.cer)
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isDownloading}
                  onClick={handleDownloadExe}
                  style={{ width: '100%', padding: '9px 10px', fontSize: '12.5px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', color: '#fff' }}
                >
                  <Download size={14} />
                  {isDownloading ? '다운로드 중...' : `2단계: 📥 KiyeunAgent.exe 다운로드`}
                </button>
              </>
            )}

            {isOutdated && (
              <button
                type="button"
                className="btn-primary"
                disabled={isDownloading}
                onClick={handleDownloadExe}
                style={{ width: '100%', padding: '9px 10px', fontSize: '12.5px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', color: '#fff' }}
              >
                <Download size={14} />
                {isDownloading ? '다운로드 중...' : `📥 최신 에이전트 (${EXPECTED_AGENT_VERSION}) 받기`}
              </button>
            )}

            {agentStatus === 'ONLINE' && (
              <button
                type="button"
                className="btn-secondary"
                disabled={isRestarting}
                onClick={handleRestart}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={isRestarting ? 'animate-spin' : ''} />
                {isRestarting ? '에이전트 재기동 중...' : '🔄 에이전트 1초 핫 재시작'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
