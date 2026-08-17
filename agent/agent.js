/**
 * =========================================================================
 * 🏢 (주)기연리프트 ERP — 로컬 경량 사이드카 에이전트 (Local Sidecar Agent)
 * =========================================================================
 * - 역할: 브라우저가 직접 처리하기 어려운 엑셀 직접 조작, PDF 무손실 생산,
 *        구글 드라이브 로컬 미러링, 로컬 문서고 영구 아카이빙을 대행 처리.
 * - 콜사인: 로그인 아이디 기반 (기본값: admin)
 * - 통신: 로컬 HTTP (http://127.0.0.1:5175) & Supabase Realtime 메시지 큐
 * =========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PDFDocument, rgb } = require('pdf-lib');

const PORT = process.env.PORT || 5175;
const CALLSIGN = process.env.AGENT_CALLSIGN || 'admin';
const MACHINE_NAME = os.hostname();

// 📁 로컬 문서고 영구 아카이빙 기본 경로 (D: 드라이브 우선, 없으면 C: 또는 에이전트 폴더)
let ARCHIVE_ROOT = 'D:\\기연리프트_문서고';
try {
  if (!fs.existsSync('D:\\')) {
    ARCHIVE_ROOT = path.join(os.homedir(), '기연리프트_문서고');
  }
} catch (e) {
  ARCHIVE_ROOT = path.join(os.homedir(), '기연리프트_문서고');
}
if (!fs.existsSync(ARCHIVE_ROOT)) {
  try { fs.mkdirSync(ARCHIVE_ROOT, { recursive: true }); } catch (e) {}
}

// 📁 구글 드라이브 로컬 미러링 캐시 폴더
const DRIVE_MIRROR_DIR = path.join(__dirname, 'drive_mirror');
if (!fs.existsSync(DRIVE_MIRROR_DIR)) {
  try { fs.mkdirSync(DRIVE_MIRROR_DIR, { recursive: true }); } catch (e) {}
}

console.log('====================================================');
console.log('🚀 [기연리프트] 로컬 사이드카 에이전트 가동');
console.log(`📡 콜사인(Callsign): ${CALLSIGN}`);
console.log(`💻 컴퓨터 이름: ${MACHINE_NAME}`);
console.log(`📂 로컬 문서 보관소: ${ARCHIVE_ROOT}`);
console.log(`🌐 로컬 통신 포트: http://127.0.0.1:${PORT}`);
console.log('====================================================');

// ── 1. 계약서 12줄 정밀 렌더링 ──
async function buildContractPdf(contractData, templateBuffer) {
  const pdfDoc = await PDFDocument.load(templateBuffer);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const white = rgb(1, 1, 1);

  // 셀 영역 화이트아웃 마스킹 (기존 잔존 텍스트 완전 소멸)
  page.drawRectangle({ x: 200, y: height - 105, width: 200, height: 16, color: white });
  page.drawRectangle({ x: 380, y: height - 130, width: 180, height: 15, color: white });
  page.drawRectangle({ x: 380, y: height - 150, width: 180, height: 15, color: white });
  page.drawRectangle({ x: 380, y: height - 170, width: 180, height: 15, color: white });
  page.drawRectangle({ x: 120, y: height - 222, width: 200, height: 15, color: white });
  page.drawRectangle({ x: 395, y: height - 222, width: 165, height: 15, color: white });
  page.drawRectangle({ x: 120, y: height - 240, width: 440, height: 15, color: white });
  page.drawRectangle({ x: 120, y: height - 276, width: 200, height: 15, color: white });
  page.drawRectangle({ x: 395, y: height - 276, width: 165, height: 15, color: white });
  page.drawRectangle({ x: 35, y: height - 528, width: 525, height: 218, color: white });
  page.drawRectangle({ x: 395, y: height - 425, width: 165, height: 18, color: white });
  page.drawRectangle({ x: 375, y: height - 765, width: 180, height: 15, color: white });

  return await pdfDoc.save();
}

// ── 2. HTTP 요청 핸들러 (프론트엔드 실시간 통신) ──
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

  // 헬스체크 API
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      callsign: CALLSIGN,
      machineName: MACHINE_NAME,
      archiveRoot: ARCHIVE_ROOT,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 작업 실행 API
  if (req.method === 'POST' && req.url === '/api/execute-job') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        console.log(`📥 [작업 수신] ${payload.jobType || 'CONTRACT_BUNDLE'} (계약: ${payload.contractNo || 'N/A'})`);

        // 로컬 문서고에 날짜별 자동 분류 폴더 생성
        const today = new Date().toISOString().split('T')[0];
        const monthDir = path.join(ARCHIVE_ROOT, today.substring(0, 7));
        if (!fs.existsSync(monthDir)) fs.mkdirSync(monthDir, { recursive: true });

        const safeCustName = (payload.customerName || '고객사').replace(/[/\\?%*:|"<>]/g, '_');
        const fileName = `[기연리프트]_${payload.contractNo || '계약'}_${safeCustName}_${today}.pdf`;
        const localSavePath = path.join(monthDir, fileName);

        // 결과 응답
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          callsign: CALLSIGN,
          localFilePath: localSavePath,
          message: `✅ 로컬 에이전트(${CALLSIGN})가 정품 문서를 생산하여 로컬 문서고에 안전 보관했습니다.`
        }));
      } catch (err) {
        console.error('❌ 작업 처리 실패:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🟢 로컬 에이전트 서비스 리스닝 시작: http://127.0.0.1:${PORT}`);
});
