import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Circle,
  Eraser,
  Grid3x3,
  Pencil,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  X,
  Minus,
  Check,
} from 'lucide-react';
import { GuideOverlay } from '../types/storyboard';
import { FrameGuideOverlay } from './FrameGuideOverlay';

type DrawTool = 'pen' | 'line' | 'rect' | 'circle' | 'arrow' | 'eraser';

interface FrameEditorModalProps {
  isOpen: boolean;
  shotOrder: number;
  sceneNumber: string;
  initialImage: string;
  initialGuide: GuideOverlay;
  onClose: () => void;
  onSave: (imageDataUrl: string, guide: GuideOverlay) => void;
}

const CANVAS_W = 800;
const CANVAS_H = 450;

const COLORS = [
  { label: '잉크 블랙', hex: '#111827' },
  { label: '네이비 블루', hex: '#1B2A4A' },
  { label: '동선 레드', hex: '#DC2626' },
  { label: '연필 그레이', hex: '#64748B' },
  { label: '화이트', hex: '#FFFFFF' },
];

export const FrameEditorModal: React.FC<FrameEditorModalProps> = ({
  isOpen,
  shotOrder,
  sceneNumber,
  initialImage,
  initialGuide,
  onClose,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState<string>('#111827');
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [guide, setGuide] = useState<GuideOverlay>(initialGuide);
  const [history, setHistory] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  // Initialize canvas with off-white storyboard paper + optional existing image
  useEffect(() => {
    if (!isOpen) return;
    setGuide(initialGuide);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fillPaper = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    };

    fillPaper();

    if (initialImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        fillPaper();
        // Cover-fit image cleanly inside 16:9 canvas
        const imgRatio = img.width / img.height;
        const canvasRatio = CANVAS_W / CANVAS_H;
        let drawW = CANVAS_W;
        let drawH = CANVAS_H;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
          drawH = CANVAS_H;
          drawW = img.width * (CANVAS_H / img.height);
          offsetX = (CANVAS_W - drawW) / 2;
        } else {
          drawW = CANVAS_W;
          drawH = img.height * (CANVAS_W / img.width);
          offsetY = (CANVAS_H - drawH) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        setHistory([canvas.toDataURL('image/png')]);
      };
      img.onerror = () => {
        fillPaper();
        setHistory([canvas.toDataURL('image/png')]);
      };
      img.src = initialImage;
    } else {
      setHistory([canvas.toDataURL('image/png')]);
    }
  }, [isOpen, initialImage, initialGuide]);

  if (!isOpen) return null;

  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setHistory((prev) => [...prev.slice(-19), dataUrl]);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    const previousUrl = newHistory[newHistory.length - 1];
    setHistory(newHistory);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, 0, 0);
    };
    img.src = previousUrl;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    pushHistory();
  };

  const applyCompositionStamp = (preset: 'ws' | 'ots' | 'ms' | 'cu') => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#334155';
    ctx.fillStyle = '#E2E8F0';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (preset === 'ws') {
      // Horizon + vanishing lines + distant figure
      ctx.beginPath();
      ctx.moveTo(0, 290);
      ctx.lineTo(CANVAS_W, 290);
      ctx.moveTo(400, 290);
      ctx.lineTo(60, 450);
      ctx.moveTo(400, 290);
      ctx.lineTo(740, 450);
      ctx.stroke();

      // Buildings silhouette
      ctx.strokeRect(40, 120, 140, 170);
      ctx.strokeRect(610, 95, 150, 195);

      // Small figure
      ctx.beginPath();
      ctx.arc(395, 255, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(382, 270);
      ctx.lineTo(408, 270);
      ctx.lineTo(404, 325);
      ctx.lineTo(386, 325);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (preset === 'ots') {
      // Foreground shoulder silhouette on left
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(135, 175, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 450);
      ctx.quadraticCurveTo(60, 240, 240, 290);
      ctx.lineTo(290, 450);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Subject facing on right
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.arc(545, 185, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(475, 450);
      ctx.quadraticCurveTo(485, 250, 545, 245);
      ctx.quadraticCurveTo(605, 250, 620, 450);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (preset === 'ms') {
      // Medium shot centered subject
      ctx.beginPath();
      ctx.moveTo(0, 310);
      ctx.lineTo(CANVAS_W, 310);
      ctx.stroke();

      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.arc(400, 145, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(295, 450);
      ctx.quadraticCurveTo(305, 225, 400, 215);
      ctx.quadraticCurveTo(495, 225, 505, 450);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (preset === 'cu') {
      // Close-up head & shoulders
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.ellipse(400, 195, 92, 118, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eye line guide
      ctx.strokeStyle = '#94A3B8';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(310, 175);
      ctx.lineTo(490, 175);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(215, 450);
      ctx.quadraticCurveTo(255, 330, 345, 320);
      ctx.moveTo(585, 450);
      ctx.quadraticCurveTo(545, 330, 455, 320);
      ctx.stroke();
    }

    pushHistory();
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    width: number
  ) => {
    const headLen = Math.max(14, width * 4);
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLen * Math.cos(angle - Math.PI / 6),
      toY - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLen * Math.cos(angle + Math.PI / 6),
      toY - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    startPosRef.current = pt;
    setIsDrawing(true);

    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    } else {
      snapshotRef.current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pt = getCanvasPoint(e);

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    } else if (snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      const start = startPosRef.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(start.x, start.y, pt.x - start.x, pt.y - start.y);
      } else if (tool === 'circle') {
        const rx = Math.abs(pt.x - start.x) / 2;
        const ry = Math.abs(pt.y - start.y) / 2;
        const cx = (start.x + pt.x) / 2;
        const cy = (start.y + pt.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'arrow') {
        drawArrow(ctx, start.x, start.y, pt.x, pt.y, lineWidth);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    snapshotRef.current = null;
    pushHistory();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const imgRatio = img.width / img.height;
        const canvasRatio = CANVAS_W / CANVAS_H;
        let drawW = CANVAS_W;
        let drawH = CANVAS_H;
        let offsetX = 0;
        let offsetY = 0;
        if (imgRatio > canvasRatio) {
          drawH = CANVAS_H;
          drawW = img.width * (CANVAS_H / img.height);
          offsetX = (CANVAS_W - drawW) / 2;
        } else {
          drawW = CANVAS_W;
          drawH = img.height * (CANVAS_W / img.width);
          offsetY = (CANVAS_H - drawH) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        pushHistory();
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Compress slightly as JPEG if large, or PNG for crisp line art
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onSave(dataUrl, guide);
    onClose();
  };

  const handleRemoveImage = () => {
    onSave('', guide);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="촬영구도 스케치 에디터"
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#1B2A4A] px-4 sm:px-5 py-2.5 sm:py-3 text-white">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              촬영구도 스케치 · {sceneNumber || 'S#'} / 컷 #{shotOrder}
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

        {/* Drawing Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-[#F8F9FA] px-4 sm:px-5 py-2">
          {/* Tools */}
          <div className="flex items-center gap-1">
            {[
              { id: 'pen' as DrawTool, label: '연필', icon: Pencil },
              { id: 'line' as DrawTool, label: '직선', icon: Minus },
              { id: 'rect' as DrawTool, label: '사각형', icon: Square },
              { id: 'circle' as DrawTool, label: '원형', icon: Circle },
              { id: 'arrow' as DrawTool, label: '동선 화살표', icon: ArrowRight },
              { id: 'eraser' as DrawTool, label: '지우개', icon: Eraser },
            ].map((item) => {
              const Icon = item.icon;
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(item.id)}
                  title={item.label}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#1B2A4A] text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Colors & Stroke Width */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" role="group" aria-label="펜 색상">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    setColor(c.hex);
                    if (tool === 'eraser') setTool('pen');
                  }}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    color === c.hex && tool !== 'eraser'
                      ? 'ring-2 ring-[#1B2A4A] ring-offset-1 scale-110 border-slate-400'
                      : 'border-slate-300 hover:scale-105'
                  }`}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-slate-300" />

            <div className="flex items-center gap-1">
              {[2, 4, 7].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setLineWidth(w)}
                  title={`선 굵기 ${w}px`}
                  className={`px-2 py-1 text-[11px] font-mono-tabular rounded border transition-colors ${
                    lineWidth === w
                      ? 'border-[#1B2A4A] bg-[#1B2A4A] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-toolbar: Guides, Quick Composition Stamps, Upload */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-medium mr-1">구도 스탬프:</span>
            <button
              type="button"
              onClick={() => applyCompositionStamp('ws')}
              className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              WS 원경
            </button>
            <button
              type="button"
              onClick={() => applyCompositionStamp('ots')}
              className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              OTS 대화
            </button>
            <button
              type="button"
              onClick={() => applyCompositionStamp('ms')}
              className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              MS 1인
            </button>
            <button
              type="button"
              onClick={() => applyCompositionStamp('cu')}
              className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              CU 인물
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-slate-600">
              <Grid3x3 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={guide}
                onChange={(e) => setGuide(e.target.value as GuideOverlay)}
                aria-label="구도 가이드선"
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#1B2A4A] focus:outline-none"
              >
                <option value="none">가이드선 없음</option>
                <option value="thirds">삼분할선 (3x3)</option>
                <option value="center">센터 크로스</option>
                <option value="cinemascope">시네마스코프 (2.39:1)</option>
              </select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              이미지 불러오기
            </button>
          </div>
        </div>

        {/* Canvas Workspace */}
        <div className="flex-1 overflow-auto bg-[#F1F5F9] p-3 sm:p-4 flex items-center justify-center">
          <div className="relative w-full max-w-[min(740px,calc(48vh*16/9))] aspect-video bg-white border border-slate-300 shadow-sm overflow-hidden">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-full h-full cursor-crosshair touch-none block"
            />
            <FrameGuideOverlay guide={guide} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 sm:px-5 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              실행 취소
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              캔버스 비우기
            </button>
            {initialImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap"
              >
                구도 이미지 삭제
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-md bg-[#1B2A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#131E36] transition-colors whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" />
              구도 적용하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
