// d:\Kiyeun_Lift\src\pages\Products.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Download, Search, RefreshCw, FileText, X, CloudUpload, Sparkles, Folder, Trash2, ExternalLink, Upload } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { db, Product } from '../services/db';
import { LIFT_RETRACTED_IMG, LIFT_EXTENDED_IMG } from '../services/specImages';

interface R2DocFile {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  url: string;
}

export const Products: React.FC = () => {
  const { products, saveProduct, hasPermission, assets, refreshAllData, googleConfigs } = useApp();
  const canSave = hasPermission('product', 'save');

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingModelId, setGeneratingModelId] = useState<string | null>(null);

  // Cloudflare R2 제품별 문서함 상태
  const [r2Files, setR2Files] = useState<R2DocFile[]>([]);
  const [loadingR2Docs, setLoadingR2Docs] = useState<boolean>(false);
  const [showR2DocModal, setShowR2DocModal] = useState<boolean>(false);
  const [selectedProductForDocs, setSelectedProductForDocs] = useState<Product | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);

  const fetchR2Files = async () => {
    const config = googleConfigs[0];
    const accountId = config?.r2AccountId || '35014a2514680107d74e1e68d96e6c32';
    const bucketName = config?.r2BucketName || 'kiyeun-storage';
    const accessKeyId = config?.r2AccessKeyId || '03cdb7560d37242de608a5db2a976030';
    const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';
    const publicDomain = config?.r2PublicDomain || 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev';

    setLoadingR2Docs(true);
    try {
      const res = await fetch('/api/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          prefix: 'Eq_doc/',
          accountId,
          bucketName,
          accessKeyId,
          secretAccessKey
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        const mapped: R2DocFile[] = data.files
          .filter((f: any) => !f.isDirectory && f.key !== 'Eq_doc/')
          .map((f: any) => {
            const parts = f.key.split('/');
            const name = parts[parts.length - 1];
            return {
              key: f.key,
              name,
              size: f.size,
              lastModified: f.lastModified,
              url: `${publicDomain.replace(/\/$/, '')}/${encodeURIComponent(f.key).replace(/%2F/g, '/')}`
            };
          });
        setR2Files(mapped);
      }
    } catch (err) {
      console.warn('R2 docs fetch error:', err);
    } finally {
      setLoadingR2Docs(false);
    }
  };

  useEffect(() => {
    fetchR2Files();
  }, [googleConfigs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
      await fetchR2Files();
      alert("최신 데이터를 성공적으로 불러왔습니다.");
    } catch (err: any) {
      console.error("Failed to sync from Supabase:", err);
      alert("최신 데이터를 가져오는 데 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  };

  // specSheetUrl이 이미 있으면 바로 열기, 없으면 생성 후 저장
  const handleGenerateAndUploadR2 = async (product: Product) => {
    if (!product.modelName) return;
    if (product.specSheetUrl) {
      window.open(product.specSheetUrl, '_blank');
      return;
    }
    setGeneratingModelId(product.id || product.modelName);
    try {
      throw new Error('브라우저 기반 PDF 렌더러가 사용 중단되었습니다. 향후 정품 엑셀 기반 렌더러로 교체 예정입니다.');
    } catch (err: any) {
      console.error('PDF error:', err);
      alert('브라우저 기반 PDF 렌더러가 사용 중단되었습니다.');
    } finally {
      setGeneratingModelId(null);
    }
  };

  const handleDownloadPdf = async (product: Partial<Product>) => {
    alert('브라우저 기반 PDF 렌더러가 폐기되었습니다. 정품 엑셀 엔진으로 개편 대기 중입니다.');
  };

  type ProductSortField = 'modelName' | 'feet' | 'spec' | 'manufacturer' | 'isActive' | 'assetCount' | 'createdAt';
  const [sortField, setSortField] = useState<ProductSortField>('modelName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: ProductSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct({
      modelName: '',
      feet: 19,
      spec: '',
      manufacturer: '',
      isActive: true,
      powerSource: '배터리',
      asContact: '031-334-5296',
      maxWindSpeed: '12.5 m/s 이내',
      safetyCertUrl: '',
      specSheetUrl: '',
      emergencyGuideUrl: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setShowModal(true);
  };

  const handleOpenPreview = (p: Product) => {
    setPreviewProduct(p);
    setShowPreviewModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.modelName) return;

    const feetValue = Number(editingProduct.feet);
    if (isNaN(feetValue) || feetValue <= 0) {
      alert("피트 규격은 0보다 큰 숫자(실수 가능, 예: 3.6, 12, 19 등)로 입력해야 합니다.");
      return;
    }

    // 클로저 캡처 (setState 초기화 전에 저장)
    const productSnapshot = { ...editingProduct } as Product;

    try {
      await saveProduct(editingProduct as Omit<Product, 'id' | 'createdAt'>);
      setShowModal(false);
      setEditingProduct(null);
      refreshAllData();

      // 기존 제원표 PDF가 없는 모델인 경우에만 백그라운드 자동 생성 -> 브라우저 렌더러 폐기로 삭제됨
    } catch (err: any) {
      alert(`저장 실패: ${err?.message || JSON.stringify(err)}`);
    }
  };


  const [assetFilter, setAssetFilter] = useState<'ALL' | 'WITH_ASSETS' | 'NO_ASSETS'>('ALL');

  const clean = (s?: string) => (s || '').replace(/[- _/]/g, '').toUpperCase().trim();

  const assetStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; owned: number; leased: number; available: number; rented: number }>();
    for (const p of products) {
      const pClean = clean(p.modelName);
      const matched = assets.filter(a => {
        const aClean = clean(a.modelName);
        return a.modelName === p.modelName || aClean === pClean;
      });
      const owned = matched.filter(a => a.ownerType === 'OWNED' || !a.ownerType).length;
      const leased = matched.filter(a => a.ownerType === 'RENTED').length;
      const available = matched.filter(a => a.status === 'AVAILABLE').length;
      const rented = matched.filter(a => a.status === 'RENTED').length;
      map.set(p.id, { total: matched.length, owned, leased, available, rented });
    }
    return map;
  }, [products, assets]);

  const r2FilesByModelMap = useMemo(() => {
    const map = new Map<string, R2DocFile[]>();
    for (const p of products) {
      const pClean = clean(p.modelName);
      const matched = r2Files.filter(f => {
        const parts = f.key.split('/');
        if (parts.length < 3) return false;
        const folderModel = parts[1];
        const fClean = clean(folderModel);
        return folderModel === p.modelName || fClean === pClean || fClean.includes(pClean) || pClean.includes(fClean);
      });
      map.set(p.id, matched);
    }
    return map;
  }, [products, r2Files]);

  const handleOpenR2DocModal = (p: Product) => {
    setSelectedProductForDocs(p);
    setShowR2DocModal(true);
  };

  const handleUploadCustomDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProductForDocs) return;

    setUploadingDoc(true);
    try {
      const config = googleConfigs[0];
      const accountId = config?.r2AccountId || '35014a2514680107d74e1e68d96e6c32';
      const bucketName = config?.r2BucketName || 'kiyeun-storage';
      const accessKeyId = config?.r2AccessKeyId || '03cdb7560d37242de608a5db2a976030';
      const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Content = event.target?.result as string;
        const key = `Eq_doc/${selectedProductForDocs.modelName}/${file.name}`;

        const res = await fetch('/api/r2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            accountId,
            bucketName,
            accessKeyId,
            secretAccessKey,
            key,
            base64Content,
            contentType: file.type || 'application/pdf'
          })
        });

        const resJson = await res.json();
        if (resJson.success) {
          alert(`✅ 파일 [${file.name}] 업로드 완료!`);
          await fetchR2Files();
        } else {
          alert(`❌ 업로드 실패: ${resJson.error}`);
        }
        setUploadingDoc(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('File upload error:', err);
      alert(`업로드 실패: ${err.message}`);
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (key: string) => {
    if (!confirm(`이 문서를 Cloudflare R2에서 정말 삭제하시겠습니까?\n\n${key}`)) return;

    try {
      const config = googleConfigs[0];
      const accountId = config?.r2AccountId || '35014a2514680107d74e1e68d96e6c32';
      const bucketName = config?.r2BucketName || 'kiyeun-storage';
      const accessKeyId = config?.r2AccessKeyId || '03cdb7560d37242de608a5db2a976030';
      const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';

      const res = await fetch('/api/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          accountId,
          bucketName,
          accessKeyId,
          secretAccessKey,
          key
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        alert("✅ 삭제되었습니다.");
        await fetchR2Files();
      } else {
        alert(`❌ 삭제 실패: ${resJson.error}`);
      }
    } catch (err: any) {
      alert(`삭제 오류: ${err.message}`);
    }
  };

  const totalModelsCount = products.length;
  const withAssetsCount = useMemo(() => products.filter(p => (assetStatsMap.get(p.id)?.total || 0) > 0).length, [products, assetStatsMap]);
  const noAssetsCount = useMemo(() => products.filter(p => (assetStatsMap.get(p.id)?.total || 0) === 0).length, [products, assetStatsMap]);

  const handleExport = () => {
    const excelData = filtered.map((p, idx) => {
      const stats = assetStatsMap.get(p.id) || { total: 0, owned: 0, leased: 0, available: 0, rented: 0 };
      return {
        '번호': idx + 1,
        '모델명': p.modelName,
        '피트(Feet)': p.feet ? `${p.feet} ft` : '-',
        '동력': p.powerSource || '-',
        '작업높이': p.workingHeight || '-',
        '발판높이': p.platformHeight || '-',
        '장비중량': p.weight || '-',
        '적재중량': p.capacityPreExt || '-',
        '장비크기': p.machineDimensions || '-',
        '플랫폼크기': p.platformDimensions || '-',
        '등판능력': p.gradeability || '-',
        '주행속도': p.speed || '-',
        '확장후본체': p.capacityPostExtMain || '-',
        '확장후확장부': p.capacityPostExtDeck || '-',
        '최대풍속': p.maxWindSpeed || '-',
        'A/S접수': p.asContact || '031-334-5296',
        '제조사': p.manufacturer || '-',
        '사용여부': p.isActive !== false ? '사용' : '미사용',
        '총보유대수': stats.total,
        '당사자산대수': stats.owned,
        '외부임차대수': stats.leased,
        '임대가능대수': stats.available,
        '대여중대수': stats.rented,
        '등록일': p.createdAt.substring(0, 10)
      };
    });

    exportToExcel(excelData, `제품목록_${new Date().toISOString().split('T')[0]}`, '제품목록');
  };

  const filtered = products
    .filter(p => {
      const stats = assetStatsMap.get(p.id) || { total: 0, owned: 0, leased: 0, available: 0, rented: 0 };
      if (assetFilter === 'WITH_ASSETS' && stats.total === 0) return false;
      if (assetFilter === 'NO_ASSETS' && stats.total > 0) return false;

      return (
        (p.modelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.manufacturer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.spec || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.powerSource || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .sort((a, b) => {
      let aVal: any = a[sortField as keyof Product];
      let bVal: any = b[sortField as keyof Product];

      if (sortField === 'assetCount') {
        aVal = assetStatsMap.get(a.id)?.total || 0;
        bVal = assetStatsMap.get(b.id)?.total || 0;
      } else if (sortField === 'isActive') {
        aVal = a.isActive !== false ? 1 : 0;
        bVal = b.isActive !== false ? 1 : 0;
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'ko');
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });

  const renderSortArrow = (field: ProductSortField) => {
    if (sortField !== field) return <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }}>↕</span>;
    return <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '12px', marginLeft: '4px' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '12px' }}>
      <div className="card-header" style={{ marginBottom: 0, flexShrink: 0 }}>
        <div>
          <h2 className="card-title">제품 모델 관리</h2>
          <p className="card-subtitle">장비 모델 및 제원표 규격 관리</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            새로고침
          </button>
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={16} />
            내보내기
          </button>
          {canSave && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} />
              모델 등록
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: 0, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '380px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="모델명, 제조사, 동력, 제원 검색..."
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* 자산 보유 여부 필터 탭 */}
        <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px', gap: '2px' }}>
          <button
            type="button"
            onClick={() => setAssetFilter('ALL')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: assetFilter === 'ALL' ? 'bold' : 'normal',
              color: assetFilter === 'ALL' ? '#fff' : 'var(--text-muted)',
              backgroundColor: assetFilter === 'ALL' ? 'var(--primary)' : 'transparent',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            전체 ({totalModelsCount})
          </button>
          <button
            type="button"
            onClick={() => setAssetFilter('WITH_ASSETS')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: assetFilter === 'WITH_ASSETS' ? 'bold' : 'normal',
              color: assetFilter === 'WITH_ASSETS' ? '#fff' : 'var(--text-muted)',
              backgroundColor: assetFilter === 'WITH_ASSETS' ? 'var(--primary)' : 'transparent',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            자산 보유 ({withAssetsCount})
          </button>
          <button
            type="button"
            onClick={() => setAssetFilter('NO_ASSETS')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: assetFilter === 'NO_ASSETS' ? 'bold' : 'normal',
              color: assetFilter === 'NO_ASSETS' ? '#fff' : 'var(--text-muted)',
              backgroundColor: assetFilter === 'NO_ASSETS' ? '#ef4444' : 'transparent',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            자산 미보유 ({noAssetsCount})
          </button>
        </div>
      </div>

      {/* 수직 전용 독립 스크롤 컨테이너 (하단 뷰포트 영역 100% 가득 활용) */}
      <div className="table-container" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', maxHeight: 'none', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-sidebar)' }}>
            <tr>
              <th style={{ width: '60px', textAlign: 'center', whiteSpace: 'nowrap' }}>NO</th>
              <th onClick={() => handleSort('modelName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                모델명 {renderSortArrow('modelName')}
              </th>
              <th onClick={() => handleSort('feet')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                피트 (FEET) {renderSortArrow('feet')}
              </th>
              <th onClick={() => handleSort('assetCount')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                자산현황 (당사/임차) {renderSortArrow('assetCount')}
              </th>
              <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>클라우드 문서 (R2)</th>
              <th style={{ whiteSpace: 'nowrap' }}>동력</th>
              <th style={{ whiteSpace: 'nowrap' }}>작업높이</th>
              <th style={{ whiteSpace: 'nowrap' }}>발판높이</th>
              <th style={{ whiteSpace: 'nowrap' }}>장비중량</th>
              <th style={{ whiteSpace: 'nowrap' }}>적재중량</th>
              <th style={{ whiteSpace: 'nowrap' }}>장비크기</th>
              <th style={{ whiteSpace: 'nowrap' }}>주행속도</th>
              <th onClick={() => handleSort('manufacturer')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                제조사 {renderSortArrow('manufacturer')}
              </th>
              <th onClick={() => handleSort('isActive')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                사용 여부 {renderSortArrow('isActive')}
              </th>
              <th onClick={() => handleSort('createdAt')} style={{ width: '110px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                등록일 {renderSortArrow('createdAt')}
              </th>
              <th style={{ width: '130px', textAlign: 'center', whiteSpace: 'nowrap' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={16} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  {products.length === 0 ? '등록된 제품 모델이 없습니다.' : '조회 조건에 맞는 제품 모델이 없습니다.'}
                </td>
              </tr>
            ) : (
              filtered.map((p, idx) => {
                const stats = assetStatsMap.get(p.id) || { total: 0, owned: 0, leased: 0, available: 0, rented: 0 };
                const docList = r2FilesByModelMap.get(p.id) || [];
                return (
                  <tr key={p.id} style={{ opacity: p.isActive !== false ? 1 : 0.6 }}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>{p.modelName}</strong></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.feet} ft</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {stats.total > 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={`가동현황: 임대가능 ${stats.available}대, 대여중 ${stats.rented}대`}>
                          <span className="badge badge-primary" style={{ fontWeight: 'bold' }}>
                            총 {stats.total}대
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            (자사 {stats.owned} · 임차 {stats.leased})
                          </span>
                        </div>
                      ) : (
                        <span className="badge badge-secondary" style={{ opacity: 0.6, fontSize: '11px' }}>
                          미보유 (0대)
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenR2DocModal(p)}
                        className={`badge ${docList.length > 0 ? 'badge-primary' : 'badge-secondary'}`}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          border: 'none',
                          opacity: docList.length > 0 ? 1 : 0.6
                        }}
                        title="Cloudflare R2 제품 문서함 열기"
                      >
                        <Folder size={12} />
                        {docList.length}건
                      </button>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.powerSource || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.workingHeight || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.platformHeight || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.weight || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.capacityPreExt || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.machineDimensions || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.speed || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.manufacturer || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`badge ${p.isActive !== false ? 'badge-success' : 'badge-secondary'}`}>
                        {p.isActive !== false ? '사용' : '미사용'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.createdAt.substring(0, 10)}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          className={p.specSheetUrl ? 'btn-secondary' : 'btn-secondary'}
                          onClick={() => p.specSheetUrl ? window.open(p.specSheetUrl, '_blank') : undefined}
                          disabled={!p.specSheetUrl || generatingModelId === (p.id || p.modelName)}
                          style={{
                            padding: '3px 8px', fontSize: '11px',
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                            opacity: p.specSheetUrl ? 1 : 0.4,
                            cursor: p.specSheetUrl ? 'pointer' : 'not-allowed',
                          }}
                          title={p.specSheetUrl ? '저장된 제원표 PDF 열기' : '제원표 없음 — 수정 저장 시 자동 생성됩니다'}
                        >
                          <FileText size={12} />
                          {generatingModelId === (p.id || p.modelName)
                            ? '생성중...'
                            : p.specSheetUrl ? '제원표' : '제원표 없음'}
                        </button>

                        {canSave && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenEdit(p)}
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            수정
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 🌟 제원표 미리보기 모달 (규격표 디자인) */}
      {showPreviewModal && previewProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto',
            backgroundColor: '#ffffff', color: '#111827', padding: '24px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                장비 제원표 미리보기
              </h3>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* 상단: 작업대 확장 전/후 적재중량 그래픽 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                작업대 확장 전 / 후 적재중량
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563', marginBottom: '16px' }}>
                장비 모델 : <span style={{ color: '#1d4ed8', fontWeight: 'bold' }}>{previewProduct.modelName}</span>
              </div>

              {/* 하중 분배 다이어그램 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                {/* 확장 전 */}
                <div style={{ textAlign: 'center', borderRight: '1px dashed #d1d5db', paddingRight: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                    {previewProduct.capacityPreExt || '272 kg'}
                  </div>
                  <div style={{ fontSize: '18px', color: '#3b82f6', marginBottom: '4px' }}>⬇️</div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80px', margin: '4px 0' }}>
                    <img
                      src={LIFT_RETRACTED_IMG}
                      alt="작업대 확장 전 리프트 형상"
                      style={{ maxHeight: '76px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', backgroundColor: '#e5e7eb', padding: '4px', borderRadius: '3px' }}>
                    작업대 확장 전 (작업자 2인)
                  </div>
                </div>

                {/* 확장 후 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                        {previewProduct.capacityPostExtMain || '159 kg'}
                      </div>
                      <div style={{ fontSize: '16px', color: '#3b82f6' }}>⬇️</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold' }}>본체</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                        {previewProduct.capacityPostExtDeck || '113 kg'}
                      </div>
                      <div style={{ fontSize: '16px', color: '#3b82f6' }}>⬇️</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold' }}>확장부</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80px', margin: '4px 0' }}>
                    <img
                      src={LIFT_EXTENDED_IMG}
                      alt="작업대 확장 후 리프트 형상"
                      style={{ maxHeight: '76px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', backgroundColor: '#e5e7eb', padding: '4px', borderRadius: '3px' }}>
                    작업대 확장 후 (각 1인)
                  </div>
                </div>
              </div>

              {/* 최대풍속 배너 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <div style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 'bold', padding: '6px 14px', borderRadius: '4px', fontSize: '13px' }}>
                  최대풍속 : {previewProduct.maxWindSpeed || '12.5 m/s 이내'}
                </div>
              </div>
            </div>

            {/* 하단: 장비 제원표 테이블 */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', letterSpacing: '2px' }}>
              장 비 제 원 표
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #111827', fontSize: '12px', color: '#111827', textAlign: 'center' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', width: '22%', padding: '5px', borderRight: '1px solid #111827' }}>사용업체명</td>
                  <td style={{ width: '28%', padding: '5px', borderRight: '1px solid #111827', color: '#6b7280' }}>(계약처 자동출력)</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', width: '22%', padding: '5px', borderRight: '1px solid #111827' }}>임대업체명</td>
                  <td style={{ width: '28%', padding: '5px', fontWeight: 'bold' }}>㈜ 기연리프트</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>장 비 명</td>
                  <td style={{ padding: '5px', borderRight: '1px solid #111827', fontWeight: 'bold' }}>{previewProduct.modelName}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>동 력</td>
                  <td style={{ padding: '5px' }}>{previewProduct.powerSource || '배터리'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>작업 높이</td>
                  <td style={{ padding: '5px', borderRight: '1px solid #111827' }}>{previewProduct.workingHeight || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>발판 높이</td>
                  <td style={{ padding: '5px' }}>{previewProduct.platformHeight || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>장비 중량</td>
                  <td style={{ padding: '5px', borderRight: '1px solid #111827' }}>{previewProduct.weight || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>적재 중량</td>
                  <td style={{ padding: '5px' }}>{previewProduct.capacityPreExt || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>장비 크기</td>
                  <td style={{ padding: '5px', borderRight: '1px solid #111827' }}>{previewProduct.machineDimensions || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>등판 능력</td>
                  <td style={{ padding: '5px' }}>{previewProduct.gradeability || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>플랫폼크기</td>
                  <td style={{ padding: '5px', borderRight: '1px solid #111827' }}>{previewProduct.platformDimensions || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>주행 속도</td>
                  <td style={{ padding: '5px' }}>{previewProduct.speed || '-'}</td>
                </tr>
                <tr>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '5px', borderRight: '1px solid #111827' }}>A/S 접수</td>
                  <td colSpan={3} style={{ padding: '5px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    {previewProduct.asContact || '031-334-5296'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleDownloadPdf(previewProduct)}
                  style={{ padding: '6px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  PDF 다운로드
                </button>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPreviewModal(false)}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 등록 / 수정 모달 */}
      {showModal && editingProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>{editingProduct.id ? '제품 모델 및 제원 수정' : '신규 제품 모델 등록'}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {/* 섹션 1: 기본 식별 정보 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>기본 모델 정보</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>모델명 *</label>
                    <input
                      type="text"
                      value={editingProduct.modelName || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, modelName: e.target.value })}
                      placeholder="예: SJ3215"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>피트 규격 (Feet) *</label>
                    <input
                      type="number"
                      step="any"
                      value={editingProduct.feet || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, feet: parseFloat(e.target.value) })}
                      placeholder="예: 15, 19, 32"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>제조사</label>
                    <input
                      type="text"
                      value={editingProduct.manufacturer || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, manufacturer: e.target.value })}
                      placeholder="예: Skyjack, Genie"
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 2: 제원표 13대 상세 규격 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>장비 제원표 상세 규격 (PDF 자동 출력 항목)</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>동력 방식</label>
                    <input
                      type="text"
                      value={editingProduct.powerSource || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, powerSource: e.target.value })}
                      placeholder="예: 배터리, 디젤, 전동"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>A/S 접수 전화번호</label>
                    <input
                      type="text"
                      value={editingProduct.asContact || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, asContact: e.target.value })}
                      placeholder="예: 031-334-5296"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>작업 높이 (M)</label>
                    <input
                      type="text"
                      value={editingProduct.workingHeight || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, workingHeight: e.target.value })}
                      placeholder="예: 6.57 M"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>발판 높이 (M)</label>
                    <input
                      type="text"
                      value={editingProduct.platformHeight || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, platformHeight: e.target.value })}
                      placeholder="예: 4.57 M"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>장비 중량 (Kg)</label>
                    <input
                      type="text"
                      value={editingProduct.weight || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, weight: e.target.value })}
                      placeholder="예: 1,148 Kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>적재 중량 / 확장 전 (Kg)</label>
                    <input
                      type="text"
                      value={editingProduct.capacityPreExt || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, capacityPreExt: e.target.value })}
                      placeholder="예: 272 kg"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>장비 크기 (전장 x 전폭 x 전고)</label>
                    <input
                      type="text"
                      value={editingProduct.machineDimensions || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, machineDimensions: e.target.value })}
                      placeholder="예: 1.80 x 0.81 x 1.92 M"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>등판 능력 (%)</label>
                    <input
                      type="text"
                      value={editingProduct.gradeability || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, gradeability: e.target.value })}
                      placeholder="예: 25 %"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>플랫폼 크기 (길이 x 폭)</label>
                    <input
                      type="text"
                      value={editingProduct.platformDimensions || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, platformDimensions: e.target.value })}
                      placeholder="예: 1.55 x 0.66 M"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>주행 속도 (Km/h)</label>
                    <input
                      type="text"
                      value={editingProduct.speed || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, speed: e.target.value })}
                      placeholder="예: 3.4 Km/h"
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 3: 확장 후 하중 및 안전 풍속 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>작업대 확장 적재 하중 및 허용 풍속</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>확장 후 본체 하중 (1인)</label>
                    <input
                      type="text"
                      value={editingProduct.capacityPostExtMain || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, capacityPostExtMain: e.target.value })}
                      placeholder="예: 159 kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>확장 후 확장부 하중 (1인)</label>
                    <input
                      type="text"
                      value={editingProduct.capacityPostExtDeck || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, capacityPostExtDeck: e.target.value })}
                      placeholder="예: 113 kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>최대 허용 풍속</label>
                    <input
                      type="text"
                      value={editingProduct.maxWindSpeed || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, maxWindSpeed: e.target.value })}
                      placeholder="예: 12.5 m/s 이내"
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 4: 안전인증 및 클라우드 링크 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>안전인증 및 매뉴얼 링크</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>작업최대높이 / 적재용량</label>
                    <input
                      type="text"
                      value={editingProduct.maxHeightCapacity || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, maxHeightCapacity: e.target.value })}
                      placeholder="예: 6.57 M / 272 kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>안전인증년월일 (KCs)</label>
                    <input
                      type="date"
                      value={editingProduct.safetyCertDate || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, safetyCertDate: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>안전인증서 클라우드 파일 링크</label>
                    <input
                      type="text"
                      value={editingProduct.safetyCertUrl || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, safetyCertUrl: e.target.value })}
                      placeholder="예: https://..."
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>제원표 클라우드 파일 링크</label>
                      <button
                        type="button"
                        onClick={async () => {
                          alert("브라우저 렌더러가 폐기되어 자동 생성 기능을 사용할 수 없습니다. 향후 정품 엑셀 기반으로 개편될 예정입니다.");
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Sparkles size={12} />
                        R2 제원표 자동 생성 & 링크 입력
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editingProduct.specSheetUrl || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, specSheetUrl: e.target.value })}
                      placeholder="예: https://pub-xxx.r2.dev/Eq_doc/..."
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>비상조작방법 매뉴얼 링크</label>
                    <input
                      type="text"
                      value={editingProduct.emergencyGuideUrl || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, emergencyGuideUrl: e.target.value })}
                      placeholder="예: https://..."
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 5: 제원 요약 메모 및 사용 여부 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>기타 비고 및 제원 특징</label>
                <textarea
                  value={editingProduct.spec || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, spec: e.target.value })}
                  placeholder="작업 높이, 적재 용량 등 제원 기재"
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border)', width: 'fit-content' }}>
                <input
                  type="checkbox"
                  id="productIsActive"
                  checked={editingProduct.isActive !== false}
                  onChange={e => setEditingProduct({ ...editingProduct, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0, padding: 0 }}
                />
                <label 
                  htmlFor="productIsActive" 
                  style={{ 
                    margin: 0, 
                    padding: 0, 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    cursor: 'pointer', 
                    color: 'var(--text-primary)', 
                    display: 'inline-block', 
                    whiteSpace: 'nowrap' 
                  }}
                >
                  사용 여부 (단종/매각 시 체크 해제)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 🌟 Cloudflare R2 제품 문서함 팝업 모달 */}
      {/* 🌟 R2 클라우드 문서함 모달 */}
      {showR2DocModal && selectedProductForDocs && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto',
            backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', padding: '24px', borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                  [{selectedProductForDocs.modelName}] 클라우드 문서함
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowR2DocModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>R2 보관 경로: </span>
                  <code style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Eq_doc/{selectedProductForDocs.modelName}/</code>
                </div>
                <label
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: uploadingDoc ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Upload size={14} />
                  {uploadingDoc ? '업로드중...' : '새 문서 업로드'}
                  <input
                    type="file"
                    onChange={handleUploadCustomDoc}
                    disabled={uploadingDoc}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* 파일 목록 */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '20px', backgroundColor: 'var(--bg-card)' }}>
              {(() => {
                const docs = r2FilesByModelMap.get(selectedProductForDocs.id) || [];
                if (docs.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <Folder size={36} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Cloudflare R2에 등록된 문서가 없습니다.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>[제원표 PDF 자동 생성] 버튼을 누르거나 새 문서를 업로드해 주세요.</p>
                    </div>
                  );
                }
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--text-main)' }}>
                    <thead style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)' }}>문서명</th>
                        <th style={{ padding: '8px 12px', width: '80px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)' }}>용량</th>
                        <th style={{ padding: '8px 12px', width: '120px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)' }}>동작</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((doc, i) => (
                        <tr key={doc.key} style={{ borderBottom: i < docs.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                            <FileText size={14} color="var(--text-muted)" />
                            <span style={{ color: 'var(--text-main)' }}>{doc.name}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {(doc.size / 1024).toFixed(0)} KB
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  backgroundColor: 'var(--primary-light)',
                                  color: 'var(--primary)',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  fontWeight: 'bold',
                                  border: '1px solid var(--border-color)'
                                }}
                              >
                                <ExternalLink size={12} />
                                보기
                              </a>
                              {canSave && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoc(doc.key)}
                                  style={{
                                    padding: '3px 6px',
                                    fontSize: '11px',
                                    backgroundColor: 'var(--danger-light)',
                                    color: 'var(--danger)',
                                    border: '1px solid var(--danger-light)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                  title="삭제"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* 모달 하단 액션 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              {canSave && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    await handleGenerateAndUploadR2(selectedProductForDocs);
                    if (!selectedProductForDocs.specSheetUrl) await fetchR2Files();
                  }}
                  disabled={generatingModelId === (selectedProductForDocs.id || selectedProductForDocs.modelName)}
                  style={{
                    padding: '6px 14px', fontSize: '13px',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    backgroundColor: selectedProductForDocs.specSheetUrl ? 'var(--success)' : 'var(--primary)'
                  }}
                >
                  {selectedProductForDocs.specSheetUrl
                    ? <><FileText size={14} /> 제원표 PDF 열기</>
                    : <><Sparkles size={14} /> {generatingModelId === (selectedProductForDocs.id || selectedProductForDocs.modelName) ? '생성중...' : '제원표 PDF 생성 & 저장'}</>
                  }
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowR2DocModal(false)}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
