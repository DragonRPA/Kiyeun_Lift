// d:\Kiyeun_Lift\src\App.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import {
  LayoutDashboard, Users, UserCheck, Package, Layers, PlusCircle,
  Truck, Wrench, Shield, ShoppingBag, CreditCard, LogOut, Sun, Moon, Menu, X, Zap, Settings, Database as DatabaseIcon,
  TrendingUp, Clock, AlertTriangle, Building2, ChevronDown, ChevronRight, Briefcase, Box, FolderKanban, ShieldAlert, Terminal, ArrowLeftRight, CheckSquare
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
import { BankMatching } from './pages/BankMatching';
import { TruckDispatch } from './pages/TruckDispatch';
import { TransportMaster } from './pages/TransportMaster';
import { DevDataUploader } from './pages/DevDataUploader';
import { Repairs } from './pages/Repairs';
import { SmartDispatch } from './pages/SmartDispatch';
import { SmartReturn } from './pages/SmartReturn';
import { AssetHistory } from './pages/AssetHistory';
import { AssetAssignment } from './pages/AssetAssignment';
import { OrganizationSettings } from './pages/OrganizationSettings';
import { Vendors } from './pages/Vendors';
import { GoogleConfig } from './pages/GoogleConfig';
import { PayrollPage } from './pages/PayrollPage';
import { CorporateCardPage } from './pages/CorporateCardPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { DelinquencyPage } from './pages/DelinquencyPage';
import { OutboundInspections } from './pages/OutboundInspections';
import { DepreciationExecution } from './pages/DepreciationExecution';

export interface SubMenuItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export interface MenuGroup {
  id: string;
  name: string;
  icon: React.ReactNode;
  items: SubMenuItem[];
}

const App: React.FC = () => {
  const { currentUser, login, logout, theme, toggleTheme, hasPermission, activeTab, setActiveTab, loadTablesForMenu } = useApp();

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

  // 메뉴(activeTab) 전환 시 스크롤 최상단 리셋 + 해당 메뉴 관련 테이블만 Supabase pull (최신 데이터 보장)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const mainArea = document.querySelector('.main-content-area');
    if (mainArea) {
      mainArea.scrollTop = 0;
    }
    loadTablesForMenu(activeTab);
  }, [activeTab]);

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

  // 계층형 상위-하위 아코디언 메뉴 구조 정의 (유저 지정 규격)
  const menuGroups: MenuGroup[] = [
    {
      id: 'grp_sales',
      name: '영업관리',
      icon: <Briefcase size={17} />,
      items: [
        { id: 'customer', name: '고객 관리', icon: <Users size={16} />, component: <Customers /> },
        { id: 'contract', name: '계약 관리', icon: <UserCheck size={16} />, component: <Contracts /> },
        { id: 'billing', name: '청구 / 수납 관리', icon: <CreditCard size={16} />, component: <Billings /> },
        { id: 'smart_dispatch', name: '스마트 출고 요청', icon: <Zap size={16} />, component: <SmartDispatch /> },
        { id: 'smart_return', name: '스마트 회수 요청', icon: <Zap size={16} />, component: <SmartReturn /> },
      ]
    },
    {
      id: 'grp_product_asset',
      name: '제품 / 자산관리',
      icon: <Box size={17} />,
      items: [
        { id: 'product', name: '제품 관리', icon: <Package size={16} />, component: <Products /> },
        { id: 'asset', name: '자산 관리 (대장)', icon: <Layers size={16} />, component: <Assets /> },
        { id: 'acquisition_disposal', name: '당사자산 취득 / 매각', icon: <PlusCircle size={16} />, component: <AssetAcquisitionDisposal /> },
        { id: 'rent_asset', name: '임차자산 관리', icon: <ShoppingBag size={16} />, component: <RentAssets /> },
      ]
    },
    {
      id: 'grp_logistics',
      name: '배차 / 운송관리',
      icon: <Truck size={17} />,
      items: [
        { id: 'delivery', name: '배차 / 운송 관리', icon: <Truck size={16} />, component: <TruckDispatch /> },
        { id: 'transport_master', name: '운송 거래처 / 기사 관리', icon: <Settings size={16} />, component: <TransportMaster /> },
      ]
    },
    {
      id: 'grp_inout',
      name: '입출고관리',
      icon: <ArrowLeftRight size={17} />,
      items: [
        { id: 'asset_inout_history', name: '자산 입출고 / 정비 이력', icon: <Clock size={16} />, component: <AssetHistory /> },
        { id: 'dispatch_assign', name: '장비 할당 / 매핑', icon: <Layers size={16} />, component: <AssetAssignment /> },
        { id: 'outbound_inspections', name: '출고 검수 의뢰 관리', icon: <CheckSquare size={16} />, component: <OutboundInspections /> },
      ]
    },
    {
      id: 'grp_maintenance',
      name: '정비 / 소모품관리',
      icon: <Wrench size={17} />,
      items: [
        { id: 'consumable', name: '소모품 관리', icon: <ShoppingBag size={16} />, component: <Consumables /> },
        { id: 'repair', name: '자산 정비 수리', icon: <Wrench size={16} />, component: <Repairs /> },
      ]
    },
    {
      id: 'grp_management',
      name: '경영관리',
      icon: <FolderKanban size={17} />,
      items: [
        { id: 'vendors', name: '매입처 (공급자 / 외주처) 관리', icon: <Building2 size={16} />, component: <Vendors /> },
        { id: 'bank_matching', name: '은행 입출금 대장', icon: <TrendingUp size={16} />, component: <BankMatching /> },
        { id: 'corporate_card', name: '법인카드 매입정산', icon: <CreditCard size={16} />, component: <CorporateCardPage /> },
        { id: 'cash_flow', name: '자금 흐름 분석', icon: <TrendingUp size={16} />, component: <CashFlowPage /> },
        { id: 'delinquency', name: '미수 채권 연체 관리', icon: <AlertTriangle size={16} />, component: <DelinquencyPage /> },
        { id: 'depreciation_execution', name: '감가상각 마감 실행', icon: <TrendingUp size={16} />, component: <DepreciationExecution /> },
      ]
    },
    {
      id: 'grp_management_special',
      name: '경영관리 - 특수',
      icon: <ShieldAlert size={17} />,
      items: [
        { id: 'organization', name: '조직 / 인사 관리', icon: <Users size={16} />, component: <OrganizationSettings /> },
        { id: 'permission', name: '사용자 및 권한', icon: <Shield size={16} />, component: <UsersPermissions /> },
        { id: 'payroll', name: '급여 정산', icon: <CreditCard size={16} />, component: <PayrollPage /> },
      ]
    },
    {
      id: 'grp_system_dev',
      name: '시스템관리 - 개발자',
      icon: <Terminal size={17} />,
      items: [
        { id: 'google_config', name: '구글 관리자 설정', icon: <Settings size={16} />, component: <GoogleConfig /> },
        { id: 'dev_uploader', name: '[개발] DB 데이터 업로더', icon: <DatabaseIcon size={16} />, component: <DevDataUploader /> },
      ]
    }
  ];

  // 상위 그룹 아코디언 접힘/펼침 상태
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    grp_sales: true,
    grp_product_asset: true,
    grp_logistics: true,
    grp_inout: true,
    grp_maintenance: true,
    grp_management: true,
    grp_management_special: true,
    grp_system_dev: true
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // activeTab이 활성화될 때 속한 상위 그룹 자동 펼침
  useEffect(() => {
    menuGroups.forEach(grp => {
      if (grp.items.some(item => item.id === activeTab)) {
        setExpandedGroups(prev => ({ ...prev, [grp.id]: true }));
      }
    });
  }, [activeTab]);

  // 활성 페이지 컴포넌트 탐색
  const getActiveComponent = () => {
    if (activeTab === 'dashboard') return <Dashboard />;
    for (const grp of menuGroups) {
      const found = grp.items.find(item => item.id === activeTab);
      if (found) return found.component;
    }
    return <Dashboard />;
  };

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
  const userHasViewPerm = hasPermission(activeTab, 'view');

  return (
    <div style={{ display: 'flex', height: '850px', maxHeight: '850px', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* 상단 네비게이션 헤더 */}
      <header style={{
        height: '64px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
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

      {/* 메인 레이아웃 본문 (850px 헤더 제외 수직 프레임) */}
      <div style={{ display: 'flex', flex: 1, height: 'calc(850px - 64px)', overflow: 'hidden', position: 'relative' }}>
        
        {/* 데스크탑 계층형 아코디언 사이드바 (독자 스크롤) */}
        <aside
          className={`sidebar-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}
          style={{
            width: '260px',
            height: '100%',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 10px',
            gap: '4px',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          {/* 최상단 독립 ERP 대시보드 버튼 */}
          {hasPermission('dashboard', 'view') && (
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: activeTab === 'dashboard' ? '700' : '500',
                color: activeTab === 'dashboard' ? '#ffffff' : 'var(--text-main)',
                background: activeTab === 'dashboard' ? 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)' : 'transparent',
                boxShadow: activeTab === 'dashboard' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                cursor: 'pointer',
                marginBottom: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <LayoutDashboard size={17} />
              <span>ERP 대시보드</span>
            </button>
          )}

          {/* 계층형 접이식 상위-하위 아코디언 그룹 메뉴 */}
          {menuGroups.map(grp => {
            // 권한이 있는 하위 메뉴가 1개 이상 존재하는지 확인
            const visibleItems = grp.items.filter(item => hasPermission(item.id, 'view'));
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedGroups[grp.id] !== false;
            const hasActiveChild = grp.items.some(item => item.id === activeTab);

            return (
              <div key={grp.id} style={{ marginBottom: '4px' }}>
                {/* 상위 메뉴 헤더 버튼 (아코디언 토글) */}
                <button
                  onClick={() => toggleGroup(grp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 10px', // 상위 아이콘 시작 X = 10px, 텍스트 시작 X = 38px
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: hasActiveChild ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    color: hasActiveChild ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                    <span style={{ width: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {grp.icon}
                    </span>
                    <span style={{ marginLeft: '8px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {grp.name}
                    </span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
                </button>

                {/* 하위 메뉴 서브 항목 그룹 */}
                {isExpanded && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    marginTop: '2px',
                    marginLeft: '15px',
                    borderLeft: '2px solid rgba(59, 130, 246, 0.22)',
                  }}>
                    {visibleItems.map(item => {
                      const isItemActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '16px 1fr',
                            columnGap: '8px',
                            alignItems: 'center',
                            width: '100%',
                            padding: '7px 8px 7px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: isItemActive ? '700' : '400',
                            color: isItemActive ? 'var(--primary)' : 'var(--text-secondary)',
                            backgroundColor: isItemActive ? 'var(--primary-light)' : 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '16px',
                            height: '16px',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}>
                            {item.icon}
                          </span>
                          <span style={{
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}>
                            {item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {/* 메인 콘텐츠 영역 (독자 스크롤) */}
        <main style={{ flex: 1, height: '100%', padding: '30px', overflowY: 'auto', overscrollBehavior: 'contain', backgroundColor: 'var(--bg-app)' }} className="main-content-area">
          {userHasViewPerm ? (
            getActiveComponent()
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '80px 0', color: 'var(--danger)', backgroundColor: 'var(--danger-light)' }}>
              <h3>접근 권한 제한 알림</h3>
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                선택하신 메뉴에 대한 조회 권한이 비활성화되어 있습니다.<br />
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
