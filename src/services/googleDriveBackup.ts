/**
 * Google Drive 증빙 파일 일괄 백업 서비스 (월 1회 수동 실행용)
 * - 일상 업로드와 완전 분리: 이 서비스는 백업 버튼 클릭 시에만 사용
 * - Supabase Storage → Google Drive 폴더로 일괄 전송
 * - OAuth 팝업은 백업 실행 시 1회만 발생
 */

declare global {
  interface Window { google?: any; }
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API   = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

// ─────────────────────────────────────────────────────────────────────────────
// 1. GIS 스크립트 로드
// ─────────────────────────────────────────────────────────────────────────────
function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google Identity Services 로드 실패'));
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 백업용 Access Token 발급 (팝업 1회 - 백업 실행 시)
// ─────────────────────────────────────────────────────────────────────────────
function getBackupToken(clientId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    await loadGIS().catch(reject);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (res: any) => {
        if (res.error) { reject(new Error(`구글 인증 오류: ${res.error}`)); return; }
        resolve(res.access_token);
      }
    });
    // 백업 실행 시 계정 선택 팝업 표시 (의도적)
    client.requestAccessToken({ prompt: '' });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 구글 드라이브 루트에서 폴더 검색 (없으면 오류)
// ─────────────────────────────────────────────────────────────────────────────
async function findDriveFolder(token: string, folderName: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false and 'root' in parents`;
  const res = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0].id;
  throw new Error(
    `구글 드라이브에 "${folderName}" 폴더가 없습니다.\n` +
    `drive.google.com에서 해당 폴더를 먼저 만들고 다시 시도해 주세요.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 단일 파일 업로드 → Drive webViewLink 반환
// ─────────────────────────────────────────────────────────────────────────────
async function uploadOneFile(token: string, fileName: string, blob: Blob, folderId: string): Promise<string> {
  const meta = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);
  const res = await fetch(UPLOAD_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || res.statusText);
  }
  const data = await res.json();
  // webViewLink 가 없으면 폴더 URL로 대체
  return data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 메인: Supabase Storage URL 목록 → 구글 드라이브 일괄 백업
// ─────────────────────────────────────────────────────────────────────────────
export interface BackupItem {
  fileName: string;
  fileUrl: string;
}

export interface BackupResult {
  total: number;
  success: number;
  fail: number;
  failedFiles: string[];
  /** 원본 Supabase URL → Drive webViewLink 맵핑 (성공한 파일만) */
  successUrlMap: Map<string, string>;
}

export async function backupToGoogleDrive(
  items: BackupItem[],
  clientId: string,
  folderName: string,
  onProgress?: (done: number, total: number) => void
): Promise<BackupResult> {
  if (!clientId?.trim()) {
    throw new Error(
      '구글 드라이브 백업을 위한 OAuth Client ID가 설정되지 않았습니다.\n' +
      '[구글 드라이브 설정] → [구글 드라이브 백업 설정]에서 Client ID를 먼저 등록해 주세요.'
    );
  }
  if (items.length === 0) {
    throw new Error('백업할 증빙 파일이 없습니다.');
  }

  // 팝업 1회 (백업 트리거 시)
  const token = await getBackupToken(clientId);
  const folderId = await findDriveFolder(token, folderName);

  const result: BackupResult = { total: items.length, success: 0, fail: 0, failedFiles: [], successUrlMap: new Map() };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const fetchRes = await fetch(item.fileUrl);
      if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
      const blob = await fetchRes.blob();
      const driveUrl = await uploadOneFile(token, item.fileName, blob, folderId);
      result.successUrlMap.set(item.fileUrl, driveUrl);
      result.success++;
    } catch {
      result.fail++;
      result.failedFiles.push(item.fileName);
    }
    onProgress?.(i + 1, items.length);
  }

  return result;
}
