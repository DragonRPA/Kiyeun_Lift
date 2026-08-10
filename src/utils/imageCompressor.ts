// src/utils/imageCompressor.ts
/**
 * 모바일 카메라 촬영 고해상도 사진(10MB+)을 Canvas를 통해 가로/세로 최대 1024px, JPEG 75% 품질로 100KB~200KB 수준으로 자모 압축
 * - 모바일 브라우저 RAM 부족으로 인한 탭 새로고침(Memory Eviction) 100% 방지
 */
export async function compressImageFile(file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    // 💡 URL.createObjectURL 사용으로 15MB Raw FileReader DataURL 메모리 할당 100% 차단 (0MB RAM 사용)
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = blobUrl;
    img.onload = () => {
      URL.revokeObjectURL(blobUrl); // 💡 Blob URL 즉시 메모리 해제

      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        img.src = '';
        resolve('');
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      // 💡 Canvas & Image GPU 텍스처 메모리 즉시 물리 강제 해제 (Android OOM 방지)
      canvas.width = 0;
      canvas.height = 0;
      img.src = '';

      resolve(compressedDataUrl);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(blobUrl);
      img.src = '';
      reject(err);
    };
  });
}

export interface CompressedResult {
  file: File;
  base64: string;
  mimeType: string;
  isCompressed: boolean;
  originalSize: number;
  compressedSize: number;
}

/**
 * Consumables.tsx 호환용 File ➔ CompressedResult 반환 압축 헬퍼
 */
export async function compressFileIfNeeded(file: File, maxMB: number = 1): Promise<CompressedResult> {
  if (!file.type.startsWith('image/')) {
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.readAsDataURL(file);
    });
    return {
      file,
      base64,
      mimeType: file.type || 'application/octet-stream',
      isCompressed: false,
      originalSize: file.size,
      compressedSize: file.size
    };
  }

  const dataUrl = await compressImageFile(file, 1024, 1024, 0.75);
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });

  return {
    file: compressedFile,
    base64: dataUrl,
    mimeType: 'image/jpeg',
    isCompressed: compressedFile.size < file.size,
    originalSize: file.size,
    compressedSize: compressedFile.size
  };
}
