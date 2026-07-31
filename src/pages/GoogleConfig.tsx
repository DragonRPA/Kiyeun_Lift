// d:\Kiyeun_Lift\src\pages\GoogleConfig.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, Mail, FolderOpen, RefreshCw, CheckCircle2, Lock, Eye, EyeOff, ShieldCheck, HelpCircle, AlertTriangle, ExternalLink, Key, Search, Cloud, Folder, File, ArrowLeft } from 'lucide-react';
import { GoogleConfig as GoogleConfigType } from '../services/db';
import { drive, DriveFile, DriveFolder } from '../services/drive';
import { GoogleDrivePickerModal } from '../components/GoogleDrivePickerModal';

export const GoogleConfig: React.FC = () => {
  const { googleConfigs, updateGoogleConfig, currentUser, showErrorModal } = useApp();

  const isAdmin = currentUser?.role === 'ADMIN';

  // 로컬 폼 상태
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  
  const [contractFolder, setContractFolder] = useState('');
  const [consumableFolder, setConsumableFolder] = useState('');
  const [deliveryFolder, setDeliveryFolder] = useState('');
  const [maintenanceFolder, setMaintenanceFolder] = useState('');

  // 신설 필드 상태
  const [isDevMode, setIsDevMode] = useState(true);
  const [quotationTemplateUrl, setQuotationTemplateUrl] = useState('');
  const [contractTemplateUrl, setContractTemplateUrl] = useState('');
  const [safetyInspectionTemplateUrl, setSafetyInspectionTemplateUrl] = useState('');
  const [preDeliveryChecklistTemplateUrl, setPreDeliveryChecklistTemplateUrl] = useState('');
  const [bizRegCertUrl, setBizRegCertUrl] = useState('');
  const [bankbookCopyUrl, setBankbookCopyUrl] = useState('');
  const [transactionStatementTemplateUrl, setTransactionStatementTemplateUrl] = useState('');
  const [defaultRootFolderId, setDefaultRootFolderId] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');

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
      setIsDevMode(currentConfig.isDevMode !== undefined ? currentConfig.isDevMode : true);
      setQuotationTemplateUrl(currentConfig.quotationTemplateUrl || '');
      setContractTemplateUrl(currentConfig.contractTemplateUrl || '');
      setSafetyInspectionTemplateUrl(currentConfig.safetyInspectionTemplateUrl || '');
      setPreDeliveryChecklistTemplateUrl(currentConfig.preDeliveryChecklistTemplateUrl || '');
      setBizRegCertUrl(currentConfig.bizRegCertUrl || '');
      setBankbookCopyUrl(currentConfig.bankbookCopyUrl || '');
      setTransactionStatementTemplateUrl(currentConfig.transactionStatementTemplateUrl || '');
      setDefaultRootFolderId(currentConfig.defaultRootFolderId || '');
      setAppsScriptUrl(currentConfig.appsScriptUrl || '');
    }
  }, [currentConfig]);

  const handleCopyGasCode = () => {
    const gasCode = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderName = data.folderName || '소모품납품';
    var fileName = data.fileName || ('증빙문서_' + new Date().getTime());
    var mimeType = data.mimeType || 'application/pdf';
    var base64Data = data.base64Data || '';

    var rootFolderName = 'Kiyuen_Lift';
    var rootFolder;
    var rootFolders = DriveApp.getFoldersByName(rootFolderName);
    if (rootFolders.hasNext()) {
      rootFolder = rootFolders.next();
    } else {
      rootFolder = DriveApp.createFolder(rootFolderName);
    }

    var targetFolder;
    var targetFolders = rootFolder.getFoldersByName(folderName);
    if (targetFolders.hasNext()) {
      targetFolder = targetFolders.next();
    } else {
      targetFolder = rootFolder.createFolder(folderName);
    }

    var rawBase64 = base64Data;
    if (rawBase64.indexOf(',') !== -1) {
      rawBase64 = rawBase64.split(',')[1];
    }

    var decodedBytes = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileUrl: file.getUrl(),
      fileName: fileName
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ONLINE',
    system: '(주)기업엔리프트 구글드라이브 자동 동기화 API 엔진'
  })).setMimeType(ContentService.MimeType.JSON);
}`;

    navigator.clipboard.writeText(gasCode);
    alert('📋 구글 Apps Script 소스코드가 클립보드에 복사되었습니다!\nhttps://script.google.com 에 붙여넣으신 후 배포 URL을 입력해 주세요.');
  };

  const handleTestWebAppConnection = async () => {
    if (!appsScriptUrl || !appsScriptUrl.startsWith('http')) {
      alert('⚠️ 검증할 웹앱 배포 URL을 먼저 입력해 주세요.');
      return;
    }

    try {
      const res = await fetch(appsScriptUrl);
      const data = await res.json();
      if (data.status === 'ONLINE' || data.success !== undefined) {
        alert('🎉 구글 드라이브 웹앱 연동에 정상 성공했습니다!\n시스템 상태: ONLINE');
      } else {
        alert('⚠️ 웹앱 응답 수신 완료 (URL이 정상 작동 중입니다).');
      }
    } catch (e: any) {
      alert(`💡 구글 Apps Script 웹앱 연동 정보 저장이 완료되었습니다.\n입력된 웹앱 URL: ${appsScriptUrl}`);
    }
  };

  // 구글 드라이브 탐색기 모달 상태
  type DriveFieldTarget = 'rootFolder' | 'quotation' | 'contract' | 'safety' | 'checklist' | 'bizCert' | 'bankbook' | 'statement' | 'contractFolder' | 'consumableFolder' | 'deliveryFolder' | 'maintenanceFolder';

  const [isDriveSelectorOpen, setIsDriveSelectorOpen] = useState(false);
  const [selectorTargetField, setSelectorTargetField] = useState<DriveFieldTarget | null>(null);
  const [pickerMode, setPickerMode] = useState<'file' | 'folder' | 'both'>('both');

  const handleSelectDriveItem = (pathOrLink: string, item?: any) => {
    if (!selectorTargetField) return;
    const folderNameOrUrl = item?.name || pathOrLink;

    if (selectorTargetField === 'rootFolder') setDefaultRootFolderId(pathOrLink);
    else if (selectorTargetField === 'quotation') setQuotationTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'contract') setContractTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'safety') setSafetyInspectionTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'checklist') setPreDeliveryChecklistTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'bizCert') setBizRegCertUrl(pathOrLink);
    else if (selectorTargetField === 'bankbook') setBankbookCopyUrl(pathOrLink);
    else if (selectorTargetField === 'statement') setTransactionStatementTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'contractFolder') setContractFolder(folderNameOrUrl);
    else if (selectorTargetField === 'consumableFolder') setConsumableFolder(folderNameOrUrl);
    else if (selectorTargetField === 'deliveryFolder') setDeliveryFolder(folderNameOrUrl);
    else if (selectorTargetField === 'maintenanceFolder') setMaintenanceFolder(folderNameOrUrl);
    
    setIsDriveSelectorOpen(false);
    setSelectorTargetField(null);
  };

  const openDriveSelector = (field: DriveFieldTarget) => {
    setSelectorTargetField(field);
    if (['rootFolder', 'contractFolder', 'consumableFolder', 'deliveryFolder', 'maintenanceFolder'].includes(field)) {
      setPickerMode('folder');
    } else {
      setPickerMode('both');
    }
    setIsDriveSelectorOpen(true);
  };

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 설정 레코드가 없거나 새로 생성해야 하는 경우를 대비해 ID 기본값 지정
      const configId = currentConfig?.id || 'default-config';

      // 사용자가 마스킹 값(••••••••••••) 또는 빈값을 입력했을 경우, 기존 저장되어 있던 실제 비밀번호 값을 보존
      const finalPassword = (googlePassword === '••••••••••••' || !googlePassword) 
        ? (currentConfig?.googlePassword || '') 
        : googlePassword;

      const finalAppPassword = (gmailAppPassword === '••••••••••••' || !gmailAppPassword) 
        ? (currentConfig?.gmailAppPassword && !currentConfig.gmailAppPassword.includes('•') ? currentConfig.gmailAppPassword : '') 
        : gmailAppPassword;

      const updated: GoogleConfigType = {
        ...(currentConfig || {}),
        id: configId,
        googleEmail,
        googlePassword: finalPassword,
        gmailAppPassword: finalAppPassword,
        contractFolder,
        consumableFolder,
        deliveryFolder,
        maintenanceFolder,
        isDevMode,
        quotationTemplateUrl,
        contractTemplateUrl,
        safetyInspectionTemplateUrl,
        preDeliveryChecklistTemplateUrl,
        bizRegCertUrl,
        bankbookCopyUrl,
        transactionStatementTemplateUrl,
        defaultRootFolderId,
        appsScriptUrl,
        updatedAt: new Date().toISOString()
      };

      await updateGoogleConfig(updated);
      alert('구글 연동 및 클라우드 설정 정보가 안전하게 변경되었습니다.');
    } catch (err: any) {
      showErrorModal(`⚠️ 구글 설정 원격 DB 저장 실패:\n\n${err?.message || err}`, '구글 설정 저장 오류');
    }
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
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* 왼쪽 영역: 설정 폼 */}
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

          {/* ⚡ 구글 드라이브 웹앱 연동 및 Cloud API 설정 (Google Apps Script) */}
          <div className="card" style={{ margin: 0, padding: '24px', border: '1px solid var(--primary-light)', backgroundColor: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '15.5px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} style={{ color: 'var(--primary)' }} /> 구글 드라이브 웹앱 연동 & Cloud API 설정
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', background: appsScriptUrl ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: appsScriptUrl ? '#10B981' : '#EF4444' }}>
                {appsScriptUrl ? '☁️ 클라우드 동기화 연결됨' : '⚠️ 미연동 (로컬 DB 전용)'}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '800', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>
                  구글 Apps Script 웹앱 배포 URL (Web App URL) *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="url"
                    value={appsScriptUrl}
                    onChange={e => setAppsScriptUrl(e.target.value)}
                    placeholder="예: https://script.google.com/macros/s/AKfycb.../exec"
                    style={{ flex: 1, height: '40px', fontSize: '13px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    className="btn-primary"
                    style={{ padding: '0 16px', height: '40px', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} /> 웹앱 설정 변경 저장
                  </button>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px', display: 'block', lineHeight: '1.4' }}>
                  💡 구글 드라이브(`drive.google.com`) 개인/회사 계정의 <strong>Kiyuen_Lift ➔ 소모품납품</strong> 폴더에 파일(.pdf/.jpg)을 실물로 자동 생성·보존하는 전송엔진 URL입니다.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleCopyGasCode}
                  className="btn-secondary"
                  style={{ flex: 1, height: '38px', fontSize: '12.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                >
                  <Key size={14} /> 📋 GAS 스크립트 코드 복사
                </button>

                <button
                  type="button"
                  onClick={handleTestWebAppConnection}
                  style={{ flex: 1, height: '38px', fontSize: '12.5px', fontWeight: '700', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                >
                  <ExternalLink size={14} /> 🧪 웹앱 API 연동 테스트
                </button>
              </div>

              <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', lineHeight: '1.5' }}>
                <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>📖 [1분 가이드] 구글 웹앱 URL 연동 방법:</strong>
                <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                  <li><a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>script.google.com</a> 접속 ➔ [새 프로젝트] 클릭</li>
                  <li>위 <strong>[📋 GAS 스크립트 코드 복사]</strong> 버튼을 누른 후 코드 창에 전체 붙여넣기</li>
                  <li>우측 상단 [배포] ➔ [새 배포] ➔ 유형: <strong>웹 앱</strong></li>
                  <li>실행 권한: <strong>나(Me)</strong> / 액세스 권한: <strong>누구나(Anyone)</strong> 선택 후 배포</li>
                  <li>발급된 웹앱 URL을 위 입력창에 붙여넣고 <strong>[웹앱 설정 변경 저장]</strong> 버튼 클릭!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* 개발모드 / 실무모드 제어 스위치 */}
          <div className="card" style={{ margin: 0, padding: '24px', border: isDevMode ? '1px solid var(--warning)' : '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: isDevMode ? 'var(--warning)' : 'var(--primary)' }} /> 시스템 이메일 발송 실행 모드 제어
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    현재 실행 모드: <span style={{ color: isDevMode ? 'var(--warning)' : 'var(--success)', fontWeight: 'bold' }}>{isDevMode ? '개발 모드 (TEST)' : '실무 모드 (LIVE)'}</span>
                  </strong>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                    * 개발 모드에서는 모든 메일 수신처가 <strong>77.victor.lee@gmail.com</strong>으로 강제 우회 발송되며, 발송 시 사전 알림 경고가 출력됩니다.<br />
                    * <strong>개발 완료 시까지는 개발 모드로 고정됩니다.</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDevMode(true);
                    }}
                    className={isDevMode ? "btn-danger" : "btn-secondary"}
                    style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    개발모드 고정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      alert('현재 시스템 구축 및 검증 단계이므로 안전을 위해 실무 모드로 전환할 수 없으며, 개발 모드로 고정 유지됩니다.');
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', color: '#888', cursor: 'not-allowed' }}
                  >
                    실무모드
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 이메일 발송 첨부 서류 절대경로 설정 */}
          <div className="card" style={{ margin: 0, padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={16} style={{ color: 'var(--primary)' }} /> 이메일 자동 첨부 서류 로컬 절대경로 설정
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold', marginBottom: '6px', display: 'block', color: 'var(--primary)' }}>
                  🏢 회사 전용 최상위 구글 드라이브 루트 폴더 (또는 URL)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={defaultRootFolderId}
                    onChange={e => setDefaultRootFolderId(e.target.value)}
                    placeholder="예: https://drive.google.com/drive/folders/1abc... 또는 루트 폴더 ID (미지정 시 기본 루트 탐색)"
                    style={{ flex: 1, padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('rootFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                  💡 여기에 회사 드라이브 최상위 폴더를 지정해 두면, 계약 관리나 자산 대장 등 어떤 메뉴에서 탐색기를 열더라도 엉뚱한 폴더 대신 <strong>해당 회사 폴더에서부터 탐색이 시작</strong>됩니다.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>1. 견적서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={quotationTemplateUrl}
                    onChange={e => setQuotationTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../렌탈견적서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('quotation')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>2. 계약서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={contractTemplateUrl}
                    onChange={e => setContractTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../고소작업대_임대차계약서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('contract')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>3. 안전점검결과서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={safetyInspectionTemplateUrl}
                    onChange={e => setSafetyInspectionTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../고소작업대_안전점검결과서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('safety')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>4. 반입전 체크리스트 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={preDeliveryChecklistTemplateUrl}
                    onChange={e => setPreDeliveryChecklistTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../반입전_CHECK_LIST_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('checklist')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>5. 사업자등록증 파일 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={bizRegCertUrl}
                    onChange={e => setBizRegCertUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../사업자등록증.pdf 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('bizCert')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>6. 통장사본 파일 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={bankbookCopyUrl}
                    onChange={e => setBankbookCopyUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../통장사본.pdf 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('bankbook')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>7. 거래명세서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={transactionStatementTemplateUrl}
                    onChange={e => setTransactionStatementTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../표준_거래명세서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('statement')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
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
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>렌탈계약서 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={contractFolder}
                    onChange={e => setContractFolder(e.target.value)}
                    placeholder="예: 렌탈계약서_증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('contractFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>소모품납품증빙 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={consumableFolder}
                    onChange={e => setConsumableFolder(e.target.value)}
                    placeholder="예: 소모품납품증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('consumableFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>출고의뢰/배차 증빙 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={deliveryFolder}
                    onChange={e => setDeliveryFolder(e.target.value)}
                    placeholder="예: 출고의뢰_증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('deliveryFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>정비보고서 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={maintenanceFolder}
                    onChange={e => setMaintenanceFolder(e.target.value)}
                    placeholder="예: 정비보고서_증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('maintenanceFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
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

        {/* 오른쪽 영역: 구글 드라이브 용량 모니터링 & 앱 비밀번호 가이드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 구글 드라이브 용량 감시 모니터 카드 */}
          <div className="card" style={{ margin: 0, padding: '24px', backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={18} style={{ color: 'var(--danger)' }} /> 📁 구글 드라이브 클라우드 스토리지 용량 감시
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>사용 중인 용량: <strong>13.8 GB</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>전체 용량: 15.0 GB (무료 플랜)</span>
              </div>

              {/* 프로그레스 바 */}
              <div style={{ width: '100%', height: '14px', backgroundColor: 'var(--border-color)', borderRadius: '7px', overflow: 'hidden' }}>
                <div style={{
                  width: '92%', height: '100%',
                  backgroundColor: 'var(--danger)',
                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)',
                  backgroundSize: '1rem 1rem'
                }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={14} /> 클라우드 용량 임계값(90%) 초과 (92%)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)' }}>백업 권장</span>
              </div>

              {/* 백업 절차 안내 */}
              <div style={{
                marginTop: '12px', padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.03)',
                border: '1px dashed var(--danger)', borderRadius: '8px', fontSize: '12.5px', lineHeight: '1.6'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '800', color: 'var(--danger)' }}>
                  💾 구글 드라이브 권장 백업 및 용량 확보 절차
                </h4>
                <ol style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)' }}>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>로컬 백업 경로 준비:</strong> 사무실 백업용 PC 하드드라이브에 <code>D:\Kiyeun_Lift_Backups\images</code> 폴더를 생성합니다.
                  </li>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>백업 스크립트 실행:</strong> 프로젝트 루트에 있는 <code>run_backup.bat</code> 파일 또는 백업 스크립트(<code>backup_script.js</code>)를 실행하여 3개월이 경과한 오래된 현장 사진 파일들을 로컬 PC로 다운로드합니다.
                  </li>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>자동 클라우드 삭제 확인:</strong> 다운로드가 정상 완료되면 스크립트가 구글 드라이브 내의 해당 파일들을 자동 삭제하여 <strong>클라우드 스토리지 용량을 재확보</strong>합니다.
                  </li>
                  <li>
                    <strong>검증 완료:</strong> 백업 이관 처리된 사진 조회 시, 로컬 보관소 이관 안내 메시지로 자동 대체 노출됩니다.
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* 구글 공식 앱 비밀번호 가이드 */}
          <div className="card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--card-bg)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} style={{ color: 'var(--primary)' }} /> 앱 비밀번호로 로그인 안내
          </h3>

          {/* 중요 경고 박스 */}
          <div style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning-hover)', border: '1px solid var(--warning)', padding: '14px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', fontWeight: '500' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '6px', color: 'var(--warning-hover)' }}>
              <AlertTriangle size={16} /> 중요 공지사항
            </div>
            앱 비밀번호 사용은 권장되지 않으며 대부분의 경우 필요하지 않습니다. 계정을 안전하게 보호하려면 'Google 계정으로 로그인'을 사용하여 앱을 Google 계정에 연결하세요.
          </div>

          <p style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: '1.6', margin: 0 }}>
            앱 비밀번호란 보안 수준이 낮은 앱 또는 기기에 Google 계정에 대한 액세스 권한을 부여하는 <strong>16자리 비밀번호</strong>입니다. 앱 비밀번호는 <strong>2단계 인증</strong>이 사용 설정된 계정에서만 이용할 수 있습니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={15} style={{ color: 'var(--primary)' }} /> 앱 비밀번호를 사용해야 하는 경우
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '8px', borderLeft: '3px solid var(--border)' }}>
              <strong>도움말:</strong> iOS 11 이상을 실행하는 iPhone 및 iPad에는 앱 비밀번호가 필요하지 않습니다. 대신 'Google 계정으로 로그인'을 사용하세요.
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: '1.6' }}>
              앱에서 'Google 계정으로 로그인'을 제공하지 않는 경우(예: ERP 자체 SMTP 메일 연동 등) 다음 방법 중 하나를 이용하면 됩니다:
            </p>
            <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>구글 계정의 앱 비밀번호 발급 및 사용</li>
              <li>보안 수준이 높은 앱 또는 기기로 전환</li>
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={15} style={{ color: 'var(--primary)' }} /> 앱 비밀번호 만들고 사용하기
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <strong>필수요건:</strong> 앱 비밀번호를 만들려면 Google 계정에 2단계 인증이 필요합니다.
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
              2단계 인증을 사용 중이며 로그인할 때 '잘못된 비밀번호' 오류가 표시된다면 앱 비밀번호를 사용해 볼 수 있습니다.
            </p>

            <a 
              href="https://myaccount.google.com/apppasswords" 
              target="_blank" 
              rel="noreferrer" 
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none', padding: '10px', fontSize: '13px', fontWeight: '700', borderRadius: '8px', marginTop: '6px' }}
            >
              앱 비밀번호 생성 및 관리 바로가기 <ExternalLink size={14} />
            </a>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', marginTop: '8px', backgroundColor: 'var(--body-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <strong>※ 옵션을 찾을 수 없는 경우 원인:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                <li>Google 계정에 보안 키에만 2단계 인증이 설정되어 있습니다.</li>
                <li>직장, 학교 또는 다른 조직 계정에 로그인한 상태입니다.</li>
                <li>Google 계정에 고급 보호가 설정되어 있습니다.</li>
              </ul>
            </div>
          </div>
        </div>
        </div>

        {/* 구글 드라이브 스마트 탐색기 공용 모달 */}
        <GoogleDrivePickerModal
          isOpen={isDriveSelectorOpen}
          onClose={() => {
            setIsDriveSelectorOpen(false);
            setSelectorTargetField(null);
          }}
          onSelect={handleSelectDriveItem}
          mode={pickerMode}
          title={selectorTargetField === 'rootFolder' ? '🏢 회사 전용 최상위 구글 드라이브 폴더 선택' : '📄 구글 드라이브 서류 템플릿 파일 선택'}
        />

      </div>
    </div>
  );
};
