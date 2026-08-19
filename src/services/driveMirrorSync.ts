// src/services/driveMirrorSync.ts
// (주)기연리프트 Cloudflare R2 ➔ 로컬 PC (C:\KiyeunAgent\drive_mirror\) 단방향 미러링 동기화 엔진
// 원칙: CF R2가 유일한 마스터 원본(SSOT), 로컬 drive_mirror는 항상 CF R2를 따라가는 읽기 전용 사본

import { GoogleConfig } from './db';

export interface MirrorSyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  files: Array<{ name: string; size: number }>;
  message: string;
}

export interface MirrorProgressState {
  isActive: boolean;
  phase: 'IDLE' | 'SCANNING' | 'DOWNLOADING' | 'TRANSFERRING' | 'COMPLETED' | 'ERROR';
  currentFile: string;
  currentIndex: number;
  totalCount: number;
  percent: number;
  message: string;
}

type MirrorProgressListener = (state: MirrorProgressState) => void;
const listeners: Set<MirrorProgressListener> = new Set();

let currentState: MirrorProgressState = {
  isActive: false,
  phase: 'IDLE',
  currentFile: '',
  currentIndex: 0,
  totalCount: 0,
  percent: 0,
  message: ''
};

export function subscribeMirrorProgress(listener: MirrorProgressListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}

function updateProgress(partial: Partial<MirrorProgressState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach(fn => {
    try { fn(currentState); } catch (e) {}
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * CF R2 버킷 전체 파일 목록을 Vercel /api/r2 프록시를 통해 조회
 */
async function listR2AllFiles(config: GoogleConfig): Promise<Array<{ key: string; size: number }>> {
  const params = new URLSearchParams({
    action: 'list',
    accountId: config.r2AccountId || '',
    bucketName: config.r2BucketName || '',
    accessKeyId: config.r2AccessKeyId || '',
    secretAccessKey: config.r2SecretAccessKey || ''
  });

  const res = await fetch(`/api/r2?${params.toString()}`, {
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) throw new Error(`R2 목록 조회 실패: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'R2 목록 조회 실패');
  return data.files || [];
}

/**
 * CF R2 공개 URL을 통해 파일 직접 다운로드
 */
async function downloadFromR2(publicDomain: string, key: string): Promise<ArrayBuffer | null> {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = `${publicDomain.replace(/\/$/, '')}/${encodedKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      return ab.byteLength > 0 ? ab : null;
    }
  } catch (e) {}
  return null;
}

/**
 * CF R2 버킷 전체 파일을 로컬 에이전트로 미러링
 * - CF R2가 원본(SSOT), 로컬은 항상 원본을 단방향으로 덮어씌우는 사본
 * - 구글 드라이브, Apps Script, 내장 HTML 템플릿 일체 사용 안 함
 */
export async function executeDriveMirrorSync(
  config?: GoogleConfig,
  onProgress?: (msg: string, current: number, total: number) => void
): Promise<MirrorSyncResult> {
  const publicDomain = config?.r2PublicDomain?.trim();
  const r2AccountId = config?.r2AccountId?.trim();
  const r2BucketName = config?.r2BucketName?.trim();

  if (!publicDomain || !r2AccountId || !r2BucketName || !config?.r2AccessKeyId || !config?.r2SecretAccessKey) {
    const msg = 'CF R2 자격증명이 설정되지 않았습니다. [관리자 설정 > CF 스토리지 설정]을 확인하세요.';
    updateProgress({ isActive: false, phase: 'ERROR', message: msg });
    return { success: false, syncedCount: 0, failedCount: 0, files: [], message: msg };
  }

  updateProgress({
    isActive: true,
    phase: 'SCANNING',
    currentFile: 'CF R2 버킷 파일 목록 조회 중...',
    currentIndex: 0,
    totalCount: 0,
    percent: 5,
    message: `CF R2 [${r2BucketName}] 버킷 전체 목록 스캔 중...`
  });

  let r2Files: Array<{ key: string; size: number }> = [];
  try {
    r2Files = await listR2AllFiles(config!);
  } catch (err: any) {
    const msg = `CF R2 목록 조회 실패: ${err?.message || err}`;
    updateProgress({ isActive: false, phase: 'ERROR', message: msg });
    return { success: false, syncedCount: 0, failedCount: 0, files: [], message: msg };
  }

  if (r2Files.length === 0) {
    const msg = 'CF R2 버킷에 파일이 없습니다.';
    updateProgress({ isActive: false, phase: 'COMPLETED', message: msg });
    return { success: true, syncedCount: 0, failedCount: 0, files: [], message: msg };
  }

  updateProgress({
    phase: 'DOWNLOADING',
    totalCount: r2Files.length,
    percent: 10,
    message: `CF R2에서 ${r2Files.length}개 파일 수신 시작...`
  });

  const payloadFiles: Array<{ name: string; base64Content: string; modifiedTime: string }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < r2Files.length; i++) {
    const file = r2Files[i];
    updateProgress({
      phase: 'DOWNLOADING',
      currentFile: file.key,
      currentIndex: i + 1,
      percent: Math.min(85, Math.round(((i + 1) / r2Files.length) * 75) + 10),
      message: `[${i + 1}/${r2Files.length}] ${file.key} 수신 중...`
    });
    onProgress?.(`[${i + 1}/${r2Files.length}] ${file.key}`, i + 1, r2Files.length);

    try {
      const ab = await downloadFromR2(publicDomain, file.key);
      if (ab) {
        payloadFiles.push({
          name: file.key,
          base64Content: arrayBufferToBase64(ab),
          modifiedTime: new Date().toISOString()
        });
        successCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      failCount++;
    }
  }

  if (payloadFiles.length === 0) {
    const msg = 'CF R2 파일 다운로드에 모두 실패했습니다.';
    updateProgress({ isActive: false, phase: 'ERROR', message: msg });
    return { success: false, syncedCount: 0, failedCount: failCount, files: [], message: msg };
  }

  // 로컬 에이전트로 전송 (CF ➔ 로컬 단방향 덮어쓰기)
  updateProgress({
    phase: 'TRANSFERRING',
    currentFile: '로컬 에이전트 전송 중...',
    percent: 90,
    message: `로컬 C:\\KiyeunAgent\\drive_mirror\\ 에 ${payloadFiles.length}개 저장 중...`
  });

  try {
    const agentRes = await fetch('http://127.0.0.1:5175/api/sync-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: payloadFiles })
    });

    if (!agentRes.ok) throw new Error(`에이전트 오류 HTTP ${agentRes.status}`);

    const agentData = await agentRes.json();
    const finalMsg = `✅ CF R2 ${payloadFiles.length}개 파일이 C:\\KiyeunAgent\\drive_mirror\\ 에 미러링되었습니다.`;

    updateProgress({
      isActive: true,
      phase: 'COMPLETED',
      currentFile: '미러링 완료',
      percent: 100,
      message: finalMsg
    });

    setTimeout(() => {
      updateProgress({ isActive: false, phase: 'IDLE' });
    }, 4000);

    return {
      success: true,
      syncedCount: agentData.syncedCount || payloadFiles.length,
      failedCount: failCount,
      files: agentData.syncedFiles || payloadFiles.map(f => ({ name: f.name, size: f.base64Content.length })),
      message: finalMsg
    };
  } catch (err: any) {
    const errMsg = `로컬 에이전트 전송 실패: ${err?.message || err}`;
    updateProgress({ isActive: true, phase: 'ERROR', message: errMsg });
    setTimeout(() => {
      updateProgress({ isActive: false, phase: 'IDLE' });
    }, 5000);
    return {
      success: false,
      syncedCount: 0,
      failedCount: payloadFiles.length,
      files: [],
      message: errMsg
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


