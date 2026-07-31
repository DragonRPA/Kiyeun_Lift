/**
 * ==============================================================================
 * (주)기업엔리프트 ERP <-> Google Drive 실물 자동 동기화 Google Apps Script (GAS)
 * ==============================================================================
 * 
 * [설치 방법 (1분 완료)]:
 * 1. 구글(Google) 로그인 상태에서 https://script.google.com 에 접속합니다.
 * 2. [새 프로젝트] 버튼을 누릅니다.
 * 3. 기존 코드(Code.gs)를 전체 삭제하고, 이 파일의 전체 코드를 복사하여 붙여넣습니다.
 * 4. 우측 상단 [배포] -> [새 배포] 클릭:
 *    - 유형 선택: 웹 앱 (Web App)
 *    - 다음 사용자 권한으로 실행: 나 (Me)
 *    - 액세스 권한 있는 사용자: 누구나 (Anyone)
 * 5. [배포] 버튼을 누른 후 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 복사합니다.
 * 6. ERP 시스템 [설정] / [시스템 관리] 메뉴의 구글 드라이브 API URL 입력란에 붙여넣고 저장합니다!
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderName = data.folderName || '소모품납품';
    var fileName = data.fileName || ('증빙문서_' + new Date().getTime());
    var mimeType = data.mimeType || 'application/pdf';
    var base64Data = data.base64Data || '';

    // 1. 최상위 루트 폴더 [Kiyuen_Lift] 조회 및 미존재 시 자동 생성
    var rootFolderName = 'Kiyuen_Lift';
    var rootFolder;
    var rootFolders = DriveApp.getFoldersByName(rootFolderName);
    if (rootFolders.hasNext()) {
      rootFolder = rootFolders.next();
    } else {
      rootFolder = DriveApp.createFolder(rootFolderName);
    }

    // 2. 하위 업무별 지정 폴더 (예: 소모품납품, 운송료 등) 조회 및 자동 생성
    var targetFolder;
    var targetFolders = rootFolder.getFoldersByName(folderName);
    if (targetFolders.hasNext()) {
      targetFolder = targetFolders.next();
    } else {
      targetFolder = rootFolder.createFolder(folderName);
    }

    // 3. Base64 헤더 제거 (data:image/jpeg;base64, ... 등)
    var rawBase64 = base64Data;
    if (rawBase64.indexOf(',') !== -1) {
      rawBase64 = rawBase64.split(',')[1];
    }

    // 4. 바이너리 바이트 블롭(Blob) 생성
    var decodedBytes = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // 5. 구글 드라이브에 실물 파일 업로드 생성
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileUrl = file.getUrl();
    var fileId = file.getId();

    var result = {
      success: true,
      fileId: fileId,
      fileName: fileName,
      fileUrl: fileUrl,
      folderName: folderName,
      message: '구글 드라이브에 파일이 성공적으로 보존되었습니다.'
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorResult = {
      success: false,
      error: err.toString(),
      message: '구글 드라이브 업로드 실패: ' + err.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ONLINE',
    system: '(주)기업엔리프트 구글드라이브 자동 동기화 API 엔진'
  })).setMimeType(ContentService.MimeType.JSON);
}
