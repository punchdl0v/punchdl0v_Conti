import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Film,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ASPECT_RATIO_OPTIONS,
  AspectRatio,
  CAMERA_ANGLE_PRESETS,
  FOCAL_LENGTH_PRESETS,
  LIGHTING_PRESETS,
  MOVEMENT_PRESETS,
  SHOT_SIZE_PRESETS,
  StoryboardShot,
} from '../types/storyboard';
import { ComboInputCell } from './ComboInputCell';
import { FrameGuideOverlay } from './FrameGuideOverlay';

interface StoryboardTableProps {
  shots: StoryboardShot[];
  totalCount: number;
  aspectRatio: AspectRatio;
  hasActiveFilter: boolean;
  onUpdateShot: (id: string, patch: Partial<StoryboardShot>) => void;
  onDeleteShot: (id: string) => void;
  onDuplicateShot: (id: string) => void;
  onMoveShot: (fromIndex: number, toIndex: number) => void;
  onOpenEditor: (shot: StoryboardShot) => void;
  onAddShot: () => void;
  onResetFilters: () => void;
}

export const StoryboardTable: React.FC<StoryboardTableProps> = ({
  shots,
  totalCount,
  aspectRatio,
  hasActiveFilter,
  onUpdateShot,
  onDeleteShot,
  onDuplicateShot,
  onMoveShot,
  onOpenEditor,
  onAddShot,
  onResetFilters,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetShotIdRef = useRef<string | null>(null);

  const aspectClass =
    ASPECT_RATIO_OPTIONS.find((opt) => opt.value === aspectRatio)?.cssAspect || 'aspect-video';

  const handleImageFile = (shotId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBrokenImages((prev) => ({ ...prev, [shotId]: false }));
      onUpdateShot(shotId, { frameImage: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const triggerDirectUpload = (shotId: string) => {
    uploadTargetShotIdRef.current = shotId;
    uploadInputRef.current?.click();
  };

  const handleUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetShotIdRef.current;
    if (file && targetId) {
      handleImageFile(targetId, file);
    }
    e.target.value = '';
  };

  // Empty states
  if (shots.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 px-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-[#1B2A4A]">
          <Film className="h-5 w-5" />
        </div>
        {totalCount === 0 ? (
          <>
            <h3 className="text-base font-semibold text-slate-900">
              아직 등록된 스토리보드 컷이 없습니다
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              첫 번째 컷을 추가하고 컷 번호, 촬영구도, 카메라 세팅을 입력해 보세요.
            </p>
            <button
              type="button"
              onClick={onAddShot}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-medium text-white hover:bg-[#131E36] transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              첫 번째 컷 추가
            </button>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-slate-900">
              검색 또는 필터 조건과 일치하는 컷이 없습니다
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              검색어나 컷 필터를 초기화하면 전체 {totalCount}개 컷을 다시 볼 수 있습니다.
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                필터 초기화
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadInputChange}
        className="hidden"
      />

      {/* Tablet Portrait & Mobile Vertical Card Layout (No horizontal scroll) */}
      <div className="portrait-card-view no-print space-y-3">
        {shots.map((shot, idx) => {
          const showFallback = !shot.frameImage || brokenImages[shot.id];

          return (
            <div
              key={shot.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              {/* Card Top Bar: 컷 / 촬영순서 / 순서 이동 / 복제·삭제 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#F8F9FA] px-3.5 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">컷</span>
                    <input
                      type="text"
                      value={shot.sceneNumber}
                      onChange={(e) => onUpdateShot(shot.id, { sceneNumber: e.target.value })}
                      placeholder="S#1"
                      aria-label={`순서 ${shot.shotOrder} 컷`}
                      className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-center font-mono-tabular text-xs font-semibold text-[#1B2A4A] focus:border-[#1B2A4A] focus:outline-none"
                    />
                  </div>

                  <div className="h-3.5 w-px bg-slate-300" aria-hidden="true" />

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500">촬영순서</span>
                    <input
                      type="number"
                      min={1}
                      value={shot.shotOrder}
                      onChange={(e) =>
                        onUpdateShot(shot.id, {
                          shotOrder: Math.max(1, parseInt(e.target.value || '1', 10)),
                        })
                      }
                      aria-label="촬영순서 번호"
                      className="w-12 rounded-md border border-slate-200 bg-white py-1 text-center font-mono-tabular text-xs font-semibold text-slate-900 focus:border-[#1B2A4A] focus:outline-none"
                    />
                  </div>

                  {!hasActiveFilter && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onMoveShot(idx, idx - 1)}
                        title="위로 이동"
                        aria-label="촬영순서 위로 이동"
                        className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-[#1B2A4A] disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === shots.length - 1}
                        onClick={() => onMoveShot(idx, idx + 1)}
                        title="아래로 이동"
                        aria-label="촬영순서 아래로 이동"
                        className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-[#1B2A4A] disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDuplicateShot(shot.id)}
                    title="이 컷 복제"
                    aria-label={`컷 ${shot.shotOrder} 복제`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-[#1B2A4A]"
                  >
                    <Copy className="w-3 h-3" />
                    복제
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteShot(shot.id)}
                    title="이 컷 삭제"
                    aria-label={`컷 ${shot.shotOrder} 삭제`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    삭제
                  </button>
                </div>
              </div>

              {/* Card Body: Left (촬영구도 + 듀레이션) / Right (촬영 내용 + 5개 스펙 + 비고) */}
              <div className="p-3.5 grid grid-cols-1 md:grid-cols-[248px_1fr] gap-4">
                {/* Left Column */}
                <div className="space-y-2.5">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-1">촬영구도</div>
                    <div
                      className={`relative w-full ${aspectClass} overflow-hidden rounded-lg border border-slate-200 bg-[#F8F9FA]`}
                    >
                      {!showFallback ? (
                        <img
                          src={shot.frameImage}
                          alt={`${shot.sceneNumber} 컷 ${shot.shotOrder} 촬영구도`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [shot.id]: true }))
                          }
                          onClick={() => onOpenEditor(shot)}
                          className="h-full w-full object-cover cursor-pointer"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenEditor(shot)}
                          className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-[#1B2A4A] transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                          <span className="text-[11px] font-medium">구도 그리기 · 업로드</span>
                        </button>
                      )}

                      <FrameGuideOverlay guide={shot.guideOverlay} />

                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-slate-900/75 via-slate-900/40 to-transparent px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenEditor(shot)}
                          className="inline-flex items-center gap-1 rounded bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#1B2A4A] shadow-sm whitespace-nowrap"
                        >
                          <Pencil className="w-3 h-3" />
                          스케치
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerDirectUpload(shot.id)}
                          className="inline-flex items-center gap-1 rounded bg-[#1B2A4A]/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm whitespace-nowrap"
                        >
                          <ImagePlus className="w-3 h-3" />
                          업로드
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 듀레이션 */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-[#F8F9FA] px-3 py-1.5">
                    <span className="text-[11px] font-medium text-slate-500">듀레이션</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={shot.duration}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          onUpdateShot(shot.id, {
                            duration: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                          });
                        }}
                        aria-label={`컷 ${shot.shotOrder} 듀레이션(초)`}
                        className="w-14 bg-white rounded border border-slate-200 px-1.5 py-0.5 text-right font-mono-tabular text-xs font-semibold text-slate-900 focus:border-[#1B2A4A] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">초</span>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3 min-w-0">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-1">촬영 내용</div>
                    <textarea
                      rows={3}
                      value={shot.description}
                      onChange={(e) => onUpdateShot(shot.id, { description: e.target.value })}
                      placeholder="인물 동선, 주요 대사, 화면 내 액션 내용을 입력하세요..."
                      aria-label={`컷 ${shot.shotOrder} 촬영 내용`}
                      className="w-full resize-y rounded-lg border border-slate-200 bg-[#F8F9FA] px-2.5 py-2 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                    />
                  </div>

                  {/* 5 Technical Presets Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1">샷</div>
                      <div className="rounded-md border border-slate-200 bg-[#F8F9FA]">
                        <ComboInputCell
                          value={shot.shotSize}
                          onChange={(val) => onUpdateShot(shot.id, { shotSize: val })}
                          presets={SHOT_SIZE_PRESETS}
                          placeholder="예: MS"
                          ariaLabel="샷"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1">앵글</div>
                      <div className="rounded-md border border-slate-200 bg-[#F8F9FA]">
                        <ComboInputCell
                          value={shot.cameraAngle}
                          onChange={(val) => onUpdateShot(shot.id, { cameraAngle: val })}
                          presets={CAMERA_ANGLE_PRESETS}
                          placeholder="Eye Level"
                          ariaLabel="앵글"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1">화각</div>
                      <div className="rounded-md border border-slate-200 bg-[#F8F9FA]">
                        <ComboInputCell
                          value={shot.focalLength}
                          onChange={(val) => onUpdateShot(shot.id, { focalLength: val })}
                          presets={FOCAL_LENGTH_PRESETS}
                          placeholder="예: 35mm"
                          ariaLabel="화각"
                          mono
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1">무브먼트</div>
                      <div className="rounded-md border border-slate-200 bg-[#F8F9FA]">
                        <ComboInputCell
                          value={shot.movement}
                          onChange={(val) => onUpdateShot(shot.id, { movement: val })}
                          presets={MOVEMENT_PRESETS}
                          placeholder="예: FIX (고정)"
                          ariaLabel="무브먼트"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="text-[11px] font-medium text-slate-500 mb-1">조명</div>
                      <div className="rounded-md border border-slate-200 bg-[#F8F9FA]">
                        <ComboInputCell
                          value={shot.lighting}
                          onChange={(val) => onUpdateShot(shot.id, { lighting: val })}
                          presets={LIGHTING_PRESETS}
                          placeholder="예: 자연광 (주간)"
                          ariaLabel="조명"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-1">비고</div>
                    <textarea
                      rows={2}
                      value={shot.remarks}
                      onChange={(e) => onUpdateShot(shot.id, { remarks: e.target.value })}
                      placeholder="소품, 의상, VFX, 음향 등 특이사항"
                      aria-label={`컷 ${shot.shotOrder} 비고`}
                      className="w-full resize-y rounded-lg border border-slate-200 bg-[#F8F9FA] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-slate-600 placeholder:text-slate-400 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tablet Landscape, Desktop & Print: 11-Column 1-Row Horizontal Sheet */}
      <div className="landscape-table-view print-table-wrapper rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="storyboard-scroll overflow-x-auto">
          <table className="print-table w-full min-w-[1160px] xl:min-w-[1420px] 2xl:min-w-[1520px] border-collapse text-left">
          <colgroup>
            <col className="w-[58px] xl:w-[76px]" />
            <col className="w-[62px] xl:w-[80px]" />
            <col className="w-[152px] lg:w-[172px] xl:w-[210px]" />
            <col className="w-[180px] lg:w-[204px] xl:w-[244px]" />
            <col className="w-[106px] xl:w-[138px]" />
            <col className="w-[96px] xl:w-[116px]" />
            <col className="w-[96px] xl:w-[120px]" />
            <col className="w-[112px] xl:w-[142px]" />
            <col className="w-[74px] xl:w-[88px]" />
            <col className="w-[108px] xl:w-[142px]" />
            <col className="w-[126px] xl:w-[174px]" />
            <col className="no-print w-[50px] xl:w-[60px]" />
          </colgroup>

          <thead className="sticky top-0 z-20 bg-[#1B2A4A] text-white">
            <tr>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-center text-xs font-semibold tracking-tight whitespace-nowrap">
                컷
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-center text-xs font-semibold tracking-tight whitespace-nowrap">
                촬영순서
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-3 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                촬영구도
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-3 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                촬영 내용
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                샷
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                앵글
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                화각
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                무브먼트
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-right text-xs font-semibold tracking-tight whitespace-nowrap">
                듀레이션
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-2.5 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                조명
              </th>
              <th scope="col" className="border-r border-[#2B3E66] px-3 py-3 text-xs font-semibold tracking-tight whitespace-nowrap">
                비고
              </th>
              <th scope="col" className="no-print px-2 py-3 text-center text-xs font-semibold tracking-tight whitespace-nowrap">
                관리
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {shots.map((shot, idx) => {
              const isDragged = draggedId === shot.id;
              const isDragTarget = dragOverId === shot.id && draggedId !== shot.id;
              const showFallback = !shot.frameImage || brokenImages[shot.id];

              return (
                <tr
                  key={shot.id}
                  draggable={!hasActiveFilter}
                  onDragStart={(e) => {
                    if (hasActiveFilter) return;
                    setDraggedId(shot.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (hasActiveFilter || !draggedId) return;
                    e.preventDefault();
                    setDragOverId(shot.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === shot.id) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (hasActiveFilter || !draggedId || draggedId === shot.id) {
                      setDraggedId(null);
                      setDragOverId(null);
                      return;
                    }
                    const fromIdx = shots.findIndex((s) => s.id === draggedId);
                    const toIdx = shots.findIndex((s) => s.id === shot.id);
                    if (fromIdx !== -1 && toIdx !== -1) {
                      onMoveShot(fromIdx, toIdx);
                    }
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className={`print-row group transition-colors ${
                    isDragged
                      ? 'opacity-45 bg-slate-100'
                      : isDragTarget
                      ? 'bg-slate-100 ring-2 ring-inset ring-[#1B2A4A]'
                      : 'bg-white hover:bg-[#F8F9FA]'
                  }`}
                >
                  {/* 1. 컷 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <input
                      type="text"
                      value={shot.sceneNumber}
                      onChange={(e) => onUpdateShot(shot.id, { sceneNumber: e.target.value })}
                      placeholder="S#1"
                      aria-label={`순서 ${shot.shotOrder} 컷`}
                      className="w-full rounded-md border border-transparent px-1.5 py-1.5 text-center font-mono-tabular text-xs font-semibold text-[#1B2A4A] hover:border-slate-200 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                    />
                  </td>

                  {/* 2. 촬영순서 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <div className="flex items-center gap-1">
                        {!hasActiveFilter && (
                          <span
                            title="드래그하여 촬영순서 변경"
                            className="no-print cursor-grab text-slate-300 hover:text-slate-600 active:cursor-grabbing"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <input
                          type="number"
                          min={1}
                          value={shot.shotOrder}
                          onChange={(e) =>
                            onUpdateShot(shot.id, {
                              shotOrder: Math.max(1, parseInt(e.target.value || '1', 10)),
                            })
                          }
                          aria-label="촬영순서 번호"
                          className="w-10 rounded border border-transparent py-0.5 text-center font-mono-tabular text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {!hasActiveFilter && (
                        <div className="no-print touch-visible flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => onMoveShot(idx, idx - 1)}
                            title="위로 이동"
                            aria-label="촬영순서 위로 이동"
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#1B2A4A] disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === shots.length - 1}
                            onClick={() => onMoveShot(idx, idx + 1)}
                            title="아래로 이동"
                            aria-label="촬영순서 아래로 이동"
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#1B2A4A] disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 3. 촬영구도 */}
                  <td className="border-r border-slate-200 px-2.5 py-2.5 align-top">
                    <div
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes('Files')) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => {
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleImageFile(shot.id, file);
                        }
                      }}
                      className={`group/frame relative w-full ${aspectClass} overflow-hidden rounded-md border border-slate-200 bg-[#F8F9FA]`}
                    >
                      {!showFallback ? (
                        <img
                          src={shot.frameImage}
                          alt={`${shot.sceneNumber} 컷 ${shot.shotOrder} 촬영구도`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [shot.id]: true }))
                          }
                          onClick={() => onOpenEditor(shot)}
                          className="h-full w-full object-cover cursor-pointer"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenEditor(shot)}
                          className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-[#1B2A4A] transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                          <span className="text-[11px] font-medium">구도 그리기 · 업로드</span>
                        </button>
                      )}

                      <FrameGuideOverlay guide={shot.guideOverlay} />

                      {/* Hover / Touch Quick Actions */}
                      <div className="no-print touch-visible absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-slate-900/75 via-slate-900/40 to-transparent px-1.5 xl:px-2 py-1.5 opacity-0 group-hover/frame:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onOpenEditor(shot)}
                          className="inline-flex items-center gap-1 rounded bg-white/95 px-2 py-1 text-[11px] font-medium text-[#1B2A4A] hover:bg-white shadow-sm whitespace-nowrap"
                        >
                          <Pencil className="w-3 h-3" />
                          스케치
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerDirectUpload(shot.id)}
                          className="inline-flex items-center gap-1 rounded bg-[#1B2A4A]/90 px-2 py-1 text-[11px] font-medium text-white hover:bg-[#1B2A4A] shadow-sm whitespace-nowrap"
                        >
                          <ImagePlus className="w-3 h-3" />
                          업로드
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* 4. 촬영 내용 */}
                  <td className="border-r border-slate-200 px-2.5 py-2.5 align-top">
                    <textarea
                      rows={4}
                      value={shot.description}
                      onChange={(e) => onUpdateShot(shot.id, { description: e.target.value })}
                      placeholder="인물 동선, 주요 대사, 화면 내 액션 내용을 입력하세요..."
                      aria-label={`컷 ${shot.shotOrder} 촬영 내용`}
                      className="w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[12.5px] leading-relaxed text-slate-800 placeholder:text-slate-400 hover:border-slate-200 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                    />
                  </td>

                  {/* 5. 샷 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <ComboInputCell
                      value={shot.shotSize}
                      onChange={(val) => onUpdateShot(shot.id, { shotSize: val })}
                      presets={SHOT_SIZE_PRESETS}
                      placeholder="예: MS"
                      ariaLabel="샷"
                    />
                  </td>

                  {/* 6. 앵글 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <ComboInputCell
                      value={shot.cameraAngle}
                      onChange={(val) => onUpdateShot(shot.id, { cameraAngle: val })}
                      presets={CAMERA_ANGLE_PRESETS}
                      placeholder="Eye Level"
                      ariaLabel="앵글"
                    />
                  </td>

                  {/* 6. 화각 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <ComboInputCell
                      value={shot.focalLength}
                      onChange={(val) => onUpdateShot(shot.id, { focalLength: val })}
                      presets={FOCAL_LENGTH_PRESETS}
                      placeholder="예: 35mm"
                      ariaLabel="화각"
                      mono
                    />
                  </td>

                  {/* 7. 무브먼트 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <ComboInputCell
                      value={shot.movement}
                      onChange={(val) => onUpdateShot(shot.id, { movement: val })}
                      presets={MOVEMENT_PRESETS}
                      placeholder="예: FIX (고정)"
                      ariaLabel="무브먼트"
                    />
                  </td>

                  {/* 8. 듀레이션 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <div className="flex items-center justify-end gap-1 rounded-md border border-transparent px-1.5 py-1 hover:border-slate-200 focus-within:border-[#1B2A4A] focus-within:bg-white">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={shot.duration}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          onUpdateShot(shot.id, {
                            duration: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                          });
                        }}
                        aria-label={`컷 ${shot.shotOrder} 듀레이션(초)`}
                        className="w-12 bg-transparent text-right font-mono-tabular text-[13px] font-medium text-slate-900 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 select-none">초</span>
                    </div>
                  </td>

                  {/* 9. 조명 */}
                  <td className="border-r border-slate-200 px-2 py-2.5 align-top">
                    <ComboInputCell
                      value={shot.lighting}
                      onChange={(val) => onUpdateShot(shot.id, { lighting: val })}
                      presets={LIGHTING_PRESETS}
                      placeholder="예: 자연광 (주간)"
                      ariaLabel="조명"
                    />
                  </td>

                  {/* 10. 비고 */}
                  <td className="border-r border-slate-200 px-2.5 py-2.5 align-top">
                    <textarea
                      rows={4}
                      value={shot.remarks}
                      onChange={(e) => onUpdateShot(shot.id, { remarks: e.target.value })}
                      placeholder="소품, 의상, VFX, 음향 등 특이사항"
                      aria-label={`컷 ${shot.shotOrder} 비고`}
                      className="w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[12px] leading-relaxed text-slate-600 placeholder:text-slate-400 hover:border-slate-200 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                    />
                  </td>

                  {/* Row Actions */}
                  <td className="no-print px-2 py-2.5 align-top">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onDuplicateShot(shot.id)}
                        title="이 컷 복제"
                        aria-label={`컷 ${shot.shotOrder} 복제`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1B2A4A] transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteShot(shot.id)}
                        title="이 컷 삭제"
                        aria-label={`컷 ${shot.shotOrder} 삭제`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
};
