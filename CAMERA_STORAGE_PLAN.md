# 스마트폰 카메라 연동 및 Supabase Storage 비용 최적화 설계서

이 문서는 스마트폰 카메라를 통해 사진을 촬영하고, 클라우드 용량 부족 및 비용 문제를 방지하기 위해 스마트폰 내에서 압축 후 업로드하고, 주기적으로 로컬 PC에 백업한 뒤 클라우드를 비우는 시스템의 설계와 소스코드 스펙을 담고 있습니다.

나중에 해당 기능을 실제 프로젝트에 구현할 때 이 스펙을 그대로 이식하여 적용하시면 됩니다.

---

## 1. 스마트폰 카메라 연동 및 사진 촬영 (HTML5)

스마트폰 브라우저에서 버튼을 누르면 기본 카메라 앱을 즉시 실행시켜 사진을 촬영하고 파일로 받아오는 표준 마크업입니다.

```html
<!-- 스마트폰 세로 방향(후면) 카메라 자동 활성화 버튼 -->
<input 
  type="file" 
  id="camera-input" 
  accept="image/*" 
  capture="environment" 
  style="display: none;" 
/>
<button type="button" onclick="document.getElementById('camera-input').click();">
  사진 촬영 및 업로드
</button>
```

---

## 2. 스마트폰 메모리 내 이미지 압축 (Client-side Compression)

원본 8MB 수준의 고화질 이미지를 브라우저 내부 메모리(HTML5 Canvas)를 이용해 0.1초 만에 **해상도 1280px 제한 및 화질 75% 압축을 가해 150KB 이하로 최적화**하는 핵심 스크립트입니다.

```javascript
document.getElementById('camera-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  console.log(`원본 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

  // 압축 진행
  const compressedFile = await compressImage(file, 1280, 0.75);
  console.log(`압축 후 크기: ${(compressedFile.size / 1024).toFixed(2)} KB`);

  // 이후 업로드 함수 실행
  await uploadToSupabase(compressedFile);
});

// 이미지 리사이징 및 압축 함수
function compressImage(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 가로비 기준 리사이징 비례 조절
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Blob 파일 변환 및 화질 설정
        canvas.toBlob((blob) => {
          const newFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(newFile);
        }, 'image/jpeg', quality);
      };
    };
  });
}
```

---

## 3. Supabase Storage 업로드 및 DB URL 저장

Supabase Storage API를 사용하여 압축된 이미지를 클라우드 저장소(Bucket)에 업로드하고 해당 URL을 데이터베이스 테이블에 저장합니다.

### A. 사전 준비 (Supabase 대시보드 설정)
1. Supabase 프로젝트의 **[Storage]** 메뉴로 들어갑니다.
2. **[New Bucket]** 버튼을 클릭하여 `rental-photos` 버킷을 생성합니다.
3. 이 버킷을 **[Public]** 상태로 설정하여 누구나 링크로 사진을 조회할 수 있도록 구성합니다.

### B. JavaScript 업로드 코드
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY');

async function uploadToSupabase(file) {
  const fileExt = file.name.split('.').pop();
  // 정비 고유번호 또는 날짜별 고유파일명 생성
  const fileName = `repairs/${Date.now()}.${fileExt}`;

  // 1. Storage 버킷에 파일 업로드
  const { data, error } = await supabase.storage
    .from('rental-photos')
    .upload(fileName, file);

  if (error) {
    console.error('Storage Upload Failed:', error);
    return;
  }

  // 2. 업로드된 이미지의 공개 URL 획득
  const { data: { publicUrl } } = supabase.storage
    .from('rental-photos')
    .getPublicUrl(fileName);

  console.log('업로드 완료 URL:', publicUrl);

  // 3. 해당 정비/배송 데이터베이스 테이블에 URL 기록
  const repairId = 'rep-001'; // 대상 정비 데이터 ID
  const { dbError } = await supabase
    .from('repairs')
    .update({ photoUrl: publicUrl })
    .eq('id', repairId);

  if (dbError) {
    console.error('Database Update Failed:', dbError);
  }
}
```

---

## 4. 로컬 PC 자동 백업 및 클라우드 용량 확보 스크립트 (Node.js)

사무실 PC의 로컬 하드 디스크(`D:\Kiyeun_Lift_Backups\images`)에 주기적으로 Supabase의 오래된(예: 3개월 전) 사진들을 다운로드하여 백업하고, 클라우드 저장 용량을 0MB로 유지하기 위해 Supabase에서 삭제 처리하는 아카이빙 스크립트입니다.

```javascript
// C:\Kiyeun_Lift_Backups\backup_script.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('VITE_SUPABASE_URL', 'SERVICE_ROLE_KEY'); // RLS를 우회하기 위해 service_role 키를 사용합니다.
const backupDir = 'D:\\Kiyeun_Lift_Backups\\images';

// 백업 폴더 준비
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function runBackup() {
  console.log('아카이빙 백업을 시작합니다...');

  // 1. 버킷 내의 모든 정비 사진 목록 가져오기
  const { data: files, error } = await supabase.storage
    .from('rental-photos')
    .list('repairs');

  if (error) {
    console.error('파일 목록 조회 실패:', error);
    return;
  }

  console.log(`총 ${files.length}개의 파일을 조회했습니다.`);

  const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90일 전 기준

  for (const file of files) {
    const fileTime = new Date(file.created_at).getTime();

    // 3개월보다 오래된 파일만 로컬 다운로드 및 클라우드 삭제 진행
    if (fileTime < threeMonthsAgo) {
      console.log(`백업 대상 확인: ${file.name} (생성일: ${file.created_at})`);

      // A. 클라우드에서 파일 다운로드 (바이너리 데이터)
      const { data: blob, error: downloadError } = await supabase.storage
        .from('rental-photos')
        .download(`repairs/${file.name}`);

      if (downloadError) {
        console.error(`다운로드 실패 (${file.name}):`, downloadError);
        continue;
      }

      // B. 로컬 하드디스크에 파일 저장
      const buffer = Buffer.from(await blob.arrayBuffer());
      const localFilePath = path.join(backupDir, file.name);
      fs.writeFileSync(localFilePath, buffer);
      console.log(`-> 로컬 저장 완료: ${localFilePath}`);

      // C. 다운로드 성공 후 클라우드 저장 공간에서 파일 삭제
      const { error: removeError } = await supabase.storage
        .from('rental-photos')
        .remove([`repairs/${file.name}`]);

      if (removeError) {
        console.error(`-> 클라우드 삭제 실패 (${file.name}):`, removeError);
      } else {
        console.log(`-> 클라우드 공간 확보 완료 (삭제됨)`);
      }
    }
  }

  console.log('백업 및 용량 확보 작업 완료!');
}

runBackup();
```

---

## 5. 클라우드 이미지 삭제 시 웹앱 예외 처리

클라우드 용량을 비우기 위해 이미지를 로컬로 옮겼을 때, 웹앱에서 빈 엑스박스 이미지가 뜨지 않도록 예외 처리하는 리액트 코드 예시입니다.

```javascript
function PhotoViewer({ photoUrl }) {
  const [imgError, setImgError] = useState(false);

  if (!photoUrl) return <p>등록된 사진 없음</p>;

  // 클라우드에서 이미지가 이미 삭제된 경우 처리
  if (imgError) {
    return (
      <div style={{ padding: '10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}>
        💾 본 사진은 3개월 경과로 인해 <strong>본사 백업 보관소 PC</strong>로 이관되었습니다.
      </div>
    );
  }

  return (
    <img 
      src={photoUrl} 
      alt="정비/배송 완료 이미지" 
      onError={() => setImgError(true)} 
      style={{ maxWidth: '100%', borderRadius: '8px' }}
    />
  );
}
```
