// src/mobile/pages/MobileManualViewer.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BookOpen,
  Search,
  FileText,
  Download,
  Eye,
  X,
  ChevronLeft,
  Filter,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { EquipmentManual } from '../../services/db';

interface MobileManualViewerProps {
  onBack?: () => void;
  initialModelName?: string;
}

export const MobileManualViewer: React.FC<MobileManualViewerProps> = ({
  onBack,
  initialModelName
}) => {
  const { equipmentManuals, products } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(initialModelName || '전체');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [previewManual, setPreviewManual] = useState<EquipmentManual | null>(null);

  // 모델 고유 목록
  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    (equipmentManuals || []).forEach(m => {
      if (m.modelName) set.add(m.modelName);
    });
    (products || []).forEach(p => {
      if (p.modelName) set.add(p.modelName);
    });
    return Array.from(set).sort();
  }, [equipmentManuals, products]);

  // 매뉴얼 필터링
  const filteredManuals = useMemo(() => {
    return (equipmentManuals || []).filter(m => {
      const matchModel = selectedModel === '전체' || m.modelName === selectedModel;
      const matchCat = selectedCategory === '전체' || m.category === selectedCategory;
      if (!matchModel || !matchCat) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        m.title.toLowerCase().includes(term) ||
        m.modelName.toLowerCase().includes(term) ||
        m.manufacturer.toLowerCase().includes(term) ||
        (m.memo && m.memo.toLowerCase().includes(term)) ||
        (m.version && m.version.toLowerCase().includes(term))
      );
    });
  }, [equipmentManuals, selectedModel, selectedCategory, searchTerm]);

  const getCategoryBadgeClass = (category: EquipmentManual['category']) => {
    switch (category) {
      case 'PARTS_BOOK':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'ERROR_CODE':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'WIRING_DIAGRAM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'OPERATOR_MANUAL':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getCategoryLabel = (category: EquipmentManual['category']) => {
    switch (category) {
      case 'PARTS_BOOK':
        return '부품 파츠북';
      case 'ERROR_CODE':
        return '에러코드 진단표';
      case 'WIRING_DIAGRAM':
        return '전기/유압 회로도';
      case 'OPERATOR_MANUAL':
        return '취급 운전 설명서';
      default:
        return category;
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-24 p-3 font-sans text-slate-100 max-w-full">
      {/* 상단 네비게이션 헤더 */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">장비 매뉴얼 라이브러리</h2>
              <p className="text-[11px] text-slate-400">현장 출고·AS 전용 파츠북 & 에러코드표</p>
            </div>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
          {filteredManuals.length}건
        </span>
      </div>

      {/* 검색창 */}
      <div className="relative w-full">
        <input
          type="text"
          placeholder="모델명, 부품명, 에러코드 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full py-2.5 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 모델 퀵 필터 (가로 스크롤 칩) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedModel('전체')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedModel === '전체'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400'
          }`}
        >
          전체 모델
        </button>
        {modelOptions.map(model => (
          <button
            key={model}
            type="button"
            onClick={() => setSelectedModel(model)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedModel === model
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400'
            }`}
          >
            {model}
          </button>
        ))}
      </div>

      {/* 문서 유형 칩 필터 */}
      <div className="grid grid-cols-5 gap-1">
        {[
          { key: '전체', label: '전체' },
          { key: 'PARTS_BOOK', label: '파츠북' },
          { key: 'ERROR_CODE', label: '에러코드' },
          { key: 'WIRING_DIAGRAM', label: '회로도' },
          { key: 'OPERATOR_MANUAL', label: '취급서' }
        ].map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSelectedCategory(item.key)}
            className={`py-1.5 px-1 rounded-lg text-[11px] font-bold text-center transition-all ${
              selectedCategory === item.key
                ? 'bg-slate-200 text-slate-900 shadow-sm'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 매뉴얼 카드 리스트 */}
      <div className="flex flex-col gap-2.5 mt-1">
        {filteredManuals.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="text-xs text-slate-400 font-bold">조건에 맞는 매뉴얼이 없습니다.</div>
            <div className="text-[11px] text-slate-500 mt-1">검색어를 변경하거나 PC에서 신규 매뉴얼을 등록해 주세요.</div>
          </div>
        ) : (
          filteredManuals.map(manual => (
            <div
              key={manual.id}
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-col gap-2.5 hover:border-slate-700 transition-all"
            >
              {/* 상단 배지 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCategoryBadgeClass(
                      manual.category
                    )}`}
                  >
                    {getCategoryLabel(manual.category)}
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                    {manual.modelName}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">{manual.version}</span>
              </div>

              {/* 매뉴얼 제목 */}
              <div>
                <h3 className="text-xs font-black text-white leading-snug line-clamp-2">
                  {manual.title}
                </h3>
                <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-1">
                  <span>제조사: <strong className="text-slate-300">{manual.manufacturer}</strong></span>
                  {manual.targetSpecFt && <span>• 규격: <strong className="text-slate-300">{manual.targetSpecFt}ft</strong></span>}
                  <span>• 크기: <strong className="text-slate-300">{manual.fileSizeLabel || '0 KB'}</strong></span>
                </div>
              </div>

              {/* 비고 및 요약 가이드 */}
              {manual.memo && (
                <div className="text-[11px] text-slate-400 bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 leading-relaxed">
                  💡 {manual.memo}
                </div>
              )}

              {/* 하단 액션 버튼 바 */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setPreviewManual(manual)}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 active:scale-98 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>즉시 열람</span>
                </button>
                <a
                  href={manual.fileUrl}
                  download={manual.fileName}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 active:scale-98 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>저장</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── 인앱 전체화면 PDF/문서 뷰어 모달 ─── */}
      {previewManual && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          {/* 뷰어 상단 바 */}
          <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getCategoryBadgeClass(
                  previewManual.category
                )}`}
              >
                {previewManual.modelName}
              </span>
              <span className="text-xs font-bold text-white truncate">{previewManual.title}</span>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <a
                href={previewManual.fileUrl}
                download={previewManual.fileName}
                className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
                title="다운로드"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setPreviewManual(null)}
                className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 뷰어 본문 */}
          <div className="flex-1 bg-slate-950 overflow-hidden relative">
            {previewManual.fileUrl.startsWith('data:application/pdf') || previewManual.fileName.endsWith('.pdf') ? (
              <iframe
                src={previewManual.fileUrl}
                title={previewManual.title}
                className="w-full h-full border-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-200">
                <FileText className="w-14 h-14 text-blue-400 mb-3" />
                <div className="text-sm font-bold">{previewManual.title}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {previewManual.fileName} ({previewManual.fileSizeLabel || '0 KB'})
                </div>
                <p className="text-xs text-slate-500 mt-3 max-w-xs">
                  {previewManual.memo || '모바일 브라우저 내장 뷰어가 지원되지 않는 형식입니다. 다운로드하여 확인하세요.'}
                </p>
                <a
                  href={previewManual.fileUrl}
                  download={previewManual.fileName}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
                >
                  <Download className="w-4 h-4" /> 파일 다운로드
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
