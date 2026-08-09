// src/pages/inspection_checklist_manage.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Plus, Trash2, Edit2, Save, X, Search, AlertCircle } from 'lucide-react';
import { InspectionChecklistItem } from '../services/db';

export const InspectionChecklistManage: React.FC = () => {
  const { inspectionChecklistItems, saveInspectionChecklistItem, deleteInspectionChecklistItem } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InspectionChecklistItem> | null>(null);

  const [formCategory, setFormCategory] = useState('외관/바디');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formScore, setFormScore] = useState<number>(5);
  const [formDescription, setFormDescription] = useState('');

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormCategory('외관/바디');
    setFormCode(`DEFECT_${Date.now().toString().slice(-4)}`);
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
      alert('정비 필요 항목명을 입력해 주세요.');
      return;
    }

    try {
      await saveInspectionChecklistItem({
        id: editingItem?.id,
        category: formCategory,
        code: formCode || `DEFECT_${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        score: Number(formScore),
        description: formDescription.trim()
      });

      alert(`✅ [정비 필요 항목 ${editingItem ? '수정' : '신규 등록'} 완료]\n\n항목명: ${formName}\n부여 점수: ${formScore}점`);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`⚠️ 저장 중 오류 발생: ${err?.message || err}`);
    }
  };

  const handleDelete = async (item: InspectionChecklistItem) => {
    if (!confirm(`[삭제 확인]\n\n정비 필요 항목 [${item.name}] (${item.score}점)을 마스터 대장에서 삭제하시겠습니까?`)) return;

    try {
      await deleteInspectionChecklistItem(item.id);
      alert('✅ 항목이 삭제되었습니다.');
    } catch (err: any) {
      alert(`⚠️ 삭제 실패: ${err?.message || err}`);
    }
  };

  const filteredItems = inspectionChecklistItems.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term) || (item.description && item.description.toLowerCase().includes(term));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 헤더 구역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck className="text-primary" size={22} /> 입고 검수 항목 및 정비 필요 점수 관리
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            현장 입고 시 담당자 주관 판단(휴먼에러)을 차단하고, 사전에 정의된 정비필요 항목 선택 시 점수가 자동 합산 연동되는 마스터 대장입니다.
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> 신규 정비 항목 등록
        </button>
      </div>

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
                <th>상세 설명 / 세부 가이드</th>
                <th style={{ whiteSpace: 'nowrap' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    등록된 입고 검수 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
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
                ))
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

    </div>
  );
};
