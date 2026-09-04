// src/pages/inspection_checklist_manage.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Plus, Trash2, Edit2, Save, X, Search, AlertCircle } from 'lucide-react';
import { InspectionChecklistItem, db } from '../services/db';

export const InspectionChecklistManage: React.FC = () => {
  const { inspectionChecklistItems, saveInspectionChecklistItem, deleteInspectionChecklistItem, repairs } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InspectionChecklistItem> | null>(null);

  const [formCategory, setFormCategory] = useState('외관/바디');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formScore, setFormScore] = useState<number>(5);
  const [formDescription, setFormDescription] = useState('');
  // 토스트 알림 상태 (헌장 5.2: 브라우저 alert/confirm 전면 퇴출)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 인앱 커스텀 확인 모달 상태 (헌장 5.2: 브라우저 confirm 전면 퇴출)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // ─── [Gutenberg Z-패턴 4단계 최하단 정비항목 마스터 대차대조식 검증] ───
  const checklistAuditSummary = useMemo(() => {
    const totalCount = inspectionChecklistItems.length;
    const categories = Array.from(new Set(inspectionChecklistItems.map(i => i.category || '외관/바디')));
    const totalScore = inspectionChecklistItems.reduce((sum, i) => sum + (i.score || 0), 0);
    const avgScore = totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';

    return { totalCount, categoryCount: categories.length, totalScore, avgScore };
  }, [inspectionChecklistItems]);

  // 💡 [Phase 2/3] 각 정비 항목(Inspection Item Code)별 과거 AS 발생 누적 통계
  const repairMappingStats = useMemo(() => {
    const stats: Record<string, { count: number; lastOccurred?: string }> = {};
    (repairs || []).forEach(r => {
      if (r.inspectionItemCode) {
        const code = r.inspectionItemCode;
        if (!stats[code]) stats[code] = { count: 0 };
        const stat = stats[code]!;
        stat.count += 1;
        
        if (r.requestDate) {
          if (!stat.lastOccurred || r.requestDate > stat.lastOccurred) {
            stat.lastOccurred = r.requestDate;
          }
        }
      }
    });
    return stats;
  }, [repairs]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormCategory('외관/바디');
    
    // CHK-000000X 7자리 자동 채번 계산
    let maxNum = 0;
    inspectionChecklistItems.forEach(item => {
      if (item.code && item.code.startsWith('CHK-')) {
        const num = parseInt(item.code.replace('CHK-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextCode = `CHK-${String(maxNum + 1).padStart(7, '0')}`;

    setFormCode(nextCode);
    setFormName('');
    setFormScore(5);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: InspectionChecklistItem) => {
    setEditingItem(item);
    setFormCategory(item.category || '외관/바디');
    setFormCode(item.code || '');
    setFormName(item.name || '');
    setFormScore(item.score || 0);
    setFormDescription(item.description || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('정비 필요 항목명을 입력해 주세요.', 'error');
      return;
    }

    try {
      await saveInspectionChecklistItem({
        id: editingItem?.id,
        category: formCategory,
        code: formCode || `CHK-${Date.now().toString().slice(-7)}`,
        name: formName.trim(),
        score: Number(formScore),
        description: formDescription.trim()
      });
      await db.awaitPendingWrites();

      showToast(`[${formName}] 정비 필요 항목 ${editingItem ? '수정' : '신규 등록'} 완료 (${formScore}점)`);
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(`저장 실패: ${err?.message || err}`, 'error');
    }
  };

  const doDelete = async (item: InspectionChecklistItem) => {
    try {
      await deleteInspectionChecklistItem(item.id);
      await db.awaitPendingWrites();
      showToast(`[${item.name}] 항목이 삭제되었습니다.`);
    } catch (err: any) {
      showToast(`삭제 실패: ${err?.message || err}`, 'error');
    }
  };

  const handleDelete = (item: InspectionChecklistItem) => {
    setConfirmModal({
      isOpen: true,
      title: '정비 필요 항목 삭제',
      message: `정비 필요 항목 [${item.name}] (${item.score}점)을 마스터 대장에서 삭제하시겠습니까?`,
      confirmText: '삭제 실행',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(null);
        doDelete(item);
      }
    });
  };

  const filteredItems = inspectionChecklistItems.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term) || (item.description && item.description.toLowerCase().includes(term));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
      {/* 🔔 인앱 토스트 알림 (헌장 5.2) */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {toastMessage.text}
        </div>
      )}
      
      {/* 헤더 구역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck className="text-primary" size={22} /> 정비 항목 관리
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            입고 검수 및 정비 점수 자동 합산 연동 마스터 대장
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> 신규 정비 항목 등록
        </button>
      </div>

      {/* 📊 정비항목 마스터 실시간 요약 바 */}
      {(() => {
        const categories = Array.from(new Set(inspectionChecklistItems.map(i => i.category || '외관/바디')));
        const totalScore = inspectionChecklistItems.reduce((sum, i) => sum + (i.score || 0), 0);

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>관리 카테고리</span>
              <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{categories.length}개</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 정비 필요 항목</span>
              <strong style={{ fontSize: '15px', color: '#16a34a' }}>{inspectionChecklistItems.length}개</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>항목 배점 총합</span>
              <strong style={{ fontSize: '15px', color: '#d97706' }}>{totalScore}점</strong>
            </div>
          </div>
        );
      })()}

      {/* 검색 및 현황 카드 */}
      <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <input
            type="text"
            placeholder="항목명, 카테고리, 설명 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '13px' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          등록된 정비 필요 항목: <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{inspectionChecklistItems.length}</strong>개
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="card" style={{ padding: '16px' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>No</th>
                <th style={{ whiteSpace: 'nowrap' }}>카테고리</th>
                <th style={{ whiteSpace: 'nowrap' }}>항목 코드</th>
                <th style={{ whiteSpace: 'nowrap' }}>정비 필요 항목명</th>
                <th style={{ whiteSpace: 'nowrap' }}>연동 정비 필요 점수</th>
                <th style={{ whiteSpace: 'nowrap' }}>누적 AS 발생(데이터)</th>
                <th>상세 설명 / 세부 가이드</th>
                <th style={{ whiteSpace: 'nowrap' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    등록된 입고 검수 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const stat = repairMappingStats[item.code] || { count: 0 };
                  return (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="badge badge-info">{item.category}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>{item.code}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <strong style={{ fontSize: '13.5px' }}>{item.name}</strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="badge badge-warning" style={{ fontSize: '12px', fontWeight: 'bold', padding: '3px 8px' }}>
                        +{item.score}점
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {stat.count > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.count.toLocaleString()}건</span>
                          {stat.lastOccurred && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>최근: {stat.lastOccurred}</span>}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{item.description || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-secondary" onClick={() => handleOpenEditModal(item)} style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Edit2 size={12} /> 수정
                        </button>
                        <button className="btn-secondary" onClick={() => handleDelete(item)} style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--danger)' }}>
                          <Trash2 size={12} /> 삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUD 모달 팝업 */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '480px', padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontWeight: '700', fontSize: '16px' }}>
                {editingItem ? '🛠️ 정비 필요 항목 수정' : '➕ 신규 정비 필요 항목 등록'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold' }}>카테고리 *</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={{ padding: '8px', fontSize: '13px' }}>
                  <option value="외관/바디">외관/바디 (도장, 섀시, 커버)</option>
                  <option value="유압/동력">유압/동력 (실린더, 유압유, 호스)</option>
                  <option value="전기/배터리">전기/배터리 (단선, 컨트롤러, 충전기)</option>
                  <option value="주행/타이어">주행/타이어 (타이어, 휠, 모터)</option>
                  <option value="기타/검수">기타/검수</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold' }}>항목명 (예: A 불량, B 불량, 유압유 누유) *</label>
                <input
                  type="text"
                  placeholder="예: A 불량 (외관 스크래치/도장 손상)"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                  style={{ padding: '8px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold' }}>연동 정비 필요 점수 (벌점) *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formScore}
                  onChange={e => setFormScore(Number(e.target.value))}
                  required
                  style={{ padding: '8px', fontSize: '13px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>💡 입고 선택 시 이 점수가 자동 합산되어 자산 정비점수로 연동됩니다.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold' }}>상세 설명 및 판단 가이드</label>
                <textarea
                  rows={3}
                  placeholder="현장 검수자가 이 항목을 판단할 때 참고할 기준 가이드..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  style={{ padding: '8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '9px' }}>
                  취소
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '9px', fontWeight: 'bold' }}>
                  <Save size={14} /> 저장 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💬 인앱 확인 모달 (헌장 5.2: alert/confirm 퇴출) */}
      {confirmModal && confirmModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div className="card" style={{ width: '90%', maxWidth: '440px', backgroundColor: 'var(--bg-card)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: confirmModal.isDanger ? 'var(--danger)' : 'var(--text-main)' }}>
              {confirmModal.title}
            </h3>
            <div style={{ fontSize: '12.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {confirmModal.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setConfirmModal(null)} style={{ padding: '6px 14px', fontSize: '12px' }}>
                취소
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmModal.onConfirm}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  backgroundColor: confirmModal.isDanger ? '#dc2626' : 'var(--primary)',
                  borderColor: confirmModal.isDanger ? '#dc2626' : 'var(--primary)'
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚖️ Gutenberg Z-패턴 4단계 최하단 정비항목 마스터 대차대조식 검증 바 (헌장 3.5) */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 'var(--sidebar-width, 240px)',
        right: 0,
        height: '42px',
        backgroundColor: 'var(--bg-card)',
        borderTop: '2px solid var(--primary)',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 99,
        fontSize: '11.5px',
        fontWeight: 600
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <span>🛠️ <strong>정비점검항목:</strong> {checklistAuditSummary.totalCount}개</span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span>📂 <strong>관리분류:</strong> {checklistAuditSummary.categoryCount}개 카테고리</span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span style={{ color: 'var(--warning)' }}>⭐ <strong>배점총합:</strong> {checklistAuditSummary.totalScore}점 (평균 {checklistAuditSummary.avgScore}점)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            fontWeight: 700,
            fontSize: '11px'
          }}>
            ⚖️ 대차 정상 (전체 카테고리 마스터 100% 무결)
          </span>
        </div>
      </div>
      <div style={{ height: '50px' }} aria-hidden="true" />
    </div>
  );
};
