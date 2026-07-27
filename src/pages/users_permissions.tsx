// src/pages/users_permissions.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Check, Lock, Save, FolderKanban, ChevronDown, ChevronRight } from 'lucide-react';
import { MenuPermission, User } from '../services/db';

import { SYSTEM_MENU_CONFIG, getAllSystemMenuIds, MenuGroupConfig } from '../config/menu_config';

export type MenuCategoryGroup = MenuGroupConfig;
export const MENU_CATEGORIES = SYSTEM_MENU_CONFIG;

export const UsersPermissions: React.FC = () => {
  const { users, permissions, updatePermissions, saveUser, currentUser, hasPermission, showErrorModal } = useApp();

  const isSuperAdmin = currentUser?.id === 'u-1' || currentUser?.id === 'sys-admin';
  const canSave = hasPermission('permission', 'save');

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [localPermissions, setLocalPermissions] = useState<MenuPermission[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // 상위 카테고리 접힘/펼침 상태
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalUsers([...users]);
  }, [users]);

  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    // 모든 시스템 메뉴 ID 스캔 및 누락된 권한 항목 자가 복구 (Auto Backfill)
    const allMenuIds = getAllSystemMenuIds();
    const merged = [...permissions];
    let addedCount = 0;

    users.forEach(u => {
      allMenuIds.forEach(menuId => {
        const exists = merged.some(p => (p.userId === u.id || (p as any).user_id === u.id) && p.menuId === menuId);
        if (!exists) {
          const isAdmin = u.role === 'ADMIN' || u.id === 'u-1' || u.id === 'sys-admin';
          merged.push({
            id: `perm-${u.id}-${menuId}`,
            userId: u.id,
            user_id: u.id,
            menuId: menuId,
            canView: true,
            canSave: isAdmin,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as any);
          addedCount++;
        }
      });
    });

    setLocalPermissions(merged);
    setIsDirty(false);
  }, [permissions, users]);

  const selectedUser = localUsers.find(u => u.id === selectedUserId);

  const toggleGroupCollapse = (grpId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [grpId]: !prev[grpId]
    }));
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    if (!canSave) return;
    
    if (userId === 'u-1' || userId === 'sys-admin') {
      alert('최고관리자 계정의 시스템 등급은 변경할 수 없습니다.');
      return;
    }

    if (newRole === 'ADMIN' && !isSuperAdmin) {
      alert('ADMIN(최고관리자) 등급은 오직 최고관리자(sys-admin) 계정만 승인 권한이 있습니다.');
      return;
    }

    const targetUser = localUsers.find(u => u.id === userId);
    if (!targetUser) return;

    if (targetUser.role === 'ADMIN' && newRole !== 'ADMIN' && !isSuperAdmin) {
      alert('ADMIN 권한 박탈은 오직 최고관리자(sys-admin)만 가능합니다.');
      return;
    }

    const updatedUser: User = {
      ...targetUser,
      role: newRole as 'ADMIN' | 'MANAGER' | 'USER'
    };

    saveUser(updatedUser);
    setLocalUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    alert(`${targetUser.name} 님의 등급이 [${newRole}] (으)로 변경되었습니다.`);
  };

  const handlePermissionToggle = (menuId: string, type: 'view' | 'save') => {
    if (!canSave || !selectedUserId) return;
    
    const targetUser = localUsers.find(u => u.id === selectedUserId);
    // 절대 슈퍼 관리자 계정은 권한 회수 불가
    if (targetUser?.id === 'u-1' || targetUser?.id === 'sys-admin' || targetUser?.loginId === 'admin') {
      alert('시스템 최고관리자 계정의 메뉴 권한은 변경할 수 없습니다.');
      return;
    }

    // 급여 정산 (payroll) 보안 제한 검증 (ADMIN이 아닌 임직원 중 단 1명만 보유 가능)
    if (menuId === 'payroll') {
      const existingPayrollHolder = localPermissions.find(p => {
        if (p.menuId !== 'payroll' || p.userId === selectedUserId) return false;
        const u = localUsers.find(user => user.id === p.userId);
        return u && u.role !== 'ADMIN' && (p.canView || p.canSave);
      });

      if (existingPayrollHolder) {
        const holderUser = localUsers.find(u => u.id === existingPayrollHolder.userId);
        alert(`급여 정산 메뉴 권한은 보안 정책상 관리자 외 임직원 중 단 1명만 소유할 수 있습니다.\n(현재 소유자: ${holderUser?.name || '타 임직원'})\n기존 소유자의 권한을 먼저 해제해 주세요.`);
        return;
      }
    }

    setLocalPermissions(prev => {
      const index = prev.findIndex(p => (p.userId === selectedUserId || (p as any).user_id === selectedUserId) && p.menuId === menuId);
      let updatedList = [...prev];
      
      if (index > -1) {
        const current = updatedList[index];
        let nextView = current.canView;
        let nextSave = current.canSave;

        if (type === 'view') {
          nextView = !current.canView;
          if (!nextView) nextSave = false;
        } else {
          nextSave = !current.canSave;
          if (nextSave) nextView = true;
        }

        updatedList[index] = { ...current, canView: nextView, canSave: nextSave };
      } else {
        updatedList.push({
          id: `perm-${selectedUserId}-${menuId}`,
          userId: selectedUserId,
          menuId: menuId,
          canView: type === 'view' ? true : true,
          canSave: type === 'save' ? true : false,
          createdAt: new Date().toISOString()
        });
      }

      setIsDirty(true);
      return updatedList;
    });
  };

  // 상위 그룹 전체 일괄 권한 설정 (조회/저장)
  const handleToggleCategoryGroup = (grp: MenuCategoryGroup, type: 'view' | 'save') => {
    if (!canSave || !selectedUserId) return;
    const targetUser = localUsers.find(u => u.id === selectedUserId);
    // 절대 슈퍼 관리자 계정은 권한 회수 불가
    if (targetUser?.id === 'u-1' || targetUser?.id === 'sys-admin' || targetUser?.loginId === 'admin') {
      alert('시스템 최고관리자 계정의 메뉴 권한은 변경할 수 없습니다.');
      return;
    }

    // 그룹 내 메뉴 항목들의 현재 권한 상태 검사 (모두 true이면 전체 false로, 아니면 전체 true로)
    const allChecked = grp.items.every(item => {
      const perm = localPermissions.find(p => p.userId === selectedUserId && p.menuId === item.id);
      return type === 'view' ? perm?.canView : perm?.canSave;
    });

    const targetVal = !allChecked;

    setLocalPermissions(prev => {
      let updatedList = [...prev];

      grp.items.forEach(item => {
        if (item.id === 'payroll' && targetVal) {
          // 급여 정산 일괄 승인 시 보안 체크
          const existingPayrollHolder = updatedList.find(p => {
            if (p.menuId !== 'payroll' || p.userId === selectedUserId) return false;
            const u = localUsers.find(user => user.id === p.userId);
            return u && u.role !== 'ADMIN' && (p.canView || p.canSave);
          });
          if (existingPayrollHolder) return; // 기존 보유자 있을 경우 스킵
        }

        const idx = updatedList.findIndex(p => p.userId === selectedUserId && p.menuId === item.id);
        if (idx > -1) {
          const cur = updatedList[idx];
          if (type === 'view') {
            const nextView = targetVal;
            const nextSave = nextView ? cur.canSave : false;
            updatedList[idx] = { ...cur, canView: nextView, canSave: nextSave };
          } else {
            const nextSave = targetVal;
            const nextView = nextSave ? true : cur.canView;
            updatedList[idx] = { ...cur, canView: nextView, canSave: nextSave };
          }
        } else {
          updatedList.push({
            id: `perm-${selectedUserId}-${item.id}`,
            userId: selectedUserId,
            menuId: item.id,
            canView: type === 'view' ? targetVal : targetVal,
            canSave: type === 'save' ? targetVal : false,
            createdAt: new Date().toISOString()
          });
        }
      });

      setIsDirty(true);
      return updatedList;
    });
  };

  // 모든 카테고리 전체 메뉴 최상위 일괄 권한 설정 (조회/저장)
  const handleToggleAllMenus = (type: 'view' | 'save') => {
    if (!canSave || !selectedUserId) return;
    const targetUser = localUsers.find(u => u.id === selectedUserId);
    if (targetUser?.id === 'u-1' || targetUser?.id === 'sys-admin' || targetUser?.loginId === 'admin') {
      alert('시스템 최고관리자 계정의 메뉴 권한은 변경할 수 없습니다.');
      return;
    }

    const allItems = MENU_CATEGORIES.flatMap(grp => grp.items);
    const allChecked = allItems.every(item => {
      const perm = localPermissions.find(p => p.userId === selectedUserId && p.menuId === item.id);
      return type === 'view' ? perm?.canView : perm?.canSave;
    });

    const targetVal = !allChecked;

    setLocalPermissions(prev => {
      let updatedList = [...prev];

      allItems.forEach(item => {
        if (item.id === 'payroll' && targetVal) {
          const existingPayrollHolder = updatedList.find(p => {
            if (p.menuId !== 'payroll' || p.userId === selectedUserId) return false;
            const u = localUsers.find(user => user.id === p.userId);
            return u && u.role !== 'ADMIN' && (p.canView || p.canSave);
          });
          if (existingPayrollHolder) return;
        }

        const idx = updatedList.findIndex(p => p.userId === selectedUserId && p.menuId === item.id);
        if (idx > -1) {
          const cur = updatedList[idx];
          if (type === 'view') {
            const nextView = targetVal;
            const nextSave = nextView ? cur.canSave : false;
            updatedList[idx] = { ...cur, canView: nextView, canSave: nextSave };
          } else {
            const nextSave = targetVal;
            const nextView = nextSave ? true : cur.canView;
            updatedList[idx] = { ...cur, canView: nextView, canSave: nextSave };
          }
        } else {
          updatedList.push({
            id: `perm-${selectedUserId}-${item.id}`,
            userId: selectedUserId,
            menuId: item.id,
            canView: type === 'view' ? targetVal : targetVal,
            canSave: type === 'save' ? targetVal : false,
            createdAt: new Date().toISOString()
          });
        }
      });

      setIsDirty(true);
      return updatedList;
    });
  };

  const handleSavePermissions = async () => {
    if (!canSave) return;
    try {
      await updatePermissions(localPermissions);
      setIsDirty(false);
      alert('메뉴 권한 설정이 성공적으로 저장되었습니다.');
    } catch (err: any) {
      console.error('Save permissions error:', err);
      showErrorModal(`⚠️ 메뉴 권한 설정 저장 중 오류가 발생했습니다:\n\n${err?.message || err}`);
    }
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield className="text-primary" /> 사용자 및 메뉴 권한 통합 관리
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            사이드바 계층 구조(상위-하위)에 따라 직원별 조회 및 저장(수정/삭제) 권한을 정밀 통제합니다.
          </p>
        </div>
        {canSave && (
          <button 
            className={`btn-${isDirty ? 'primary' : 'secondary'}`} 
            onClick={handleSavePermissions}
            disabled={!isDirty}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: isDirty ? '0 0 12px rgba(59, 130, 246, 0.5)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            <Save size={16} /> {isDirty ? '변경사항 저장 적용' : '저장 완료'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
        
        {/* 사용자 리스트 (좌측 패널) */}
        <div className="card" style={{ margin: 0, height: '700px', display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div className="card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
            <h3 className="card-title" style={{ fontSize: '15px' }}>등록 임직원 리스트</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>직원 선택 후 권한 설정</span>
          </div>

          <div className="table-container" style={{ flex: 1, overflowY: 'auto', border: 'none' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>임직원명</th>
                  <th>등급</th>
                </tr>
              </thead>
              <tbody>
                {localUsers.map(u => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <tr 
                      key={u.id} 
                      onClick={() => setSelectedUserId(u.id)}
                      style={{ 
                        cursor: 'pointer', 
                        backgroundColor: isSelected ? 'var(--primary-light)' : 'transparent',
                        borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent'
                      }}
                    >
                      <td>
                        <strong style={{ color: isSelected ? 'var(--primary)' : 'var(--text-primary)', fontSize: '13px' }}>{u.name}</strong> 
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.department} ({u.loginId || '미등록'})</div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select 
                          value={u.role || 'USER'}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={!canSave || u.id === 'sys-admin'}
                          style={{
                            padding: '3px 6px', fontSize: '11.5px', borderRadius: '4px',
                            border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)',
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 계층형 메뉴 권한 매트릭스 (우측 패널) */}
        <div className="card" style={{ margin: 0, height: '700px', display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div className="card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: '15px' }}>
                상위-하위 계층 메뉴 권한 매트릭스
                {selectedUser && <span style={{ marginLeft: '10px', fontSize: '14px', color: 'var(--primary)' }}>[{selectedUser.name} {selectedUser.role}]</span>}
              </h3>
            </div>
            {selectedUser?.role === 'ADMIN' && (
              <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 'bold' }}>* ADMIN 등급은 전권 자동 소유</span>
            )}
          </div>

          <div className="table-container" style={{ flex: 1, overflowY: 'auto', border: 'none', boxShadow: 'none' }}>
            <table style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                  <th style={{ padding: '10px 14px', verticalAlign: 'middle' }}>상위 카테고리 및 하위 메뉴명</th>
                  <th style={{ width: '135px', textAlign: 'center', padding: '8px 4px' }}>
                    {(() => {
                      const isSuperAdminUser = selectedUser?.id === 'u-1' || selectedUser?.id === 'sys-admin' || selectedUser?.loginId === 'admin';
                      const allItems = MENU_CATEGORIES.flatMap(g => g.items);
                      const isAllGlobalViewChecked = allItems.length > 0 && allItems.every(item => {
                        const p = localPermissions.find(x => (x.userId === selectedUserId || (x as any).user_id === selectedUserId) && x.menuId === item.id);
                        return isSuperAdminUser ? true : (p?.canView ?? false);
                      });
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px' }}>조회 (VIEW)</span>
                          <button
                            type="button"
                            disabled={!canSave || isSuperAdminUser}
                            onClick={() => handleToggleAllMenus('view')}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: isAllGlobalViewChecked ? 'var(--primary)' : 'var(--bg-card)',
                              color: isAllGlobalViewChecked ? '#fff' : 'var(--text-secondary)',
                              cursor: canSave && !isSuperAdminUser ? 'pointer' : 'default',
                              fontWeight: '700'
                            }}
                          >
                            {isAllGlobalViewChecked ? '전체해제' : '전체선택'}
                          </button>
                        </div>
                      );
                    })()}
                  </th>
                  <th style={{ width: '135px', textAlign: 'center', padding: '8px 4px' }}>
                    {(() => {
                      const isSuperAdminUser = selectedUser?.id === 'u-1' || selectedUser?.id === 'sys-admin' || selectedUser?.loginId === 'admin';
                      const allItems = MENU_CATEGORIES.flatMap(g => g.items);
                      const isAllGlobalSaveChecked = allItems.length > 0 && allItems.every(item => {
                        const p = localPermissions.find(x => (x.userId === selectedUserId || (x as any).user_id === selectedUserId) && x.menuId === item.id);
                        return isSuperAdminUser ? true : (p?.canSave ?? false);
                      });
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px' }}>저장 (SAVE)</span>
                          <button
                            type="button"
                            disabled={!canSave || isSuperAdminUser}
                            onClick={() => handleToggleAllMenus('save')}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: isAllGlobalSaveChecked ? 'var(--success)' : 'var(--bg-card)',
                              color: isAllGlobalSaveChecked ? '#fff' : 'var(--text-secondary)',
                              cursor: canSave && !isSuperAdminUser ? 'pointer' : 'default',
                              fontWeight: '700'
                            }}
                          >
                            {isAllGlobalSaveChecked ? '전체해제' : '전체선택'}
                          </button>
                        </div>
                      );
                    })()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {MENU_CATEGORIES.map(grp => {
                  const isCollapsed = collapsedGroups[grp.id] === true;
                  const isAdmin = selectedUser?.role === 'ADMIN';
                  const isSuperAdminUser = selectedUser?.id === 'u-1' || selectedUser?.id === 'sys-admin' || selectedUser?.loginId === 'admin';

                  // 상위 그룹의 전체 선택 상태 파악
                  const allViewChecked = grp.items.every(item => {
                    const p = localPermissions.find(x => (x.userId === selectedUserId || (x as any).user_id === selectedUserId) && x.menuId === item.id);
                    return isSuperAdminUser ? true : (p?.canView ?? false);
                  });
                  const allSaveChecked = grp.items.every(item => {
                    const p = localPermissions.find(x => (x.userId === selectedUserId || (x as any).user_id === selectedUserId) && x.menuId === item.id);
                    return isSuperAdminUser ? true : (p?.canSave ?? false);
                  });

                  return (
                    <React.Fragment key={grp.id}>
                      {/* 상위 메뉴 카테고리 헤더 행 */}
                      <tr style={{ backgroundColor: 'var(--bg-app)', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => toggleGroupCollapse(grp.id)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}>
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            <FolderKanban size={16} />
                            <span>{grp.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '6px' }}>
                              ({grp.items.length}개 메뉴)
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px' }}>
                          <button
                            type="button"
                            disabled={!canSave || isSuperAdminUser}
                            onClick={() => handleToggleCategoryGroup(grp, 'view')}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: allViewChecked ? 'var(--primary)' : 'var(--bg-card)',
                              color: allViewChecked ? '#fff' : 'var(--text-secondary)',
                              cursor: canSave && !isSuperAdminUser ? 'pointer' : 'default',
                              fontWeight: '600'
                            }}
                          >
                            {allViewChecked ? '조회 전체해제' : '조회 전체선택'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px' }}>
                          <button
                            type="button"
                            disabled={!canSave || isSuperAdminUser}
                            onClick={() => handleToggleCategoryGroup(grp, 'save')}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: allSaveChecked ? 'var(--success)' : 'var(--bg-card)',
                              color: allSaveChecked ? '#fff' : 'var(--text-secondary)',
                              cursor: canSave && !isSuperAdminUser ? 'pointer' : 'default',
                              fontWeight: '600'
                            }}
                          >
                            {allSaveChecked ? '저장 전체해제' : '저장 전체선택'}
                          </button>
                        </td>
                      </tr>

                      {/* 하위 메뉴 행들 */}
                      {!isCollapsed && grp.items.map(menu => {
                        const perm = localPermissions.find(p => p.userId === selectedUserId && p.menuId === menu.id) || { canView: isSuperAdminUser, canSave: isSuperAdminUser };
                        const canView = isSuperAdminUser || perm.canView;
                        const canSaveVal = isSuperAdminUser || perm.canSave;

                        return (
                          <tr key={menu.id} style={{ borderBottom: '1px dashed var(--border-color)' }}>
                            <td style={{ paddingLeft: '32px', fontSize: '13px' }}>
                              <span>• {menu.name}</span>
                            </td>

                            {/* 조회 권한 */}
                            <td style={{ textAlign: 'center' }}>
                              {isSuperAdminUser ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}><Lock size={12} /> 허용</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={canView}
                                  onChange={() => handlePermissionToggle(menu.id, 'view')}
                                  disabled={!canSave}
                                  style={{ cursor: canSave ? 'pointer' : 'default', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                                />
                              )}
                            </td>

                            {/* 저장 권한 */}
                            <td style={{ textAlign: 'center' }}>
                              {isSuperAdminUser ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}><Lock size={12} /> 허용</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={canSaveVal}
                                  onChange={() => handlePermissionToggle(menu.id, 'save')}
                                  disabled={!canSave || !canView}
                                  style={{ cursor: canSave && canView ? 'pointer' : 'default', width: '16px', height: '16px', accentColor: 'var(--success)' }}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
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
