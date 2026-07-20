// d:\Kiyeun_Lift\src\pages\UsersPermissions.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Shield } from 'lucide-react';
import { User, MenuPermission, db } from '../services/db';

export const UsersPermissions: React.FC = () => {
  const { permissions, updatePermissions, hasPermission, currentUser } = useApp();
  // 권한 통제 화면 자체 접근(저장)을 어드민과 매니저에게만 허용
  const isSuperAdmin = currentUser?.loginId === 'admin';
  const canSave = (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && hasPermission('permission', 'save');

  // 선택된 사용자 상태 (좌측에서 클릭)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // 로컬 사용자 상태 (좌측 패널용)
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  // 로컬 권한 상태 (우측 패널 에디팅용)
  const [localPermissions, setLocalPermissions] = useState<MenuPermission[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let savedUsers = [...db.users];
    
    // 강제 admin 계정 주입 (목록에 없을 경우)
    if (currentUser?.loginId === 'admin') {
      const hasAdmin = savedUsers.find(u => u.loginId === 'admin');
      if (!hasAdmin) {
        savedUsers.unshift({
          id: 'sys-admin',
          loginId: 'admin',
          name: '최고관리자 (System Admin)',
          role: 'ADMIN',
          departmentId: null
        } as unknown as User);
      }
    }
    setLocalUsers(savedUsers);

    // 권한 목록 복사
    setLocalPermissions([...db.permissions]);
  }, [currentUser]);

  // 사용자를 처음 클릭하거나 선택했을 때 기본 선택값 설정 (선택적)
  useEffect(() => {
    if (!selectedUserId && localUsers.length > 0) {
      setSelectedUserId(localUsers[0].id);
    }
  }, [localUsers, selectedUserId]);

  const handleRoleChange = (userId: string, newRole: string) => {
    if (!canSave) {
      alert('사용자 등급을 수정할 수 없습니다.');
      return;
    }
    
    // 슈퍼어드민 강제 다운그레이드 방지
    if (userId === 'sys-admin' && newRole !== 'ADMIN') {
      alert('시스템 최고관리자의 등급은 변경할 수 없습니다.');
      return;
    }

    // 다른 사람에게 ADMIN을 줄 수 있는 건 loginId가 'admin'인 사람뿐
    if (newRole === 'ADMIN' && !isSuperAdmin) {
      alert('ADMIN 등급은 최고관리자(admin) 계정만 부여할 수 있습니다.');
      return;
    }

    const updatedUsers = localUsers.map(u => 
      u.id === userId ? { ...u, role: newRole } : u
    );
    setLocalUsers(updatedUsers as User[]);
    setIsDirty(true);
  };

  // 최신 메뉴 리스트
  const menus = [
    { id: 'dashboard', name: 'ERP 대시보드' },
    { id: 'organization', name: '조직/인사 관리' },
    { id: 'payroll', name: '급여 정산' },
    { id: 'corporate_card', name: '법인카드 매입정산' },
    { id: 'cash_flow', name: '자금 흐름 분석' },
    { id: 'delinquency', name: '미수 채권 연체 관리' },
    { id: 'customer', name: '고객 관리 (담당자/현장)' },
    { id: 'product', name: '제품 관리' },
    { id: 'asset', name: '자산 관리' },
    { id: 'acquisition_disposal', name: '당사자산 취득/매각' },
    { id: 'rent_asset', name: '임차자산 조회/등록/반납' },
    { id: 'consumable', name: '소모품 관리' },
    { id: 'contract', name: '계약 관리' },
    { id: 'billing', name: '청구/수납 관리' },
    { id: 'bank_matching', name: '은행 입출금 매칭' },
    { id: 'delivery', name: '배차 관리 (비용정산)' },
    { id: 'transport_master', name: '운송 거래처/기사 관리' },
    { id: 'smart_dispatch', name: '스마트 출고 요청 (파서)' },
    { id: 'smart_return', name: '스마트 회수 요청' },
    { id: 'asset_inout_history', name: '자산 입출고/정비 이력' },
    { id: 'dispatch_assign', name: '스마트 출고/배차 - 장비 할당 권한' },
    { id: 'repair', name: '자산 수리 관리 (외근정비)' },
    { id: 'permission', name: '사용자 및 권한 설정' },
    { id: 'google_config', name: '구글 관리자 설정' }
  ];

  const handlePermissionToggle = (menuId: string, type: 'view' | 'save') => {
    if (!canSave || !selectedUserId) return;
    
    const targetUser = localUsers.find(u => u.id === selectedUserId);
    if (targetUser?.role === 'ADMIN') {
      alert('ADMIN 등급은 모든 메뉴에 대한 권한을 강제로 갖습니다.');
      return;
    }

    // 급여 정산 (payroll) 보안 제한 검증 (ADMIN이 아닌 임직원 중 단 1명만 보유 가능)
    if (menuId === 'payroll') {
      const existing = localPermissions.find(p => p.userId === selectedUserId && p.menuId === 'payroll');
      const isTurningOn = existing ? (type === 'view' ? !existing.canView : !existing.canSave) : true;

      if (isTurningOn) {
        const otherHasPayroll = localPermissions.some(p => {
          if (p.userId === selectedUserId) return false;
          if (p.menuId !== 'payroll') return false;
          if (!p.canView && !p.canSave) return false;

          const userObj = localUsers.find(u => u.id === p.userId);
          return userObj && userObj.role !== 'ADMIN';
        });

        if (otherHasPayroll) {
          const otherPerm = localPermissions.find(p => {
            if (p.userId === selectedUserId) return false;
            if (p.menuId !== 'payroll') return false;
            if (!p.canView && !p.canSave) return false;
            const userObj = localUsers.find(u => u.id === p.userId);
            return userObj && userObj.role !== 'ADMIN';
          });
          const otherUser = otherPerm ? localUsers.find(u => u.id === otherPerm.userId) : null;
          alert(`급여 정산 권한은 ADMIN이 아닌 일반 직원 중 단 1명만 보유할 수 있습니다.\n이미 다른 직원(${otherUser?.name || '기타 직원'})에게 이 권한이 부여되어 있으므로, 기존 권한을 명시적으로 해제하기 전에는 다른 임직원에게 추가로 부여할 수 없습니다.`);
          return;
        }
      }
    }

    setLocalPermissions(prev => {
      const existingIdx = prev.findIndex(p => p.userId === selectedUserId && p.menuId === menuId);
      const newPerms = [...prev];

      if (existingIdx >= 0) {
        newPerms[existingIdx] = {
          ...newPerms[existingIdx],
          canView: type === 'view' ? !newPerms[existingIdx].canView : newPerms[existingIdx].canView,
          canSave: type === 'save' ? !newPerms[existingIdx].canSave : newPerms[existingIdx].canSave
        };
      } else {
        newPerms.push({
          id: `perm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
          userId: selectedUserId,
          menuId,
          canView: type === 'view',
          canSave: type === 'save',
          createdAt: new Date().toISOString()
        } as MenuPermission);
      }
      return newPerms;
    });
    setIsDirty(true);
  };

  // --- Unload Warning ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // 브라우저 표준 경고창 유발
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // --- Manual Save ---
  const handleSaveAll = () => {
    // 저장 전 최종 보안 검증: ADMIN이 아닌 일반 임직원 중 급여정산 권한 소유자가 2명 이상인지 최종 대조
    const payrollUsers = new Set<string>();
    localPermissions.forEach(p => {
      if (p.menuId === 'payroll' && (p.canView || p.canSave)) {
        const userObj = localUsers.find(u => u.id === p.userId);
        if (userObj && userObj.role !== 'ADMIN') {
          payrollUsers.add(p.userId);
        }
      }
    });

    if (payrollUsers.size > 1) {
      alert(`저장 실패: 급여 정산 권한은 ADMIN이 아닌 일반 직원 중 단 1명만 보유할 수 있습니다. 현재 ${payrollUsers.size}명의 비-ADMIN 임직원에게 권한이 설정되어 있어 저장이 불가능합니다.\n기존 소유자의 권한을 해제해 주세요.`);
      return;
    }

    // 1. 유저 Role 일괄 저장
    const realUsers = localUsers.filter(u => u.id !== 'sys-admin');
    realUsers.forEach(u => {
      db.updateRow<User>('users', u.id, { role: u.role });
    });
    
    // 2. 권한 일괄 저장
    // AppContext에 바로 넣어서 글로벌 적용
    updatePermissions(localPermissions);
    
    setIsDirty(false);
    alert('사용자 권한 설정이 안전하게 저장되었습니다.');
  };

  const selectedUser = localUsers.find(u => u.id === selectedUserId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '22px', fontWeight: '800' }}>사용자 및 권한 관리</h2>
        </div>
        
        {canSave && (
          <button 
            className={`btn-primary ${isDirty ? 'pulse-animation' : ''}`} 
            onClick={handleSaveAll}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: isDirty ? 'var(--danger)' : 'var(--primary)',
              boxShadow: isDirty ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            <Shield size={16} /> {isDirty ? '권한 일괄 저장 (변경됨)' : '권한 일괄 저장'}
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        좌측에서 특정 직원을 선택한 뒤 우측에서 <strong>개인별(ID별) 메뉴 접근 권한</strong>을 상세하게 통제할 수 있습니다.<br/>
        (단, `ADMIN` 등급은 모든 메뉴 접근이 항상 허용됩니다.)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* 사용자 리스트 (좌측 패널) */}
        <div className="card" style={{ margin: 0, height: '650px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3 className="card-title">등록된 사용자 리스트</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>직원을 클릭하세요</span>
          </div>

          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>이름 (ID)</th>
                  <th>시스템 등급</th>
                </tr>
              </thead>
              <tbody>
                {localUsers.map(u => (
                  <tr 
                    key={u.id} 
                    onClick={() => setSelectedUserId(u.id)}
                    style={{ 
                      cursor: 'pointer', 
                      backgroundColor: selectedUserId === u.id ? 'var(--bg-active)' : 'transparent',
                      borderLeft: selectedUserId === u.id ? '4px solid var(--primary)' : '4px solid transparent'
                    }}
                  >
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{u.name}</strong> 
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>({u.loginId || '미등록'})</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select 
                        value={u.role || 'USER'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={!canSave || u.id === 'sys-admin'}
                        style={{
                          padding: '4px 8px', fontSize: '12px', borderRadius: '4px',
                          border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)',
                          fontWeight: 'bold',
                          color: u.role === 'ADMIN' ? 'var(--danger)' : u.role === 'MANAGER' ? 'var(--success)' : 'var(--info)'
                        }}
                      >
                        {isSuperAdmin && <option value="ADMIN">ADMIN</option>}
                        {(!isSuperAdmin && u.role === 'ADMIN') && <option value="ADMIN" disabled>ADMIN</option>}
                        <option value="MANAGER">MANAGER</option>
                        <option value="USER">USER</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 메뉴별 권한 매트릭스 (우측 패널) */}
        <div className="card" style={{ margin: 0, height: '650px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3 className="card-title">
              메뉴 권한 상세 설정
              {selectedUser && <span style={{ marginLeft: '12px', fontSize: '14px', color: 'var(--primary)' }}>- [{selectedUser.name}]</span>}
            </h3>
            {selectedUser?.role === 'ADMIN' && (
              <span style={{ fontSize: '12px', color: 'var(--danger)' }}>* ADMIN은 전권 소유</span>
            )}
          </div>

          <div className="table-container" style={{ flex: 1, overflowY: 'auto', border: 'none', boxShadow: 'none' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>대상 메뉴명</th>
                  <th style={{ textAlign: 'center' }}>조회 (View)</th>
                  <th style={{ textAlign: 'center' }}>저장 (Save)</th>
                </tr>
              </thead>
              <tbody>
                {menus.map(menu => {
                  const perm = localPermissions.find(p => p.userId === selectedUserId && p.menuId === menu.id) || { canView: false, canSave: false };
                  const isAdmin = selectedUser?.role === 'ADMIN';
                  
                  return (
                    <tr key={menu.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{menu.name}</span>
                          {menu.id === 'payroll' && (
                            <span style={{ fontSize: '11.5px', color: '#ef4444', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center' }}>
                              ⚠️ 일반직원 중 단 1명 제한
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isAdmin ? true : perm.canView}
                          disabled={!canSave || isAdmin}
                          onChange={() => handlePermissionToggle(menu.id, 'view')}
                          style={{ width: '18px', height: '18px', cursor: isAdmin ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isAdmin ? true : perm.canSave}
                          disabled={!canSave || isAdmin}
                          onChange={() => handlePermissionToggle(menu.id, 'save')}
                          style={{ width: '18px', height: '18px', cursor: isAdmin ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
