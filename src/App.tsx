// d:\Kiyeun_Lift\src\App.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import {
  LayoutDashboard, Users, UserCheck, Package, Layers, PlusCircle,
  Truck, Wrench, Shield, ShoppingBag, CreditCard, LogOut, Sun, Moon, Menu, X, Zap, Settings
} from 'lucide-react';

// 페이지 컴포넌트 임포트
import { Dashboard } from './pages/Dashboard';
import { UsersPermissions } from './pages/UsersPermissions';
import { Customers } from './pages/Customers';
import { Products } from './pages/Products';
import { Assets } from './pages/Assets';
import { AssetAcquisitionDisposal } from './pages/AssetAcquisitionDisposal';
import { RentAssets } from './pages/RentAssets';
import { Consumables } from './pages/Consumables';
import { Contracts } from './pages/Contracts';
import { Billings } from './pages/Billings';
import { TruckDispatch } from './pages/TruckDispatch';
import { TransportMaster } from './pages/TransportMaster';
import { Repairs } from './pages/Repairs';
import { SmartDispatch } from './pages/SmartDispatch';
import { AssetAssignment } from './pages/AssetAssignment';
import { OrganizationSettings } from './pages/OrganizationSettings';

const App: React.FC = () => {
  const { currentUser, login, logout, theme, toggleTheme, hasPermission } = useApp();

  // 로그인 폼 상태
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  // 편의기능 체크박스 상태
  const [rememberId, setRememberId] = useState(false);
  const [rememberPw, setRememberPw] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);

  // 모바일 메뉴 사이드바 토글 상태
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 현재 활성화된 메뉴 탭 상태
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // 컴포넌트 마운트 시 저장된 로그인 편의 정보 로드
  useEffect(() => {
    const savedId = localStorage.getItem('remember_id');
    const savedPw = localStorage.getItem('remember_pw');
    if (savedId) {
      setLoginId(savedId);
      setRememberId(true);
    }
    if (savedPw) {
      setPassword(savedPw);
      setRememberPw(true);
    }
    const hasAuto = !!localStorage.getItem('auto_user');
    if (hasAuto) {
      setAutoLogin(true);
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(loginId, password, autoLogin);
    if (success) {
      setLoginError(false);
      
      // 아이디 저장 처리
      if (rememberId) {
        localStorage.setItem('remember_id', loginId);
      } else {
        localStorage.removeItem('remember_id');
      }
      
      // 비밀번호 저장 처리
      if (rememberPw) {
        localStorage.setItem('remember_pw', password);
      } else {
        localStorage.removeItem('remember_pw');
      }

      // 필드 정리 (저장 설정 안된 값만 비우기)
      if (!rememberId) setLoginId('');
      if (!rememberPw) setPassword('');
      
      setActiveTab('dashboard'); // 로그인 성공시 대시보드로
    } else {
      setLoginError(true);
    }
  };

  // 전체 메뉴 구조 정의
  const sidebarMenus = [
    { id: 'dashboard', name: 'ERP 대시보드', icon: <LayoutDashboard size={18} />, component: <Dashboard /> },
    { id: 'customer', name: '고객 관리', icon: <Users size={18} />, component: <Customers /> },
    { id: 'product', name: '제품 관리', icon: <Package size={18} />, component: <Products /> },
    { id: 'asset', name: '자산 관리 (대장)', icon: <Layers size={18} />, component: <Assets /> },
    { id: 'acquisition_disposal', name: '당사자산 취득/매각', icon: <PlusCircle size={18} />, component: <AssetAcquisitionDisposal /> },
    { id: 'rent_asset', name: '임차자산 관리', icon: <ShoppingBag size={18} />, component: <RentAssets /> },
    { id: 'consumable', name: '소모품 관리', icon: <ShoppingBag size={18} />, component: <Consumables /> },
    { id: 'contract', name: '계약 관리', icon: <UserCheck size={18} />, component: <Contracts /> },
    { id: 'billing', name: '청구/수납 관리', icon: <CreditCard size={18} />, component: <Billings /> },
    { id: 'delivery', name: '배차/운송 관리', icon: <Truck size={18} />, component: <TruckDispatch /> },
    { id: 'transport_master', name: '운송 거래처/기사 관리', icon: <Settings size={18} />, component: <TransportMaster /> },
    { id: 'smart_dispatch', name: '스마트 출고 요청', icon: <Zap size={18} />, component: <SmartDispatch /> },
    { id: 'dispatch_assign', name: '장비 할당 (매핑)', icon: <Layers size={18} />, component: <AssetAssignment /> },
    { id: 'repair', name: '자산 정비수리', icon: <Wrench size={18} />, component: <Repairs /> },
    { id: 'organization', name: '조직/인사 관리', icon: <Users size={18} />, component: <OrganizationSettings /> },
    { id: 'permission', name: '사용자 및 권한', icon: <Shield size={18} />, component: <UsersPermissions /> }
  ];

  // 1. 비로그인 상태: 로그인 화면 렌더링
  if (!currentUser) {
    return (
      <div style={{
        display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', padding: '16px'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px' }}>
              KIYEUN LIFT ERP
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              소규모 고소작업대 렌탈 관리 시스템
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: 'var(--text-main)', fontSize: '13px', marginBottom: '4px', display: 'block' }}>사용자 아이디</label>
              <input
                type="text"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                placeholder="아이디 입력 (admin)"
                required
                style={{ fontSize: '14px', padding: '8px 12px' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-main)', fontSize: '13px', marginBottom: '4px', display: 'block' }}>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 입력 (admin123)"
                required
                style={{ fontSize: '14px', padding: '8px 12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', padding: '2px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberId}
                  onChange={e => setRememberId(e.target.checked)}
                  style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                />
                아이디 저장
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberPw}
                  onChange={e => setRememberPw(e.target.checked)}
                  style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                />
                비밀번호 저장
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={e => setAutoLogin(e.target.checked)}
                  style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                />
                자동 로그인
              </label>
            </div>

            {loginError && (
              <div style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center', fontWeight: '600' }}>
                아이디 또는 비밀번호가 잘못되었습니다.
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ padding: '12px', fontSize: '16px', fontWeight: '600', marginTop: '4px' }}>
              로그인
            </button>
          </form>

          {/* 테스트 계정 안내 */}
          <div style={{ marginTop: '16px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-app)', fontSize: '12px' }}>
            <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text-main)' }}>[테스트 계정 안내]</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>• 최고관리자: <strong>admin / admin123</strong></div>
              <div>• 영업관리: <strong>manager / mgr123</strong></div>
              <div>• 일반영업: <strong>user / user123</strong></div>
              <div>• 정비현장: <strong>mechanic / mech123</strong></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. 로그인 상태: 메인 ERP 대시보드 렌더링
  const activeMenu = sidebarMenus.find(m => m.id === activeTab);
  const userHasViewPerm = activeMenu ? hasPermission(activeMenu.id, 'view') : false;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      
      {/* 상단 네비게이션 헤더 */}
      <header style={{
        height: '64px',
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ padding: '8px', display: 'none', borderRadius: '4px', backgroundColor: 'transparent' }}
            className="mobile-burger-btn"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 style={{ fontSize: '19px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px' }}>
            KIYEUN LIFT ERP
          </h1>
        </div>

        {/* 사용자 정보 및 다크모드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={toggleTheme}
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="user-profile-badge">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '13px', fontWeight: '700' }}>{currentUser.name} {currentUser.role === 'ADMIN' ? '관리자' : '임직원'}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{currentUser.department} ({currentUser.role})</span>
            </div>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700'
            }}>
              {currentUser.name.substring(0, 1)}
            </div>
          </div>

          <button
            onClick={logout}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      </header>

      {/* 메인 레이아웃 본문 */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        
        {/* 데스크탑 사이드바 (모바일에서는 화면 크기에 따라 제어) */}
        <aside
          className={`sidebar-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}
          style={{
            width: '260px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 12px',
            gap: '6px',
            overflowY: 'auto'
          }}
        >
          {sidebarMenus.map(menu => {
            const hasView = hasPermission(menu.id, 'view');
            if (!hasView) return null; // 조회 권한이 없는 메뉴는 노출 자체를 차단

            return (
              <button
                key={menu.id}
                onClick={() => {
                  setActiveTab(menu.id);
                  setMobileMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: activeTab === menu.id ? '600' : '400',
                  color: activeTab === menu.id ? 'var(--primary)' : 'var(--text-secondary)',
                  backgroundColor: activeTab === menu.id ? 'var(--primary-light)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {menu.icon}
                <span>{menu.name}</span>
              </button>
            );
          })}
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <main style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: 'var(--bg-app)' }} className="main-content-area">
          {userHasViewPerm && activeMenu ? (
            activeMenu.component
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '80px 0', color: 'var(--danger)', backgroundColor: 'var(--danger-light)' }}>
              <h3>접근 권한 제한 알림</h3>
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                선택하신 [{activeMenu?.name}] 메뉴에 대한 조회 권한이 비활성화되어 있습니다.<br />
                권한이 필요할 경우 최고관리자에게 문의하시기 바랍니다.
              </p>
            </div>
          )}
        </main>

      </div>

      {/* 모바일 스타일 처리를 위한 인라인 Style Tag */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-burger-btn {
            display: block !important;
          }
          .sidebar-nav {
            position: fixed;
            top: 64px;
            left: -260px;
            bottom: 0;
            z-index: 40;
            transition: left 0.3s ease;
            box-shadow: 10px 0 15px -3px rgba(0,0,0,0.1);
          }
          .sidebar-nav.mobile-open {
            left: 0;
          }
          .user-profile-badge {
            display: none !important;
          }
          .main-content-area {
            padding: 16px !important;
          }
        }
      `}</style>

    </div>
  );
};

export default App;
