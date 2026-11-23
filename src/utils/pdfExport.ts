import { AspectRatio, StoryboardEpisode, StoryboardProject, StoryboardShot } from '../types/storyboard';
import { formatDurationTimecode } from './exportUtils';

const PAGE_W_PX = 1754; // A4 landscape @ ~150 DPI
const PAGE_H_PX = 1240;
const PDF_W_PT = 841.89; // A4 landscape in PDF points
const PDF_H_PT = 595.28;

const MARGIN_X = 56;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_W = PAGE_W_PX - MARGIN_X * 2; // 1642px

const FONT_SANS = '"Plus Jakarta Sans", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const FONT_MONO = '"JetBrains Mono", "Noto Sans KR", monospace';

interface ColumnDef {
  label: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { label: '컷', width: 64, align: 'center' },
  { label: '촬영순서', width: 74, align: 'center' },
  { label: '촬영구도', width: 224, align: 'left' },
  { label: '촬영 내용', width: 288, align: 'left' },
  { label: '샷', width: 150, align: 'left' },
  { label: '앵글', width: 128, align: 'left' },
  { label: '화각', width: 124, align: 'left' },
  { label: '무브먼트', width: 146, align: 'left' },
  { label: '듀레이션', width: 84, align: 'right' },
  { label: '조명', width: 140, align: 'left' },
  { label: '비고', width: 220, align: 'left' },
];
// Total width = 64+74+224+288+150+128+124+146+84+140+220 = 1642px (exact CONTENT_W)

function getAspectNumeric(aspectRatio: AspectRatio): number {
  switch (aspectRatio) {
    case '2:1':
      return 2 / 1;
    case '2.39:1':
      return 2.39 / 1;
    case '1.85:1':
      return 1.85 / 1;
    case '4:3':
      return 4 / 3;
    case '16:9':
    default:
      return 16 / 9;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const ch of para) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function createCanvasPage(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W_PX;
  canvas.height = PAGE_H_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W_PX, PAGE_H_PX);
  return { canvas, ctx };
}

function drawPageHeader(
  ctx: CanvasRenderingContext2D,
  project: StoryboardProject,
  episode: StoryboardEpisode,
  totalDuration: number,
  totalShots: number
): number {
  let y = MARGIN_TOP;

  ctx.fillStyle = '#1B2A4A';
  ctx.font = `700 16px ${FONT_SANS}`;
  ctx.textBaseline = 'top';
  ctx.fillText('스토리보드 메이커', MARGIN_X, y);

  ctx.fillStyle = '#111827';
  ctx.font = `700 28px ${FONT_SANS}`;
  const titleText = `${project.title || '무제 프로젝트'}${episode.name ? ` — ${episode.name}` : ''}`;
  ctx.fillText(titleText, MARGIN_X, y + 24);

  // Right-aligned metadata
  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = `500 15px ${FONT_MONO}`;
  const metaLine1 = `촬영일: ${episode.shootingDate || '-'}  ·  감독: ${project.director || '-'}  ·  촬영: ${project.cinematographer || '-'}  ·  화면비: ${project.aspectRatio}`;
  const metaLine2 = `총 ${episode.scenes.length}씬  ·  ${totalShots}컷  ·  예상 러닝타임 ${formatDurationTimecode(totalDuration)}`;
  ctx.fillText(metaLine1, PAGE_W_PX - MARGIN_X, y + 12);
  ctx.fillText(metaLine2, PAGE_W_PX - MARGIN_X, y + 36);
  ctx.textAlign = 'left';

  y += 66;
  ctx.fillStyle = '#1B2A4A';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, 3);
  return y + 16;
}

function drawTableHeader(ctx: CanvasRenderingContext2D, y: number): number {
  const headerH = 38;
  ctx.fillStyle = '#1B2A4A';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, headerH);

  let x = MARGIN_X;
  ctx.font = `600 14px ${FONT_SANS}`;
  ctx.textBaseline = 'middle';

  for (let i = 0; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    ctx.fillStyle = '#FFFFFF';
    if (col.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(col.label, x + col.width / 2, y + headerH / 2);
    } else if (col.align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(col.label, x + col.width - 10, y + headerH / 2);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(col.label, x + 10, y + headerH / 2);
    }

    if (i < COLUMNS.length - 1) {
      ctx.fillStyle = '#2B3E66';
      ctx.fillRect(x + col.width - 1, y, 1, headerH);
    }
    x += col.width;
  }

  ctx.textAlign = 'left';
  return y + headerH;
}

function drawSceneBar(
  ctx: CanvasRenderingContext2D,
  y: number,
  epLabel: string,
  sceneLabel: string,
  cutCount: number,
  sceneDur: number
): number {
  const barH = 36;
  ctx.fillStyle = '#F8F9FA';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, barH);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN_X, y, CONTENT_W, barH);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1B2A4A';
  ctx.font = `700 14px ${FONT_MONO}`;
  ctx.fillText(`EP  ${epLabel || '-'}`, MARGIN_X + 14, y + barH / 2);

  ctx.fillStyle = '#334155';
  ctx.font = `600 14px ${FONT_SANS}`;
  ctx.fillText(`#S  ${sceneLabel || '-'}`, MARGIN_X + 160, y + barH / 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = `500 13px ${FONT_MONO}`;
  ctx.fillText(
    `${cutCount}컷 · ${formatDurationTimecode(sceneDur)}`,
    PAGE_W_PX - MARGIN_X - 14,
    y + barH / 2
  );
  ctx.textAlign = 'left';

  return y + barH;
}

function drawShotRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  rowH: number,
  shot: StoryboardShot,
  frameImg: HTMLImageElement | null,
  aspectRatio: AspectRatio
): number {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN_X, y, CONTENT_W, rowH);

  let x = MARGIN_X;
  const padX = 10;
  const padY = 12;

  for (let i = 0; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    if (i < COLUMNS.length - 1) {
      ctx.beginPath();
      ctx.moveTo(x + col.width, y);
      ctx.lineTo(x + col.width, y + rowH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();
    }

    ctx.textBaseline = 'top';

    if (i === 0) {
      // 컷
      ctx.fillStyle = '#1B2A4A';
      ctx.font = `700 14px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(shot.sceneNumber || '-', x + col.width / 2, y + padY);
    } else if (i === 1) {
      // 촬영순서
      ctx.fillStyle = '#111827';
      ctx.font = `700 14px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(shot.shotOrder), x + col.width / 2, y + padY);
    } else if (i === 2) {
      // 촬영구도
      const thumbW = col.width - 18;
      const thumbH = Math.round(thumbW / getAspectNumeric(aspectRatio));
      const tx = x + 9;
      const ty = y + 9;

      ctx.fillStyle = '#F8F9FA';
      ctx.fillRect(tx, ty, thumbW, thumbH);

      if (frameImg) {
        const imgRatio = frameImg.width / frameImg.height;
        const boxRatio = thumbW / thumbH;
        let sx = 0;
        let sy = 0;
        let sw = frameImg.width;
        let sh = frameImg.height;
        if (imgRatio > boxRatio) {
          sw = frameImg.height * boxRatio;
          sx = (frameImg.width - sw) / 2;
        } else {
          sh = frameImg.width / boxRatio;
          sy = (frameImg.height - sh) / 2;
        }
        ctx.drawImage(frameImg, sx, sy, sw, sh, tx, ty, thumbW, thumbH);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = `500 12px ${FONT_SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('구도 미등록', tx + thumbW / 2, ty + thumbH / 2);
      }

      ctx.strokeStyle = '#CBD5E1';
      ctx.strokeRect(tx, ty, thumbW, thumbH);
    } else if (i === 3) {
      // 촬영 내용
      ctx.fillStyle = '#1E293B';
      ctx.font = `400 13.5px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, shot.description || '-', col.width - padX * 2);
      lines.forEach((line, li) => {
        ctx.fillText(line, x + padX, y + padY + li * 19);
      });
    } else if (i === 4) {
      // 샷
      ctx.fillStyle = '#1E293B';
      ctx.font = `500 13px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, shot.shotSize || '-', col.width - padX * 2);
      lines.forEach((line, li) => ctx.fillText(line, x + padX, y + padY + li * 18));
    } else if (i === 5) {
      // 앵글
      ctx.fillStyle = '#1E293B';
      ctx.font = `500 13px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, shot.cameraAngle || '-', col.width - padX * 2);
      lines.forEach((line, li) => ctx.fillText(line, x + padX, y + padY + li * 18));
    } else if (i === 6) {
      // 화각
      ctx.fillStyle = '#1E293B';
      ctx.font = `500 13px ${FONT_MONO}`;
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, shot.focalLength || '-', col.width - padX * 2);
      lines.forEach((line, li) => ctx.fillText(line, x + padX, y + padY + li * 18));
    } else if (i === 7) {
      // 무브먼트
      ctx.fillStyle = '#1E293B';
      ctx.font = `500 13px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, shot.movement || '-', col.width - padX * 2);
      lines.forEach((line, li) => ctx.fillText(line, x + padX, y + padY + li * 18));
    } else if (i === 8) {
      // 듀레이션
      ctx.fillStyle = '#0F172A';
      ctx.font = `600 13.5px ${FONT_MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${(shot.duration || 0).toFixed(1)}초`, x + col.width - padX, y + padY);
    } else if (i === 9) {
      // 조명
      ctx.fillStyle = '#1E293B';
      ctx.font = `500 13px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, shot.lighting || '-', col.width - padX * 2);
      lines.forEach((line, li) => ctx.fillText(line, x + padX, y + padY + li * 18));
    } else if (i === 10) {
      // 비고
      ctx.fillStyle = '#475569';
      ctx.font = `400 13px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, shot.remarks || '-', col.width - padX * 2);
      lines.forEach((line, li) => ctx.fillText(line, x + padX, y + padY + li * 18));
    }

    ctx.textAlign = 'left';
    x += col.width;
  }

  return y + rowH;
}

function base64ToUint8Array(dataUrl: string): Uint8Array<ArrayBuffer> {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const buffer = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function buildMultiPagePdfBlob(canvases: HTMLCanvasElement[]): Blob {
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  let byteOffset = 0;

  const pushStr = (s: string) => {
    const encoded = encoder.encode(s);
    const copy = new Uint8Array(new ArrayBuffer(encoded.byteLength));
    copy.set(encoded);
    chunks.push(copy);
    byteOffset += copy.length;
  };
  const pushBytes = (b: Uint8Array<ArrayBuffer>) => {
    chunks.push(b);
    byteOffset += b.length;
  };

  const offsets: number[] = [0]; // 1-based object offsets
  const startObj = (id: number) => {
    offsets[id] = byteOffset;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => pushStr('\nendobj\n');

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const pageCount = canvases.length;
  // Object IDs:
  // 1: Catalog
  // 2: Pages
  // For each page i (0..pageCount-1):
  //   pageObjId = 3 + i*3
  //   contentObjId = 4 + i*3
  //   imgObjId = 5 + i*3
  const pageIds = canvases.map((_, i) => 3 + i * 3);

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  startObj(2);
  pushStr(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);
  endObj();

  canvases.forEach((canvas, i) => {
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imgId = 5 + i * 3;

    const jpegBytes = base64ToUint8Array(canvas.toDataURL('image/jpeg', 0.92));
    const contentStream = `q\n${PDF_W_PT.toFixed(2)} 0 0 ${PDF_H_PT.toFixed(2)} 0 0 cm\n/Im${i} Do\nQ\n`;

    startObj(pageId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_W_PT.toFixed(2)} ${PDF_H_PT.toFixed(
        2
      )}] /Resources << /XObject << /Im${i} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    endObj();

    startObj(contentId);
    pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream`);
    endObj();

    startObj(imgId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${PAGE_W_PX} /Height ${PAGE_H_PX} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushStr('\nendstream');
    endObj();
  });

  const xrefOffset = byteOffset;
  const totalObjs = 2 + pageCount * 3;
  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjs; id++) {
    pushStr(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }

  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}

export async function renderEpisodeToCanvases(
  project: StoryboardProject,
  episode: StoryboardEpisode
): Promise<HTMLCanvasElement[]> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const allShots = episode.scenes.flatMap((sc) => sc.shots);
  const totalDuration = allShots.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);

  // Preload all frame images concurrently
  const imgMap = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    allShots.map(async (shot) => {
      if (shot.frameImage) {
        const img = await loadImage(shot.frameImage);
        imgMap.set(shot.id, img);
      } else {
        imgMap.set(shot.id, null);
      }
    })
  );

  const pages: HTMLCanvasElement[] = [];
  let current = createCanvasPage();
  pages.push(current.canvas);

  let y = drawPageHeader(current.ctx, project, episode, totalDuration, allShots.length);

  const thumbW = COLUMNS[2].width - 18;
  const minThumbH = Math.round(thumbW / getAspectNumeric(project.aspectRatio)) + 18;

  for (const scene of episode.scenes) {
    const sceneDuration = scene.shots.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);

    // Ensure space for scene bar + table header + at least 110px of first row
    if (y + 36 + 38 + 110 > PAGE_H_PX - MARGIN_BOTTOM) {
      current = createCanvasPage();
      pages.push(current.canvas);
      y = drawPageHeader(current.ctx, project, episode, totalDuration, allShots.length);
    }

    y = drawSceneBar(
      current.ctx,
      y,
      scene.epLabel,
      scene.sceneLabel,
      scene.shots.length,
      sceneDuration
    );
    y = drawTableHeader(current.ctx, y);

    for (const shot of scene.shots) {
      // Measure row height accurately
      current.ctx.font = `400 13.5px ${FONT_SANS}`;
      const descLines = wrapText(current.ctx, shot.description || '-', COLUMNS[3].width - 20);
      current.ctx.font = `400 13px ${FONT_SANS}`;
      const remarkLines = wrapText(current.ctx, shot.remarks || '-', COLUMNS[10].width - 20);
      const textH = Math.max(descLines.length * 19, remarkLines.length * 18) + 24;
      const rowH = Math.max(minThumbH, textH, 92);

      if (y + rowH > PAGE_H_PX - MARGIN_BOTTOM) {
        current = createCanvasPage();
        pages.push(current.canvas);
        y = drawPageHeader(current.ctx, project, episode, totalDuration, allShots.length);
        y = drawSceneBar(
          current.ctx,
          y,
          scene.epLabel,
          scene.sceneLabel,
          scene.shots.length,
          sceneDuration
        );
        y = drawTableHeader(current.ctx, y);
      }

      y = drawShotRow(
        current.ctx,
        y,
        rowH,
        shot,
        imgMap.get(shot.id) ?? null,
        project.aspectRatio
      );
    }

    y += 18;
  }

  // Page footer numbering
  pages.forEach((canvas, idx) => {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#64748B';
    ctx.font = `500 13px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${idx + 1} / ${pages.length}`, PAGE_W_PX / 2, PAGE_H_PX - 20);
    ctx.textAlign = 'left';
  });

  return pages;
}

export async function downloadEpisodeAsPDF(
  project: StoryboardProject,
  episode: StoryboardEpisode
): Promise<void> {
  const canvases = await renderEpisodeToCanvases(project, episode);
  const blob = buildMultiPagePdfBlob(canvases);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (project.title || '스토리보드').replace(/[^\w가-힣_-]+/g, '_');
  const safeEp = (episode.name || '1회차').replace(/[^\w가-힣_-]+/g, '_');
  link.href = url;
  link.download = `${safeTitle}_${safeEp}_스토리보드.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
