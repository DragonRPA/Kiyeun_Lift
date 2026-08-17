// src/services/driveMirrorSync.ts
// (주)기연리프트 구글 드라이브 ➔ 로컬 PC (C:\KiyeunAgent\drive_mirror\) 실시간 미러링 동기화 엔진

import { GoogleConfig } from './db';
import { extractDriveFileId, extractDriveFolderId, listFilesInDriveFolder, getDriveReadToken } from './googleDriveBackup';

export interface MirrorSyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  files: Array<{ name: string; size: number }>;
  message: string;
}

/**
 * ArrayBuffer -> Base64 변환
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 구글 드라이브 루트 폴더 및 등록된 서식/증빙 파일들을 로컬 에이전트로 일괄 미러링 동기화
 */
export async function executeDriveMirrorSync(
  config?: GoogleConfig,
  onProgress?: (msg: string, current: number, total: number) => void
): Promise<MirrorSyncResult> {
  const appsScriptUrl = config?.appsScriptUrl?.trim();
  const folderId = extractDriveFolderId(config?.defaultRootFolderId || '') || (config?.defaultRootFolderId?.includes('/') ? null : config?.defaultRootFolderId?.trim()) || '1aBZsZ1KnKhk9Ax6oiM2cb-yKfDHKGRif';
  const clientId = config?.oauthClientId?.trim() || '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com';

  let token: string | undefined;
  if (!appsScriptUrl) {
    try {
      token = await getDriveReadToken(clientId);
    } catch (e: any) {
      console.warn('구글 토큰 획득 건너뜀 (내장 템플릿 우선 동기화):', e);
    }
  }

  const payloadFiles: Array<{ name: string; base64Content: string; modifiedTime: string }> = [];
  let successCount = 0;
  let failCount = 0;

  // ── 1. 구글 드라이브 루트 폴더 내의 모든 원본 파일 리스팅 및 다운로드 ──
  if (token && folderId && folderId !== 'root') {
    onProgress?.('구글 드라이브 폴더 내 원본 파일 목록 검색 중...', 1, 10);
    try {
      const driveFiles = await listFilesInDriveFolder(folderId, token);
      for (let i = 0; i < driveFiles.length; i++) {
        const file = driveFiles[i];
        onProgress?.(`구글 드라이브 [${i + 1}/${driveFiles.length}] ${file.name} 수신 중...`, i + 1, driveFiles.length);
        try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const buf = await res.arrayBuffer();
            payloadFiles.push({
              name: file.name,
              base64Content: arrayBufferToBase64(buf),
              modifiedTime: new Date().toISOString()
            });
            successCount++;
          }
        } catch (err) {
          console.warn(`⚠️ 구글 파일 다운로드 실패 (${file.name}):`, err);
          failCount++;
        }
      }
    } catch (e) {
      console.warn('⚠️ 구글 드라이브 폴더 리스팅 실패:', e);
    }
  }

  // ── 2. 개별 URL 지정 파일 다운로드 ──
  const specificItems = [
    { label: '사업자등록증', url: config?.bizRegCertUrl, ext: 'pdf' },
    { label: '통장사본', url: config?.bankbookCopyUrl, ext: 'pdf' },
    { label: '안전점검결과서_양식', url: config?.safetyInspectionTemplateUrl, ext: 'xlsx' },
    { label: '임대차계약서_양식', url: config?.contractTemplateUrl, ext: 'pdf' },
    { label: '반입전체크리스트_양식', url: config?.preDeliveryChecklistTemplateUrl, ext: 'pdf' },
    { label: '견적서_양식', url: config?.quotationTemplateUrl, ext: 'pdf' },
    { label: '거래명세서_양식', url: config?.transactionStatementTemplateUrl, ext: 'pdf' }
  ];

  for (const item of specificItems) {
    const fileId = item.url ? extractDriveFileId(item.url) : null;
    if (!fileId) continue;
    const fileName = `${item.label}.${item.ext}`;
    if (payloadFiles.some(f => f.name === fileName)) continue; // 중복 방지

    onProgress?.(`${item.label} 개별 다운로드 중...`, payloadFiles.length + 1, payloadFiles.length + 5);
    try {
      let buf: ArrayBuffer | null = null;
      if (appsScriptUrl) {
        const res = await fetch(`${appsScriptUrl}?action=download&fileId=${encodeURIComponent(fileId)}`);
        if (res.ok) buf = await res.arrayBuffer();
      } else if (token) {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) buf = await res.arrayBuffer();
      }
      if (buf) {
        payloadFiles.push({
          name: fileName,
          base64Content: arrayBufferToBase64(buf),
          modifiedTime: new Date().toISOString()
        });
        successCount++;
      }
    } catch (err) {
      console.warn(`⚠️ 개별 파일 다운로드 실패 (${item.label}):`, err);
      failCount++;
    }
  }

  // ── 3. 시스템 내장 표준 양식 템플릿 동기화 (실제 존재하는 원본 서식 파일들) ──
  const builtinTemplates = [
    { name: '반입전체크리스트_양식_원본.pdf', url: '/templates/반입전체크리스트_양식_원본.pdf' },
    { name: '안전점검결과서_양식_원본.pdf', url: '/templates/안전점검결과서_양식_원본.pdf' },
    { name: '임대차계약서_양식_원본.pdf', url: '/templates/임대차계약서_양식_원본.pdf' },
    { name: '거래명세서양식.xlsx', url: '/거래명세서양식.xlsx' },
    { name: '렌탈견적서_양식.html', url: '/templates/렌탈견적서_양식.html' },
    { name: '고소작업대_임대차계약서_양식.html', url: '/templates/고소작업대_임대차계약서_양식.html' },
    { name: '고소작업대_안전점검결과서_양식.html', url: '/templates/고소작업대_안전점검결과서_양식.html' },
    { name: '반입전_CHECK_LIST_양식.html', url: '/templates/반입전_CHECK_LIST_양식.html' },
    { name: '거래명세서_양식.html', url: '/templates/거래명세서_양식.html' }
  ];

  for (const tpl of builtinTemplates) {
    if (payloadFiles.some(f => f.name === tpl.name)) continue;
    try {
      const res = await fetch(tpl.url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        payloadFiles.push({
          name: tpl.name,
          base64Content: arrayBufferToBase64(buf),
          modifiedTime: new Date().toISOString()
        });
        successCount++;
      }
    } catch (e) {}
  }

  if (payloadFiles.length === 0) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: failCount,
      files: [],
      message: '동기화할 대상 파일을 찾지 못했습니다.'
    };
  }

  onProgress?.(`로컬 에이전트(C:\\KiyeunAgent\\drive_mirror\\)로 ${payloadFiles.length}개 파일 전송 중...`, payloadFiles.length, payloadFiles.length);

  try {
    const agentRes = await fetch('http://127.0.0.1:5175/api/sync-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: payloadFiles })
    });

    if (!agentRes.ok) {
      throw new Error(`에이전트 응답 오류 HTTP ${agentRes.status}`);
    }

    const agentData = await agentRes.json();
    return {
      success: true,
      syncedCount: agentData.syncedCount || payloadFiles.length,
      failedCount: failCount,
      files: agentData.syncedFiles || payloadFiles.map(f => ({ name: f.name, size: f.base64Content.length })),
      message: `✅ 구글 드라이브 및 서식 총 ${payloadFiles.length}개 파일이 C:\\KiyeunAgent\\drive_mirror\\ 에 실시간 복제되었습니다.`
    };
  } catch (err: any) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: payloadFiles.length,
      files: [],
      message: `로컬 에이전트 미러링 저장 실패: ${err?.message || err}`
    };
  }
}

/**
 * 에이전트 로컬 미러링 폴더 내 파일 현황 조회
 */
export async function getLocalMirrorStatus(): Promise<{ success: boolean; files: Array<{ name: string; size: number; modifiedTime: string }>; mirrorPath?: string }> {
  try {
    const res = await fetch('http://127.0.0.1:5175/api/mirror-status', {
      method: 'GET',
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { success: false, files: [] };
}
