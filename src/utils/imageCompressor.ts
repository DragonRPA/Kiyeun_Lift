/**
 * 이미지 / PDF 파일 자동 압축 및 Base64 데이터 변환 유틸리티
 */

export interface CompressionResult {
  base64: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  isCompressed: boolean;
}

/**
 * 이미지 파일을 HTML Canvas 기반 고화질 자동 압축 (최대 해상도 1920px, 품질 82%)
 * PDF 파일의 경우 원본 유지
 */
export async function compressFileIfNeeded(
  file: File,
  maxDimension: number = 1920,
  quality: number = 0.82
): Promise<CompressionResult> {
  const originalSize = file.size;

  // PDF 파일인 경우: 압축 없이 Base64 변환만 진행
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const base64 = await fileToBase64(file);
    return {
      base64,
      mimeType: 'application/pdf',
      originalSize,
      compressedSize: originalSize,
      isCompressed: false
    };
  }

  // 이미지 파일이 아닌 경우: 그대로 변환
  if (!file.type.startsWith('image/')) {
    const base64 = await fileToBase64(file);
    return {
      base64,
      mimeType: file.type || 'application/octet-stream',
      originalSize,
      compressedSize: originalSize,
      isCompressed: false
    };
  }

  // 이미지 파일 자동 압축
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // 최대 해상도 비율 축소
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fileToBase64(file).then(base64 => {
            resolve({
              base64,
              mimeType: file.type,
              originalSize,
              compressedSize: originalSize,
              isCompressed: false
            });
          });
          return;
        }

        // 고품질 캔버스 드로잉
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 82% 품질 압축
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        const approxCompressedSize = Math.round((compressedBase64.length * 3) / 4);

        resolve({
          base64: compressedBase64,
          mimeType: 'image/jpeg',
          originalSize,
          compressedSize: approxCompressedSize,
          isCompressed: approxCompressedSize < originalSize
        });
      };

      img.onerror = () => {
        fileToBase64(file).then(base64 => {
          resolve({
            base64,
            mimeType: file.type,
            originalSize,
            compressedSize: originalSize,
            isCompressed: false
          });
        });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
