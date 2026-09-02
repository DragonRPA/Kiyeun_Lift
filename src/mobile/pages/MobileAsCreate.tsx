// src/mobile/pages/MobileAsCreate.tsx
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CameraUploader } from '../components/CameraUploader';
import { ArrowLeft, Check, Plus, AlertTriangle } from 'lucide-react';

interface MobileAsCreateProps {
  onBack: () => void;
  onCreated: (ticketId: string) => void;
}

const CATEGORIES = [
  '방지봉/협착',
  '상하강불량',
  '충전/전원',
  '오일누유',
  '키박스/스위치',
  '에러코드',
  '파이프걸림',
  '점검요청',
  '기타',
];

export const MobileAsCreate: React.FC<MobileAsCreateProps> = ({ onBack, onCreated }) => {
  const { createFieldAsTicket, showErrorModal } = useApp();

  const [customerName, setCustomerName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [assetNo, setAssetNo] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [issueCategory, setIssueCategory] = useState('방지봉/협착');
  const [issueDescription, setIssueDescription] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !assetNo.trim()) {
      showErrorModal('고객사명과 장비번호는 필수 입력 항목입니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await createFieldAsTicket({
        customerName,
        siteName,
        assetNo: assetNo.toUpperCase(),
        locationDetail,
        reporterName,
        reporterContact,
        issueCategory,
        issueDescription,
        priority,
        faultImageUrl: images[0] || '',
        evidenceImages: images,
      });

      alert('AS 접수가 등록되었습니다.');
      onCreated(ticket.id);
    } catch (err: any) {
      showErrorModal('접수 등록 실패: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-28 p-4 bg-slate-950 min-h-screen">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로가기
        </button>
        <span className="text-sm font-black text-white">현장 AS 신규 접수</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 장비번호 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">
            장비번호 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={assetNo}
            onChange={(e) => setAssetNo(e.target.value)}
            placeholder="예: 1001, G19-01"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono uppercase focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 고객사명 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">
            고객사명 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="고객사 상호명 입력"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 현장명 / 위치 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">현장명</label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="현장 이름 또는 주소"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 고장 분류 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">고장 분류</label>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setIssueCategory(cat)}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                  issueCategory === cat
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 고장 상세 증상 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">고장 상세 내용</label>
          <textarea
            rows={3}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="현장 작업자의 구체적 고장 호소 내용..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 접수자 연락처 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">접수자 성함</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="홍길동"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">연락처</label>
            <input
              type="tel"
              value={reporterContact}
              onChange={(e) => setReporterContact(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white"
            />
          </div>
        </div>

        {/* 고장 현장 사진 첨부 */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <CameraUploader
            label="고장 현장 사진 촬영"
            images={images}
            onChange={setImages}
            maxImages={4}
          />
        </div>

        {/* 접수 등록 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base shadow-xl active:scale-98 transition-all"
        >
          {isSubmitting ? '접수 등록 중...' : '현장 AS 접수 등록'}
        </button>
      </form>
    </div>
  );
};
