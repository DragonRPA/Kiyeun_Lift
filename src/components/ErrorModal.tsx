import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, X } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title = '시스템 오류 발생',
  message,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #ef4444',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
        overflow: 'hidden',
        color: '#f8fafc',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: '#ef4444',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={20} color="#ffffff" />
            </div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fca5a5' }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '10px', lineHeight: 1.5 }}>
            오류 내용을 아래 박스에서 확인하실 수 있으며, <b>[오류 내용 복사]</b> 버튼을 눌러 쉽게 원인을 제보하실 수 있습니다:
          </p>
          
          {/* 오류 텍스트 박스 */}
          <div style={{ position: 'relative' }}>
            <textarea
              readOnly
              value={message}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: '100%',
                minHeight: '140px',
                maxHeight: '260px',
                backgroundColor: '#0f172a',
                color: '#f87171',
                border: '1px solid #334155',
                borderRadius: '10px',
                padding: '14px',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '13px',
                lineHeight: '1.5',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 모달 푸터 / 액션 버튼 */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: '#0f172a',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              backgroundColor: copied ? '#059669' : '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '복사되었습니다!' : '📋 오류 내용 전체 복사'}
          </button>
          
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
