// src/components/ContractDocumentBundleModal.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { X, FileText, Download, Eye, CheckCircle2, AlertCircle, RefreshCw, FileCheck } from 'lucide-react';
import { generateCloudflare6DocBundlePdf } from '../services/pdfBundle';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialContractId?: string;
}

export const ContractDocumentBundleModal: React.FC<Props> = ({ isOpen, onClose, initialContractId }) => {
  const { contracts, customers, sites, assets, contractAssets } = useApp();

  const [selectedContractId, setSelectedContractId] = useState<string>(
    initialContractId || contracts[0]?.id || ''
  );

  // 실시간 생성 진행 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [generatedResult, setGeneratedResult] = useState<{ url: string; fileName: string; pageCount: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 선택된 계약 상세 정보 계산
  const selectedContract = useMemo(() => {
    return contracts.find(c => c.id === selectedContractId) || contracts[0];
  }, [contracts, selectedContractId]);

  const customer = useMemo(() => {
    if (!selectedContract) return null;
    return customers.find(cust => cust.id === selectedContract.customerId);
  }, [customers, selectedContract]);

  const site = useMemo(() => {
    if (!selectedContract) return null;
    return sites?.find(s => s.id === selectedContract.siteId);
  }, [sites, selectedContract]);

  const mappedAssets = useMemo(() => {
    if (!selectedContract) return [];
    const caList = contractAssets.filter(ca => ca.contractId === selectedContract.id);
    return caList.map(ca => {
      const a = assets.find(ast => ast.id === ca.assetId);
      return {
        assetNo: a?.assetNo || 'G06119',
        modelName: a?.modelName || ca.expectedModel || 'GTJZ0608ME',
        sn: a?.serialNo || '0108000379',
        rentalFee: ca.monthlyRentalFee || 390000
      };
    });
  }, [selectedContract, contractAssets, assets]);

  if (!isOpen) return null;

  const handleGenerate = async (openPreview: boolean = false) => {
    if (!selectedContract) return;

    setIsGenerating(true);
    setProgressPercent(5);
    setProgressText('6종 서류팩 조립 시작...');
    setErrorMessage(null);
    setGeneratedResult(null);

    const custName = customer?.name || '고객사';
    const siteName = site?.name || '현장미지정';
    const siteAddress = site?.address || customer?.address || '';

    try {
      const result = await generateCloudflare6DocBundlePdf(
        {
          customerName: custName,
          contractDate: selectedContract.startDate,
          contractStartDate: selectedContract.startDate,
          contractEndDate: selectedContract.endDate,
          siteName: siteName,
          siteAddress: siteAddress,
          contractNo: selectedContract.id,
          assets: mappedAssets.length > 0 ? mappedAssets : undefined
        },
        (stepText, current, total) => {
          const percent = Math.round((current / total) * 90);
          setProgressPercent(percent);
          setProgressText('[' + current + '/' + total + '] ' + stepText);
        }
      );

      setProgressPercent(100);
      setProgressText('✅ 총 ' + result.pageCount + '페이지 6종 통합 서류팩 생성 완료!');
      setGeneratedResult({ url: result.url, fileName: result.fileName, pageCount: result.pageCount });

      if (openPreview) {
        window.open(result.url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = result.url;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error('PDF 생성 실패:', err);
      setErrorMessage(err.message || 'PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '760px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          color: '#1e293b'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, whiteSpace: 'nowrap' }}>
              계약 서류 6종 통합 PDF 생성 및 출력
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1. 계약 선택 셀렉터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
              대상 계약 선택 (계약 DB 연동)
            </label>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                color: '#0f172a'
              }}
            >
              {contracts.map(c => {
                const cust = customers.find(cust => cust.id === c.customerId);
                const s = sites?.find(site => site.id === c.siteId);
                const custName = cust?.name || '고객사미지정';
                const siteName = s?.name || '현장미지정';
                return (
                  <option key={c.id} value={c.id}>
                    [{c.id}] {custName} — {siteName} ({c.startDate} ~ {c.endDate || '미정'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. 선택된 계약 상세 요약 카드 */}
          {selectedContract && (
            <div
              style={{
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                padding: '12px 16px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                fontSize: '12.5px'
              }}
            >
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, marginRight: '6px' }}>고객사:</span>
                <strong>{customer?.name || '미지정'}</strong> ({customer?.bizRegNo || '등록번호미지정'})
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, marginRight: '6px' }}>현장명:</span>
                <strong>{site?.name || '현장미지정'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, marginRight: '6px' }}>계약기간:</span>
                <span>{selectedContract.startDate} ~ {selectedContract.endDate || '종료일 미정 (장기계약)'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, marginRight: '6px' }}>체결 장비:</span>
                <strong>
                  {mappedAssets.length > 0
                    ? mappedAssets.map(a => a.modelName + ' (' + a.assetNo + ')').join(', ')
                    : '기본 장비 3대 자동 매핑'}
                </strong>
              </div>
            </div>
          )}

          {/* 3. 엮을 6종 서류 확인 그리드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
              병합 대상 6종 서류 구성 (Cloudflare R2 원본)
            </label>
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                backgroundColor: '#fafafa',
                padding: '10px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span><strong>01. 계약서</strong> (선택 계약 정보 주입)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span><strong>02. 반입전체크리스트</strong> (장비 검수 주입)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span><strong>03. 안전점검결과서</strong> (안전표 주입)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#2563eb" />
                <span><strong>08. 생산물배상책임보험증권</strong> (CF 원본)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#2563eb" />
                <span><strong>09. 사업자등록증</strong> (CF 원본)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#2563eb" />
                <span><strong>10. 통장사본</strong> (CF 원본)</span>
              </div>
            </div>
          </div>

          {/* 4. 실시간 진행 상태 게이지 */}
          {isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#eff6ff', padding: '12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
                <span>{progressText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#dbeafe', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: progressPercent + '%',
                    height: '100%',
                    backgroundColor: '#2563eb',
                    transition: 'width 0.2s ease-in-out'
                  }}
                />
              </div>
            </div>
          )}

          {/* 5. 에러 메시지 표출 */}
          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '12.5px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6. 완료 상태 카드 */}
          {generatedResult && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#15803d', fontSize: '13px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={18} color="#16a34a" />
                <span>{generatedResult.fileName} (총 {generatedResult.pageCount}페이지)</span>
              </div>
              <button
                type="button"
                onClick={() => window.open(generatedResult.url, '_blank')}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Eye size={13} /> 새 창 열기
              </button>
            </div>
          )}

        </div>

        {/* 모달 푸터 */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            닫기
          </button>

          <button
            type="button"
            onClick={() => handleGenerate(true)}
            disabled={isGenerating}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #2563eb',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={15} /> 새 창 미리보기
          </button>

          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={isGenerating}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isGenerating ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
            6종 통합 PDF 다운로드
          </button>
        </div>
      </div>
    </div>
  );
};
