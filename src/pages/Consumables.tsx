// d:\Kiyeun_Lift\src\pages\Consumables.tsx
import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, Hammer, ListCollapse, Layers, Plus, ClipboardList, PackagePlus, CheckCircle2, XCircle, Search, Download, FileText, Camera, Upload, RefreshCw } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { drive } from '../services/drive';
import { Consumable } from '../services/db';

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1200;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => {
        resolve(file);
      };
    };
    reader.onerror = () => {
      resolve(file);
    };
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const Consumables: React.FC = () => {
  const {
    consumables, consumableLogs, consumablePurchases, assets, purchaseConsumable, useConsumable,
    requestConsumablePurchase, acceptConsumablePurchase, completeConsumablePurchase, inboundConsumablePurchase,
    hasPermission, users, currentUser, googleConfigs, showErrorModal
  } = useApp();

  const canSave = hasPermission('consumable', 'save');
  // 탭 구성: STOCK (보유 재고), REQ_LIST (신청 내역 조회), REQ_WRITE (구매신청 작성), REQ_INBOUND (구매물품 입고처리), USE (소모품 사용), LOGS (입출고 로그)
  const [activeTab, setActiveTab] = useState<'STOCK' | 'REQ_LIST' | 'REQ_WRITE' | 'REQ_INBOUND' | 'USE' | 'LOGS'>('STOCK');

  // --- [1] 구매신청 조회용 필터 상태 ---
  const [reqSearchTerm, setReqSearchTerm] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETED'>('ALL');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');

  // 실제 조회 버튼 클릭 시 확정되어 적용되는 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [statusQuery, setStatusQuery] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETED'>('ALL');
  const [startDateQuery, setStartDateQuery] = useState('');
  const [endDateQuery, setEndDateQuery] = useState('');

  // --- [2] 구매신청 작성(Write) 폼 상태 ---
  const [reqConsumableId, setReqConsumableId] = useState('');
  const [reqModelName, setReqModelName] = useState('');
  const [reqQty, setReqQty] = useState(1);
  const [reqUnitPrice, setReqUnitPrice] = useState(0);
  const [reqDate, setReqDate] = useState(new Date().toISOString().split('T')[0]);
  const [reqSellerName, setReqSellerName] = useState('');

  // --- [3] 입고처리(Inbound) 폼 상태 ---
  const [selectedReqId, setSelectedReqId] = useState('');
  const [inboundQty, setInboundQty] = useState(1);
  const [uploadMethod, setUploadMethod] = useState<'PC' | 'MOBILE'>('PC');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [noInvoice, setNoInvoice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- [4] 소모품 사용(Use) 폼 상태 ---
  const [useConsumableId, setUseConsumableId] = useState('');
  const [useQty, setUseQty] = useState(1);
  const [useAssetId, setUseAssetId] = useState('');
  const [useDesc, setUseDesc] = useState('');

  // --- [5] 증빙 미리보기 상태 ---
  const [previewRequest, setPreviewRequest] = useState<any | null>(null);

  const getUserName = (id?: string) => {
    if (!id) return '시스템';
    return users.find(u => u.id === id)?.name || '정비 담당자';
  };

  const getAssetNo = (id?: string) => {
    if (!id) return '-';
    return assets.find(a => a.id === id)?.assetNo || '-';
  };

  // --- 엑셀 다운로드 핸들러 ---
  const handleExportStock = () => {
    const excelData = consumables.map((c, idx) => {
      const logs = consumableLogs.filter(l => l.consumableId === c.id);
      const totalUsed = logs.filter(l => l.type === 'OUTBOUND').reduce((sum, l) => sum + l.quantity, 0);
      const totalPurchased = c.stockQty + totalUsed;
      return {
        'No': idx + 1,
        '자재 품목명': c.modelName,
        '구입수량': totalPurchased,
        '사용수량': totalUsed,
        '현재 재고수량': c.stockQty,
        '단위': c.unit,
        '최근단가': c.unitPrice,
        '최근 구입처': c.supplier || '-',
        '안전재고수준': c.stockQty <= 2 ? '재고 부족 (긴급)' : c.stockQty < 5 ? '보충 필요' : '여유'
      };
    });
    exportToExcel(excelData, `소모품_재고현황_${new Date().toISOString().split('T')[0]}`, '재고현황');
  };

  const handleExportPurchases = () => {
    const filteredPurchases = getFilteredPurchases();
    const excelData = filteredPurchases.map((p, idx) => ({
      'No': idx + 1,
      '품명': p.modelName,
      '신청수량': p.requestedQty,
      '신청단가': p.unitPrice,
      '신청작성일': p.requestDate,
      '판매처': p.sellerName,
      '상태': p.status === 'REQUESTED' ? '신청' : p.status === 'ACCEPTED' ? '접수' : p.status === 'COMPLETED' ? '구매완료' : '취소',
      '접수일': p.acceptedDate || '-',
      '완료일': p.completedDate || '-',
      '누적입고수량': p.receivedQty,
      '증빙링크': p.statementFileUrl || '-',
      '신청자': p.requesterName || '-',
      '접수자': p.accepterName || '-',
      '입고처리자': p.inbounderName || '-'
    }));
    exportToExcel(excelData, `소모품_구매신청내역_${new Date().toISOString().split('T')[0]}`, '구매신청목록');
  };

  const handleExportLogs = () => {
    const excelData = consumableLogs.map((log, idx) => {
      const item = consumables.find(c => c.id === log.consumableId);
      return {
        'No': idx + 1,
        '구분': log.type === 'INBOUND' ? '구입입고' : '자재사용',
        '변동일자': log.actionDate,
        '자재 품목명': item?.modelName || '삭제된 소모품',
        '수량': log.quantity,
        '단가': log.unitPrice,
        '소계(원)': log.quantity * log.unitPrice,
        '대상장비': log.targetAssetId ? getAssetNo(log.targetAssetId) : '-',
        '처리담당자': getUserName(log.userId),
        '설명': log.description
      };
    });
    exportToExcel(excelData, `소모품_입출고이력_${new Date().toISOString().split('T')[0]}`, '입출고로그');
  };

  // --- 구매신청 필터 연동 ---
  const getFilteredPurchases = () => {
    return consumablePurchases.filter(p => {
      const matchesSearch = p.modelName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusQuery === 'ALL' ? true :
                            statusQuery === 'COMPLETED' ? p.status === 'COMPLETED' :
                            p.status !== 'COMPLETED';

      const matchesStart = !startDateQuery || p.requestDate >= startDateQuery;
      const matchesEnd = !endDateQuery || p.requestDate <= endDateQuery;

      return matchesSearch && matchesStatus && matchesStart && matchesEnd;
    });
  };

  // --- 구매신청서 작성 제출 ---
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    
    const finalModelName = reqConsumableId === 'NEW' ? reqModelName : (consumables.find(c => c.id === reqConsumableId)?.modelName || '');
    if (!finalModelName || reqQty <= 0 || reqUnitPrice < 0 || !reqSellerName) {
      alert('신청 품명, 수량, 단가 및 판매처를 올바르게 지정해 주세요.');
      return;
    }

    try {
      await requestConsumablePurchase({
        consumableId: reqConsumableId !== 'NEW' ? reqConsumableId : undefined,
        modelName: finalModelName,
        qty: reqQty,
        unitPrice: reqUnitPrice,
        requestDate: reqDate,
        sellerName: reqSellerName
      });

      alert('소모품 구매 신청서가 성공적으로 제출 및 저장되었습니다.');
      
      // 초기화 및 탭 전환
      setReqConsumableId('');
      setReqModelName('');
      setReqQty(1);
      setReqUnitPrice(0);
      setReqSellerName('');
      setActiveTab('REQ_LIST');
    } catch (err: any) {
      showErrorModal(`⚠️ 소모품 구매신청 저장 중 오류가 발생했습니다:\n\n${err?.message || err}`, '구매신청 저장 오류');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
        alert('허용되는 파일 형식이 아닙니다 (PDF, JPG, JPEG, PNG만 가능).');
        if (e.target) e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  // --- 입고 확정 처리 (제출 시 업로드 수행) ---
  const handleInboundConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!selectedReqId || inboundQty <= 0) {
      alert('입고할 신청건을 선택하고 입고 수량을 지정해 주세요.');
      return;
    }
    if (!selectedFile) {
      alert('공급자 거래명세서 증빙 파일을 먼저 지정해 주세요.');
      return;
    }

    setIsUploading(true);

    // 1. 이미지 압축 처리 (JPEG/JPG/PNG 이미지 대상)
    let fileToUpload = selectedFile;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'pdf';
    const isImage = ['jpg', 'jpeg', 'png'].includes(ext) || selectedFile.type.startsWith('image/');
    
    if (isImage) {
      try {
        fileToUpload = await compressImage(selectedFile);
      } catch (err) {
        console.error("Image compression failed, using original file:", err);
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const seq = String(consumableLogs.filter(l => l.actionDate === dateStr && l.type === 'INBOUND').length + 1).padStart(3, '0');
    const prefix = noInvoice ? 'INB-PHOTO-' : 'INB-';
    const newFileName = `${prefix}${dateStr}-${seq}.${ext}`;

    let base64Url = '';
    try {
      base64Url = await fileToBase64(fileToUpload);
    } catch (err) {
      console.error("FileReader failed:", err);
    }

    const config = googleConfigs[0];
    const targetFolderName = config?.consumableFolder || '소모품납품증빙';

    setTimeout(async () => {
      // 1. 구글 드라이브 관리 폴더가 있는지 체크하고 없으면 생성
      let folder = drive.listFolders().find(f => f.name === targetFolderName);
      if (!folder) {
        folder = drive.createFolder(targetFolderName, 'root');
      }

      // 2. 구글드라이브에 가상 파일 업로드
      const mockFile = drive.uploadFile(
        newFileName,
        fileToUpload.type || (ext.toLowerCase() === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        `${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`,
        folder.id,
        base64Url
      );

      try {
        await inboundConsumablePurchase(selectedReqId, inboundQty, mockFile.webViewLink);
        setIsUploading(false);
        const docTypeText = noInvoice ? '실물 납품 증빙 사진이' : '거래명세서가';
        alert(`소모품 입고 처리가 완료되었습니다.\n${docTypeText} 구글드라이브 [${targetFolderName}] 폴더에 안전하게 보존되었습니다.\n저장된 파일명: ${newFileName}`);
        
        // 리셋
        setSelectedReqId('');
        setInboundQty(1);
        setSelectedFile(null);
        setNoInvoice(false);
        setActiveTab('STOCK');
      } catch (err: any) {
        setIsUploading(false);
        showErrorModal(`⚠️ 입고 처리 중 오류가 발생했습니다:\n\n${err?.message || err}`, '소모품 입고 오류');
      }
    }, 1000);
  };

  const handleUseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!useConsumableId || useQty <= 0 || !useAssetId) {
      alert('필수 값을 선택해 주세요.');
      return;
    }

    const selectedConsumable = consumables.find(c => c.id === useConsumableId);
    if (!selectedConsumable || selectedConsumable.stockQty < useQty) {
      alert('재고가 부족하여 소모품을 사용할 수 없습니다.');
      return;
    }

    try {
      await useConsumable({
        consumableId: useConsumableId,
        quantity: useQty,
        targetAssetId: useAssetId,
        description: useDesc || '정비 소모품 출고'
      });

      alert('소모품 출고 및 수리 자재 등록이 완료되었습니다.');
      setUseConsumableId('');
      setUseQty(1);
      setUseAssetId('');
      setUseDesc('');
      setActiveTab('STOCK');
    } catch (err: any) {
      showErrorModal(`⚠️ 소모품 사용 처리 중 오류가 발생했습니다:\n\n${err?.message || err}`, '소모품 출고 오류');
    }
  };

  // 입고 대상 선택 가능한 구매완료 건 목록
  const activeCompletedPurchases = consumablePurchases.filter(p => p.status === 'COMPLETED' && p.receivedQty < p.requestedQty);

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: '700' }}>소모품 및 자재 관리</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'STOCK' && (
            <button className="btn-secondary" onClick={handleExportStock} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 재고현황 다운로드
            </button>
          )}
          {activeTab === 'REQ_LIST' && (
            <button className="btn-secondary" onClick={handleExportPurchases} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 신청내역 다운로드
            </button>
          )}
          {activeTab === 'LOGS' && (
            <button className="btn-secondary" onClick={handleExportLogs} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 이력로그 다운로드
            </button>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          className={activeTab === 'STOCK' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('STOCK')}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Layers size={14} /> 보유 재고 현황
        </button>
        <button
          className={activeTab === 'REQ_LIST' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('REQ_LIST')}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ClipboardList size={14} /> 구매 신청 내역 조회
        </button>
        {canSave && (
          <>
            <button
              className={activeTab === 'REQ_WRITE' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('REQ_WRITE')}
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> 소모품 구매 신청
            </button>
            <button
              className={activeTab === 'REQ_INBOUND' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('REQ_INBOUND')}
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <PackagePlus size={14} /> 구매품 입고 처리 (증빙 필수)
            </button>

            <button
              className={activeTab === 'USE' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('USE')}
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Hammer size={14} /> 소모품 사용 (출고)
            </button>
          </>
        )}
        <button
          className={activeTab === 'LOGS' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('LOGS')}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ListCollapse size={14} /> 입출고 이력 로그
        </button>
      </div>

      {/* [TAB 1] 보유 재고 현황 */}
      {activeTab === 'STOCK' && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">소모품 보유 수량 목록</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* 재고 5개 이하 시 보충 경고</span>
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>자재 품목명</th>
                  <th style={{ textAlign: 'center' }}>구입수량</th>
                  <th style={{ textAlign: 'center' }}>사용수량</th>
                  <th style={{ textAlign: 'center' }}>현재 재고수량</th>
                  <th>단위</th>
                  <th>단가</th>
                  <th>최근 구입처</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {consumables.map(c => {
                  const logs = consumableLogs.filter(l => l.consumableId === c.id);
                  const totalUsed = logs.filter(l => l.type === 'OUTBOUND').reduce((sum, l) => sum + l.quantity, 0);
                  const totalPurchased = c.stockQty + totalUsed;

                  return (
                    <tr key={c.id}>
                      <td><strong style={{ color: 'var(--primary)' }}>{c.modelName}</strong></td>
                      <td style={{ textAlign: 'center' }}>{totalPurchased}</td>
                      <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: '500' }}>{totalUsed}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '15px', color: 'var(--success)' }}>{c.stockQty}</td>
                      <td>{c.unit}</td>
                      <td>{c.unitPrice.toLocaleString()}원</td>
                      <td>{c.supplier || '-'}</td>
                      <td>
                        {c.stockQty <= 2 ? (
                          <span className="badge badge-danger">재고 부족 (긴급)</span>
                        ) : c.stockQty < 5 ? (
                          <span className="badge badge-warning">보충 필요</span>
                        ) : (
                          <span className="badge badge-success">여유</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* [TAB 2] 구매 신청 내역 조회 */}
      {activeTab === 'REQ_LIST' && (
        <div>
          {/* 조회 필터 */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <form onSubmit={e => {
              e.preventDefault();
              setSearchQuery(reqSearchTerm);
              setStatusQuery(reqStatusFilter);
              setStartDateQuery(reqStartDate);
              setEndDateQuery(reqEndDate);
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
                <div>
                  <label>품명/판매처 검색</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={reqSearchTerm}
                      onChange={e => setReqSearchTerm(e.target.value)}
                      placeholder="품명, 거래처 등..."
                      style={{ paddingLeft: '32px' }}
                    />
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <div>
                  <label>완료 여부</label>
                  <select value={reqStatusFilter} onChange={e => setReqStatusFilter(e.target.value as any)}>
                    <option value="ALL">전체 신청 내역</option>
                    <option value="INCOMPLETE">미완료 신청 (신청/접수)</option>
                    <option value="COMPLETED">완료된 신청 (구매완료)</option>
                  </select>
                </div>
                <div>
                  <label>신청시작일</label>
                  <input type="date" value={reqStartDate} onChange={e => setReqStartDate(e.target.value)} />
                </div>
                <div>
                  <label>신청종료일</label>
                  <input type="date" value={reqEndDate} onChange={e => setReqEndDate(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1, height: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                    <Search size={14} /> 조회
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setReqSearchTerm('');
                      setReqStatusFilter('ALL');
                      setReqStartDate('');
                      setReqEndDate('');
                      setSearchQuery('');
                      setStatusQuery('ALL');
                      setStartDateQuery('');
                      setEndDateQuery('');
                    }}
                    style={{ height: '38px' }}
                  >
                    초기화
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* 목록 표시 */}
          <div className="card" style={{ margin: 0 }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>소모품 자재 구매 신청 내역</h3>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>품명</th>
                    <th>신청수량</th>
                    <th>신청단가</th>
                    <th>신청일</th>
                    <th>판매처 / 구매URL</th>
                    <th>상태</th>
                    <th>접수일 / 완료일</th>
                    <th>증빙파일</th>
                    {canSave && <th style={{ textAlign: 'center' }}>결정/관리</th>}
                  </tr>
                </thead>
                <tbody>
                  {getFilteredPurchases().length === 0 ? (
                    <tr>
                      <td colSpan={canSave ? 9 : 8} style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                        {consumablePurchases.length === 0 ? '📭 등록된 구매신청 데이터가 없습니다.' : '🔍 조회 조건에 맞는 구매신청 데이터가 없습니다. 검색 조건을 변경해 보세요.'}
                      </td>
                    </tr>
                  ) : (
                    getFilteredPurchases().map(p => {
                      const isUrl = p.sellerName.toLowerCase().startsWith('http') || p.sellerName.toLowerCase().startsWith('www');
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.modelName}</strong></td>
                          <td>
                            {p.requestedQty}개 <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>(입고: {p.receivedQty}개)</span>
                          </td>
                          <td>{p.unitPrice.toLocaleString()}원</td>
                          <td>
                            <div>{p.requestDate}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              신청: {p.requesterName}
                            </div>
                          </td>
                          <td>
                            {isUrl ? (
                              <a href={p.sellerName.startsWith('http') ? p.sellerName : `https://${p.sellerName}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all' }}>
                                온라인 구매 바로가기
                              </a>
                            ) : (
                              p.sellerName
                            )}
                          </td>
                          <td>
                            <span className={`badge ${
                              p.status === 'REQUESTED' ? 'badge-warning' :
                              p.status === 'ACCEPTED' ? 'badge-info' :
                              p.status === 'COMPLETED' ? 'badge-success' : 'badge-secondary'
                            }`}>
                              {p.status === 'REQUESTED' ? '신청완료' : p.status === 'ACCEPTED' ? '접수완료' : p.status === 'COMPLETED' ? '구매완료' : '신청취소'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            <div>접수: {p.acceptedDate || '-'} {p.accepterName ? `(${p.accepterName})` : ''}</div>
                            <div>완료: {p.completedDate || '-'} {p.inbounderName ? `(입고: ${p.inbounderName})` : ''}</div>
                          </td>
                          <td>
                            {p.statementFileUrl ? (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setPreviewRequest(p)}
                                style={{ padding: '2px 6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                              >
                                <FileText size={10} /> 명세서 열기
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>미제출</span>
                            )}
                          </td>
                          {canSave && (
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                {p.status === 'REQUESTED' && (
                                  <button
                                    className="btn-primary"
                                    onClick={async () => {
                                      try {
                                        await acceptConsumablePurchase(p.id);
                                      } catch (err: any) {
                                        showErrorModal(`⚠️ 접수 처리 실패:\n\n${err?.message || err}`, '접수 오류');
                                      }
                                    }}
                                    style={{ padding: '2px 6px', fontSize: '11px', backgroundColor: 'var(--info)' }}
                                  >
                                    접수
                                  </button>
                                )}
                                {(p.status === 'REQUESTED' || p.status === 'ACCEPTED') && (
                                  <button
                                    className="btn-primary"
                                    onClick={async () => {
                                      try {
                                        await completeConsumablePurchase(p.id);
                                      } catch (err: any) {
                                        showErrorModal(`⚠️ 구매완료 처리 실패:\n\n${err?.message || err}`, '구매완료 오류');
                                      }
                                    }}
                                    style={{ padding: '2px 6px', fontSize: '11px' }}
                                  >
                                    구매완료
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* [TAB 3] 구매 신청서 작성 */}
      {activeTab === 'REQ_WRITE' && (
        <div className="card" style={{ maxWidth: '600px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>소모품 구매 신청서 작성</h3>
          <form onSubmit={handleRequestSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label>대상 품목 선택 *</label>
                <select value={reqConsumableId} onChange={e => {
                  setReqConsumableId(e.target.value);
                  if (e.target.value !== 'NEW' && e.target.value !== '') {
                    const item = consumables.find(c => c.id === e.target.value);
                    if (item) {
                      setReqModelName(item.modelName);
                      setReqUnitPrice(item.unitPrice || 0);
                    }
                  } else {
                    setReqModelName('');
                    setReqUnitPrice(0);
                  }
                }} required>
                  <option value="">-- 품목 선택 --</option>
                  <option value="NEW">[NEW] -- 신규 품목명 직접 입력 --</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>{c.modelName} (현재고: {c.stockQty}{c.unit})</option>
                  ))}
                </select>
              </div>

              {reqConsumableId === 'NEW' && (
                <div>
                  <label>신규 소모품 품명 입력 *</label>
                  <input
                    type="text"
                    value={reqModelName}
                    onChange={e => setReqModelName(e.target.value)}
                    placeholder="예: SJ3219 교체용 조이스틱 컨트롤러"
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>신청 수량 *</label>
                  <input
                    type="number"
                    value={reqQty || ''}
                    onChange={e => setReqQty(parseInt(e.target.value) || 1)}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label>신청 단가 (원) *</label>
                  <input
                    type="number"
                    value={reqUnitPrice || ''}
                    onChange={e => setReqUnitPrice(parseInt(e.target.value) || 0)}
                    placeholder="예상 매입 단가"
                    required
                  />
                </div>
              </div>

              <div>
                <label>신청 작성일자 *</label>
                <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} required />
              </div>

              <div>
                <label>판매처 또는 구매 URL *</label>
                <input
                  type="text"
                  value={reqSellerName}
                  onChange={e => setReqSellerName(e.target.value)}
                  placeholder="예: 세방상사 또는 온라인 구매 링크(https://...)"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  * 거래처명을 입력하거나 온라인 판매의 경우 상품 상세 URL을 입력해 주세요.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('REQ_LIST')}>목록보기</button>
              <button type="submit" className="btn-primary">구매 신청서 제출</button>
            </div>
          </form>
        </div>
      )}

      {/* [TAB 4] 구매품 입고 처리 (거래명세서 구글드라이브 저장 의무화) */}
      {activeTab === 'REQ_INBOUND' && (
        <div className="card" style={{ maxWidth: '700px', width: '100%', margin: '0 0 40px 0', padding: '20px 18px 24px 18px' }}>
          <h3 className="card-title" style={{ marginBottom: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📦 구매 완료된 소모품 자재 입고 처리
          </h3>
          <form onSubmit={handleInboundConfirmSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontWeight: '700', fontSize: '13.5px', marginBottom: '6px', display: 'block' }}>구매 완료된 신청 건 선택 *</label>
                <select value={selectedReqId} onChange={e => {
                  setSelectedReqId(e.target.value);
                  const p = consumablePurchases.find(req => req.id === e.target.value);
                  if (p) {
                    setInboundQty(p.requestedQty - p.receivedQty);
                  } else {
                    setInboundQty(1);
                  }
                  setSelectedFile(null);
                  setUploadedFileUrl('');
                }} required style={{ width: '100%', height: '42px', fontSize: '13.5px' }}>
                  <option value="">-- 입고할 완료된 구매신청 선택 --</option>
                  {activeCompletedPurchases.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.requestDate}] {p.modelName} (신청: {p.requestedQty}개 / 기입고: {p.receivedQty}개) - {p.sellerName.substring(0,25)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedReqId && (
                <>
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary)' }}>선택된 구매 신청 상세</h4>
                    {(() => {
                      const p = consumablePurchases.find(req => req.id === selectedReqId);
                      if (!p) return null;
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '12.5px' }}>
                          <div><strong>품명:</strong> {p.modelName}</div>
                          <div><strong>신청 수량:</strong> {p.requestedQty}개</div>
                          <div><strong>기 입고량:</strong> {p.receivedQty}개</div>
                          <div><strong>미입고 잔량:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{p.requestedQty - p.receivedQty}개</span></div>
                          <div><strong>단가:</strong> {p.unitPrice.toLocaleString()}원</div>
                          <div><strong>판매처:</strong> {p.sellerName}</div>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label style={{ fontWeight: '700', fontSize: '13.5px', marginBottom: '6px', display: 'block' }}>금회 입고 수량 *</label>
                    <input
                      type="number"
                      value={inboundQty || ''}
                      onChange={e => setInboundQty(parseInt(e.target.value) || 1)}
                      min={1}
                      max={(() => {
                        const p = consumablePurchases.find(req => req.id === selectedReqId);
                        return p ? (p.requestedQty - p.receivedQty) : 9999;
                      })()}
                      required
                      style={{ width: '100%', height: '40px', fontSize: '14px' }}
                    />
                  </div>

                  {/* 공급자 거래명세서 / 사진 촬영 증빙 지정 영역 */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--bg-card)' }}>
                    <label style={{ fontWeight: '700', fontSize: '13.5px', marginBottom: '6px', display: 'block', color: 'var(--primary)' }}>
                      📑 납품 증빙 문서 및 사진 첨부 (필수)
                    </label>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.4' }}>
                      스캔된 거래명세서 문서는 <strong>[📁 파일지정]</strong>을 이용하시고, 현장 실물 자재나 약식 인수표는 <strong>[📷 사진촬영]</strong>을 클릭하여 스마트폰으로 즉시 촬영하여 첨부하세요.
                    </p>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {/* 1. 파일 지정 버튼 */}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setNoInvoice(false);
                          fileInputRef.current?.click();
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', padding: '0 16px', fontWeight: '700', flex: '1 1 140px', justifyContent: 'center' }}
                      >
                        <Upload size={16} /> 📁 파일지정
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => {
                          setNoInvoice(false);
                          handleFileChange(e);
                        }}
                        style={{ display: 'none' }}
                        accept="application/pdf,image/*"
                      />

                      {/* 2. 사진 촬영 버튼 */}
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setNoInvoice(true);
                          cameraInputRef.current?.click();
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', padding: '0 16px', fontWeight: '700', flex: '1 1 140px', justifyContent: 'center', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', borderColor: '#059669' }}
                      >
                        <Camera size={16} /> 📷 사진촬영
                      </button>
                      <input
                        type="file"
                        ref={cameraInputRef}
                        onChange={(e) => {
                          setNoInvoice(true);
                          handleFileChange(e);
                        }}
                        style={{ display: 'none' }}
                        accept="image/*"
                        capture="environment"
                      />
                    </div>

                    {/* 선택된 파일 명세 안내 */}
                    {selectedFile && (
                      <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>
                            {noInvoice ? '📸 사진촬영' : '📄 문서지정'}:
                          </span>
                          <strong>{selectedFile.name}</strong>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                            ({((selectedFile.size || 0) / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}
                        >
                          취소
                        </button>
                      </div>
                    )}

                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: selectedFile ? 'var(--success)' : 'var(--danger)', fontSize: '12.5px', fontWeight: '600' }}>
                      {selectedFile ? (
                        <>
                          <CheckCircle2 size={16} /> {noInvoice ? '실물 납품 사진이 첨부되었습니다.' : '거래명세서 파일이 첨부되었습니다.'}
                        </>
                      ) : (
                        <>
                          <XCircle size={14} /> [📁 파일지정] 또는 [📷 사진촬영]으로 증빙을 먼저 선택해 주세요.
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 하단 입고 완료 대형 직관 버튼 (모바일 100% 가시성 보장) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px', marginBottom: '20px' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={isUploading || inboundQty <= 0 || !selectedFile}
                style={{
                  width: '100%',
                  height: '52px',
                  fontSize: '16px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  background: (isUploading || inboundQty <= 0 || !selectedFile)
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  boxShadow: (isUploading || inboundQty <= 0 || !selectedFile)
                    ? 'none'
                    : '0 4px 14px rgba(37, 99, 235, 0.35)',
                  cursor: (isUploading || inboundQty <= 0 || !selectedFile) ? 'not-allowed' : 'pointer'
                }}
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> 입고 처리 중...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} /> 입고완료 및 증빙 보전 저장
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveTab('STOCK')}
                style={{ width: '100%', height: '40px', fontSize: '14px', justifyContent: 'center' }}
              >
                취소 후 목록으로 이동
              </button>
            </div>

            {/* 스마트폰 하단 툴바 가림 방지 폼 내부 초대형 스페이서 (350px) */}
            <div style={{ height: '350px', width: '100%', minHeight: '350px', clear: 'both' }} aria-hidden="true" />
          </form>
          {/* 스마트폰 하단 툴바 가림 방지 카드 하단 스페이서 (350px) */}
          <div style={{ height: '350px', width: '100%', minHeight: '350px', clear: 'both' }} aria-hidden="true" />
        </div>
      )}



      {/* [TAB 6] 소모품 사용 (출고) */}
      {activeTab === 'USE' && (
        <div className="card" style={{ maxWidth: '600px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>소모품 수리 정비 사용 등록</h3>
          <form onSubmit={handleUseSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>자재 품목 선택 *</label>
                <select value={useConsumableId} onChange={e => setUseConsumableId(e.target.value)} required>
                  <option value="">-- 소모품 품목 선택 --</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>{c.modelName} (현재고: {c.stockQty}{c.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label>사용 수량 *</label>
                <input
                  type="number"
                  value={useQty || ''}
                  onChange={e => setUseQty(parseInt(e.target.value) || 1)}
                  min={1}
                  required
                />
              </div>

              <div>
                <label>장착 자산 (관리번호) *</label>
                <select value={useAssetId} onChange={e => setUseAssetId(e.target.value)} required>
                  <option value="">-- 대상 장비 자산 선택 --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.assetNo} ({a.modelName}) - {a.status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>사용 내역 설명</label>
                <textarea
                  value={useDesc}
                  onChange={e => setUseDesc(e.target.value)}
                  placeholder="사용 목적 및 교체 사유 기술..."
                  rows={2}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary">사용 확정</button>
            </div>
          </form>
        </div>
      )}

      {/* [TAB 7] 입출고 이력 로그 */}
      {activeTab === 'LOGS' && (
        <div className="card" style={{ margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>입출고 변동 상세 이력</h3>
          
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>구분</th>
                  <th>변동일자</th>
                  <th>자재 품목명</th>
                  <th>수량</th>
                  <th>단가</th>
                  <th>소계</th>
                  <th>대상장비</th>
                  <th>처리담당자</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {consumableLogs.map(log => {
                  const item = consumables.find(c => c.id === log.consumableId);
                  return (
                    <tr key={log.id}>
                      <td>
                        <span className={`badge ${log.type === 'INBOUND' ? 'badge-success' : 'badge-danger'}`}>
                          {log.type === 'INBOUND' ? '구입입고' : '자재사용'}
                        </span>
                      </td>
                      <td>{log.actionDate}</td>
                      <td>{item?.modelName || '삭제된 소모품'}</td>
                      <td>
                        {log.type === 'INBOUND' ? '+' : '-'}{log.quantity}
                      </td>
                      <td>{log.unitPrice.toLocaleString()}원</td>
                      <td style={{ fontWeight: '600' }}>
                        {(log.quantity * log.unitPrice).toLocaleString()}원
                      </td>
                      <td>{log.targetAssetId ? getAssetNo(log.targetAssetId) : '-'}</td>
                      <td>{getUserName(log.userId)}</td>
                      <td style={{ fontSize: '13px' }}>{log.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* [MODAL] 증빙 거래명세서 미리보기 모달 */}
      {previewRequest && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '650px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
            
            {/* 모달 헤더 */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} style={{ color: 'var(--primary)' }} /> 거래명세서 증빙 미리보기
              </h3>
              <button 
                type="button" 
                onClick={() => setPreviewRequest(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '700' }}
              >
                &times;
              </button>
            </div>

            {/* 모달 바디 */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {previewRequest.statementFileUrl.startsWith('data:') ? (
                // 실제 업로드된 파일 (Data URL)
                previewRequest.statementFileUrl.startsWith('data:image/') ? (
                  <div style={{ textAlign: 'center' }}>
                    <img 
                      src={previewRequest.statementFileUrl} 
                      alt="거래명세서 증빙 이미지" 
                      style={{ maxWidth: '100%', maxHeight: '550px', borderRadius: '6px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }} 
                    />
                  </div>
                ) : (
                  // PDF 또는 기타 문서형식의 Data URL
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <FileText size={56} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>PDF 증빙 문서가 안전하게 보관되어 있습니다.</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
                      브라우저 보안 보안 정책에 따라, 파일 다운로드를 통해 원본 거래명세서를 안전하게 열람하실 수 있습니다.
                    </p>
                    <a 
                      href={previewRequest.statementFileUrl} 
                      download={`INB-${previewRequest.completedDate || previewRequest.requestDate || '증빙'}.pdf`}
                      className="btn-primary" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '6px', textDecoration: 'none' }}
                    >
                      <Download size={14} /> PDF 다운로드 및 열기
                    </a>
                  </div>
                )
              ) : (
                // 모의(Seed) 데이터용 거래명세서 템플릿
                <div style={{ border: '2px solid #333', padding: '24px', fontFamily: 'monospace', color: '#000', backgroundColor: '#fff', borderRadius: '4px', lineHeight: '1.5', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
                  <h2 style={{ textAlign: 'center', letterSpacing: '8px', textDecoration: 'underline', marginBottom: '24px', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>거 래 명 세 서</h2>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #333', marginBottom: '16px', color: '#000' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 'bold', width: '15%', backgroundColor: '#f2f2f2' }}>거래일자</td>
                        <td style={{ border: '1px solid #333', padding: '6px' }}>{previewRequest.completedDate || previewRequest.requestDate}</td>
                        <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 'bold', width: '15%', backgroundColor: '#f2f2f2' }}>증빙코드</td>
                        <td style={{ border: '1px solid #333', padding: '6px' }}>{previewRequest.statementFileUrl.split('/').pop()}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ border: '1px solid #333', padding: '10px', fontSize: '12px', color: '#000' }}>
                      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '6px' }}>■ 공급자 (Supplier)</div>
                      <div><strong>상호:</strong> {previewRequest.sellerName}</div>
                      <div><strong>대표자:</strong> 김협력 (인)</div>
                      <div><strong>소재지:</strong> 서울시 영등포구 경인로 12</div>
                    </div>
                    <div style={{ border: '1px solid #333', padding: '10px', fontSize: '12px', color: '#000' }}>
                      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '6px' }}>■ 공급받는자 (Receiver)</div>
                      <div><strong>상호:</strong> (주)기윤리프트</div>
                      <div><strong>대표자:</strong> 이정용 (인)</div>
                      <div><strong>소재지:</strong> 경기도 시흥시 번영로 123</div>
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #333', marginBottom: '16px', color: '#000' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f2f2f2' }}>
                        <th style={{ border: '1px solid #333', padding: '6px' }}>품목명 / 규격</th>
                        <th style={{ border: '1px solid #333', padding: '6px', width: '12%', textAlign: 'center' }}>수량</th>
                        <th style={{ border: '1px solid #333', padding: '6px', width: '22%', textAlign: 'right' }}>단가</th>
                        <th style={{ border: '1px solid #333', padding: '6px', width: '25%', textAlign: 'right' }}>공급가액</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '6px' }}>{previewRequest.modelName}</td>
                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>{previewRequest.requestedQty}개</td>
                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{previewRequest.unitPrice.toLocaleString()}원</td>
                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{(previewRequest.requestedQty * previewRequest.unitPrice).toLocaleString()}원</td>
                      </tr>
                      <tr>
                        <td colSpan={3} style={{ border: '1px solid #333', padding: '6px', fontWeight: 'bold', backgroundColor: '#f2f2f2', textAlign: 'right' }}>공급가액 소계</td>
                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{(previewRequest.requestedQty * previewRequest.unitPrice).toLocaleString()}원</td>
                      </tr>
                      <tr>
                        <td colSpan={3} style={{ border: '1px solid #333', padding: '6px', fontWeight: 'bold', backgroundColor: '#f2f2f2', textAlign: 'right' }}>부가가치세 (10%)</td>
                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{(previewRequest.requestedQty * previewRequest.unitPrice * 0.1).toLocaleString()}원</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9f9f9' }}>
                        <td colSpan={3} style={{ border: '1px solid #333', padding: '6px', fontWeight: 'bold', textAlign: 'right' }}>총 합계금액 (V.A.T 포함)</td>
                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>{(previewRequest.requestedQty * previewRequest.unitPrice * 1.1).toLocaleString()}원</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      ※ 본 명세서는 시스템 내부 모의 증빙 데이터이며, 실제 세무 용도로는 세금계산서를 참조해 주십시오.
                    </div>
                    <div style={{ border: '2px solid red', padding: '4px 8px', color: 'red', borderRadius: '4px', transform: 'rotate(-5deg)', fontWeight: 'bold', fontSize: '11px', display: 'inline-block' }}>
                      (주)기윤리프트 영수/인
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-app)' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setPreviewRequest(null)}
                style={{ padding: '6px 14px', fontSize: '13px' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 모바일 화면 하단 스크롤 여유 350px 스페이서 */}
      <div style={{ height: '350px', width: '100%', minHeight: '350px', clear: 'both' }} aria-hidden="true" />
    </div>
  );
};
