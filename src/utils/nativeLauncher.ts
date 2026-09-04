// src/utils/nativeLauncher.ts
// 스마트폰(Android / iOS) 앱 딥링크 및 전화걸기 안전 실행 유틸리티

export type NavAppType = 'TMAP' | 'KAKAO' | 'NAVER' | 'WEB';

// 🌟 연속 클릭으로 인한 OS 액티비티 충돌 및 WindowManager 데드락(폰 벽돌) 차단용 디바운스 락 (2초)
let lastNavLaunchTime = 0;

/**
 * 안전한 길안내 내비게이션 앱 실행기
 * 
 * ⚠️ 핵심 안전 원칙 (안드로이드 폰 멈춤/소프트브릭 및 장소찾기 오류 원천 방지):
 * 1. 'search(장소찾기)' 스킴 대신 'route/navigation(길안내 모드)' 스킴으로 호출하여 즉시 길안내 시작.
 * 2. 'S.browser_fallback_url' 완전 배제:
 *    TMAP이 이미 백그라운드에 켜져 있는 상태에서 재진입 시, 크롬의 fallback 웹페이지 로드와 TMAP의
 *    포그라운드 전환이 경합하여 안드로이드 WindowManagerService(WMS)가 SurfaceFlinger Lock 데드락에 빠져
 *    폰이 벽돌(완전 멈춤/재부팅 필요)이 되던 치명적 원인이었습니다.
 * 3. 2초 디바운스 락: 기사가 성급하게 연타하거나 TMAP 실행 중 재시도할 때 안드로이드 TaskManager
 *    인텐트 스택이 엉키는 것을 원천 차단합니다.
 * 4. 표준 Custom URL Scheme (tmap://route) 직접 디스패치:
 *    브라우저 히스토리를 꼬지 않고 안드로이드/iOS OS 인텐트 라우터에 'onNewIntent'로 즉시 안전 전달합니다.
 */
export function launchNavigation(destination: string, app: NavAppType = 'TMAP') {
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
  const encodedDest = encodeURIComponent(cleanDest);
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let targetUrl = '';

  if (app === 'TMAP') {
    if (isAndroid) {
      // 안드로이드 TMAP 정식 길안내 모드 (route)
      // ⚠️ 데드락 유발하는 S.browser_fallback_url 완전 배제
      // tmap://route 스킴은 이미 TMAP이 백그라운드에 켜져 있어도 안전하게 onNewIntent로 목적지를 갱신함
      targetUrl = `tmap://route?referrer=com.skt.Tmap&goalname=${encodedDest}`;
    } else if (isIos) {
      // iOS 사파리 TMAP 정식 길안내 모드
      targetUrl = `tmap://route?goalname=${encodedDest}`;
    } else {
      // PC / 데스크톱: 카카오맵 웹 길찾기
      targetUrl = `https://map.kakao.com/link/to/${encodedDest}`;
    }
  } else if (app === 'KAKAO') {
    if (isAndroid) {
      // 카카오내비 정식 길안내 모드
      targetUrl = `kakaonavi://navigate?name=${encodedDest}&coord_type=wgs84`;
    } else if (isIos) {
      targetUrl = `kakaonavi://navigate?name=${encodedDest}&coord_type=wgs84`;
    } else {
      targetUrl = `https://map.kakao.com/link/to/${encodedDest}`;
    }
  } else if (app === 'NAVER') {
    if (isAndroid) {
      // 네이버지도 내비게이션 정식 길안내 모드 (navigation)
      targetUrl = `nmap://navigation?dname=${encodedDest}&appname=com.kiyuen.lift`;
    } else if (isIos) {
      targetUrl = `nmap://navigation?dname=${encodedDest}&appname=com.kiyuen.lift`;
    } else {
      targetUrl = `https://map.naver.com/v5/search/${encodedDest}`;
    }
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
