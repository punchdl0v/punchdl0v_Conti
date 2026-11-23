import React, { useEffect, useState } from 'react';
import { Download, Loader2, Printer, X } from 'lucide-react';
import { StoryboardEpisode, StoryboardProject } from '../types/storyboard';
import { downloadEpisodeAsPDF, renderEpisodeToCanvases } from '../utils/pdfExport';

interface PrintExportModalProps {
  isOpen: boolean;
  project: StoryboardProject;
  episode: StoryboardEpisode;
  onClose: () => void;
}

export const PrintExportModal: React.FC<PrintExportModalProps> = ({
  isOpen,
  project,
  episode,
  onClose,
}) => {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [printBlockedNotice, setPrintBlockedNotice] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPrintBlockedNotice(false);
    setIsRendering(true);

    renderEpisodeToCanvases(project, episode)
      .then((canvases) => {
        if (cancelled) return;
        setPreviewUrls(canvases.map((c) => c.toDataURL('image/jpeg', 0.85)));
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, project, episode]);

  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      await downloadEpisodeAsPDF(project, episode);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBrowserPrint = () => {
    setPrintBlockedNotice(false);
    let didStartPrint = false;
    const onBeforePrint = () => {
      didStartPrint = true;
    };
    window.addEventListener('beforeprint', onBeforePrint, { once: true });

    // Close modal briefly before calling print so the print sheet is unobstructed, or rely on .no-print
    try {
      window.print();
    } catch {
      // Blocked in sandboxed iframe
    }

    window.setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!didStartPrint) {
        setPrintBlockedNotice(true);
      }
    }, 250);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="인쇄 및 PDF 출력"
    >
      <div className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1B2A4A] px-5 py-3.5 text-white">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              인쇄 / PDF 출력 미리보기 · {episode.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Body */}
        <div className="flex-1 overflow-y-auto bg-[#F1F5F9] p-5 space-y-4 storyboard-scroll">
          {printBlockedNotice && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              현재 미리보기 창(iFrame) 보안 정책으로 브라우저 기본 인쇄창이 제한되어 있습니다. 아래{' '}
              <span className="font-semibold">PDF 파일 다운로드</span> 버튼을 누르면 A4 가로 규격 PDF 파일로 즉시 저장되어 바로 인쇄하실 수 있습니다.
            </div>
          )}

          {isRendering ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#1B2A4A]" />
              <span className="text-xs font-medium">A4 가로 스토리보드 시트 생성 중...</span>
            </div>
          ) : (
            previewUrls.map((url, idx) => (
              <div
                key={idx}
                className="mx-auto max-w-4xl rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden"
              >
                <img
                  src={url}
                  alt={`스토리보드 인쇄 미리보기 ${idx + 1}페이지`}
                  className="w-full h-auto block"
                />
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3.5">
          <div className="text-xs text-slate-500 font-mono-tabular">
            A4 가로(Landscape) · 총 {previewUrls.length || 1}페이지
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              닫기
            </button>

            <button
              type="button"
              onClick={handleBrowserPrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B2A4A] bg-white px-4 py-2 text-xs font-semibold text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              브라우저 인쇄
            </button>

            <button
              type="button"
              disabled={isRendering || isDownloading}
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B2A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#131E36] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              PDF 파일 다운로드
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
