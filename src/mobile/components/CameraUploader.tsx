// src/mobile/components/CameraUploader.tsx
import React, { useState, useRef } from 'react';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';

interface CameraUploaderProps {
  label: string;
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  required?: boolean;
}

export const CameraUploader: React.FC<CameraUploaderProps> = ({
  label,
  images = [],
  onChange,
  maxImages = 4,
  required = false,
}) => {
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompressing(true);
    try {
      const newImages: string[] = [...images];
      for (let i = 0; i < files.length; i++) {
        if (newImages.length >= maxImages) break;
        const file = files[i];
        const compressedBase64 = await compressImageFile(file);
        if (compressedBase64) {
          newImages.push(compressedBase64);
        }
      }
      onChange(newImages);
    } catch (err) {
      console.error('이미지 압축 실패:', err);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-1">
          {label}
          {required && <span className="text-red-400 font-bold">*</span>}
          <span className="text-xs text-slate-400 font-normal">
            ({images.length}/{maxImages})
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {images.map((imgUrl, idx) => (
          <div
            key={idx}
            className="relative aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group"
          >
            <img
              src={imgUrl}
              alt={`촬영 사진 ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-2 right-2 p-2 bg-red-600/90 text-white rounded-lg shadow-lg active:scale-95 transition-transform"
              aria-label="사진 삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-950/80 text-slate-200 text-xs rounded font-mono">
              #{idx + 1}
            </span>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            disabled={compressing}
            onClick={() => fileInputRef.current?.click()}
            className="aspect-video rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-800/50 hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-400 active:scale-98 transition-all min-h-[90px]"
          >
            {compressing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-xs font-medium">압축 중...</span>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6" />
                <span className="text-xs font-semibold">사진 촬영 / 첨부</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
