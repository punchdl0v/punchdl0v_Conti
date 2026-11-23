import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, Pause, Play, RotateCcw } from 'lucide-react';
import { ASPECT_RATIO_OPTIONS, AspectRatio, StoryboardShot } from '../types/storyboard';
import { formatDurationTimecode } from '../utils/exportUtils';
import { FrameGuideOverlay } from './FrameGuideOverlay';

interface PresentationViewProps {
  shots: StoryboardShot[];
  aspectRatio: AspectRatio;
  projectTitle: string;
  onSwitchToSheet: () => void;
}

export const PresentationView: React.FC<PresentationViewProps> = ({
  shots,
  aspectRatio,
  projectTitle,
  onSwitchToSheet,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedInShot, setElapsedInShot] = useState(0);

  const safeIndex = Math.min(currentIndex, Math.max(0, shots.length - 1));
  const currentShot = shots[safeIndex];

  const aspectClass =
    ASPECT_RATIO_OPTIONS.find((opt) => opt.value === aspectRatio)?.cssAspect || 'aspect-video';

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setIsPlaying(false);
        setElapsedInShot(0);
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setIsPlaying(false);
        setElapsedInShot(0);
        setCurrentIndex((prev) => Math.min(shots.length - 1, prev + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [shots.length]);

  // Animatic playback timer using each shot's real duration
  useEffect(() => {
    if (!isPlaying || !currentShot) return;

    const targetDuration = Math.max(1, currentShot.duration || 3);
    const interval = window.setInterval(() => {
      setElapsedInShot((prev) => {
        const next = prev + 0.1;
        if (next >= targetDuration) {
          if (safeIndex < shots.length - 1) {
            setCurrentIndex(safeIndex + 1);
            return 0;
          } else {
            setIsPlaying(false);
            return targetDuration;
          }
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPlaying, currentShot, safeIndex, shots.length]);

  if (!currentShot) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 px-6 text-center">
        <p className="text-sm text-slate-600">프레젠테이션할 컷이 없습니다.</p>
        <button
          type="button"
          onClick={onSwitchToSheet}
          className="mt-4 rounded-lg bg-[#1B2A4A] px-4 py-2 text-xs font-medium text-white hover:bg-[#131E36]"
        >
          스토리보드 시트로 돌아가기
        </button>
      </div>
    );
  }

  const shotDuration = Math.max(0.5, currentShot.duration || 0);
  const progressPct = Math.min(100, (elapsedInShot / shotDuration) * 100);

  return (
    <div className="space-y-4">
      {/* Main Theater Viewport */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Top Bar inside Viewer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-[#1B2A4A] px-5 py-3 text-white">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold tracking-tight">{projectTitle}</span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {currentShot.sceneNumber} / 컷 #{currentShot.shotOrder}
            </span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="font-mono-tabular text-slate-300">
              {safeIndex + 1} / {shots.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setElapsedInShot(0);
                setCurrentIndex(0);
              }}
              title="처음으로"
              className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              처음
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#1B2A4A] hover:bg-slate-100 whitespace-nowrap"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? '일시정지' : '애니매틱 재생'}
            </button>
          </div>
        </div>

        {/* Split Stage + Spec Panel on Landscape & Desktop; Stacked on Portrait */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(310px,1fr)] portrait:grid-cols-1">
          {/* Stage */}
          <div className="bg-[#0F172A] px-3 sm:px-5 lg:px-6 py-5 lg:py-6 flex items-center justify-center relative">
            <button
              type="button"
              disabled={safeIndex === 0}
              onClick={() => {
                setIsPlaying(false);
                setElapsedInShot(0);
                setCurrentIndex((i) => Math.max(0, i - 1));
              }}
              aria-label="이전 컷"
              className="mr-2 sm:mr-3 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 disabled:opacity-25 transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className={`relative w-full max-w-3xl max-h-[56vh] ${aspectClass} overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-2xl`}>
              {currentShot.frameImage ? (
                <img
                  src={currentShot.frameImage}
                  alt={`${currentShot.sceneNumber} 컷 ${currentShot.shotOrder}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
                  <Film className="w-8 h-8" />
                  <span className="text-xs">등록된 촬영구도 이미지가 없습니다</span>
                </div>
              )}
              <FrameGuideOverlay guide={currentShot.guideOverlay} />

              {/* Subtle progress bar during playback */}
              {isPlaying && (
                <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                  <div
                    className="h-full bg-white transition-all duration-100"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={safeIndex === shots.length - 1}
              onClick={() => {
                setIsPlaying(false);
                setElapsedInShot(0);
                setCurrentIndex((i) => Math.min(shots.length - 1, i + 1));
              }}
              aria-label="다음 컷"
              className="ml-2 sm:ml-3 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 disabled:opacity-25 transition-colors shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 11-Field Spec Panel */}
          <div className="border-t lg:border-t-0 lg:border-l portrait:border-t portrait:border-l-0 border-slate-200 bg-white p-4 lg:p-5 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 portrait:sm:grid-cols-4 gap-x-4 gap-y-3 pb-4 border-b border-slate-200 text-xs">
              <div>
                <div className="text-slate-500 mb-0.5">컷</div>
                <div className="font-mono-tabular font-semibold text-[#1B2A4A]">
                  {currentShot.sceneNumber || '-'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">촬영순서</div>
                <div className="font-mono-tabular font-semibold text-slate-900">
                  #{currentShot.shotOrder}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">샷</div>
                <div className="font-medium text-slate-900">{currentShot.shotSize || '-'}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">앵글</div>
                <div className="font-medium text-slate-900">{currentShot.cameraAngle || '-'}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">화각</div>
                <div className="font-mono-tabular font-medium text-slate-900">
                  {currentShot.focalLength || '-'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">무브먼트</div>
                <div className="font-medium text-slate-900">{currentShot.movement || '-'}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">듀레이션</div>
                <div className="font-mono-tabular font-semibold text-slate-900">
                  {currentShot.duration.toFixed(1)}초 ({formatDurationTimecode(currentShot.duration)})
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">조명</div>
                <div className="font-medium text-slate-900">{currentShot.lighting || '-'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 portrait:md:grid-cols-2 gap-3.5 text-sm flex-1">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">촬영 내용</div>
                <p className="text-slate-800 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {currentShot.description || '입력된 촬영 내용이 없습니다.'}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">비고</div>
                <p className="text-slate-600 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {currentShot.remarks || '특이사항 없음'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Filmstrip Selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 storyboard-scroll">
        {shots.map((shot, idx) => {
          const active = idx === safeIndex;
          return (
            <button
              key={shot.id}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setElapsedInShot(0);
                setCurrentIndex(idx);
              }}
              className={`shrink-0 w-40 rounded-lg border p-2 text-left transition-colors ${
                active
                  ? 'border-[#1B2A4A] bg-white ring-1 ring-[#1B2A4A]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="aspect-video w-full overflow-hidden rounded bg-slate-100 mb-1.5">
                {shot.frameImage ? (
                  <img
                    src={shot.frameImage}
                    alt={`${shot.sceneNumber} #${shot.shotOrder}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Film className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                <span className="font-semibold text-[#1B2A4A]">
                  {shot.sceneNumber} · #{shot.shotOrder}
                </span>
                <span className="text-slate-500">{shot.duration.toFixed(1)}초</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
