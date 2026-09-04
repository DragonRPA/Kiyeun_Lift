// src/utils/nativeLauncher.ts
// 스마트폰(Android / iOS) 앱 딥링크, 클립보드 복사 및 전화걸기 안전 실행 유틸리티

export type NavAppType = 'TMAP' | 'KAKAO' | 'NAVER' | 'WEB';

// 🌟 연속 클릭으로 인한 OS 액티비티 충돌 및 데드락 방지 락 (2초)
let lastNavLaunchTime = 0;

/**
 * 모바일 클립보드 안전 복사 헬퍼 (iOS / Android / PWA 전 플랫폼 호환)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed:', err);
  }

  // 폴백: textarea execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback execCommand copy failed:', err);
    return false;
  }
}

/**
 * 화면 상단/하단 비간섭 안내 토스트 표출
 */
function showFloatingToast(message: string) {
  const existing = document.getElementById('nav-floating-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'nav-floating-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '90px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
  toast.style.color = '#38bdf8';
  toast.style.border = '1px solid rgba(56, 189, 248, 0.4)';
  toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5)';
  toast.style.padding = '10px 16px';
  toast.style.borderRadius = '12px';
  toast.style.fontSize = '12px';
  toast.style.fontWeight = 'bold';
  toast.style.zIndex = '99999';
  toast.style.textAlign = 'center';
  toast.style.whiteSpace = 'pre-line';
  toast.style.pointerEvents = 'none';
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3500);
}

/**
 * 안전한 길안내 내비게이션 앱 실행기
 * 
 * 📌 [T맵 연동 실패 원인 및 구조적 해결]:
 * 1. 일상에서 공유하는 티맵 링크(surl.tmap.co.kr)는 티맵 서버에 이미 저장된 목적지의 위도/경도(GPS 좌표)를 품고 있습니다.
 *    반면 당사 ERP DB에는 사용자가 입력한 문자열 텍스트 주소('창업로 42')만 존재합니다.
 * 2. 티맵의 길안내 스킴(tmap://route)은 위경도 숫자 좌표(goalx, goaly)가 없으면 경로 계산을 시작하지 못하고 메인 홈 화면만 엽니다.
 *    좌표가 없는 텍스트 주소는 티맵의 '검색 스킴(tmap://search?name=...)'으로 호출해야 검색창에 주소가 전달됩니다.
 * 3. 현장 상세 주소에 동/호수나 특수문자가 섞여 티맵 POI 검색이 빗나가는 경우를 100% 방지하기 위해,
 *    내비 버튼 클릭 즉시 목적지 주소를 스마트폰 클립보드에 자동 복사하여 필요 시 1-Click 붙여넣기를 보장합니다.
 */
export async function launchNavigation(destination: string, app: NavAppType = 'TMAP') {
  if (!destination || !destination.trim()) {
    alert('길안내 목적지 정보가 없습니다.');
    return;
  }

  // 1. 연속 클릭 방지 락 (2초 이내 중복 호출 차단)
  const now = Date.now();
  if (now - lastNavLaunchTime < 2000) {
    console.warn('내비게이션 호출 쿨다운 중입니다 (중복 호출 차단)');
    return;
  }
  lastNavLaunchTime = now;

  const cleanDest = destination.trim();

  // 2. 📋 스마트폰 클립보드에 고객/현장 주소 100% 선제적 자동 복사 (붙여넣기 대비)
  await copyToClipboard(cleanDest);
  showFloatingToast(`📋 현장 주소가 클립보드에 복사되었습니다!\n(T맵 검색창에 길게 눌러 바로 붙여넣기 가능)`);

  // 3. 검색 쿼리 정제 (부연 설명, 괄호, 층수 등 제거하여 T맵/내비 검색 성공률 극대화)
  const cleanSearchQuery = cleanDest
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/지하\s*\d+층|지상\s*\d+층|\d+층|하역장|게이트.*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || cleanDest;

  const encodedDest = encodeURIComponent(cleanSearchQuery);
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let targetUrl = '';

  if (app === 'TMAP') {
    // 💡 TMAP은 좌표 없는 문자열 주소 전달 시 'search' 스킴을 사용해야 검색창에 주소가 자동 입력됨
    targetUrl = `tmap://search?name=${encodedDest}`;
  } else if (app === 'KAKAO') {
    // 카카오내비 정식 길안내 모드 (텍스트 주소로도 내부 POI 길안내 자동 매핑)
    targetUrl = `kakaonavi://navigate?name=${encodedDest}&coord_type=wgs84`;
  } else if (app === 'NAVER') {
    // 네이버지도 내비게이션 정식 길안내 모드
    targetUrl = `nmap://navigation?dname=${encodedDest}&appname=com.kiyuen.lift`;
  } else {
    // WEB 모드: 웹 길찾기
    targetUrl = `https://map.kakao.com/link/to/${encodedDest}`;
  }

  // 데스크톱 브라우저이거나 웹 링크인 경우 새 탭 열기
  if (!isAndroid && !isIos && targetUrl.startsWith('http')) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // 모바일 환경: 브라우저 윈도우 스택 및 DOM을 오염시키지 않는 안전한 다이렉트 디스패치
  try {
    window.location.href = targetUrl;
  } catch {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.target = '_self';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * 안전한 전화걸기 헬퍼
 * - window.location.href 직접 대입으로 인한 PWA 흰 화면(ERR_UNKNOWN_URL_SCHEME) 및 세션 리셋 방지
 * - DOM <a> 태그 클릭 방식을 사용하여 스마트폰 기본 전화 다이얼러를 안전하게 호출
 */
export function safePhoneCall(phone: string | undefined | null) {
  if (!phone) {
    alert('전화번호 정보가 없습니다.');
    return;
  }

  const cleanNumber = phone.replace(/[^0-9+*#]/g, '');
  if (!cleanNumber) {
    alert('유효하지 않은 전화번호입니다.');
    return;
  }

  const a = document.createElement('a');
  a.href = `tel:${cleanNumber}`;
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    } catch {
      // ignore
    }
  }, 300);
}
