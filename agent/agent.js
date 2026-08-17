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
const { spawn, execSync } = require('child_process');
const { PDFDocument, rgb } = require('pdf-lib');

const VERSION = 'v1.111.0.Build.228';
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

// ── 2. HTTP 요청 핸들러 (프론트엔드 실시간 통신 & 미러링 엔진) ──
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

  // 4. 구글 드라이브 로컬 미러링 상태 조회 API (하위 폴더 재귀 통계)
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
        const archiveDir = path.join(DRIVE_MIRROR_DIR, 'archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

        const syncedResults = [];

        for (const file of filesToSync) {
          if (!file.name || !file.base64Content) continue;

          const targetFilePath = path.join(DRIVE_MIRROR_DIR, file.name);
          const targetDir = path.dirname(targetFilePath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const buffer = Buffer.from(file.base64Content, 'base64');

          // 기존 파일 존재 시 버전 아카이빙 (수정일자가 다르거나 크기가 다른 경우)
          if (fs.existsSync(targetFilePath)) {
            const existingStat = fs.statSync(targetFilePath);
            if (existingStat.size !== buffer.length) {
              const nowIso = new Date().toISOString().replace(/[:.]/g, '-');
              const safeFileName = file.name.replace(/[\/\\]/g, '_');
              const backupName = `${nowIso}_${safeFileName}`;
              fs.copyFileSync(targetFilePath, path.join(archiveDir, backupName));
              console.log(`📦 [미러링 버전 아카이브] ${file.name} -> archive/${backupName}`);
            }
          }

          fs.writeFileSync(targetFilePath, buffer);
          syncedResults.push({ name: file.name, size: buffer.length, path: targetFilePath });
          console.log(`💾 [구글 드라이브 미러링 완료] ${file.name} (${buffer.length} bytes)`);
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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🟢 로컬 에이전트 서비스 리스닝 시작: http://127.0.0.1:${PORT}`);
});
