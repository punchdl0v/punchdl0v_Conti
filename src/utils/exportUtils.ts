import { StoryboardProject } from '../types/storyboard';

export function formatDurationTimecode(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  const wholeSecs = Math.floor(secs);
  const tenths = Math.round((secs - wholeSecs) * 10);
  const adjustedSecs = tenths === 10 ? wholeSecs + 1 : wholeSecs;
  const adjustedTenths = tenths === 10 ? 0 : tenths;

  const mm = String(mins).padStart(2, '0');
  const ss = String(adjustedSecs).padStart(2, '0');
  return `${mm}:${ss}.${adjustedTenths}`;
}

export function exportStoryboardToCSV(project: StoryboardProject): void {
  const headers = [
    '회차',
    'EP',
    '#S',
    '컷',
    '촬영순서',
    '촬영구도(이미지여부)',
    '촬영 내용',
    '샷',
    '앵글',
    '화각',
    '무브먼트',
    '듀레이션(초)',
    '조명',
    '비고',
  ];

  const escapeCSV = (val: string | number): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = project.episodes.flatMap((ep) =>
    ep.scenes.flatMap((scene) =>
      scene.shots.map((shot) => [
        escapeCSV(ep.name),
        escapeCSV(scene.epLabel),
        escapeCSV(scene.sceneLabel),
        escapeCSV(shot.sceneNumber),
        escapeCSV(shot.shotOrder),
        escapeCSV(shot.frameImage ? '첨부됨' : '미첨부'),
        escapeCSV(shot.description),
        escapeCSV(shot.shotSize),
        escapeCSV(shot.cameraAngle),
        escapeCSV(shot.focalLength),
        escapeCSV(shot.movement),
        escapeCSV(shot.duration.toFixed(1)),
        escapeCSV(shot.lighting),
        escapeCSV(shot.remarks),
      ])
    )
  );

  // UTF-8 BOM for proper Korean display in Excel
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCSV).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (project.title || '스토리보드').replace(/[^\w가-힣_-]+/g, '_');
  link.href = url;
  link.download = `${safeTitle}_스토리보드.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportProjectToJSON(project: StoryboardProject): void {
  const jsonContent = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (project.title || '스토리보드').replace(/[^\w가-힣_-]+/g, '_');
  link.href = url;
  link.download = `${safeTitle}_프로젝트.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function resolveImageAsDataUrl(src: string): Promise<string> {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return src;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : src);
      reader.onerror = () => resolve(src);
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

export async function exportSingleFileHTML(project: StoryboardProject): Promise<void> {
  // Clone project and convert any relative image paths to inline base64 data URLs
  const portableProject: StoryboardProject = {
    ...project,
    episodes: await Promise.all(
      project.episodes.map(async (ep) => ({
        ...ep,
        scenes: await Promise.all(
          ep.scenes.map(async (sc) => ({
            ...sc,
            shots: await Promise.all(
              sc.shots.map(async (sh) => ({
                ...sh,
                frameImage: await resolveImageAsDataUrl(sh.frameImage),
              }))
            ),
          }))
        ),
      }))
    ),
  };

  let htmlTemplate = '';
  try {
    const res = await fetch('/storyboard-maker.html', { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('<div id="root">')) {
        htmlTemplate = text;
      }
    }
  } catch {
    // Fallback below when already running from a local file:// standalone HTML
  }

  if (!htmlTemplate) {
    const docClone = document.documentElement.cloneNode(true) as HTMLElement;
    const rootEl = docClone.querySelector('#root');
    if (rootEl) rootEl.innerHTML = '';
    const oldDataScript = docClone.querySelector('#embedded-project-data');
    if (oldDataScript) oldDataScript.remove();
    htmlTemplate = '<!doctype html>\n' + docClone.outerHTML;
  }

  const serializedProject = JSON.stringify(portableProject).replace(/<\/script/gi, '<\\/script');
  const dataScript = `<script id="embedded-project-data">window.__INITIAL_STORYBOARD_PROJECT__ = ${serializedProject};</script>`;

  let finalHtml = htmlTemplate;
  if (finalHtml.includes('<!--EMBEDDED_PROJECT_DATA-->')) {
    finalHtml = finalHtml.split('<!--EMBEDDED_PROJECT_DATA-->').join(dataScript);
  } else if (finalHtml.includes('<div id="root"></div>')) {
    finalHtml = finalHtml
      .split('<div id="root"></div>')
      .join(`<div id="root"></div>\n    ${dataScript}`);
  } else {
    finalHtml = finalHtml.split('</body>').join(`${dataScript}\n  </body>`);
  }

  const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (project.title || '스토리보드').replace(/[^\w가-힣_-]+/g, '_');
  link.href = url;
  link.download = `${safeTitle}_스토리보드.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

