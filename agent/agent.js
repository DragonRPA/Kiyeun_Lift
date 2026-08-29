/**
 * =========================================================================
 * 🏢 (주)기연리프트 ERP — 로컬 경량 사이드카 에이전트 (Local Sidecar Agent)
 * =========================================================================
 * - 역할: CF R2 파일 로컬 미러링, 로컬 문서고 아카이빙, 프런트 실시간 통신 대행
 * - 통신: 로컬 HTTP (http://127.0.0.1:5175)
 * - 의존성: Node.js 내장 모듈만 사용 (외부 npm 패키지 Zero)
 * =========================================================================
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');


const VERSION = 'v1.127.3.Build.247';
const PORT = process.env.PORT || 5175;
const CALLSIGN = process.env.AGENT_CALLSIGN || 'admin';
const MACHINE_NAME = os.hostname();

// 📁 전사 표준 절대경로: C:\KiyeunAgent\ 및 하위 문서고
const AGENT_HOME = 'C:\\KiyeunAgent';
const TARGET_EXE_PATH = path.join(AGENT_HOME, 'KiyeunAgent.exe');
const ARCHIVE_ROOT = path.join(AGENT_HOME, '문서고');
const DRIVE_MIRROR_DIR = path.join(AGENT_HOME, 'drive_mirror');

// =========================================================================
// 🚀 [스마트 자가 자동 설치 & 구버전 자동 교체(Auto-Kill & Takeover) 엔진]
// 사용자가 다운로드 폴더나 바탕화면에서 KiyeunAgent.exe를 실행한 경우,
// 1) 기존에 돌고 있던 구버전 KiyeunAgent.exe 프로세스를 조용히 자동 종료!
// 2) C:\KiyeunAgent\KiyeunAgent.exe 를 최신 바이너리로 안전 덮어쓰기!
// 3) 표준 위치에서 최신 에이전트를 백그라운드로 즉시 바통 터치 기동!
// =========================================================================
const currentExePath = process.execPath;
const currentPid = process.pid;
const isExe = currentExePath.toLowerCase().endsWith('.exe') && !currentExePath.toLowerCase().includes('node.exe');

// 1. 다른 경로에서 실행된 경우 (설치/업그레이드 모드)
if (isExe && path.resolve(currentExePath).toLowerCase() !== path.resolve(TARGET_EXE_PATH).toLowerCase()) {
  try {
    if (!fs.existsSync(AGENT_HOME)) fs.mkdirSync(AGENT_HOME, { recursive: true });
    if (!fs.existsSync(ARCHIVE_ROOT)) fs.mkdirSync(ARCHIVE_ROOT, { recursive: true });
    if (!fs.existsSync(DRIVE_MIRROR_DIR)) fs.mkdirSync(DRIVE_MIRROR_DIR, { recursive: true });

    console.log('====================================================');
    console.log(`📦 [기연리프트] 에이전트 최신 버전(${VERSION}) 자가 교체/설치 진행`);
    console.log(`📍 현재 실행 위치: ${currentExePath}`);
    console.log(`🎯 표준 정착 경로: ${TARGET_EXE_PATH}`);

    // 기존 구버전 프로세스 및 5175 포트 점유 프로세스 완벽 강제 종료 (설치 모드에서만)
    try {
      console.log('🔄 기존 구버전 프로세스 자동 정리 중...');
      execSync('powershell -NoProfile -Command "Get-Process -Name KiyeunAgent -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ' + currentPid + ' } | Stop-Process -Force"', { stdio: 'ignore' });
    } catch (kErr) {}

    // 0.6초 대기 후 파일 복사
    setTimeout(() => {
      try {
        fs.copyFileSync(currentExePath, TARGET_EXE_PATH);
        console.log('✅ C:\\KiyeunAgent\\KiyeunAgent.exe 최신 버전으로 교체 완료!');
        console.log('🚀 최신 엔진으로 백그라운드 기동합니다...');
        console.log('====================================================');

        const child = spawn(TARGET_EXE_PATH, [], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        });
        child.unref();

        console.log('🎉 업그레이드가 완료되었습니다. 이 창은 2초 후 자동으로 닫힙니다.');
        setTimeout(() => { process.exit(0); }, 2000);
      } catch (copyErr) {
        console.error('⚠️ 파일 복사 실패 (현재 위치에서 실행 유지):', copyErr.message);
      }
    }, 600);
    return;
  } catch (err) {
    console.error('⚠️ 자가 설치 중 오류 발생:', err.message);
  }
}

// 🔄 윈도우 시작 시 자동 실행(Auto-Startup) 레지스트리 자동 등록
try {
  execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "KiyeunAgent" /t REG_SZ /d "${TARGET_EXE_PATH}" /f`, { stdio: 'ignore' });
} catch (e) {}

// 디렉토리 자동 생성 (정식 위치 실행 시)
try {
  if (!fs.existsSync(AGENT_HOME)) fs.mkdirSync(AGENT_HOME, { recursive: true });
  if (!fs.existsSync(ARCHIVE_ROOT)) fs.mkdirSync(ARCHIVE_ROOT, { recursive: true });
  if (!fs.existsSync(DRIVE_MIRROR_DIR)) fs.mkdirSync(DRIVE_MIRROR_DIR, { recursive: true });
} catch (e) {
  console.warn('디렉토리 생성 경고:', e.message);
}

console.log('====================================================');
console.log(`🚀 [기연리프트] 로컬 사이드카 에이전트 가동 (${VERSION})`);
console.log(`📡 콜사인(Callsign): ${CALLSIGN}`);
console.log(`💻 컴퓨터 이름: ${MACHINE_NAME}`);
console.log(`📂 에이전트 홈 경로: ${AGENT_HOME}`);
console.log(`📑 문서 영구 보관소: ${ARCHIVE_ROOT}`);
console.log(`🌐 로컬 통신 포트: http://127.0.0.1:${PORT}`);
console.log('====================================================');

// ── HTTP 요청 핸들러 ──
let activeCallsign = CALLSIGN;

const server = http.createServer(async (req, res) => {
  // CORS 헤더 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];
  const queryIndex = rawUrl.indexOf('?');
  const queryString = queryIndex !== -1 ? rawUrl.substring(queryIndex + 1) : '';
  const searchParams = new URLSearchParams(queryString);

  // 1. 헬스체크 및 동적 콜사인 바인딩 API
  if (req.method === 'GET' && pathname === '/health') {
    const queryCallsign = searchParams.get('callsign');
    if (queryCallsign && queryCallsign.trim()) {
      activeCallsign = queryCallsign.trim();
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      version: VERSION,
      callsign: activeCallsign,
      machineName: MACHINE_NAME,
      archiveRoot: ARCHIVE_ROOT,
      driveMirrorDir: DRIVE_MIRROR_DIR,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. 에이전트 원클릭 핫 재시작 (Restart) API
  if (req.method === 'POST' && pathname === '/api/restart') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, message: '에이전트를 1초 후 자동 재시작합니다.' }));
    setTimeout(() => {
      const child = spawn(TARGET_EXE_PATH, [], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      process.exit(0);
    }, 500);
    return;
  }

  // 3. 에이전트 원클릭 셧다운 (Shutdown) API
  if (req.method === 'POST' && pathname === '/api/shutdown') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, message: '에이전트를 안전하게 종료합니다.' }));
    setTimeout(() => { process.exit(0); }, 500);
    return;
  }

  // 3-2. Cloudflare R2 원본 실시간 강제 재동기화 API
  if (req.method === 'POST' && pathname === '/api/trigger-sync') {
    autoSyncFromCloudflare().then((syncRes) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(syncRes || {
        success: true,
        message: 'Cloudflare R2 실시간 버킷 동기화가 완료되었습니다.'
      }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // 3-2-2. 📧 실시간 Gmail SMTP 이메일 발송 API (/api/send-email)
  if (req.method === 'POST' && pathname === '/api/send-email') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData || '{}');
        const { to, cc, subject, body, googleEmail, gmailAppPassword, attachments } = payload;

        if (!to || !subject || !body) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: '수신자(to), 제목(subject), 본문(body)은 필수 항목입니다.' }));
          return;
        }

        const cleanEmail = String(googleEmail || '').trim();
        const cleanPass = String(gmailAppPassword || '').replace(/\s+/g, '').trim();

        if (!cleanEmail || !cleanPass) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: '구글 계정 이메일과 16자리 앱 비밀번호가 필요합니다.' }));
          return;
        }

        let nodemailer;
        try {
          nodemailer = require('nodemailer');
        } catch (e) {
          try {
            nodemailer = require(path.join(__dirname, '../node_modules/nodemailer'));
          } catch (e2) {
            throw new Error('nodemailer 모듈을 로드할 수 없습니다.');
          }
        }

        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: cleanEmail, pass: cleanPass }
        });

        const parsedAttachments = Array.isArray(attachments) ? attachments.map((att) => {
          const base64Data = String(att.content || '').replace(/^data:.*?;base64,/, '');
          return {
            filename: att.filename || '계약서류팩.pdf',
            content: Buffer.from(base64Data, 'base64'),
            contentType: att.contentType || 'application/pdf'
          };
        }) : undefined;

        const info = await transporter.sendMail({
          from: `"(주)기연리프트" <${cleanEmail}>`,
          to: String(to).trim(),
          cc: cc ? String(cc).trim() : undefined,
          subject: String(subject).trim(),
          text: String(body),
          attachments: parsedAttachments
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, messageId: info.messageId, accepted: info.accepted }));
      } catch (err) {
        console.error('Agent email send error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message || '이메일 발송에 실패했습니다.' }));
      }
    });
    return;
  }

  // 3-3. 🌟 정품 엑셀 원본 기반 7종 통합 계약 서류팩 PDF 생성 엔진 (Excel COM + pdf-lib)
  if (req.method === 'POST' && pathname === '/api/generate-contract-bundle') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const tempBuildDir = path.join(AGENT_HOME, 'temp_build_' + Date.now());
      try {
        const payload = JSON.parse(body || '{}');
        if (!fs.existsSync(tempBuildDir)) fs.mkdirSync(tempBuildDir, { recursive: true });

        const custName = payload.customerName || '주식회사 세보엠이씨';
        const bizRegNo = payload.bizRegNo || '118-81-00241';
        const ceoName = payload.ceoName || '김우영, 이원하';
        const contractDate = payload.contractDate || new Date().toISOString().split('T')[0];
        const siteName = payload.siteName || '평택삼성전자 P4';
        const siteAddress = payload.siteAddress || '경기 평택시 고덕면 여염리 산 157';
        const managerName = payload.managerName || payload.siteManagerName || '장효준 선임';
        const managerPhone = payload.managerPhone || payload.siteManagerPhone || '010-7723-0285';
        const optionsText = payload.optionsText || '옵션 협착난간대, 튜브소화기 외';
        const remarksText = payload.remarksText || '안전발판 지급';

        const assets = payload.assets && payload.assets.length > 0 ? payload.assets : [
          {
            assetNo: 'G26006',
            modelName: 'GS-2646',
            sn: 'GS46D-13045',
            rentalFee: 480000,
            manufacturer: 'GENIE (주)기연리프트',
            manufactureYear: '2018',
            weight: '1,956 kg',
            workingHeight: '9.92 M',
            capacityPreExt: '454 kg',
            certDate: '2010-12-29'
          }
        ];

        const primaryAsset = assets[0];
        const totalRentalFee = assets.reduce((sum, a) => sum + (Number(a.rentalFee) || 0), 0);

        // PowerShell 스크립트 작성 (다중 자산 N대 엑셀 COM 배치 엔진)
        let psScript = `\ufeff
$ErrorActionPreference = 'Stop'

$net = New-Object -ComObject WScript.Network
$origPrinter = "Apeos C2060"
try { $net.SetDefaultPrinter('Microsoft Print to PDF') } catch {}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

function Replace-Tag($targetWs, $tag, $val) {
  $null = $targetWs.Cells.Replace($tag, $val, 2, 1, $false, $false, $false)
}

# ─── 1. 01.계약서.xlsx (1 page) ───
$f1In = '${DRIVE_MIRROR_DIR.replace(/\\/g, '\\\\')}\\\\01.계약서.xlsx'
$f1Work = '${tempBuildDir.replace(/\\/g, '\\\\')}\\\\01.계약서_filled.xlsx'
$f1Pdf = '${tempBuildDir.replace(/\\/g, '\\\\')}\\\\01.계약서.pdf'
Copy-Item $f1In $f1Work -Force
$wb1 = $excel.Workbooks.Open($f1Work)
$ws1 = $wb1.Sheets.Item(1)

Replace-Tag $ws1 "{Today}" "${contractDate}"
Replace-Tag $ws1 "{사업자등록번호}" "${bizRegNo}"
Replace-Tag $ws1 "{고객명}" "${custName}"
Replace-Tag $ws1 "{대표자}" "${ceoName}"
Replace-Tag $ws1 "{현장명}" "${siteName}"
Replace-Tag $ws1 "{하차일시}" "${contractDate}"
Replace-Tag $ws1 "{현장주소}" "${siteAddress}"
Replace-Tag $ws1 "{현장담당자}" "${managerName}"
Replace-Tag $ws1 "{현장담당자연락처}" "${managerPhone}"
Replace-Tag $ws1 "{합계}" "₩${totalRentalFee.toLocaleString()}"
Replace-Tag $ws1 "{옵션}" "${optionsText}"
Replace-Tag $ws1 "{특이사항}" "${remarksText}"

# ── 자산별 행(Row 44부터) 1대당 1줄씩 명시적 기입 ──
` + assets.map((ast, idx) => {
  const row = 44 + idx;
  const aModel = ast.modelName || 'GS-2646';
  const aSn = ast.sn ? String(ast.sn) : '';
  const aNo = ast.assetNo || '';
  const aFee = (ast.rentalFee || 480000).toLocaleString();
  return `
$ws1.Cells.Item(${row}, 1).Value2 = "${aModel}"
$ws1.Cells.Item(${row}, 3).Value2 = "1"
$ws1.Cells.Item(${row}, 4).Value2 = "${aSn}\`r\`n${aNo}"
$ws1.Cells.Item(${row}, 5).Value2 = "${aFee}"
$ws1.Cells.Item(${row}, 7).Value2 = "${aFee}"
`;
}).join('') + (assets.length < 12 ? Array.from({ length: 12 - assets.length }, (_, k) => {
  const row = 44 + assets.length + k;
  return `
$ws1.Cells.Item(${row}, 1).Value2 = ""
$ws1.Cells.Item(${row}, 3).Value2 = ""
$ws1.Cells.Item(${row}, 4).Value2 = ""
$ws1.Cells.Item(${row}, 5).Value2 = ""
$ws1.Cells.Item(${row}, 7).Value2 = ""
`;
}).join('') : '') + `

$ws1.PageSetup.PaperSize = 9
$ws1.PageSetup.Orientation = 1
$ws1.PageSetup.Zoom = $false
$ws1.PageSetup.FitToPagesWide = 1
if (${assets.length} -le 12) {
  $ws1.PageSetup.PrintArea = "A26:K78"
  $ws1.PageSetup.FitToPagesTall = 1
} else {
  $ws1.PageSetup.PrintArea = ""
  $ws1.PageSetup.FitToPagesTall = $false
}
$wb1.ExportAsFixedFormat(0, $f1Pdf)
$wb1.Close($false)
`;

        // ─── 2. 02.반입전체크리스트.xlsx (자산 N대 루프) ───
        for (let i = 0; i < assets.length; i++) {
          const ast = assets[i];
          const cModel = ast.modelName || 'GS-2646';
          const cAssetNo = ast.assetNo || 'G26006';

          psScript += `
# --- 2-${i+1}. 체크리스트: ${cAssetNo} (${cModel}) ---
$f2In_${i} = '${DRIVE_MIRROR_DIR.replace(/\\/g, '\\\\')}\\\\02.반입전체크리스트.xlsx'
$f2Work_${i} = '${tempBuildDir.replace(/\\/g, '\\\\')}\\\\02.체크리스트_${i}.xlsx'
$f2Pdf_${i} = '${tempBuildDir.replace(/\\/g, '\\\\')}\\\\02.체크리스트_${i}.pdf'
Copy-Item $f2In_${i} $f2Work_${i} -Force
$wb2_${i} = $excel.Workbooks.Open($f2Work_${i})
$ws2_${i} = $wb2_${i}.Sheets.Item(1)
Replace-Tag $ws2_${i} "{모델명}" "${cModel}"
Replace-Tag $ws2_${i} "{관리번호}" "${cAssetNo}"
$ws2_${i}.PageSetup.PaperSize = 9
$ws2_${i}.PageSetup.Orientation = 1
$ws2_${i}.PageSetup.Zoom = $false
$ws2_${i}.PageSetup.FitToPagesWide = 1
$ws2_${i}.PageSetup.FitToPagesTall = 1
$wb2_${i}.ExportAsFixedFormat(0, $f2Pdf_${i})
$wb2_${i}.Close($false)
`;
        }

        // ─── 3. 03.안전점검결과서.xlsx (자산 N대 루프) ───
        for (let i = 0; i < assets.length; i++) {
          const ast = assets[i];
          const aModel = ast.modelName || 'GS-2646';
          const aAssetNo = ast.assetNo || 'G26006';
          const aSn = ast.sn || '';
          const aMfg = ast.manufacturer || 'GENIE (주)기연리프트';
          const aYear = ast.manufactureYear ? `${ast.manufactureYear}년` : '2018년';
          const aWeight = ast.weight || '1,956 kg';
          const aHeight = ast.workingHeight || '9.92 m';
          const aCap = ast.capacityPreExt || '454 kg';
          const aCertDate = ast.certDate || '2010-12-29';

          psScript += `
# --- 3-${i+1}. 안전점검표: ${aAssetNo} (${aModel}) ---
$f3In_${i} = '${DRIVE_MIRROR_DIR.replace(/\\/g, '\\\\')}\\\\03.안전점검결과서.xlsx'
$f3Work_${i} = '${tempBuildDir.replace(/\\/g, '\\\\')}\\\\03.안전점검_${i}.xlsx'
$f3Pdf_${i} = '${tempBuildDir.replace(/\\/g, '\\\\')}\\\\03.안전점검_${i}.pdf'
Copy-Item $f3In_${i} $f3Work_${i} -Force
$wb3_${i} = $excel.Workbooks.Open($f3Work_${i})
$ws3_${i} = $wb3_${i}.Sheets.Item(1)
Replace-Tag $ws3_${i} "{사업장명}" "${siteName}"
Replace-Tag $ws3_${i} "{형식}" "자주식 시저형"
Replace-Tag $ws3_${i} "{제조사}" "${aMfg}"
Replace-Tag $ws3_${i} "{고객명}" "${custName}"
Replace-Tag $ws3_${i} "{동력방식}" "배터리식"
Replace-Tag $ws3_${i} "{모델명}" "${aModel}"
Replace-Tag $ws3_${i} "{중량}" "${aWeight}"
Replace-Tag $ws3_${i} "{운행속도}" "3.5 km/h"
Replace-Tag $ws3_${i} "{작업높이}" "${aHeight}"
Replace-Tag $ws3_${i} "{적재}" "${aCap}"
Replace-Tag $ws3_${i} "{차량번호}" "${aAssetNo}${aSn ? ` (${aSn})` : ''}"
Replace-Tag $ws3_${i} "{제조연도}" "${aYear}"
Replace-Tag $ws3_${i} "{안전인증일}" "${aCertDate}"
Replace-Tag $ws3_${i} "{Today}" "${contractDate}"
Replace-Tag $ws3_${i} "{점검자}" "김동우 팀장"
$ws3_${i}.PageSetup.PaperSize = 9
$ws3_${i}.PageSetup.Orientation = 1
$ws3_${i}.PageSetup.Zoom = $false
$ws3_${i}.PageSetup.FitToPagesWide = 1
$ws3_${i}.PageSetup.FitToPagesTall = 1
$wb3_${i}.ExportAsFixedFormat(0, $f3Pdf_${i})
$wb3_${i}.Close($false)
`;
        }

        psScript += `
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
try { $net.SetDefaultPrinter($origPrinter) } catch {}
`;

        const psFile = path.join(tempBuildDir, 'build_bundle.ps1');
        fs.writeFileSync(psFile, psScript, 'utf8');

        // Excel 변환 동기 실행
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { encoding: 'utf8' });

        // PDF 병합 (pdf-lib)
        let PDFDocument;
        try {
          PDFDocument = require('pdf-lib').PDFDocument;
        } catch (e) {
          try {
            PDFDocument = require(path.join(__dirname, '../node_modules/pdf-lib')).PDFDocument;
          } catch (e2) {
            PDFDocument = require('C:/KiyeunAgent/node_modules/pdf-lib').PDFDocument;
          }
        }

        const mergedPdf = await PDFDocument.create();

        // 1. 계약서 1p 병합
        const f1PdfPath = path.join(tempBuildDir, '01.계약서.pdf');
        if (fs.existsSync(f1PdfPath)) {
          const doc = await PDFDocument.load(fs.readFileSync(f1PdfPath));
          const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        }

        // 2. 체크리스트 Np 병합
        for (let i = 0; i < assets.length; i++) {
          const f2PdfPath = path.join(tempBuildDir, `02.체크리스트_${i}.pdf`);
          if (fs.existsSync(f2PdfPath)) {
            const doc = await PDFDocument.load(fs.readFileSync(f2PdfPath));
            const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
          }
        }

        // 3. 안전점검표 Np 병합
        for (let i = 0; i < assets.length; i++) {
          const f3PdfPath = path.join(tempBuildDir, `03.안전점검_${i}.pdf`);
          if (fs.existsSync(f3PdfPath)) {
            const doc = await PDFDocument.load(fs.readFileSync(f3PdfPath));
            const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
          }
        }

        // 4. 모델별 Eq_doc/{모델명}/ 정규 문서 일체 병합
        const uniqueModels = [];
        assets.forEach(a => {
          if (a.modelName && !uniqueModels.includes(a.modelName)) uniqueModels.push(a.modelName);
        });

        for (const mName of uniqueModels) {
          const eqDocDir = path.join(DRIVE_MIRROR_DIR, 'Eq_doc', mName);
          if (fs.existsSync(eqDocDir)) {
            const files = fs.readdirSync(eqDocDir).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
            for (const f of files) {
              const docBytes = fs.readFileSync(path.join(eqDocDir, f));
              const doc = await PDFDocument.load(docBytes);
              const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
              pages.forEach(p => mergedPdf.addPage(p));
            }
          }
        }

        // 5. 생산물배상책임보험증권 (2025~2026, 2026~2027 연속 보증)
        const p2025 = path.join(DRIVE_MIRROR_DIR, '08.생산물배상책임보험증권_2025-2026.pdf');
        if (fs.existsSync(p2025)) {
          const doc = await PDFDocument.load(fs.readFileSync(p2025));
          const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        }
        const p2026 = path.join(DRIVE_MIRROR_DIR, '08.생산물배상책임보험증권_2026-2027.pdf');
        if (fs.existsSync(p2026)) {
          const doc = await PDFDocument.load(fs.readFileSync(p2026));
          const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        }

        // 6. 사업자등록증 (1p)
        const pBiz = path.join(DRIVE_MIRROR_DIR, '09.사업자등록증.pdf');
        if (fs.existsSync(pBiz)) {
          const doc = await PDFDocument.load(fs.readFileSync(pBiz));
          const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        }

        // 7. 통장사본 (1p)
        const pBank = path.join(DRIVE_MIRROR_DIR, '10.통장사본.pdf');
        if (fs.existsSync(pBank)) {
          const doc = await PDFDocument.load(fs.readFileSync(pBank));
          const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        }

        const finalPdfBytes = await mergedPdf.save();
        const pageCount = mergedPdf.getPageCount();
        const fileName = `[기연리프트]_계약서류팩_${custName}_${siteName}(${pageCount}p).pdf`;

        // 로컬 문서고 영구 아카이빙
        const yyyyMm = contractDate.substring(0, 7) || new Date().toISOString().substring(0, 7);
        const archiveDir = path.join(ARCHIVE_ROOT, yyyyMm);
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        const localSavePath = path.join(archiveDir, fileName);
        fs.writeFileSync(localSavePath, finalPdfBytes);

        // 임시 폴더 청소
        try { fs.rmSync(tempBuildDir, { recursive: true, force: true }); } catch (e) {}

        const b64 = Buffer.from(finalPdfBytes).toString('base64');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          fileName,
          pageCount,
          localPath: localSavePath,
          base64Content: b64,
          message: `정품 엑셀 기반 7종 통합 계약 서류팩(${pageCount}페이지) 생성이 완료되었습니다.`
        }));

      } catch (err) {
        console.error('Agent contract bundle error:', err);
        try { fs.rmSync(tempBuildDir, { recursive: true, force: true }); } catch (e) {}
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 3-4. 🌟 진짜 MS Excel COM 기반 정품 거래명세표 PDF 생성 엔진
  if (req.method === 'POST' && pathname === '/api/generate-statement') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const tempBuildDir = path.join(AGENT_HOME, 'temp_stmt_' + Date.now());
      try {
        const payload = JSON.parse(body || '{}');
        if (!fs.existsSync(tempBuildDir)) fs.mkdirSync(tempBuildDir, { recursive: true });

        const billing    = payload.billing    || {};
        const details    = payload.details    || [];
        const customer   = payload.customer   || {};
        const contract   = payload.contract   || {};
        const site       = payload.site       || {};
        const salesperson = payload.salesperson || {};

        const billingDate = billing.billingDate || billing.billingYm || new Date().toISOString().split('T')[0];
        const custName  = customer.name     || '거래처';
        const siteName  = site.name         || '현장';
        const billingYm = billing.billingYm || billingDate.substring(0, 7);

        // 1. [로컬 원본 엑셀 사본 확인] (1순위: drive_mirror, 2순위: public)
        const excelSources = [
          path.join(DRIVE_MIRROR_DIR, '00.거래명세서양식.xlsx'),
          path.join(DRIVE_MIRROR_DIR, '거래명세서양식.xlsx'),
          'D:\\GoogleDrive\\RPA 개발\\01.AntiGravity\\Kiyuen_Lift\\public\\00.거래명세서양식.xlsx',
          'D:\\GoogleDrive\\RPA 개발\\01.AntiGravity\\Kiyuen_Lift\\public\\거래명세서양식.xlsx'
        ];
        const excelSrc = excelSources.find(p => fs.existsSync(p));
        if (!excelSrc) {
          throw new Error('00.거래명세서양식.xlsx 를 drive_mirror 또는 public 에서 찾을 수 없습니다.');
        }

        const workFile = path.join(tempBuildDir, '00.거래명세서_filled.xlsx');
        const pdfFile  = path.join(tempBuildDir, '00.거래명세서.pdf');
        fs.copyFileSync(excelSrc, workFile);

        // 2. [품목 행 및 합계 데이터 계산]
        let itemReplacementsPs = '';
        let supplyTotal = 0;
        const validDetails = details.slice(0, 11);

        for (let i = 0; i < 11; i++) {
          const item = validDetails[i];
          if (item) {
            const supply = (item.unitPrice || 0) * (item.quantity || 1);
            const vat = Math.round(supply * 0.1);
            supplyTotal += supply;
            const desc = (item.description || '').replace(/"/g, '`"');
            const itmName = (item.itemName || '렌탈 장비').replace(/"/g, '`"');

            if (i === 0) {
              itemReplacementsPs += `
Replace-Tag $ws "{월}" "${billingDate.split('-')[1] || '8'}"
Replace-Tag $ws "{일}" "${billingDate.split('-')[2] || '23'}"
Replace-Tag $ws "{품목} {청구기간}" "${itmName}"
Replace-Tag $ws "{수량}" "${item.quantity || 1}"
Replace-Tag $ws "{렌탈료}" "${(item.unitPrice || 0).toLocaleString()}"
Replace-Tag $ws "{공급가액}" "${supply.toLocaleString()}"
Replace-Tag $ws "{부가세}" "${vat.toLocaleString()}"
Replace-Tag $ws "{비고}" "${desc}"
`;
            } else {
              const r = 16 + i;
              itemReplacementsPs += `
$ws.Cells.Item(${r}, 2).Value2 = ${i + 1}
$ws.Cells.Item(${r}, 3).Value2 = "${billingDate.split('-')[1] || '8'}"
$ws.Cells.Item(${r}, 4).Value2 = "${billingDate.split('-')[2] || '23'}"
$ws.Cells.Item(${r}, 5).Value2 = "${itmName}"
$ws.Cells.Item(${r}, 12).Value2 = ${item.quantity || 1}
$ws.Cells.Item(${r}, 13).Value2 = "${(item.unitPrice || 0).toLocaleString()}"
$ws.Cells.Item(${r}, 15).Value2 = "${supply.toLocaleString()}"
$ws.Cells.Item(${r}, 17).Value2 = "${vat.toLocaleString()}"
$ws.Cells.Item(${r}, 20).Value2 = "${desc}"
`;
            }
          }
        }

        const vatTotal = Math.round(supplyTotal * 0.1);
        const grandTotal = supplyTotal + vatTotal;

        // 3. [진짜 MS Excel COM 자동화 PowerShell 스크립트]
        const psScript = `\ufeff
$ErrorActionPreference = 'Stop'

$net = New-Object -ComObject WScript.Network
$origPrinter = "Apeos C2060"
try { $net.SetDefaultPrinter('Microsoft Print to PDF') } catch {}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

function Replace-Tag($targetWs, $tag, $val) {
  $null = $targetWs.Cells.Replace($tag, $val, 2, 1, $false, $false, $false)
}

$wb = $excel.Workbooks.Open('${workFile.replace(/\\/g, '\\\\')}')
$ws = $wb.Sheets.Item(1)

Replace-Tag $ws "{사업자등록번호}" "${(customer.bizRegNo || '-').replace(/"/g, '`"')}"
Replace-Tag $ws "{고객명}" "${custName.replace(/"/g, '`"')}"
Replace-Tag $ws "{대표자}" "${(customer.representative || '-').replace(/"/g, '`"')}"
Replace-Tag $ws "{주소}" "${(customer.address || '-').replace(/"/g, '`"')}"
Replace-Tag $ws "{업태}" "${(customer.bizType || '건설업').replace(/"/g, '`"')}"
Replace-Tag $ws "{종목}" "${(customer.bizItem || '토목건축').replace(/"/g, '`"')}"
Replace-Tag $ws "{영업사원}" "${(salesperson.name || '테스터(영업)').replace(/"/g, '`"')}"
Replace-Tag $ws "{영업사원연락처}" "${(salesperson.mobile || '010-1111-0002').replace(/"/g, '`"')}"
Replace-Tag $ws "{현장담당자}" "${(site.managerName || site.contactName || '현장소장').replace(/"/g, '`"')}"
Replace-Tag $ws "{현장담당자연락처}" "${(site.managerPhone || site.contactPhone || '-').replace(/"/g, '`"')}"
Replace-Tag $ws "{청구담당자}" "${(customer.billingManagerName || '청구담당').replace(/"/g, '`"')}"
Replace-Tag $ws "{청구담당자연락처}" "${(customer.billingManagerPhone || '-').replace(/"/g, '`"')}"
Replace-Tag $ws "{계산서담당자}" "${(customer.taxManagerName || '회계담당').replace(/"/g, '`"')}"
Replace-Tag $ws "{계산서담당자연락처}" "${(customer.taxManagerPhone || '-').replace(/"/g, '`"')}"
Replace-Tag $ws "{계산서이메일}" "${(customer.repEmail || customer.email || '77.victor.lee@gmail.com').replace(/"/g, '`"')}"
Replace-Tag $ws "{현장명}" "${siteName.replace(/"/g, '`"')}"
$ws.Cells.Item(13, 5).Value2 = "${billingDate}"

${itemReplacementsPs}

Replace-Tag $ws "{공급가합계}" "${supplyTotal.toLocaleString()}"
Replace-Tag $ws "{부가세합계}" "${vatTotal.toLocaleString()}"
Replace-Tag $ws "{총액}" "${grandTotal.toLocaleString()}"

# [A4 가로 1페이지 완벽 맞춤 설정]
try {
  $ws.PageSetup.PaperSize = 9 # xlPaperA4
  $ws.PageSetup.Orientation = 2 # xlLandscape (가로)
  $ws.PageSetup.Zoom = $false
  $ws.PageSetup.FitToPagesWide = 1
  $ws.PageSetup.FitToPagesTall = 1
} catch {}

$wb.ExportAsFixedFormat(0, '${pdfFile.replace(/\\/g, '\\\\')}')
$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

try { $net.SetDefaultPrinter($origPrinter) } catch {}
Write-Host "REAL_EXCEL_EXPORT_SUCCESS"
`;

        const psFile = path.join(tempBuildDir, 'export_stmt.ps1');
        fs.writeFileSync(psFile, psScript, 'utf8');

        // Excel 변환 실행
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { encoding: 'utf8', timeout: 30000 });

        if (!fs.existsSync(pdfFile)) {
          throw new Error('진짜 MS Excel에서 PDF 파일이 생성되지 않았습니다.');
        }

        const pdfBytes = fs.readFileSync(pdfFile);
        const b64 = Buffer.from(pdfBytes).toString('base64');
        const fileName = `거래명세서_${custName}_${siteName}_${billingYm}.pdf`;

        // 4. [문서고 영구 아카이빙 (수정된 엑셀 + 진짜 MS Excel PDF)]
        try {
          const archiveDir = path.join(ARCHIVE_ROOT, billingYm);
          if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
          fs.writeFileSync(path.join(archiveDir, fileName), pdfBytes);
          fs.copyFileSync(workFile, path.join(archiveDir, `거래명세서_${custName}_${siteName}_${billingYm}.xlsx`));
        } catch (archErr) { console.warn('아카이빙 경고(무시):', archErr.message); }

        try { fs.rmSync(tempBuildDir, { recursive: true, force: true }); } catch (e) {}

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          fileName,
          base64Content: b64,
          supplyTotal,
          vatTotal,
          totalAmount: grandTotal,
          message: `✅ 진짜 MS Excel 원본 편집 기반 정품 거래명세표 PDF 생성 완료`
        }));
      } catch (stmtErr) {
        console.error('❌ 거래명세서 생성 실패:', stmtErr);
        try { fs.rmSync(tempBuildDir, { recursive: true, force: true }); } catch (e) {}
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: stmtErr.message }));
      }
    });
    return;
  }


  if (req.method === 'GET' && pathname === '/api/mirror-status') {
    try {
      const getAllFilesRecursively = (dir, rootDir) => {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          if (file.startsWith('.') || file === 'archive') return;
          const fullPath = path.join(dir, file);
          const st = fs.statSync(fullPath);
          if (st.isDirectory()) {
            results = results.concat(getAllFilesRecursively(fullPath, rootDir));
          } else {
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            results.push({ name: relPath, size: st.size, modifiedTime: st.mtime.toISOString() });
          }
        });
        return results;
      };

      const stats = getAllFilesRecursively(DRIVE_MIRROR_DIR, DRIVE_MIRROR_DIR);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        mirrorPath: DRIVE_MIRROR_DIR,
        fileCount: stats.length,
        files: stats
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 3. 구글 드라이브 파일 로컬 미러링 (하위 디렉토리 트리 자동 생성 & 차분 동기화 & 버전 아카이빙) API
  if (req.method === 'POST' && pathname === '/api/sync-drive') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const filesToSync = payload.files || (payload.file ? [payload.file] : []);
        const syncedResults = [];

        for (const file of filesToSync) {
          if (!file.name) continue;

          // 빈 폴더 마커 처리
          if (file.isDirectory || file.name.endsWith('/') || !file.base64Content) {
            const targetDir = path.join(DRIVE_MIRROR_DIR, file.name);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            syncedResults.push({ name: file.name, size: 0, path: targetDir, isDirectory: true });
            continue;
          }

          const targetFilePath = path.join(DRIVE_MIRROR_DIR, file.name);
          const targetDir = path.dirname(targetFilePath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const buffer = Buffer.from(file.base64Content, 'base64');
          fs.writeFileSync(targetFilePath, buffer);
          syncedResults.push({ name: file.name, size: buffer.length, path: targetFilePath });
          console.log(`💾 [CF 미러링 완료] ${file.name} (${buffer.length} bytes)`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          callsign: activeCallsign,
          syncedCount: syncedResults.length,
          syncedFiles: syncedResults,
          message: `✅ 구글 드라이브 ${syncedResults.length}개 파일이 로컬(C:\\KiyeunAgent\\drive_mirror\\)에 실시간 미러링되었습니다.`
        }));
      } catch (err) {
        console.error('❌ 미러링 실패:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 3-2. 로컬 PC 내 Google Drive 폴더 직결 미러링 API (구글 클라우드 OAuth 403 차단 100% 원천 해결)
  if (req.method === 'POST' && pathname === '/api/sync-local-path') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const sourceDir = payload.sourcePath;
        if (!sourceDir || !fs.existsSync(sourceDir)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: '지정한 로컬 폴더 경로가 존재하지 않습니다.' }));
          return;
        }

        const copyRecursively = (src, dest) => {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          const entries = fs.readdirSync(src, { withFileTypes: true });
          let count = 0;
          for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'archive') continue;
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              count += copyRecursively(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
              count++;
            }
          }
          return count;
        };

        const totalCopied = copyRecursively(sourceDir, DRIVE_MIRROR_DIR);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          totalCopied,
          message: `✅ 로컬 드라이브 (${sourceDir})에서 총 ${totalCopied}개 파일이 C:\\KiyeunAgent\\drive_mirror\\ 로 즉시 복제되었습니다.`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }
  // 5. 파일 캐시 확인 및 구글 드라이브 다운로드 (로컬 미러링 캐시 우선) API
  if (req.method === 'GET' && pathname === '/api/get-file') {
    const fileId = searchParams.get('fileId');
    const fileName = searchParams.get('fileName') || (fileId ? `${fileId}.pdf` : '');
    if (!fileId && !fileName) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'fileId or fileName is required' }));
      return;
    }

    (async () => {
      try {
        const ext = path.extname(fileName).toLowerCase();
        const mimeTypes = {
          '.pdf': 'application/pdf',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.xls': 'application/vnd.ms-excel',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.txt': 'text/plain',
          '.json': 'application/json'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        // 1순위: 로컬 미러링 폴더(C:\KiyeunAgent\drive_mirror\)에서 파일 확인
        let localFilePath = path.join(DRIVE_MIRROR_DIR, fileName);
        if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          const fileBuf = fs.readFileSync(localFilePath);
          res.writeHead(200, { 'Content-Type': contentType, 'X-Cache-Source': 'LOCAL_MIRROR' });
          res.end(fileBuf);
          return;
        }

        // 2순위: 하위 폴더 탐색 (fileName이 서브 디렉토리 없이 전달된 경우 대비)
        const findFileRecursively = (dir, targetName) => {
          if (!fs.existsSync(dir)) return null;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.name.startsWith('.') || ent.name === 'archive') continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              const found = findFileRecursively(full, targetName);
              if (found) return found;
            } else if (ent.name.toLowerCase() === targetName.toLowerCase()) {
              return full;
            }
          }
          return null;
        };

        const foundPath = findFileRecursively(DRIVE_MIRROR_DIR, path.basename(fileName));
        if (foundPath && fs.existsSync(foundPath)) {
          const fileBuf = fs.readFileSync(foundPath);
          res.writeHead(200, { 'Content-Type': contentType, 'X-Cache-Source': 'LOCAL_MIRROR_RECURSIVE' });
          res.end(fileBuf);
          return;
        }

        // 3순위: R2 공개 URL 또는 기본 CF R2 도메인에서 자동 다운로드 후 로컬 캐싱
        const directUrl = searchParams.get('url') || (fileName ? `https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev/${fileName.split('/').map(encodeURIComponent).join('/')}` : null);
        if (directUrl && directUrl.startsWith('http')) {
          try {
            const fetchRes = await fetch(directUrl);
            if (fetchRes.ok) {
              const ab = await fetchRes.arrayBuffer();
              if (ab.byteLength > 100) {
                const targetDir = path.dirname(localFilePath);
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
                fs.writeFileSync(localFilePath, Buffer.from(ab));

                res.writeHead(200, { 'Content-Type': contentType, 'X-Cache-Source': 'R2_URL_DOWNLOADED' });
                res.end(Buffer.from(ab));
                return;
              }
            }
          } catch (urlErr) {}
        }

        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: `파일을 찾을 수 없습니다: ${fileName}` }));
      } catch (err) {
        console.error('❌ /api/get-file 오류:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }
  // 4. 계약 서류 팩 무손실 생산 및 로컬 문서고 보관 API
  if (req.method === 'POST' && pathname === '/api/execute-job') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        console.log(`📥 [작업 수신] ${payload.jobType || 'CONTRACT_BUNDLE'} (계약: ${payload.contractNo || 'N/A'}, 작업자: ${activeCallsign})`);

        // 로컬 문서고에 날짜별 자동 분류 폴더 생성
        const today = new Date().toISOString().split('T')[0];
        const monthDir = path.join(ARCHIVE_ROOT, today.substring(0, 7));
        if (!fs.existsSync(monthDir)) fs.mkdirSync(monthDir, { recursive: true });

        const safeCustName = (payload.customerName || '고객사').replace(/[/\\?%*:|"<>]/g, '_');
        const fileName = `[기연리프트]_${payload.contractNo || '계약'}_${safeCustName}_${today}.pdf`;
        const localSavePath = path.join(monthDir, fileName);

        if (payload.base64Content) {
          const pdfBuffer = Buffer.from(payload.base64Content, 'base64');
          fs.writeFileSync(localSavePath, pdfBuffer);
        }

        // 결과 응답
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          callsign: activeCallsign,
          localFilePath: localSavePath,
          message: `✅ 로컬 에이전트(${activeCallsign})가 정품 문서를 생산하여 로컬 문서고(${localSavePath})에 안전 보관했습니다.`
        }));
      } catch (err) {
        console.error('❌ 작업 처리 실패:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 6. 로컬 설치 프린터 목록 조회 API
  if (req.method === 'GET' && pathname === '/api/printers') {
    try {
      const psCmd = 'Get-CimInstance -ClassName Win32_Printer | Select-Object Name, Default | ConvertTo-Json';
      const output = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8' }).trim();
      let printerData = [];
      try {
        const parsed = JSON.parse(output || '[]');
        printerData = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        printerData = [];
      }

      const printers = printerData.map(p => p.Name).filter(Boolean);
      const defaultPrinterObj = printerData.find(p => p.Default);
      const defaultPrinter = defaultPrinterObj ? defaultPrinterObj.Name : (printers[0] || '');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        printers,
        defaultPrinter,
        count: printers.length
      }));
    } catch (err) {
      console.error('❌ /api/printers 오류:', err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message, printers: [], defaultPrinter: '' }));
    }
    return;
  }

  // 7. 출고요청서 전용 프린터 0초 다이렉트 인쇄 API
  if (req.method === 'POST' && pathname === '/api/print-dispatch') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const printerName = payload.printerName || 'Apeos C2060';
        const htmlContent = payload.htmlContent || '';
        const title = payload.title || '기연리프트_출고요청서';

        if (!htmlContent) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'htmlContent is required' }));
          return;
        }

        // 임시 인쇄용 HTML 파일 작성 (UTF-8)
        const tempPrintHtml = path.join(AGENT_HOME, `temp_dispatch_print_${Date.now()}.html`);
        fs.writeFileSync(tempPrintHtml, `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; padding: 20px; color: #111; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 13px; text-align: left; }
    th { background-color: #f9fafb; font-weight: bold; width: 130px; }
    .header { text-align: center; border-bottom: 2px solid #312e81; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #1e1b4b; letter-spacing: 2px; }
    .section-title { font-size: 14px; font-weight: bold; border-left: 4px solid #312e81; padding-left: 8px; margin: 16px 0 8px 0; color: #312e81; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`, 'utf8');

        console.log(`🖨️ [다이렉트 인쇄] 대상 프린터: [${printerName}], 임시파일: ${tempPrintHtml}`);

        const printCmd = `Start-Process rundll32.exe -ArgumentList 'mshtml.dll,PrintHTML "${tempPrintHtml}" "${printerName}"' -NoNewWindow`;
        execSync(`powershell -NoProfile -Command "${printCmd}"`, { stdio: 'ignore' });

        // 10초 후 임시 파일 자동 정리
        setTimeout(() => {
          try { if (fs.existsSync(tempPrintHtml)) fs.unlinkSync(tempPrintHtml); } catch (e) {}
        }, 10000);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          printer: printerName,
          message: `✅ 전용 프린터 [${printerName}] 로 출고요청서가 즉시 전송되었습니다.`
        }));
      } catch (err) {
        console.error('❌ /api/print-dispatch 인쇄 오류:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ 포트 ${PORT} 가 사용 중입니다. 이전 프로세스를 정리하고 1초 후 재시도합니다...`);
    try {
      execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
    } catch (e) {}
    setTimeout(() => {
      server.close();
      server.listen(PORT, '127.0.0.1', () => {
        console.log(`🟢 로컬 에이전트 서비스 리스닝 시작: http://127.0.0.1:${PORT}`);
      });
    }, 1000);
  } else {
    console.error('❌ 서버 에러:', err);
  }
});

// ── 0. Cloudflare R2 실시간 버킷 동적 스캔 및 자동 미러링 엔진 (Zero-Dependency SigV4) ──
const CF_ACCOUNT_ID = '35014a2514680107d74e1e68d96e6c32';
const CF_BUCKET_NAME = 'kiyeun-storage';
const CF_ACCESS_KEY = '03cdb7560d37242de608a5db2a976030';
const CF_SECRET_KEY = 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';
const CF_PUBLIC_URL = 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev';

function hmac(key, str) {
  return crypto.createHmac('sha256', key).update(str, 'utf8').digest();
}
function hash(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

async function fetchR2BucketAllObjects() {
  const host = CF_ACCOUNT_ID + '.r2.cloudflarestorage.com';
  const region = 'auto';
  const service = 's3';
  let isTruncated = true;
  let nextContinuationToken = null;
  const allObjects = [];

  while (isTruncated) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const canonicalUri = '/' + CF_BUCKET_NAME;
    let canonicalQuery = 'list-type=2';
    if (nextContinuationToken) {
      canonicalQuery += '&continuation-token=' + encodeURIComponent(nextContinuationToken);
    }
    const payloadHash = hash('');
    const canonicalHeaders = 'host:' + host + '\nx-amz-content-sha256:' + payloadHash + '\nx-amz-date:' + amzDate + '\n';
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = 'GET\n' + canonicalUri + '\n' + canonicalQuery + '\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;
    const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
    const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + hash(canonicalRequest);

    const kDate = hmac('AWS4' + CF_SECRET_KEY, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    const authHeader = 'AWS4-HMAC-SHA256 Credential=' + CF_ACCESS_KEY + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

    const xmlData = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: host,
        port: 443,
        path: canonicalUri + '?' + canonicalQuery,
        method: 'GET',
        headers: {
          'Host': host,
          'x-amz-date': amzDate,
          'x-amz-content-sha256': payloadHash,
          'Authorization': authHeader
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => res.statusCode === 200 ? resolve(d) : reject(new Error('HTTP ' + res.statusCode + ': ' + d)));
      });
      req.on('error', reject);
      req.end();
    });

    const isTruncatedMatch = /<IsTruncated>(true|false)<\/IsTruncated>/.exec(xmlData);
    isTruncated = isTruncatedMatch ? isTruncatedMatch[1] === 'true' : false;

    const tokenMatch = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xmlData);
    nextContinuationToken = tokenMatch ? tokenMatch[1] : null;

    const contentRegex = /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g;
    let match;
    while ((match = contentRegex.exec(xmlData)) !== null) {
      const key = match[1];
      const size = parseInt(match[2], 10);
      const isDirectory = key.endsWith('/');
      allObjects.push({ key, size, isDirectory });
    }
  }

  return allObjects;
}

async function autoSyncFromCloudflare() {
  console.log('🔄 [CF 실시간 동적 미러링] Cloudflare R2 원본 저장소 실시간 스캔 시작...');
  try {
    const objects = await fetchR2BucketAllObjects();
    const fileCount = objects.filter(o => !o.isDirectory).length;
    const folderCount = objects.filter(o => o.isDirectory).length;
    console.log(`📦 [CF R2 버킷 파일 목록 확인] 파일 ${fileCount}개, 빈 폴더 ${folderCount}개 발견`);
    let downloaded = 0;
    let skipped = 0;
    let foldersCreated = 0;

    for (const obj of objects) {
      // 빈 폴더 또는 디렉토리 마커 처리
      if (obj.isDirectory) {
        const targetDir = path.join(DRIVE_MIRROR_DIR, obj.key);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          console.log(`📁 [CF 빈 폴더 생성] ${obj.key}`);
          foldersCreated++;
        }
        continue;
      }

      // 일반 파일 다운로드
      const targetFile = path.join(DRIVE_MIRROR_DIR, obj.key);
      const targetDir = path.dirname(targetFile);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      if (fs.existsSync(targetFile)) {
        const st = fs.statSync(targetFile);
        if (st.isDirectory()) {
          fs.rmSync(targetFile, { recursive: true, force: true });
        } else if (st.size === obj.size && st.size > 0) {
          skipped++;
          continue;
        }
      }

      try {
        const encKey = obj.key.split('/').map(encodeURIComponent).join('/');
        const res = await fetch(`${CF_PUBLIC_URL}/${encKey}`, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab.byteLength > 0) {
            fs.writeFileSync(targetFile, Buffer.from(ab));
            downloaded++;
            console.log(`💾 [CF 동기화 완료] ${obj.key} (${ab.byteLength.toLocaleString()} bytes)`);
          }
        }
      } catch (dlErr) {
        console.error(`❌ [다운로드 실패] ${obj.key}:`, dlErr.message);
      }
    }

    if (downloaded > 0 || foldersCreated > 0) {
      console.log(`✅ [CF 동적 미러링 완료] 파일 갱신: ${downloaded}개, 폴더 생성: ${foldersCreated}개, 최신 유지: ${skipped}개`);
    } else {
      console.log(`✅ [CF 동적 미러링 완료] 모든 파일(${fileCount}개) 및 폴더가 이미 최신 상태로 로컬에 보존되어 있습니다.`);
    }

    return {
      success: true,
      downloaded,
      skipped,
      foldersCreated,
      totalFiles: fileCount,
      message: `✅ Cloudflare R2 동기화 완료 (갱신: ${downloaded}개, 최신 유지: ${skipped}개)`
    };
  } catch (err) {
    console.error('⚠️ CF R2 실시간 버킷 조회 오류:', err.message);
    return {
      success: false,
      error: err.message,
      message: `⚠️ Cloudflare R2 버킷 스캔 오류: ${err.message}`
    };
  }
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🟢 로컬 에이전트 서비스 리스닝 시작: http://127.0.0.1:${PORT}`);
  // 기동 즉시 백그라운드에서 CF 실시간 동적 미러링 실행 (1회)
  setTimeout(autoSyncFromCloudflare, 300);
  // 이후 1시간마다 백그라운드 자가 점검 (3600000 ms)
  setInterval(autoSyncFromCloudflare, 3600000);
});


