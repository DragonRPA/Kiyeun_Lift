// src/components/ContractDocumentBundleModal.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { X, FileText, Download, Eye, CheckCircle2, AlertCircle, RefreshCw, FileCheck, Mail, Send } from 'lucide-react';
import { emailService } from '../services/email';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialContractId?: string;
}

export const ContractDocumentBundleModal: React.FC<Props> = ({ isOpen, onClose, initialContractId }) => {
  const { contracts, customers, sites, assets, contractAssets, products, googleConfigs } = useApp();

  const [selectedContractId, setSelectedContractId] = useState<string>(
    initialContractId || contracts[0]?.id || ''
  );

  // 실시간 생성 진행 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [generatedResult, setGeneratedResult] = useState<{ url: string; fileName: string; pageCount: number; blob?: Blob } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 이메일 발송 UI 상태
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

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
      const model = a?.modelName || ca.expectedModel || 'GS-2646';
      const prod = products.find(p => p.modelName === model);

      return {
        assetNo: a?.assetNo || 'G26006',
        modelName: model,
        sn: a?.serialNo || 'GS46D-13045',
        rentalFee: ca.monthlyRentalFee || 480000,
        manufacturer: prod?.manufacturer || a?.manufacturer || 'GENIE (주)기연리프트',
        manufactureYear: a?.manufactureYear || '2018',
        weight: prod?.weight || '1,956 kg',
        workingHeight: prod?.workingHeight || '9.92 M',
        platformHeight: prod?.platformHeight || '7.92 M',
        capacityPreExt: prod?.capacityPreExt || '454 kg',
        certDate: (prod as any)?.certDate || '2010-12-29'
      };
    });
  }, [selectedContract, contractAssets, assets, products]);

  // 고유 모델 목록
  const uniqueModelList = useMemo(() => {
    const models: string[] = [];
    mappedAssets.forEach(a => {
      if (a.modelName && !models.includes(a.modelName)) {
        models.push(a.modelName);
      }
    });
    return models.length > 0 ? models : ['GS-2646'];
  }, [mappedAssets]);

  if (!isOpen) return null;

  const handleGenerate = async (openPreview: boolean = false, autoDownload: boolean = true) => {
    if (!selectedContract) return;

    setIsGenerating(true);
    setProgressPercent(5);
    setProgressText('7종 통합 서류팩 조립 시작...');
    setErrorMessage(null);
    setGeneratedResult(null);
    setEmailSentSuccess(false);

    const custName = customer?.name || '주식회사 세보엠이씨';
    const siteName = site?.name || '평택삼성전자 P4';
    const siteAddress = site?.address || customer?.address || '경기 평택시 고덕면 여염리 산 157';

    try {
      const bundleOptions = {
        customerName: custName,
        bizRegNo: customer?.bizRegNo || '118-81-00241',
        ceoName: customer?.representative || '김우영, 이원하',
        contractDate: selectedContract.startDate,
        contractStartDate: selectedContract.startDate,
        contractEndDate: selectedContract.endDate,
        deliveryDate: selectedContract.startDate ? `${selectedContract.startDate} 예정` : undefined,
        siteName: siteName,
        siteAddress: siteAddress,
        contractNo: selectedContract.id,
        managerName: customer?.representative || '장효준 선임',
        managerPhone: customer?.repContact || '010-7723-0285',
        siteManagerName: site?.contactName || '장효준 선임',
        siteManagerPhone: site?.contact || '010-7723-0285',
        salesRepName: '김동우 팀장',
        salesRepPhone: '010-9402-5296',
        optionsText: (selectedContract as any).optionsText || (selectedContract as any).remarks || '옵션 협착난간대, 튜브소화기 외',
        assets: mappedAssets.length > 0 ? mappedAssets : undefined,
        r2Config: googleConfigs[0] ? {
          accountId: googleConfigs[0].r2AccountId,
          bucketName: googleConfigs[0].r2BucketName,
          accessKeyId: googleConfigs[0].r2AccessKeyId,
          secretAccessKey: googleConfigs[0].r2SecretAccessKey,
          publicDomain: googleConfigs[0].r2PublicDomain,
        } : undefined,
      };

      let finalResult: { url: string; fileName: string; pageCount: number; blob?: Blob } | null = null;

      // 🚨 절대 HTML2CANVAS 사용하지 말것 (저수준 문서 출력의 주범임)
      // 오직 로컬 사이드카 에이전트(정품 엑셀 COM 엔진)만 사용하여 품질을 100% 보장해야 함.
      try {
        setProgressText('로컬 에이전트 정품 엑셀 엔진 가동 중...');
        setProgressPercent(30);

        const agentResp = await fetch('http://127.0.0.1:5175/api/generate-contract-bundle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bundleOptions)
        });

        if (agentResp.ok) {
          const agentRes = await agentResp.json();
          if (agentRes.success && agentRes.base64Content) {
            setProgressPercent(90);
            const binaryStr = atob(agentRes.base64Content);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes.buffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            finalResult = {
              url,
              fileName: agentRes.fileName || `[기연리프트]_계약서류팩_${custName}_${siteName}(${agentRes.pageCount}p).pdf`,
              pageCount: agentRes.pageCount || 37,
              blob
            };
          } else {
            throw new Error(agentRes.error || '에이전트에서 생성에 실패했습니다.');
          }
        } else {
          throw new Error(`에이전트 오류: HTTP ${agentResp.status}`);
        }
      } catch (agentErr: any) {
        throw new Error('정품 엑셀 생성 엔진(로컬 에이전트)에 연결할 수 없거나 오류가 발생했습니다.\n로컬 에이전트가 실행 중인지 확인해주세요.\n\n상세: ' + agentErr.message);
      }

      if (!finalResult) {
        throw new Error('문서 생성 결과를 받을 수 없습니다.');
      }

      setProgressPercent(100);
      setProgressText('✅ 총 ' + finalResult.pageCount + '페이지 정품 7종 통합 서류팩 완성!');
      setGeneratedResult(finalResult);

      // 이메일 수신자/제목 기본값 세팅
      setEmailRecipient(customer?.repEmail || site?.email || '');
      setEmailSubject(`[기연리프트] ${custName} - ${siteName} 고소작업대 임대차 계약서 및 7종 필수서류 묶음`);

      if (openPreview) {
        window.open(finalResult.url, '_blank');
      } else if (autoDownload) {
        const link = document.createElement('a');
        link.href = finalResult.url;
        link.download = finalResult.fileName;
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

  const handleSendEmail = async () => {
    if (!emailRecipient) {
      alert('수신인 이메일 주소를 입력해 주세요.');
      return;
    }
    if (!generatedResult) {
      alert('먼저 계약 서류팩 PDF를 생성해 주세요.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const custName = customer?.name || '고객사';
      const siteName = site?.name || '현장';
      const body = `
안녕하십니까, ${custName} 담당자님.
(주)기연리프트 영업팀입니다.

요청하신 [${siteName}] 현장 고소작업대 임대차 계약서 및 법정/필수 7종 서류 묶음(총 ${generatedResult.pageCount}페이지)을 첨부 파일로 송부드립니다.

■ 첨부 서류 구성 (단일 통합 PDF):
1. 고소작업대 임대차 계약서
2. 자산별 반입 전 CHECK LIST (${mappedAssets.length}대)
3. 자산별 안전점검 결과서 (${mappedAssets.length}대)
4. 장비 모델별(${uniqueModelList.join(', ')}) 정규 문서(제원표, 안전인증서, 작동법 등) 일체
5. 생산물배상책임(PL)보험증권 (계약기간 보증)
6. 사업자등록증
7. 통장사본

계약 내용 및 장비 제원을 검토해 주시고, 문의사항이 있으시면 언제든 연락 부탁드립니다.

감사합니다.
주식회사 기연리프트 배상
전화: 031-334-5296 / 영업담당: 010-9402-5296
      `.trim();

      // PDF Blob -> Base64 변환
      let base64Content = '';
      if (generatedResult.blob) {
        const arrayBuffer = await generatedResult.blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64Content = btoa(binary);
      }

      // 시스템 Gmail SMTP API (/api/send-email) 호출
      await emailService.sendEmail(
        emailRecipient,
        emailSubject,
        body,
        base64Content ? [{ filename: generatedResult.fileName, content: base64Content }] : []
      );

      setEmailSentSuccess(true);
      alert(`✅ 이메일이 성공적으로 발송되었습니다!\n\n• 수신인: ${emailRecipient}\n• 제목: ${emailSubject}\n• 첨부파일: ${generatedResult.fileName} (${generatedResult.pageCount}페이지)`);
    } catch (err: any) {
      console.error('이메일 발송 실패:', err);
      alert(`이메일 발송 실패: ${err?.message || err}`);
    } finally {
      setIsSendingEmail(false);
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
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-app)',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              계약 서류 7종 통합 PDF 생성 및 이메일 발송
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 1. 계약 선택 셀렉터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
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
                border: '1px solid var(--border-color)',
                fontSize: '13.5px',
                fontWeight: 600,
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)'
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
                backgroundColor: 'var(--bg-app)',
                borderRadius: '8px',
                padding: '14px 18px',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                fontSize: '13px'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>고객사:</span>
                <strong>{customer?.name || '미지정'}</strong> <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({customer?.bizRegNo || '사업자번호 미지정'})</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>현장명:</span>
                <strong>{site?.name || '현장미지정'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>계약기간:</span>
                <span>{selectedContract.startDate} ~ {selectedContract.endDate || '종료일 미정 (장기계약)'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>투입 자산 ({mappedAssets.length}대):</span>
                <strong style={{ color: 'var(--primary)' }}>
                  {mappedAssets.length > 0
                    ? mappedAssets.map(a => a.modelName + ' (' + a.assetNo + ')').join(', ')
                    : 'GS-2646 (12대 기본 매핑)'}
                </strong>
              </div>
            </div>
          )}

          {/* 3. 엮을 7종 서류 확인 그리드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              자동 조립 7종 서류 묶음 구성 (첨부 실물 표준 순서)
            </label>
            <div
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-app)',
                padding: '12px 16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                fontSize: '12.5px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--success)" />
                <span><strong>1. 고소작업대 임대차 계약서</strong> (1p)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--success)" />
                <span><strong>2. 자산별 반입 전 CHECK LIST</strong> ({mappedAssets.length}p)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--success)" />
                <span><strong>3. 자산별 안전점검 결과서</strong> ({mappedAssets.length}p)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--primary)" />
                <span><strong>4. 모델별 R2 정규문서 일체</strong> ({uniqueModelList.join(', ')})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--primary)" />
                <span><strong>5. 생산물배상책임(PL)보험증권</strong> (계약기간 보증)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--primary)" />
                <span><strong>6. 사업자등록증</strong> (CF R2 원본)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="var(--primary)" />
                <span><strong>7. 통장사본</strong> (CF R2 원본)</span>
              </div>
            </div>
          </div>

          {/* 4. 실시간 진행 상태 게이지 */}
          {isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--primary-light)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, color: 'var(--primary)' }}>
                <span>{progressText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: progressPercent + '%',
                    height: '100%',
                    backgroundColor: 'var(--primary)',
                    transition: 'width 0.2s ease-in-out'
                  }}
                />
              </div>
            </div>
          )}

          {/* 5. 에러 메시지 표출 */}
          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '13px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6. 완료 상태 카드 & 이메일 작성 영역 */}
          {generatedResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCheck size={18} color="var(--success)" />
                  <span>{generatedResult.fileName} (총 {generatedResult.pageCount}페이지 조립 완료)</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => window.open(generatedResult.url, '_blank')}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'var(--success)',
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
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(!showEmailForm)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'var(--primary)',
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
                    <Mail size={13} /> 이메일 발송
                  </button>
                </div>
              </div>

              {/* 이메일 발송 폼 */}
              {showEmailForm && (
                <div style={{ padding: '14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={16} color="var(--primary)" />
                    고객사 계약서류팩 이메일 발송
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center', fontSize: '12.5px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>수신인:</span>
                    <input
                      type="email"
                      value={emailRecipient}
                      onChange={e => setEmailRecipient(e.target.value)}
                      placeholder="고객사 담당자 이메일 주소 (예: customer@company.com)"
                      style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>제목:</span>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={isSendingEmail}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: isSendingEmail ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Send size={14} />
                      {isSendingEmail ? '발송 준비중...' : '이메일 클라이언트 열기 및 발송'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* 모달 푸터 */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            닫기
          </button>

          <button
            type="button"
            onClick={() => handleGenerate(true, false)}
            disabled={isGenerating}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--primary)',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
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
            onClick={() => handleGenerate(false, true)}
            disabled={isGenerating}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary)',
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
            7종 통합 PDF 다운로드
          </button>
        </div>
      </div>
    </div>
  );
};
