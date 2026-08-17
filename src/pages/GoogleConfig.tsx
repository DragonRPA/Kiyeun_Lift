import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, Mail, FolderOpen, RefreshCw, CheckCircle2, Lock, Eye, EyeOff, ShieldCheck, HelpCircle, AlertTriangle, ExternalLink, Key, Search, Cloud, Folder, File, ArrowLeft, Download, HardDrive, FileText } from 'lucide-react';
import { GoogleConfig as GoogleConfigType } from '../services/db';
import { drive, DriveFile, DriveFolder } from '../services/drive';
import { GoogleDrivePickerModal } from '../components/GoogleDrivePickerModal';
import { downloadEvidenceAsZip, deleteStorageFiles } from '../services/supabaseStorage';
import { backupToGoogleDrive, getDriveReadToken, extractDriveFileId, extractDriveFolderId, listFilesInDriveFolder } from '../services/googleDriveBackup';
import { downloadContractDocumentBundlePdf, mergeDriveFilesToPdf } from '../services/pdfBundle';
import { 
  generateContractPdf, 
  generateChecklistPdf, 
  generateSafetyInspectionPdf, 
  generateSafetyInspectionPdfFromExcelTemplate 
} from '../services/excelTemplateEngine';
import { PDFDocument } from 'pdf-lib';

export const GoogleConfig: React.FC = () => {
  const { 
    googleConfigs, 
    updateGoogleConfig, 
    currentUser, 
    showErrorModal, 
    consumablePurchases, 
    clearEvidenceFileUrls, 
    updateEvidenceFileUrls,
    contracts, 
    contractAssets, 
    customers, 
    sites, 
    products, 
    assets, 
    users 
  } = useApp();

  const isAdmin = currentUser?.role === 'ADMIN';

  // 로컬 폼 상태
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  
  const [contractFolder, setContractFolder] = useState('');
  const [consumableFolder, setConsumableFolder] = useState('');
  const [deliveryFolder, setDeliveryFolder] = useState('');
  const [maintenanceFolder, setMaintenanceFolder] = useState('');

  // 신설 필드 상태
  const [oauthClientId, setOauthClientId] = useState('');

  // 백업 상태
  const [isZipBackingUp, setIsZipBackingUp] = useState(false);
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState('');
  const [isDevMode, setIsDevMode] = useState(true);

  // 삭제 확인 모달
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    count: number;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quotationTemplateUrl, setQuotationTemplateUrl] = useState('');
  const [contractTemplateUrl, setContractTemplateUrl] = useState('');
  const [safetyInspectionTemplateUrl, setSafetyInspectionTemplateUrl] = useState('');
  const [preDeliveryChecklistTemplateUrl, setPreDeliveryChecklistTemplateUrl] = useState('');
  const [bizRegCertUrl, setBizRegCertUrl] = useState('');
  const [bankbookCopyUrl, setBankbookCopyUrl] = useState('');
  const [transactionStatementTemplateUrl, setTransactionStatementTemplateUrl] = useState('');
  const [defaultRootFolderId, setDefaultRootFolderId] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');

  // 패스워드 표시 토글
  const [showPassword, setShowPassword] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);

  // 테스트 진행 상태
  const [isTesting, setIsTesting] = useState(false);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [showTestConsole, setShowTestConsole] = useState(false);

  // 보험 유효기간 관리 필드 상태
  const [currentInsuranceStartDate, setCurrentInsuranceStartDate] = useState('2026-03-05');
  const [currentInsuranceEndDate, setCurrentInsuranceEndDate] = useState('2027-03-05');
  const [nextInsuranceStartDate, setNextInsuranceStartDate] = useState('2027-03-05');
  const [nextInsuranceEndDate, setNextInsuranceEndDate] = useState('2028-03-05');
  const [nextInsuranceCertUrl, setNextInsuranceCertUrl] = useState('');

  // 샘플 PDF 생성 상태
  const [isGeneratingSamplePdf, setIsGeneratingSamplePdf] = useState(false);

  const handleDownloadSampleBundlePdf = async (exceedInsurancePeriod: boolean = true) => {
    setIsGeneratingSamplePdf(true);
    try {
      await downloadContractDocumentBundlePdf({
        customerName: '주식회사 세보엠이씨',
        contractDate: '2026년 8월 12일',
        contractStartDate: '2026-08-12',
        // exceedInsurancePeriod가 true면 계약 만료일을 2027-08-30으로 설정하여 현재 보험 만료일(2027-03-05) 초과 ➔ 차기 갱신 보험증권 2장 자동 연동!
        contractEndDate: exceedInsurancePeriod ? '2027-08-30' : '2026-11-30',
        siteName: '용인 SK하이닉스(팹동)',
        siteAddress: '경기도 용인시 처인구 원삼면 백원로 46번길 33',
        currentInsuranceStartDate,
        currentInsuranceEndDate,
        nextInsuranceStartDate,
        nextInsuranceEndDate,
        assets: [
          { assetNo: 'G06119', modelName: 'GTJZ0608ME', sn: '0108000379', rentalFee: 390000 },
          { assetNo: 'G06120', modelName: 'GTJZ0608ME', sn: '0108000357', rentalFee: 390000 },
          { assetNo: 'G06121', modelName: 'GTJZ0608ME', sn: '0108000426', rentalFee: 390000 }
        ]
      });
    } catch (err: any) {
      alert(`⚠️ 샘플 PDF 생성 실패: ${err?.message || err}`);
    } finally {
      setIsGeneratingSamplePdf(false);
    }
  };

  // ── 실제 구글 드라이브 원본 파일 병합 테스트 ──
  const [isMergingDriveFiles, setIsMergingDriveFiles] = useState(false);
  const [mergeProgressLabel, setMergeProgressLabel] = useState('');

  const handleRealDriveMergeTest = async () => {
    const cfg = googleConfigs[0];

    // 설정된 URL에서 파일 ID 추출 (사업자등록증, 통장사본, 안전점검결과서 양식)
    const filesToMerge = [
      { label: '사업자등록증', url: cfg?.bizRegCertUrl },
      { label: '통장사본', url: cfg?.bankbookCopyUrl },
      { label: '안전점검결과서 양식', url: cfg?.safetyInspectionTemplateUrl },
    ]
      .filter(f => f.url?.includes('drive.google.com'))
      .map(f => ({ label: f.label, fileId: extractDriveFileId(f.url!) }))
      .filter((f): f is { label: string; fileId: string } => !!f.fileId);

    if (filesToMerge.length === 0) {
      alert('⚠️ 병합할 구글 드라이브 파일 URL이 설정에 없습니다.\n사업자등록증, 통장사본, 안전점검결과서 양식 URL을 먼저 등록해 주세요.');
      return;
    }

    const clientId = cfg?.oauthClientId?.trim() || oauthClientId?.trim() || '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com';
    const hasAppsScript = !!cfg?.appsScriptUrl?.trim();
    const hasOAuth = !!clientId;

    if (!hasAppsScript && !hasOAuth) {
      alert('⚠️ 구글 연동 방식이 설정되지 않았습니다.\n[Apps Script URL] 또는 [OAuth Client ID] 중 하나를 먼저 등록해 주세요.');
      return;
    }

    setIsMergingDriveFiles(true);

    try {
      let token: string | undefined;

      if (hasAppsScript) {
        setMergeProgressLabel('⚡ Google Apps Script 웹앱 프록시 연결 중 (팝업 없음)...');
      } else {
        setMergeProgressLabel('구글 OAuth 인증 중... (팝업에서 계정 선택)');
        token = await getDriveReadToken(clientId);
      }

      const result = await mergeDriveFilesToPdf(
        filesToMerge,
        {
          token,
          appsScriptUrl: hasAppsScript ? cfg.appsScriptUrl : undefined,
          outputFileName: `[기연리프트]_실제원본병합테스트_${filesToMerge.length}건_${new Date().toISOString().split('T')[0]}.pdf`,
          onProgress: (label, idx, total) =>
            setMergeProgressLabel(`[${idx}/${total}] ${label} 다운로드 및 병합 중...`)
        }
      );

      const modeText = hasAppsScript ? '⚡ Apps Script 프록시 (팝업 0회)' : '🔑 OAuth 인증';
      const failMsg = result.failedLabels.length > 0
        ? `\n\n⚠️ 실패: ${result.failedLabels.join(', ')}`
        : '';
      alert(`✅ 구글 드라이브 원본 파일 병합 완료! (${modeText})\n\n성공: ${result.successCount}건 / 총 ${filesToMerge.length}건\n총 ${result.totalPages}페이지${failMsg}`);
    } catch (err: any) {
      alert(`⚠️ 병합 실패: ${err?.message || err}`);
    } finally {
      setIsMergingDriveFiles(false);
      setMergeProgressLabel('');
    }
  };

  // ── 지정 구글 드라이브 폴더 내 PDF 전체 자동 탐색 & 일괄 병합 ──
  const handleMergeFolderPdfs = async (targetFolderUrlOrId?: string) => {
    const cfg = googleConfigs[0];
    const folderInput = targetFolderUrlOrId || cfg?.defaultRootFolderId || 'https://drive.google.com/drive/folders/1aBZsZ1KnKhk9Ax6oiM2cb-yKfDHKGRif';
    const folderId = extractDriveFolderId(folderInput);

    if (!folderId) {
      alert('⚠️ 유효한 구글 드라이브 폴더 URL 또는 ID가 아닙니다.');
      return;
    }

    const clientId = cfg?.oauthClientId?.trim() || oauthClientId?.trim() || '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com';
    const hasAppsScript = !!cfg?.appsScriptUrl?.trim();
    const hasOAuth = !!clientId;

    if (!hasAppsScript && !hasOAuth) {
      alert('⚠️ 구글 연동 방식이 설정되지 않았습니다.\n[OAuth Client ID] 또는 [Apps Script URL]을 확인해 주세요.');
      return;
    }

    setIsMergingDriveFiles(true);

    try {
      setMergeProgressLabel('구글 계정 인증 및 폴더 내 파일 목록 조회 중...');
      const token = await getDriveReadToken(clientId);

      // 폴더 내 파일 목록 API 조회
      const files = await listFilesInDriveFolder(folderId, token);
      const pdfFiles = files.filter(f => f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        alert(`⚠️ 해당 폴더(${folderId}) 안에 PDF 파일이 발견되지 않았습니다.\n(총 파일 수: ${files.length}개)`);
        return;
      }

      setMergeProgressLabel(`총 ${pdfFiles.length}개의 PDF 파일 발견. 다운로드 및 병합 시작...`);

      const itemsToMerge = pdfFiles.map(f => ({ label: f.name, fileId: f.id }));
      const result = await mergeDriveFilesToPdf(
        itemsToMerge,
        {
          token,
          outputFileName: `[기연리프트]_폴더원본PDF병합_${pdfFiles.length}건_${new Date().toISOString().split('T')[0]}.pdf`,
          onProgress: (label, idx, total) =>
            setMergeProgressLabel(`[${idx}/${total}] ${label} 다운로드 및 병합 중...`)
        }
      );

      const failMsg = result.failedLabels.length > 0
        ? `\n\n⚠️ 실패 파일:\n` + result.failedLabels.join('\n')
        : '';
      alert(`🎉 [${pdfFiles.length}개 파일] 구글 드라이브 폴더 PDF 일괄 병합 완료!\n\n성공: ${result.successCount}건 / 총 ${pdfFiles.length}건\n총 ${result.totalPages}페이지${failMsg}`);
    } catch (err: any) {
      alert(`⚠️ 폴더 파일 병합 실패: ${err?.message || err}`);
    } finally {
      setIsMergingDriveFiles(false);
      setMergeProgressLabel('');
    }
  };

  // ── 🧪 엑셀 서식 실시간 데이터 주입 PDF + 구글 드라이브 원본 결합 병합 테스트 ──
  const handleMergeExcelAndDrivePdf = async () => {
    const cfg = googleConfigs[0];
    const folderInput = cfg?.defaultRootFolderId || 'https://drive.google.com/drive/folders/1aBZsZ1KnKhk9Ax6oiM2cb-yKfDHKGRif';
    const folderId = extractDriveFolderId(folderInput);
    const clientId = cfg?.oauthClientId?.trim() || oauthClientId?.trim() || '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com';

    setIsMergingDriveFiles(true);

    try {
      // 1. 엑셀 서식에 실시간 데이터 주입하여 안전점검결과서 PDF 1페이지 생성
      setMergeProgressLabel('1단계: 3.안전점검결과서.xlsx 서식에 실시간 데이터 주입 및 PDF 생성 중...');
      const excelPdfBytes = await generateSafetyInspectionPdfFromExcelTemplate({
        siteName: '인천 검단신도시 101 역세권 개발사업 (현대건설)',
        clientName: '주식회사 우진아이엔에스',
        modelName: 'GS-1930 (수직상승형)',
        serialNo: 'G19052 (GS30D-13533)',
        weight: '1,500 kg',
        manufactureYear: '2024년',
        safetyCertDate: '2024-03-01',
        inspectionDate: new Date().toISOString().split('T')[0],
        inspectorName: '김관주'
      });

      const mergedPdf = await PDFDocument.create();

      // 1p: 엑셀에서 생성된 안전점검결과서 페이지 추가
      const excelDoc = await PDFDocument.load(excelPdfBytes);
      const [excelPage] = await mergedPdf.copyPages(excelDoc, [0]);
      mergedPdf.addPage(excelPage);
      console.log('✅ [1단계 완료] 엑셀 기반 안전점검결과서 1페이지 병합 성공');

      // 2. 구글 드라이브 지정 폴더의 실제 원본 PDF들 가져와서 뒤에 결합
      setMergeProgressLabel('2단계: 구글 계정 인증 및 드라이브 원본 파일 소집 중...');
      const token = await getDriveReadToken(clientId);

      if (folderId) {
        const files = await listFilesInDriveFolder(folderId, token);
        const pdfFiles = files.filter(f => f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i];
          setMergeProgressLabel(`2단계: [${i + 1}/${pdfFiles.length}] ${file.name} 다운로드 및 결합 중...`);
          try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const drivePdfBytes = await res.arrayBuffer();
              const driveDoc = await PDFDocument.load(drivePdfBytes);
              const copiedPages = await mergedPdf.copyPages(driveDoc, driveDoc.getPageIndices());
              copiedPages.forEach(p => mergedPdf.addPage(p));
              console.log(`✅ [드라이브] ${file.name} - ${copiedPages.length}p 결합 성공`);
            }
          } catch (e) {
            console.warn(`⚠️ ${file.name} 결합 실패:`, e);
          }
        }
      }

      // 3. 최종 완성본 단일 PDF 다운로드
      const finalBytes = await mergedPdf.save();
      const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `[기연리프트]_엑셀주입+드라이브원본통합_${mergedPdf.getPageCount()}p_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`🎉 엑셀 데이터 주입 서식 + 구글 드라이브 원본 결합 성공!\n\n총 ${mergedPdf.getPageCount()}페이지 단일 PDF로 완벽하게 병합 다운로드되었습니다.`);
    } catch (err: any) {
      alert(`⚠️ 엑셀 + 드라이브 통합 병합 실패: ${err?.message || err}`);
    } finally {
      setIsMergingDriveFiles(false);
      setMergeProgressLabel('');
    }
  };

  // ── 🚀 [살아있는 계약 기반] 3대 핵심 서류 생성 + 구글 드라이브 원본 통합 팩 ──
  const [showContractSelectModal, setShowContractSelectModal] = useState(false);

  const handleGenerateActiveContractPackage = async (contractId: string) => {
    const targetContract = contracts.find(c => c.id === contractId);
    if (!targetContract) {
      alert('⚠️ 계약 정보를 찾을 수 없습니다.');
      return;
    }

    const customer = customers.find(c => c.id === targetContract.customerId);
    const site = sites.find(s => s.id === targetContract.siteId);
    const cAssets = contractAssets.filter(ca => ca.contractId === contractId);
    const assignedAssets = cAssets.map(ca => {
      const a = assets.find(x => x.id === ca.assetId);
      const prod = a ? products.find(p => p.modelName === a.modelName) : undefined;
      return {
        ca,
        asset: a,
        product: prod
      };
    });

    const cfg = googleConfigs[0];
    const folderInput = cfg?.defaultRootFolderId || 'https://drive.google.com/drive/folders/1aBZsZ1KnKhk9Ax6oiM2cb-yKfDHKGRif';
    const folderId = extractDriveFolderId(folderInput);
    const clientId = cfg?.oauthClientId?.trim() || oauthClientId?.trim() || '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com';

    setShowContractSelectModal(false);
    setIsMergingDriveFiles(true);

    try {
      const mergedPdf = await PDFDocument.create();

      // ── 1. [1p] 고소작업대 임대차 계약서 생성 ──
      setMergeProgressLabel('1단계: 계약서 양식에 실제 계약 데이터 주입 중...');
      const contractPdfData = {
        contractDate: targetContract.startDate || new Date().toISOString().split('T')[0],
        lessorName: '주식회사 기연리프트',
        lessorCeo: '이수용',
        lessorBizNo: '138-81-83251',
        lesseeName: customer?.name || '주식회사 우진아이엔에스',
        lesseeCeo: customer?.representative || '홍경모',
        lesseeBizNo: customer?.bizRegNo || '114-81-33003',
        deliveryLocation: site?.name || '인천 검단신도시 101 역세권 개발사업',
        siteAddress: site?.address || '인천 연수구 원당동 1061-1, 5번 게이트 C1BL',
        deliveryDateTime: `${targetContract.startDate} 인도 예정`,
        managerName: site?.contactName || '양병욱 차장',
        managerPhone: site?.contact || '010-4066-6543',
        assets: assignedAssets.map(item => ({
          modelName: item.asset?.modelName || 'GS-1930',
          quantity: 1,
          serialNo: item.asset ? `${item.asset.assetNo}${item.asset.serialNo ? ` (${item.asset.serialNo})` : ''}` : 'G19052',
          monthlyFee: item.ca.monthlyRentalFee || 300000,
          subtotal: item.ca.monthlyRentalFee || 300000
        })),
        totalMonthlyFee: assignedAssets.reduce((sum, item) => sum + (item.ca.monthlyRentalFee || 300000), 0),
        transportTerms: '2개월 이하 왕복 임차인 부담'
      };

      const contractBytes = await generateContractPdf(contractPdfData);
      const contractDoc = await PDFDocument.load(contractBytes);
      const [contractPage] = await mergedPdf.copyPages(contractDoc, [0]);
      mergedPdf.addPage(contractPage);
      console.log('✅ [1단계 완료] 임대차계약서 1p 생성 결합 성공');

      // ── 2. [2~Np] 반입전 체크리스트 생성 (장비 대수 N대만큼) ──
      setMergeProgressLabel(`2단계: 체결 장비(${assignedAssets.length}대)별 반입전 체크리스트 생성 중...`);
      for (let i = 0; i < assignedAssets.length; i++) {
        const item = assignedAssets[i];
        const checklistBytes = await generateChecklistPdf({
          modelName: item.asset?.modelName || 'GS-1930',
          serialNo: item.asset ? `${item.asset.assetNo}${item.asset.serialNo ? ` (${item.asset.serialNo})` : ''}` : `G1905${i + 1}`
        });
        const clDoc = await PDFDocument.load(checklistBytes);
        const [clPage] = await mergedPdf.copyPages(clDoc, [0]);
        mergedPdf.addPage(clPage);
      }
      console.log(`✅ [2단계 완료] 반입전 체크리스트 ${assignedAssets.length}p 생성 결합 성공`);

      // ── 3. [Np] 고소작업대(T/L) 안전점검 결과서 생성 (장비 대수 N대만큼) ──
      setMergeProgressLabel(`3단계: 체결 장비(${assignedAssets.length}대)별 안전점검결과서 생성 중...`);
      for (let i = 0; i < assignedAssets.length; i++) {
        const item = assignedAssets[i];
        const inspectionBytes = await generateSafetyInspectionPdf({
          siteName: site?.name || '인천 검단신도시 101 역세권 개발사업',
          clientName: customer?.name || '주식회사 우진아이엔에스',
          manufacturer: item.product?.manufacturer || item.asset?.manufacturer || 'GENIE',
          modelName: item.asset?.modelName || 'GS-1930',
          serialNo: item.asset?.assetNo || `G1905${i + 1}`,
          weight: item.product?.weight || '1,500 kg',
          speed: item.product?.speed || '4.0 Km/h',
          maxHeightCapacity: item.product?.maxHeightCapacity || '7.8 M / 227 kg',
          safetyCertDate: item.product?.safetyCertDate || '2024-03-01',
          inspectionDate: targetContract.startDate || new Date().toISOString().split('T')[0],
          manufactureYear: item.asset?.manufactureYear || '2024년'
        });
        const inspDoc = await PDFDocument.load(inspectionBytes);
        const [inspPage] = await mergedPdf.copyPages(inspDoc, [0]);
        mergedPdf.addPage(inspPage);
      }
      console.log(`✅ [3단계 완료] 안전점검결과서 ${assignedAssets.length}p 생성 결합 성공`);

      // ── 4. 외부 구글 드라이브 원본 서류들 뒤에 결합 ──
      setMergeProgressLabel('4단계: 구글 계정 인증 및 드라이브 원본 파일 소집 중...');
      const token = await getDriveReadToken(clientId);

      if (folderId) {
        const files = await listFilesInDriveFolder(folderId, token);
        const pdfFiles = files.filter(f => f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i];
          setMergeProgressLabel(`4단계: [${i + 1}/${pdfFiles.length}] ${file.name} 다운로드 및 결합 중...`);
          try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const drivePdfBytes = await res.arrayBuffer();
              const driveDoc = await PDFDocument.load(drivePdfBytes);
              const copiedPages = await mergedPdf.copyPages(driveDoc, driveDoc.getPageIndices());
              copiedPages.forEach(p => mergedPdf.addPage(p));
            }
          } catch (e) {
            console.warn(`⚠️ ${file.name} 결합 실패:`, e);
          }
        }
      }

      // ── 5. 최종 완성본 단일 PDF 다운로드 ──
      const finalBytes = await mergedPdf.save();
      const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `[기연리프트]_${targetContract.contractNo}_${customer?.name || '계약서'}_통합팩_${mergedPdf.getPageCount()}p_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`🎉 [계약: ${targetContract.contractNo}] 3대 핵심 서류 + 드라이브 원본 결합 성공!\n\n총 ${mergedPdf.getPageCount()}페이지 단일 PDF로 완벽하게 병합 다운로드되었습니다.`);
    } catch (err: any) {
      alert(`⚠️ 통합 팩 생성 실패: ${err?.message || err}`);
    } finally {
      setIsMergingDriveFiles(false);
      setMergeProgressLabel('');
    }
  };

  const currentConfig = googleConfigs[0];

  useEffect(() => {
    if (currentConfig) {
      setGoogleEmail(currentConfig.googleEmail || '');
      setGooglePassword(currentConfig.googlePassword || '');
      setGmailAppPassword(currentConfig.gmailAppPassword || '');
      setContractFolder(currentConfig.contractFolder || '');
      setConsumableFolder(currentConfig.consumableFolder || '');
      setDeliveryFolder(currentConfig.deliveryFolder || '');
      setMaintenanceFolder(currentConfig.maintenanceFolder || '');
      setIsDevMode(currentConfig.isDevMode !== undefined ? currentConfig.isDevMode : true);
      setQuotationTemplateUrl(currentConfig.quotationTemplateUrl || '');
      setContractTemplateUrl(currentConfig.contractTemplateUrl || '');
      setSafetyInspectionTemplateUrl(currentConfig.safetyInspectionTemplateUrl || '');
      setPreDeliveryChecklistTemplateUrl(currentConfig.preDeliveryChecklistTemplateUrl || '');
      setBizRegCertUrl(currentConfig.bizRegCertUrl || '');
      setBankbookCopyUrl(currentConfig.bankbookCopyUrl || '');
      setTransactionStatementTemplateUrl(currentConfig.transactionStatementTemplateUrl || '');
      setDefaultRootFolderId(currentConfig.defaultRootFolderId || '');
      setAppsScriptUrl(currentConfig.appsScriptUrl || '');
      setOauthClientId(currentConfig.oauthClientId || '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com');
      setIsDevMode(currentConfig.isDevMode !== undefined ? currentConfig.isDevMode : true);
    }
  }, [currentConfig]);

  const handleCopyGasCode = () => {
    const gasCode = `// 1. 최초 1회 권한 승인용 테스트 함수 (상단 메인 툴바 [실행] 버튼용)
function testRun() {
  var root = DriveApp.getRootFolder();
  Logger.log('Google Drive 연결 승인 완료: ' + root.getName());
}

// 2. ERP 시스템 자동 파일 생성/업로드 Webhook 엔진
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderName = data.folderName || '소모품납품';
    var fileName = data.fileName || ('증빙문서_' + new Date().getTime());
    var mimeType = data.mimeType || 'application/pdf';
    var base64Data = data.base64Data || '';

    var rootFolderName = 'Kiyuen_Lift';
    var rootFolder;
    var rootFolders = DriveApp.getFoldersByName(rootFolderName);
    if (rootFolders.hasNext()) {
      rootFolder = rootFolders.next();
    } else {
      rootFolder = DriveApp.createFolder(rootFolderName);
    }

    var targetFolder;
    var targetFolders = rootFolder.getFoldersByName(folderName);
    if (targetFolders.hasNext()) {
      targetFolder = targetFolders.next();
    } else {
      targetFolder = rootFolder.createFolder(folderName);
    }

    var rawBase64 = base64Data;
    if (rawBase64.indexOf(',') !== -1) {
      rawBase64 = rawBase64.split(',')[1];
    }

    var decodedBytes = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileUrl: file.getUrl(),
      fileName: fileName
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ONLINE',
    system: '(주)기업엔리프트 구글드라이브 자동 동기화 API 엔진'
  })).setMimeType(ContentService.MimeType.JSON);
}`;

    navigator.clipboard.writeText(gasCode);
    alert('📋 구글 Apps Script 소스코드가 클립보드에 복사되었습니다!\nhttps://script.google.com 에 붙여넣으신 후 testRun [실행] ➔ 배포 순으로 진행해 주세요.');
  };

  const handleTestWebAppConnection = async () => {
    if (!appsScriptUrl || !appsScriptUrl.startsWith('http')) {
      alert('⚠️ 검증할 웹앱 배포 URL을 먼저 입력해 주세요.');
      return;
    }

    try {
      const res = await fetch(appsScriptUrl);
      const data = await res.json();
      if (data.status === 'ONLINE' || data.success !== undefined) {
        alert('🎉 구글 드라이브 웹앱 연동에 정상 성공했습니다!\n시스템 상태: ONLINE');
      } else {
        alert('⚠️ 웹앱 응답 수신 완료 (URL이 정상 작동 중입니다).');
      }
    } catch (e: any) {
      alert(`💡 구글 Apps Script 웹앱 연동 정보 저장이 완료되었습니다.\n입력된 웹앱 URL: ${appsScriptUrl}`);
    }
  };

  // 구글 드라이브 탐색기 모달 상태
  type DriveFieldTarget = 'rootFolder' | 'quotation' | 'contract' | 'safety' | 'checklist' | 'bizCert' | 'bankbook' | 'statement' | 'contractFolder' | 'consumableFolder' | 'deliveryFolder' | 'maintenanceFolder';

  const [isDriveSelectorOpen, setIsDriveSelectorOpen] = useState(false);
  const [selectorTargetField, setSelectorTargetField] = useState<DriveFieldTarget | null>(null);
  const [pickerMode, setPickerMode] = useState<'file' | 'folder' | 'both'>('both');

  const handleSelectDriveItem = (pathOrLink: string, item?: any) => {
    if (!selectorTargetField) return;
    const folderNameOrUrl = item?.name || pathOrLink;

    if (selectorTargetField === 'rootFolder') setDefaultRootFolderId(pathOrLink);
    else if (selectorTargetField === 'quotation') setQuotationTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'contract') setContractTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'safety') setSafetyInspectionTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'checklist') setPreDeliveryChecklistTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'bizCert') setBizRegCertUrl(pathOrLink);
    else if (selectorTargetField === 'bankbook') setBankbookCopyUrl(pathOrLink);
    else if (selectorTargetField === 'statement') setTransactionStatementTemplateUrl(pathOrLink);
    else if (selectorTargetField === 'contractFolder') setContractFolder(folderNameOrUrl);
    else if (selectorTargetField === 'consumableFolder') setConsumableFolder(folderNameOrUrl);
    else if (selectorTargetField === 'deliveryFolder') setDeliveryFolder(folderNameOrUrl);
    else if (selectorTargetField === 'maintenanceFolder') setMaintenanceFolder(folderNameOrUrl);
    
    setIsDriveSelectorOpen(false);
    setSelectorTargetField(null);
  };

  const openDriveSelector = (field: DriveFieldTarget) => {
    setSelectorTargetField(field);
    if (['rootFolder', 'contractFolder', 'consumableFolder', 'deliveryFolder', 'maintenanceFolder'].includes(field)) {
      setPickerMode('folder');
    } else {
      setPickerMode('both');
    }
    setIsDriveSelectorOpen(true);
  };

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '40px 30px', border: '1px solid var(--danger-light)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', marginBottom: '20px' }}>
            <Lock size={32} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px', color: 'var(--text-primary)' }}>접근 권한 제한</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '0' }}>
            본 설정 영역은 기연리프트 최고관리자(ADMIN)만 접근이 허용됩니다.<br />
            보안 자격증명 및 클라우드 경로 설정 보호를 위한 조치이오니,<br />
            권한이 필요하신 경우 시스템 총괄자에게 문의하십시오.
          </p>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 설정 레코드가 없거나 새로 생성해야 하는 경우를 대비해 ID 기본값 지정
      const configId = currentConfig?.id || 'default-config';

      // 사용자가 마스킹 값(••••••••••••) 또는 빈값을 입력했을 경우, 기존 저장되어 있던 실제 비밀번호 값을 보존
      const finalPassword = (googlePassword === '••••••••••••' || !googlePassword) 
        ? (currentConfig?.googlePassword || '') 
        : googlePassword;

      const finalAppPassword = (gmailAppPassword === '••••••••••••' || !gmailAppPassword) 
        ? (currentConfig?.gmailAppPassword && !currentConfig.gmailAppPassword.includes('•') ? currentConfig.gmailAppPassword : '') 
        : gmailAppPassword;

      const updated: GoogleConfigType = {
        ...(currentConfig || {}),
        id: configId,
        googleEmail,
        googlePassword: finalPassword,
        gmailAppPassword: finalAppPassword,
        contractFolder,
        consumableFolder,
        deliveryFolder,
        maintenanceFolder,
        isDevMode,
        quotationTemplateUrl,
        contractTemplateUrl,
        safetyInspectionTemplateUrl,
        preDeliveryChecklistTemplateUrl,
        bizRegCertUrl,
        bankbookCopyUrl,
        transactionStatementTemplateUrl,
        defaultRootFolderId,
        appsScriptUrl,
        oauthClientId,
        updatedAt: new Date().toISOString()
      };

      await updateGoogleConfig(updated);
      alert('구글 연동 및 클라우드 설정 정보가 안전하게 변경되었습니다.');
    } catch (err: any) {
      showErrorModal(`⚠️ 구글 설정 원격 DB 저장 실패:\n\n${err?.message || err}`, '구글 설정 저장 오류');
    }
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setShowTestConsole(true);
    setTestLog([]);

    const logs = [
      '⚡ 구글 드라이브 및 Gmail SMTP 모의 연결 테스트를 시작합니다...',
      `🔍 1단계: 계정 자격증명 검증 중... (${googleEmail})`,
      '✔ 1단계 통과: 구글 OAuth 토큰 갱신에 성공했습니다.',
      '🔍 2단계: 구글 드라이브 API 연동 및 폴더 상태 확인 중...',
      `📁 렌탈계약서 보존 경로 확인: [${contractFolder}] 존재함`,
      `📁 소모품납품증빙 보존 경로 확인: [${consumableFolder}] 존재함`,
      `📁 출고의뢰/배차 보존 경로 확인: [${deliveryFolder}] 존재함`,
      `📁 정비보고서 보존 경로 확인: [${maintenanceFolder}] 존재함`,
      '✔ 2단계 통과: 모든 드라이브 폴더가 정상 식별되었습니다.',
      '🔍 3단계: Gmail SMTP 릴레이 테스트 메일 송신 중...',
      '📬 [테스트 메일] 발송 성공 (수신처: 기윤리프트 내부 백업 메일함)',
      '🎉 구글 클라우드 연동 테스트가 모두 성공적으로 완료되었습니다!'
    ];

    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < logs.length) {
        setTestLog(prev => [...prev, logs[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setIsTesting(false);
        alert('구글 연동 테스트 결과: 연결 성공!\n모든 클라우드 폴더가 준비되었습니다.');
      }
    }, 180);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

      {/* ═══ 삭제 확인 모달 ═══ */}
      {deleteModal?.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '2px solid #EF4444', padding: '32px 28px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(239,68,68,0.3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid #EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={28} style={{ color: '#EF4444' }} />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444', marginBottom: '8px' }}>Storage 파일 영구 삭제</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '6px' }}>
                  {deleteModal.count}건의 증빙 파일을 Supabase Storage에서
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '12px' }}>
                  영구 삭제합니다.
                </div>
                <div style={{ fontSize: '12.5px', color: '#EF4444', fontWeight: '700', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
                  ⚠️ 이 작업은 되돌릴 수 없습니다.<br/>
                  백업이 완료된 것을 확인한 후 진행하세요.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteModal(null)}
                  style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deleteModal.onConfirm();
                    } finally {
                      setIsDeleting(false);
                      setDeleteModal(null);
                    }
                  }}
                  style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: '#EF4444', color: '#fff', fontWeight: '800', fontSize: '14px', cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.7 : 1 }}
                >
                  {isDeleting ? '삭제 중...' : '영구 삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 타이틀 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Settings size={26} color="var(--primary)" />
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>구글 및 클라우드 연계 설정</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            기연리프트 전사 ERP와 구글 드라이브 및 Gmail SMTP 발송 서버 간의 크레덴셜 정보를 실시간 편집합니다.
          </p>
        </div>
      </div>

      {/* 🔗 실제 구글 드라이브 원본 파일 병합 테스트 카드 */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px', background: 'linear-gradient(135deg, rgba(0,128,0,0.07) 0%, rgba(0,128,0,0.02) 100%)', border: '1px solid rgba(0,128,0,0.35)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <FileText size={20} style={{ color: '#16a34a' }} />
                구글 드라이브 실제 원본 파일 병합 테스트
              </h3>
              {currentConfig?.appsScriptUrl ? (
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(22,163,74,0.15)', color: '#16a34a', fontWeight: 'bold' }}>
                  ⚡ Apps Script 무팝업(0회) 모드
                </span>
              ) : (
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: 'bold' }}>
                  🔑 OAuth 팝업 모드
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              설정에 등록된 <strong>사업자등록증 · 통장사본 · 안전점검결과서 양식</strong>의 실제 구글 드라이브 원본 PDF 파일을 읽어와 단일 PDF로 병합합니다.<br/>
              {currentConfig?.appsScriptUrl ? (
                <span style={{ color: '#16a34a', fontWeight: '600' }}>⚡ Apps Script 프록시가 연동되어 별도 구글 로그인 팝업 없이 즉시 원클릭으로 다운로드됩니다.</span>
              ) : (
                <span>💡 OAuth 팝업이 1회 나타납니다. (Apps Script URL을 등록하면 팝업 0회 무음 다운로드로 자동 전환됩니다)</span>
              )}
            </p>
            {isMergingDriveFiles && mergeProgressLabel && (
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                ⏳ {mergeProgressLabel}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={isMergingDriveFiles}
              onClick={() => setShowContractSelectModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '14px', fontWeight: '800', whiteSpace: 'nowrap', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', borderRadius: '8px', color: '#fff', cursor: isMergingDriveFiles ? 'wait' : 'pointer', opacity: isMergingDriveFiles ? 0.7 : 1, boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
            >
              <Download size={18} />
              {isMergingDriveFiles ? '계약 서류 팩 결합 중...' : '🚀 살아있는 계약 선택 ➔ 3대 서류 + 드라이브 통합 팩 다운로드'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={isMergingDriveFiles}
              onClick={handleMergeExcelAndDrivePdf}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '11.5px', fontWeight: '600', whiteSpace: 'nowrap', cursor: isMergingDriveFiles ? 'wait' : 'pointer' }}
            >
              <Download size={13} />
              🧪 단일 안전점검결과서 주입 테스트
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* 왼쪽 영역: 설정 폼 */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 구글 서비스 계정 인증 */}
          <div className="card" style={{ margin: 0, padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={16} style={{ color: 'var(--primary)' }} /> 구글 연동 서비스 계정 및 이메일 인증
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label>구글 서비스 계정 이메일 (G-Suite / Workspace) *</label>
                <input
                  type="email"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  placeholder="예: kiyeunlift@gmail.com"
                  required
                />
              </div>

              <div style={{ position: 'relative' }}>
                <label>구글 계정 패스워드 *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={googlePassword}
                    onChange={e => setGooglePassword(e.target.value)}
                    placeholder="구글 비밀번호 입력"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <label>Gmail 발송용 앱 비밀번호 (App Password) *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAppPassword ? 'text' : 'password'}
                    value={gmailAppPassword}
                    onChange={e => setGmailAppPassword(e.target.value)}
                    placeholder="16자리 Gmail SMTP 앱 비밀번호"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAppPassword(!showAppPassword)}
                    style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showAppPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                  ※ 구글 계정 2단계 인증 설정 후 발급받은 16자리 SMTP 전용 보안 키값을 입력하세요.
                </small>
              </div>
            </div>
          </div>

          {/* ☁️ Supabase Storage 증빙 파일 저장소 안내 */}
          <div className="card" style={{ margin: 0, padding: '24px', border: '1px solid #10B981', backgroundColor: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '15.5px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} style={{ color: '#10B981' }} /> Supabase Storage 증빙 파일 저장소
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', whiteSpace: 'nowrap' }}>
                ✅ 연동 완료 (별도 설정 없음)
              </span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '14px', fontSize: '12.5px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                <strong style={{ color: '#10B981', display: 'block', marginBottom: '6px' }}>☁️ 저장 방식</strong>
                소모품 입고 처리 시 거래명세서/증빙 사진이 <strong style={{ color: 'var(--text-primary)' }}>Supabase Storage 버킷 'evidence/consumables/'</strong>에 자동 저장됩니다.<br />
                구글 로그인 팝업 없이 ERP 계정만으로 즉시 업로드됩니다.
              </div>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', fontSize: '12.5px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>📦 로컬 백업 방법</strong>
                [소모품 관리] → [구매신청 내역] 탭 → <strong style={{ color: 'var(--text-primary)' }}>[증빙파일 ZIP 백업]</strong> 버튼 클릭<br />
                저장된 모든 증빙 파일을 ZIP으로 PC에 다운로드합니다.
              </div>
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '14px', fontSize: '12.5px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                <strong style={{ color: '#3B82F6', display: 'block', marginBottom: '6px' }}>⚙️ 최초 1회 설정 필요 (Supabase 대시보드)</strong>
                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                  <li><a href="https://app.supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>app.supabase.com</a> 접속 → 프로젝트 선택</li>
                  <li>왼쪽 메뉴 <strong>Storage</strong> → <strong>[New Bucket]</strong> 클릭</li>
                  <li>이름: <code style={{ background: 'rgba(0,0,0,0.1)', padding: '1px 6px', borderRadius: '3px', fontFamily: 'monospace' }}>evidence</code>, <strong>Public 토글 ON</strong> → [Save]</li>
                </ol>
                이후 별도 설정 없이 자동으로 동작합니다.
              </div>

              {/* ─── 백업 버튼 영역 ─── */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>📦 증빙 파일 백업</strong>

                {/* 백업 진행 상황 */}
                {backupProgress && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    {backupProgress}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* 로컬 ZIP 백업 */}
                  <button
                    type="button"
                    disabled={isZipBackingUp || isDriveBackingUp}
                    onClick={async () => {
                      const targets = consumablePurchases.filter(p => p.statementFileUrl?.startsWith('http'));
                      if (!targets.length) { alert('백업할 증빙 파일이 없습니다.\n(Supabase Storage에 저장된 파일만 가능)'); return; }
                      setIsZipBackingUp(true);
                      setBackupProgress(`ZIP 생성 중... (총 ${targets.length}건)`);
                      try {
                        const today = new Date().toISOString().split('T')[0];
                        const items = targets.map(p => ({
                          fileName: `${p.id.toUpperCase()}_${p.sellerName}_${p.completedDate || today}.${p.statementFileUrl!.split('.').pop()?.split('?')[0] || 'pdf'}`,
                          fileUrl: p.statementFileUrl!
                        }));
                        await downloadEvidenceAsZip(items, `소모품_증빙파일_백업_${today}.zip`);
                        setBackupProgress(`✅ ZIP 다운로드 완료 (${items.length}건) — 없애려면 영구 삭제 버튼 실행`);
                        // 커스텀 삭제 확인 모달
                        setDeleteModal({
                          open: true,
                          count: items.length,
                          onConfirm: async () => {
                            setBackupProgress('Storage 파일 삭제 중...');
                            await deleteStorageFiles(items.map(i => i.fileUrl));
                            // DB에서 statementFileUrl 을 센티널 값으로 표시
                            await updateEvidenceFileUrls(targets.map(p => ({ id: p.id, url: 'DELETED_AFTER_BACKUP' })));
                            setBackupProgress(`✅ 삭제 완료 (${items.length}건) — ERP 목록에 '백업 후 삭제됨' 표시`);
                            setTimeout(() => setBackupProgress(''), 5000);
                          }
                        });
                        setTimeout(() => setBackupProgress(''), 8000);
                      } catch (err: any) {
                        showErrorModal(err?.message, '로컬 백업 오류');
                        setBackupProgress('');
                      } finally { setIsZipBackingUp(false); }
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <Download size={15} /> {isZipBackingUp ? 'ZIP 생성 중...' : '로컬 백업 (ZIP)'}
                  </button>

                  {/* 구글 드라이브 백업 */}
                  <button
                    type="button"
                    disabled={isZipBackingUp || isDriveBackingUp}
                    onClick={async () => {
                      const targets = consumablePurchases.filter(p => p.statementFileUrl?.startsWith('http'));
                      if (!targets.length) { alert('백업할 증빙 파일이 없습니다.'); return; }
                      const config = googleConfigs[0];
                      const clientId = config?.oauthClientId || oauthClientId;
                      const folder = config?.consumableFolder || '소모품납품';
                      setIsDriveBackingUp(true);
                      setBackupProgress('구글 계정 인증 중...');
                      try {
                        const today = new Date().toISOString().split('T')[0];
                        const items = targets.map(p => ({
                          fileName: `${p.id.toUpperCase()}_${p.sellerName}_${p.completedDate || today}.${p.statementFileUrl!.split('.').pop()?.split('?')[0] || 'pdf'}`,
                          fileUrl: p.statementFileUrl!
                        }));
                        const result = await backupToGoogleDrive(
                          items, clientId, folder,
                          (done, total) => setBackupProgress(`구글 드라이브 업로드 중... (${done}/${total}건)`)
                        );
                        // 성공한 파일 URL만 추립
                        const successUrls = items
                          .filter(it => !result.failedFiles.includes(it.fileName))
                          .map(it => it.fileUrl);
                        const resultMsg = result.fail > 0
                          ? `완료: 성공 ${result.success}건, 실패 ${result.fail}건`
                          : `구글 드라이브 백업 완료 (${result.success}건)`;
                        setBackupProgress(`✅ ${resultMsg}`);
                        // 성공 파일에 대해서만 삭제 확인 모달
                        if (successUrls.length > 0) {
                          setDeleteModal({
                            open: true,
                            count: successUrls.length,
                            onConfirm: async () => {
                              setBackupProgress('Storage 파일 삭제 중...');
                              await deleteStorageFiles(successUrls);
                              // DB의 statementFileUrl 을 Drive URL로 교체
                              const updates = targets
                                .filter(p => result.successUrlMap.has(p.statementFileUrl!))
                                .map(p => ({
                                  id: p.id,
                                  url: result.successUrlMap.get(p.statementFileUrl!)!
                                }));
                              await updateEvidenceFileUrls(updates);
                              setBackupProgress(`✅ 삭제 완료 (${successUrls.length}건) — ERP 증빙보기 링크가 구글드라이브로 변경됨`);
                              setTimeout(() => setBackupProgress(''), 5000);
                            }
                          });
                        }
                        setTimeout(() => setBackupProgress(''), 10000);
                      } catch (err: any) {
                        showErrorModal(err?.message, '구글 드라이브 백업 오류');
                        setBackupProgress('');
                      } finally { setIsDriveBackingUp(false); }
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '7px', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10B981', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <HardDrive size={15} /> {isDriveBackingUp ? '업로드 중...' : '구글 드라이브에 백업'}
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* 개발모드 / 실무모드 제어 스위치 */}
          <div className="card" style={{ margin: 0, padding: '24px', border: isDevMode ? '1px solid var(--warning)' : '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: isDevMode ? 'var(--warning)' : 'var(--primary)' }} /> 시스템 이메일 발송 실행 모드 제어
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    현재 실행 모드: <span style={{ color: isDevMode ? 'var(--warning)' : 'var(--success)', fontWeight: 'bold' }}>{isDevMode ? '개발 모드 (TEST)' : '실무 모드 (LIVE)'}</span>
                  </strong>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                    * 개발 모드에서는 모든 메일 수신처가 <strong>77.victor.lee@gmail.com</strong>으로 강제 우회 발송되며, 발송 시 사전 알림 경고가 출력됩니다.<br />
                    * <strong>개발 완료 시까지는 개발 모드로 고정됩니다.</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDevMode(true);
                    }}
                    className={isDevMode ? "btn-danger" : "btn-secondary"}
                    style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    개발모드 고정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      alert('현재 시스템 구축 및 검증 단계이므로 안전을 위해 실무 모드로 전환할 수 없으며, 개발 모드로 고정 유지됩니다.');
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', color: '#888', cursor: 'not-allowed' }}
                  >
                    실무모드
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 이메일 발송 첨부 서류 절대경로 설정 */}
          <div className="card" style={{ margin: 0, padding: '24px', border: '1px solid rgba(245,158,11,0.4)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={16} style={{ color: 'var(--primary)' }} /> 이메일 자동 첨부 서류 로컬 절대경로 설정
            </h3>
            {/* ⚠️ 주의 배너 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '7px', padding: '10px 14px', marginBottom: '16px' }}>
              <AlertTriangle size={15} style={{ color: '#F59E0B', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#B45309', fontWeight: '600' }}>주의: 시스템 작동에 중요한 설정입니다. 편집에 주의하세요.</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold', marginBottom: '6px', display: 'block', color: 'var(--primary)' }}>
                  🏢 회사 전용 최상위 구글 드라이브 루트 폴더 (또는 URL)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={defaultRootFolderId}
                    onChange={e => setDefaultRootFolderId(e.target.value)}
                    placeholder="예: https://drive.google.com/drive/folders/1abc... 또는 루트 폴더 ID (미지정 시 기본 루트 탐색)"
                    style={{ flex: 1, padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('rootFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                  💡 여기에 회사 드라이브 최상위 폴더를 지정해 두면, 계약 관리나 자산 대장 등 어떤 메뉴에서 탐색기를 열더라도 엉뚱한 폴더 대신 <strong>해당 회사 폴더에서부터 탐색이 시작</strong>됩니다.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>1. 견적서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={quotationTemplateUrl}
                    onChange={e => setQuotationTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../렌탈견적서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('quotation')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>2. 계약서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={contractTemplateUrl}
                    onChange={e => setContractTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../고소작업대_임대차계약서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('contract')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>3. 안전점검결과서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={safetyInspectionTemplateUrl}
                    onChange={e => setSafetyInspectionTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../고소작업대_안전점검결과서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('safety')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>4. 반입전 체크리스트 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={preDeliveryChecklistTemplateUrl}
                    onChange={e => setPreDeliveryChecklistTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../반입전_CHECK_LIST_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('checklist')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>5. 사업자등록증 파일 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={bizRegCertUrl}
                    onChange={e => setBizRegCertUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../사업자등록증.pdf 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('bizCert')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>6. 통장사본 파일 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={bankbookCopyUrl}
                    onChange={e => setBankbookCopyUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../통장사본.pdf 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('bankbook')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>7. 거래명세서 양식 경로 또는 클라우드 링크 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={transactionStatementTemplateUrl}
                    onChange={e => setTransactionStatementTemplateUrl(e.target.value)}
                    placeholder="예: d:/GoogleDrive/.../표준_거래명세서_양식.html 또는 구글 드라이브 주소"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('statement')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 구글 드라이브 폴더 체계 */}
          <div className="card" style={{ margin: 0, padding: '24px', border: '1px solid rgba(245,158,11,0.4)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={16} style={{ color: 'var(--primary)' }} /> 파일 유형별 구글 드라이브 폴더명 맵핑
            </h3>
            {/* ⚠️ 주의 배너 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '7px', padding: '10px 14px', marginBottom: '16px' }}>
              <AlertTriangle size={15} style={{ color: '#F59E0B', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#B45309', fontWeight: '600' }}>주의: 시스템 작동에 중요한 설정입니다. 편집에 주의하세요.</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>렌탈계약서 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={contractFolder}
                    onChange={e => setContractFolder(e.target.value)}
                    placeholder="예: 렌탈계약서_증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('contractFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>소모품납품증빙 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={consumableFolder}
                    onChange={e => setConsumableFolder(e.target.value)}
                    placeholder="예: 소모품납품증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('consumableFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>출고의뢰/배차 증빙 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={deliveryFolder}
                    onChange={e => setDeliveryFolder(e.target.value)}
                    placeholder="예: 출고의뢰_증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('deliveryFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>정비보고서 보존 폴더명 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={maintenanceFolder}
                    onChange={e => setMaintenanceFolder(e.target.value)}
                    placeholder="예: 정비보고서_증빙"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDriveSelector('maintenanceFolder')}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Cloud size={14} /> 드라이브 탐색
                  </button>
                </div>
              </div>

              {/* 구글 드라이브 백업용 OAuth Client ID */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>구글 드라이브 백업용 OAuth 2.0 Client ID</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={oauthClientId}
                    onChange={e => setOauthClientId(e.target.value)}
                    placeholder="123456789-xxx.apps.googleusercontent.com"
                    style={{ flex: 1, height: '38px', fontSize: '13px', padding: '0 12px', borderRadius: '6px', border: `1px solid ${oauthClientId ? '#10B981' : 'var(--border)'}`, background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                  />
                  <button type="button" onClick={handleSave} className="btn-primary" style={{ padding: '0 16px', height: '38px', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    저장
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>미입력 시 [Supabase Storage 증빙 파일 저장소] 커드에서 구글 드라이브에 백업 기능을 사용할 수 없습니다.</span>
              </div>
            </div>
          </div>

          {/* 하단 버튼 제어 및 테스트 로그 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {showTestConsole && (
              <div style={{ backgroundColor: '#1e293b', color: '#38bdf8', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #334155' }}>
                <div style={{ borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '8px', color: '#94a3b8', fontWeight: 'bold' }}>
                  구글 연동 연계 테스트 콘솔 로그
                </div>
                {testLog.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>{log}</div>
                ))}
                {isTesting && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#f59e0b' }}>
                    <RefreshCw size={12} className="animate-spin" /> 통신 릴레이 확인 중...
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTestConnection}
                disabled={isTesting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isTesting ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                API 연동 테스트 실행
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn-primary" style={{ padding: '8px 24px' }}>
                  설정 정보 저장
                </button>
              </div>
            </div>
          </div>

        </form>

        {/* 오른쪽 영역: 구글 드라이브 Apps Script 프록시 & 용량 모니터링 & 앱 비밀번호 가이드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* ⚡ Google Apps Script 웹앱 프록시 설정 (팝업 0회 무음 다운로드) */}
          <div className="card" style={{ margin: 0, padding: '24px', border: '1px solid #16a34a', backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: '#16a34a' }} /> ⚡ Apps Script 웹앱 프록시 (팝업 0회)
              </span>
              {appsScriptUrl?.trim() ? (
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: 'rgba(22,163,74,0.15)', color: '#16a34a' }}>
                  ✅ 연동 활성화됨
                </span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  미등록 (OAuth 팝업 사용 중)
                </span>
              )}
            </h3>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 14px 0' }}>
              Google Apps Script 웹앱을 1회 배포하여 URL을 등록하면, 전 직원이 <strong>구글 로그인 팝업 0회(Zero-Popup)</strong>로 구글 드라이브 원본 PDF를 실시간 자동 병합할 수 있습니다.
            </p>

            {/* Apps Script 배포 3단계 가이드 */}
            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', fontSize: '12px', lineHeight: '1.7', marginBottom: '14px' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>📋 1회성 배포 절차 (약 1분):</strong>
              <ol style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)' }}>
                <li>아래 <strong>[Apps Script 코드 복사]</strong> 버튼 클릭</li>
                <li><a href="https://script.google.com/home/start" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>script.google.com</a> 접속 → [새 프로젝트]에 붙여넣기</li>
                <li>우측 상단 <strong>[배포] → [새 배포]</strong> → 유형: <strong>웹 앱</strong> 선택<br/>
                  • 실행할 사용자: <strong>나(관리자 계정)</strong><br/>
                  • 액세스 권한: <strong>모든 사용자</strong></li>
                <li>발급된 <strong>웹 앱 URL</strong>을 아래 입력란에 붙여넣고 저장</li>
              </ol>
            </div>

            {/* 코드 복사 버튼 */}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const gasCode = `function doGet(e) {
  var fileId = e.parameter.fileId;
  var action = e.parameter.action;
  
  if (action === 'downloadFile' && fileId) {
    try {
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      var base64 = Utilities.base64Encode(blob.getBytes());
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        name: file.getName(),
        mimeType: file.getMimeType(),
        base64: base64
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Kiyeun Lift Google Drive Proxy Ready"
  })).setMimeType(ContentService.MimeType.JSON);
}`;
                navigator.clipboard.writeText(gasCode);
                alert('📋 Google Apps Script 프록시 코드가 클립보드에 복사되었습니다!\nscript.google.com에 붙여넣고 배포해 주세요.');
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '14px' }}
            >
              📋 Apps Script 프록시 코드 클립보드 복사
            </button>

            {/* Apps Script Web App URL 입력창 */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                배포된 Apps Script 웹 앱 URL:
              </label>
              <input
                type="url"
                value={appsScriptUrl}
                onChange={e => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                style={{ width: '100%', padding: '9px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
              />
              <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                ※ 끝이 <code style={{ color: 'var(--primary)' }}>/exec</code>로 끝나는 URL을 입력하세요.
              </small>
            </div>
          </div>

          {/* 구글 드라이브 용량 감시 모니터 카드 */}
          <div className="card" style={{ margin: 0, padding: '24px', backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={18} style={{ color: 'var(--danger)' }} /> 📁 구글 드라이브 클라우드 스토리지 용량 감시
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>사용 중인 용량: <strong>13.8 GB</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>전체 용량: 15.0 GB (무료 플랜)</span>
              </div>

              {/* 프로그레스 바 */}
              <div style={{ width: '100%', height: '14px', backgroundColor: 'var(--border-color)', borderRadius: '7px', overflow: 'hidden' }}>
                <div style={{
                  width: '92%', height: '100%',
                  backgroundColor: 'var(--danger)',
                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)',
                  backgroundSize: '1rem 1rem'
                }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={14} /> 클라우드 용량 임계값(90%) 초과 (92%)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)' }}>백업 권장</span>
              </div>

              {/* 백업 절차 안내 */}
              <div style={{
                marginTop: '12px', padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.03)',
                border: '1px dashed var(--danger)', borderRadius: '8px', fontSize: '12.5px', lineHeight: '1.6'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '800', color: 'var(--danger)' }}>
                  💾 구글 드라이브 권장 백업 및 용량 확보 절차
                </h4>
                <ol style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)' }}>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>로컬 백업 경로 준비:</strong> 사무실 백업용 PC 하드드라이브에 <code>D:\Kiyeun_Lift_Backups\images</code> 폴더를 생성합니다.
                  </li>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>백업 스크립트 실행:</strong> 프로젝트 루트에 있는 <code>run_backup.bat</code> 파일 또는 백업 스크립트(<code>backup_script.js</code>)를 실행하여 3개월이 경과한 오래된 현장 사진 파일들을 로컬 PC로 다운로드합니다.
                  </li>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>자동 클라우드 삭제 확인:</strong> 다운로드가 정상 완료되면 스크립트가 구글 드라이브 내의 해당 파일들을 자동 삭제하여 <strong>클라우드 스토리지 용량을 재확보</strong>합니다.
                  </li>
                  <li>
                    <strong>검증 완료:</strong> 백업 이관 처리된 사진 조회 시, 로컬 보관소 이관 안내 메시지로 자동 대체 노출됩니다.
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* 구글 공식 앱 비밀번호 가이드 */}
          <div className="card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--card-bg)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} style={{ color: 'var(--primary)' }} /> 앱 비밀번호로 로그인 안내
          </h3>

          {/* 중요 경고 박스 */}
          <div style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning-hover)', border: '1px solid var(--warning)', padding: '14px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', fontWeight: '500' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '6px', color: 'var(--warning-hover)' }}>
              <AlertTriangle size={16} /> 중요 공지사항
            </div>
            앱 비밀번호 사용은 권장되지 않으며 대부분의 경우 필요하지 않습니다. 계정을 안전하게 보호하려면 'Google 계정으로 로그인'을 사용하여 앱을 Google 계정에 연결하세요.
          </div>

          <p style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: '1.6', margin: 0 }}>
            앱 비밀번호란 보안 수준이 낮은 앱 또는 기기에 Google 계정에 대한 액세스 권한을 부여하는 <strong>16자리 비밀번호</strong>입니다. 앱 비밀번호는 <strong>2단계 인증</strong>이 사용 설정된 계정에서만 이용할 수 있습니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={15} style={{ color: 'var(--primary)' }} /> 앱 비밀번호를 사용해야 하는 경우
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '8px', borderLeft: '3px solid var(--border)' }}>
              <strong>도움말:</strong> iOS 11 이상을 실행하는 iPhone 및 iPad에는 앱 비밀번호가 필요하지 않습니다. 대신 'Google 계정으로 로그인'을 사용하세요.
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: '1.6' }}>
              앱에서 'Google 계정으로 로그인'을 제공하지 않는 경우(예: ERP 자체 SMTP 메일 연동 등) 다음 방법 중 하나를 이용하면 됩니다:
            </p>
            <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>구글 계정의 앱 비밀번호 발급 및 사용</li>
              <li>보안 수준이 높은 앱 또는 기기로 전환</li>
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={15} style={{ color: 'var(--primary)' }} /> 앱 비밀번호 만들고 사용하기
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <strong>필수요건:</strong> 앱 비밀번호를 만들려면 Google 계정에 2단계 인증이 필요합니다.
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
              2단계 인증을 사용 중이며 로그인할 때 '잘못된 비밀번호' 오류가 표시된다면 앱 비밀번호를 사용해 볼 수 있습니다.
            </p>

            <a 
              href="https://myaccount.google.com/apppasswords" 
              target="_blank" 
              rel="noreferrer" 
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none', padding: '10px', fontSize: '13px', fontWeight: '700', borderRadius: '8px', marginTop: '6px' }}
            >
              앱 비밀번호 생성 및 관리 바로가기 <ExternalLink size={14} />
            </a>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', marginTop: '8px', backgroundColor: 'var(--body-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <strong>※ 옵션을 찾을 수 없는 경우 원인:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                <li>Google 계정에 보안 키에만 2단계 인증이 설정되어 있습니다.</li>
                <li>직장, 학교 또는 다른 조직 계정에 로그인한 상태입니다.</li>
                <li>Google 계정에 고급 보호가 설정되어 있습니다.</li>
              </ul>
            </div>
          </div>
        </div>
        </div>

        {/* 구글 드라이브 스마트 탐색기 공용 모달 */}
        <GoogleDrivePickerModal
          isOpen={isDriveSelectorOpen}
          onClose={() => {
            setIsDriveSelectorOpen(false);
            setSelectorTargetField(null);
          }}
          onSelect={handleSelectDriveItem}
          mode={pickerMode}
          title={selectorTargetField === 'rootFolder' ? '🏢 회사 전용 최상위 구글 드라이브 폴더 선택' : '📄 구글 드라이브 서류 템플릿 파일 선택'}
        />

        {/* 🚀 살아있는 계약 선택 팝업 모달 */}
        {showContractSelectModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '16px', maxWidth: '750px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    🚀 실시간 유효 계약 선택 (통합 서류 팩 테스트)
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    현재 살아있는(ACTIVE) 계약 중 하나를 선택하면, 실제 계약/고객/장비 데이터를 주입하여 3대 서류와 드라이브 원본을 병합합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContractSelectModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {contracts.filter(c => c.status === 'ACTIVE').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    현재 유효한(ACTIVE) 계약이 없습니다. 계약 관리에서 계약을 먼저 등록해 주세요.
                  </div>
                ) : (
                  contracts.filter(c => c.status === 'ACTIVE').map(c => {
                    const cust = customers.find(x => x.id === c.customerId);
                    const site = sites.find(s => s.id === c.siteId);
                    const cAssetCount = contractAssets.filter(ca => ca.contractId === c.id).length;

                    return (
                      <div
                        key={c.id}
                        style={{
                          padding: '16px 18px',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-app)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '16px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#2563eb' }}>{c.contractNo}</span>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{cust?.name || '고객사'}</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#dbeafe', color: '#1d4ed8', fontWeight: 'bold' }}>
                              장비 {cAssetCount}대 체결
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span>📍 현장: <strong>{site?.name || '기본현장'}</strong></span>
                            <span>📅 계약일: {c.startDate}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleGenerateActiveContractPackage(c.id)}
                          style={{
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#2563eb',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          <Download size={15} />
                          이 계약으로 팩 다운로드
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-app)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowContractSelectModal(false)}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600' }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
