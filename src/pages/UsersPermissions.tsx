// d:\Kiyeun_Lift\src\pages\UsersPermissions.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Plus, Save, UserPlus, Key } from 'lucide-react';
import { User, MenuPermission } from '../services/db';

export const UsersPermissions: React.FC = () => {
  const { users, permissions, saveUser, updatePermissions, hasPermission, currentUser } = useApp();
  const canSave = hasPermission('permission', 'save');

  // 사용자 등록/수정 모달 상태
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  // 권한 롤 필터 상태
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MANAGER' | 'USER' | 'MECHANIC'>('MANAGER');

  // 메뉴 리스트
  const menus = [
    { id: 'customer', name: '고객 관리 (담당자/현장)' },
    { id: 'product', name: '제품 관리' },
    { id: 'asset', name: '자산 관리' },
    { id: 'acquisition_disposal', name: '당사자산 취득/매각' },
    { id: 'rent_asset', name: '임차자산 조회/등록/반납' },
    { id: 'consumable', name: '소모품 조회/등록/사용' },
    { id: 'contract', name: '계약 관리' },
    { id: 'billing', name: '청구/수납 관리' },
    { id: 'delivery', name: '배차 관리 (비용정산)' },
    { id: 'smart_dispatch', name: '스마트 출고 요청 (파서)' },
    { id: 'repair', name: '자산 수리 관리 (외근정비)' },
    { id: 'permission', name: '사용자 및 권한 설정' }
  ];

  const handleOpenAddUser = () => {
    setEditingUser({ loginId: '', passwordHash: '', name: '', department: '', role: 'USER' });
    setShowUserModal(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleSaveUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser.loginId || !editingUser.name || !editingUser.passwordHash) {
      alert('필수값을 입력해 주세요.');
      return;
    }
    saveUser(editingUser as Omit<User, 'id' | 'createdAt'>);
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handlePermissionToggle = (menuId: string, type: 'view' | 'save') => {
    if (!canSave) {
      alert('권한 설정을 수정할 수 있는 권한이 없습니다.');
      return;
    }
    if (selectedRole === 'ADMIN') {
      alert('ADMIN 권한은 강제 조정할 수 없습니다.');
      return;
    }

    const updatedPermissions = permissions.map(p => {
      if (p.role === selectedRole && p.menuId === menuId) {
        return {
          ...p,
          canView: type === 'view' ? !p.canView : p.canView,
          canSave: type === 'save' ? !p.canSave : p.canSave
        };
      }
      return p;
    });

    updatePermissions(updatedPermissions);
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>사용자 및 권한 관리</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* 사용자 관리 카드 */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">등록된 사용자 리스트</h3>
            {canSave && (
              <button className="btn-primary" onClick={handleOpenAddUser} style={{ padding: '6px 12px', fontSize: '13px' }}>
                <UserPlus size={16} /> 사용자 추가
              </button>
            )}
          </div>

          <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table style={{ minWidth: '400px' }}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>ID</th>
                  <th>부서</th>
                  <th>권한</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong style={{ color: 'var(--primary)' }}>{u.name}</strong></td>
                    <td>{u.loginId}</td>
                    <td>{u.department}</td>
                    <td>
                      <span className={`badge ${
                        u.role === 'ADMIN' ? 'badge-danger' : 
                        u.role === 'MANAGER' ? 'badge-success' : 
                        u.role === 'MECHANIC' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {canSave && (
                        <button className="btn-secondary" onClick={() => handleOpenEditUser(u)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                          수정
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 메뉴별 권한 매트릭스 카드 */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">역할별 메뉴 통제 매트릭스</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* ADMIN은 항상 모든 권한 소유</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {(['MANAGER', 'USER', 'MECHANIC'] as const).map(role => (
              <button
                key={role}
                className={selectedRole === role ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setSelectedRole(role)}
                style={{ padding: '8px 14px', flex: 1 }}
              >
                {role} 권한
              </button>
            ))}
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table style={{ minWidth: '400px' }}>
              <thead>
                <tr>
                  <th>대상 메뉴명</th>
                  <th style={{ textAlign: 'center' }}>조회 (View)</th>
                  <th style={{ textAlign: 'center' }}>저장 (Save)</th>
                </tr>
              </thead>
              <tbody>
                {menus.map(menu => {
                  const perm = permissions.find(p => p.role === selectedRole && p.menuId === menu.id) || { canView: false, canSave: false };
                  return (
                    <tr key={menu.id}>
                      <td>{menu.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={perm.canView}
                          disabled={!canSave || selectedRole === 'ADMIN'}
                          onChange={() => handlePermissionToggle(menu.id, 'view')}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={perm.canSave}
                          disabled={!canSave || selectedRole === 'ADMIN'}
                          onChange={() => handlePermissionToggle(menu.id, 'save')}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
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

      {/* 사용자 추가/수정 모달 */}
      {showUserModal && editingUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSaveUserSubmit} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">{editingUser.id ? '사용자 정보 수정' : '신규 사용자 등록'}</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>로그인 ID *</label>
                <input
                  type="text"
                  value={editingUser.loginId || ''}
                  disabled={!!editingUser.id}
                  onChange={e => setEditingUser({ ...editingUser, loginId: e.target.value })}
                  placeholder="아이디"
                  required
                />
              </div>
              <div>
                <label>비밀번호 *</label>
                <input
                  type="password"
                  value={editingUser.passwordHash || ''}
                  onChange={e => setEditingUser({ ...editingUser, passwordHash: e.target.value })}
                  placeholder="비밀번호"
                  required
                />
              </div>
              <div>
                <label>이름 *</label>
                <input
                  type="text"
                  value={editingUser.name || ''}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="성명"
                  required
                />
              </div>
              <div>
                <label>소속 부서</label>
                <input
                  type="text"
                  value={editingUser.department || ''}
                  onChange={e => setEditingUser({ ...editingUser, department: e.target.value })}
                  placeholder="부서명"
                />
              </div>
              <div>
                <label>직무 역할 권한</label>
                <select
                  value={editingUser.role || 'USER'}
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value as User['role'] })}
                >
                  <option value="USER">USER (영업사원)</option>
                  <option value="MANAGER">MANAGER (영업총괄)</option>
                  <option value="MECHANIC">MECHANIC (현장정비사)</option>
                  <option value="ADMIN">ADMIN (최고관리자)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowUserModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
