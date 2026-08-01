/**
 * Google Drive OAuth 2.0 직접 업로드 서비스
 * - Google Identity Services(GIS) 라이브러리를 동적으로 로드
 * - 브라우저 팝업으로 구글 계정 1회 로그인 → Access Token 발급
 * - Google Drive API v3 Multipart Upload로 실물 파일 직접 전송
 * - 폴더 없으면 자동 생성
 */

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export interface DriveOAuthUploadOptions {
  file: File;
  fileName: string;
  folderName: string;
  clientId: string;
}

export interface DriveOAuthUploadResult {
  success: boolean;
  fileUrl: string;
  fileId?: string;
  fileName: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 내부 상태: Access Token 캐시
// ─────────────────────────────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenClient: any = null;

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';

// ─────────────────────────────────────────────────────────────────────────────
// 1. GIS 스크립트 동적 로드
// ─────────────────────────────────────────────────────────────────────────────
function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services 스크립트 로드 실패'));
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Access Token 발급 (브라우저 팝업 로그인)
// ─────────────────────────────────────────────────────────────────────────────
function getAccessToken(clientId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGIS();
    } catch (e) {
      reject(e);
      return;
    }

    // 이미 유효한 토큰이 있으면 재사용
    if (_cachedToken) {
      resolve(_cachedToken);
      return;
    }

    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(`구글 인증 오류: ${tokenResponse.error}`));
          return;
        }
        _cachedToken = tokenResponse.access_token;

        // 토큰 만료 시 자동 초기화 (기본 1시간)
        setTimeout(() => { _cachedToken = null; }, (tokenResponse.expires_in - 60) * 1000);

        resolve(_cachedToken!);
      }
    });

    // 팝업 표시
    _tokenClient.requestAccessToken({ prompt: _cachedToken ? '' : 'consent' });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Google Drive 폴더 ID 조회 (없으면 생성)
// ─────────────────────────────────────────────────────────────────────────────
async function findFolder(token: string, folderName: string): Promise<string> {
  // 드라이브 루트에서 정확히 일치하는 폴더 검색 (자동 생성 없음)
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false and 'root' in parents`;

  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=createdTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 폴더가 없으면 오류 - 임의 생성하지 않음
  throw new Error(
    `구글 드라이브에 "${folderName}" 폴더가 존재하지 않습니다.\n\n` +
    `구글 드라이브(drive.google.com)에서 해당 폴더를 먼저 만든 후 다시 시도하거나,\n` +
    `[시스템 관리] → [구글 드라이브 설정]에서 폴더명을 실제 드라이브 폴더명과 일치시켜 주세요.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 파일 Multipart 업로드
// ─────────────────────────────────────────────────────────────────────────────
async function uploadFileToDrive(
  token: string,
  file: File,
  fileName: string,
  folderId: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    mimeType: file.type || 'application/octet-stream',
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(UPLOAD_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(`Drive 업로드 실패: ${errData?.error?.message || res.statusText}`);
  }

  return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 외부 호출 메인 함수
// ─────────────────────────────────────────────────────────────────────────────
export async function uploadToGoogleDriveOAuth(
  options: DriveOAuthUploadOptions
): Promise<DriveOAuthUploadResult> {
  const { file, fileName, folderName, clientId } = options;

  if (!clientId || !clientId.trim()) {
    throw new Error('구글 클라이언트 ID(OAuth Client ID)가 설정되지 않았습니다.\n구글 드라이브 설정 메뉴에서 Client ID를 등록해 주세요.');
  }

  // 1. 브라우저 팝업으로 구글 로그인 → Access Token
  const token = await getAccessToken(clientId);

  // 2. 설정에서 지정한 폴더명을 드라이브 루트에서 검색 (폴더 없으면 즉시 오류)
  const targetFolderId = await findFolder(token, folderName);

  // 3. 파일 업로드
  const uploaded = await uploadFileToDrive(token, file, fileName, targetFolderId);

  const fileUrl = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;

  return {
    success: true,
    fileUrl,
    fileId: uploaded.id,
    fileName,
    message: `구글 드라이브 [${folderName}]에 실물 파일 업로드 완료`
  };
}

// 토큰 강제 초기화 (로그아웃 등)
export function clearGoogleOAuthToken(): void {
  _cachedToken = null;
  _tokenClient = null;
}
