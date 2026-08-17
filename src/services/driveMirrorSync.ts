// src/services/driveMirrorSync.ts
// (주)기연리프트 구글 드라이브 ➔ 로컬 PC (C:\KiyeunAgent\drive_mirror\) 실시간 미러링 동기화 엔진

import { GoogleConfig } from './db';
import { extractDriveFileId, getDriveReadToken } from './googleDriveBackup';

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
 * 구글 드라이브 원본 서식/증빙 파일들을 로컬 에이전트로 일괄 미러링 동기화
 */
export async function executeDriveMirrorSync(
  config?: GoogleConfig,
  onProgress?: (msg: string, current: number, total: number) => void
): Promise<MirrorSyncResult> {
  const targetItems: Array<{ label: string; url?: string; ext: string }> = [
    { label: '사업자등록증', url: config?.bizRegCertUrl, ext: 'pdf' },
    { label: '통장사본', url: config?.bankbookCopyUrl, ext: 'pdf' },
    { label: '안전점검결과서_양식', url: config?.safetyInspectionTemplateUrl, ext: 'xlsx' },
    { label: '임대차계약서_양식', url: config?.contractTemplateUrl, ext: 'pdf' },
    { label: '반입전체크리스트_양식', url: config?.preDeliveryChecklistTemplateUrl, ext: 'pdf' },
    { label: '견적서_양식', url: config?.quotationTemplateUrl, ext: 'pdf' },
    { label: '거래명세서_양식', url: config?.transactionStatementTemplateUrl, ext: 'pdf' }
  ];

  const validItems = targetItems
    .map(item => ({
      ...item,
      fileId: item.url ? extractDriveFileId(item.url) : null
    }))
    .filter((item): item is { label: string; url: string; ext: string; fileId: string } => !!item.fileId);

  if (validItems.length === 0) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      files: [],
      message: '⚠️ 구글 설정에 등록된 원본 드라이브 파일 링크가 없습니다.'
    };
  }

  const appsScriptUrl = config?.appsScriptUrl?.trim();
  let token: string | undefined;

  if (!appsScriptUrl) {
    const clientId = config?.oauthClientId?.trim() || '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com';
    try {
      token = await getDriveReadToken(clientId);
    } catch (e: any) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: validItems.length,
        files: [],
        message: `구글 인증 실패: ${e?.message || e}`
      };
    }
  }

  const payloadFiles: Array<{ name: string; base64Content: string; modifiedTime: string }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    const fileName = `${item.label}.${item.ext}`;
    onProgress?.(`${item.label} 다운로드 중...`, i + 1, validItems.length);

    try {
      let fileBytes: ArrayBuffer;

      if (appsScriptUrl) {
        // Apps Script 웹앱 프록시를 통한 무팝업 고속 다운로드
        const fetchUrl = `${appsScriptUrl}?action=download&fileId=${encodeURIComponent(item.fileId)}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Apps Script 응답 오류 HTTP ${res.status}`);
        fileBytes = await res.arrayBuffer();
      } else if (token) {
        // OAuth Token 직접 호출
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${item.fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Google API 응답 오류 HTTP ${res.status}`);
        fileBytes = await res.arrayBuffer();
      } else {
        throw new Error('인증 수단 없음');
      }

      const b64 = arrayBufferToBase64(fileBytes);
      payloadFiles.push({
        name: fileName,
        base64Content: b64,
        modifiedTime: new Date().toISOString()
      });
      successCount++;
    } catch (err) {
      console.warn(`⚠️ [미러링 다운로드 실패] ${item.label}:`, err);
      failCount++;
    }
  }

  if (payloadFiles.length === 0) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: failCount,
      files: [],
      message: '다운로드된 파일이 없어 미러링을 완료하지 못했습니다.'
    };
  }

  onProgress?.('로컬 에이전트(C:\\KiyeunAgent\\drive_mirror\\)로 전송 중...', payloadFiles.length, validItems.length);

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
      message: `✅ 구글 드라이브 ${successCount}개 파일이 C:\\KiyeunAgent\\drive_mirror\\ 에 실시간 복제되었습니다.`
    };
  } catch (err: any) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: validItems.length,
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
