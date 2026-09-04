// src/utils/nativeLauncher.ts
// 스마트폰(Android / iOS) 앱 딥링크 및 전화걸기 안전 실행 유틸리티

export type NavAppType = 'TMAP' | 'KAKAO' | 'NAVER' | 'WEB';

/**
 * 안전한 길안내 내비게이션 앱 실행기
 * 
 * ⚠️ 핵심 안전 원칙 (안드로이드 폰 멈춤/소프트브릭 방지):
 * 1. 절대 setTimeout을 사용한 백그라운드 팝업/폴백을 실행하지 않습니다.
 *    (기존 setTimeout 1.5초 팝업은 TMAP 프로세스 전환 중 크롬의 비동기 창 생성으로
 *     안드로이드 WindowManager Deadlock / ANR 멈춤을 유발하던 치명적 원인이었습니다.)
 * 2. 안드로이드 환경에서는 Chrome 공식 표준 'Intent Scheme'과 'S.browser_fallback_url'을 사용하여
 *    OS가 자체적으로 앱 유무를 판단하고 안전하게 전환되도록 합니다.
 * 3. DOM 가상 <a> 링크 클릭 방식을 사용하여 브라우저 탐색(Navigation) 에러를 원천 차단합니다.
 */
export function launchNavigation(destination: string, app: NavAppType = 'TMAP') {
  if (!destination || !destination.trim()) {
    alert('길안내 목적지 정보가 없습니다.');
    return;
  }

  const cleanDest = destination.trim();
  const encodedDest = encodeURIComponent(cleanDest);
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let targetUrl = '';

  if (app === 'TMAP') {
    if (isAndroid) {
      // 안드로이드 공식 TMAP Intent 스킴 (미설치 시 카카오맵 웹으로 안전 자동 연결)
      const fallbackUrl = `https://map.kakao.com/link/search/${encodedDest}`;
      targetUrl = `intent://search?name=${encodedDest}#Intent;scheme=tmap;package=com.skt.tmap.ku;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`;
    } else if (isIos) {
      // iOS 사파리 전용 TMAP 스킴
      targetUrl = `tmap://search?name=${encodedDest}`;
    } else {
      // 데스크톱 / PC: 카카오맵 웹 검색
      targetUrl = `https://map.kakao.com/link/search/${encodedDest}`;
    }
  } else if (app === 'KAKAO') {
    if (isAndroid) {
      const fallbackUrl = `https://map.kakao.com/link/search/${encodedDest}`;
      targetUrl = `intent://search?q=${encodedDest}#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`;
    } else if (isIos) {
      targetUrl = `kakaomap://search?q=${encodedDest}`;
    } else {
      targetUrl = `https://map.kakao.com/link/search/${encodedDest}`;
    }
  } else if (app === 'NAVER') {
    if (isAndroid) {
      const fallbackUrl = `https://map.naver.com/v5/search/${encodedDest}`;
      targetUrl = `intent://search?query=${encodedDest}&appname=com.kiyuen.lift#Intent;scheme=nmap;package=com.nhn.android.nmap;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`;
    } else if (isIos) {
      targetUrl = `nmap://search?query=${encodedDest}&appname=com.kiyuen.lift`;
    } else {
      targetUrl = `https://map.naver.com/v5/search/${encodedDest}`;
    }
  } else {
    // WEB 모드: 브라우저 웹 지도로 안전 열기
    targetUrl = `https://map.kakao.com/link/search/${encodedDest}`;
  }

  // 데스크톱 브라우저이거나 웹 링크인 경우 새 탭 열기
  if (!isAndroid && !isIos && targetUrl.startsWith('http')) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // 모바일 환경: 안전한 DOM <a> 클릭으로 다이렉트 호출 (브라우저 히스토리 오염 및 프로세스 락 방지)
  const a = document.createElement('a');
  a.href = targetUrl;
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
  }, 500);
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
  }, 500);
}
