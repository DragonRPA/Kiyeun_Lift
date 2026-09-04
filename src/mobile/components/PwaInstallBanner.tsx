// src/mobile/components/PwaInstallBanner.tsx
import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. 이미 홈 화면 단독 앱(Standalone)으로 실행 중인지 확인
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // 2. iOS Safari 판별
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. 안드로이드 beforeinstallprompt 이벤트 캡처
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 이미 독립 실행 중이거나 사용자가 닫았으면 배너 숨김
  if (isStandalone || isDismissed) {
    return null;
  }

  // 설치 버튼 클릭 핸들러
  const handleInstallClick = async () => {
    if (isIos) {
      // iOS인 경우 가이드 모달 표출
      setShowIosModal(true);
    } else if (deferredPrompt) {
      // 안드로이드 브라우저 기본 설치 팝업 호출
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsDismissed(true);
      }
    } else {
      // 기타 브라우저 (삼성인터넷 등에서 프롬프트가 안 떴을 때) 안내 모달
      setShowIosModal(true);
    }
  };

  return (
    <>
      {/* 상단 스마트 슬림 설치 배너 */}
      <div className="bg-gradient-to-r from-blue-950/90 via-slate-900 to-indigo-950/90 border-b border-blue-500/30 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-100 flex items-center gap-1">
              <span>홈 화면 앱 설치</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              가용 재고 조회 앱 홈 화면 추가
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11.5px] flex items-center gap-1 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>설치</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS 사파리 및 수동 안내 모달 */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                홈 화면에 앱 추가 방법
              </h3>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              브라우저 메뉴에서 아래 절차를 진행하여 홈 화면에 앱을 추가합니다.
            </p>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 font-black flex items-center justify-center flex-shrink-0 text-xs border border-blue-500/30">
                  1
                </div>
                <div className="text-xs text-slate-200">
                  화면 하단 메뉴의 <strong className="text-blue-400 flex inline-flex items-center gap-1"><Share className="w-3.5 h-3.5" /> 공유</strong> 버튼을 터치합니다.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 font-black flex items-center justify-center flex-shrink-0 text-xs border border-blue-500/30">
                  2
                </div>
                <div className="text-xs text-slate-200">
                  메뉴를 스크롤하여 <strong className="text-emerald-400 flex inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5" /> 홈 화면에 추가</strong>를 선택합니다.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 active:scale-98 transition-all"
            >
              확인 완료
            </button>
          </div>
        </div>
      )}
    </>
  );
};