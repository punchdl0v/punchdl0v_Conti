import { StoryboardEpisode, StoryboardProject } from '../types/storyboard';
import { formatDurationTimecode } from '../utils/exportUtils';

export interface DriveDocFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface ParsedGoogleDoc {
  documentId: string;
  title: string;
  paragraphs: string[];
  bodyEndIndex: number;
}

export class WorkspaceAuthError extends Error {
  constructor(message = 'Google 인증이 만료되었거나 권한이 필요합니다.') {
    super(message);
    this.name = 'WorkspaceAuthError';
  }
}

export function isSafeHttpsUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchGoogleApi<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new WorkspaceAuthError('Google 계정 권한을 다시 확인해 주세요.');
  }

  if (!res.ok) {
    let errorMessage = `Google API 요청 실패 (${res.status})`;
    try {
      const errData = (await res.json()) as { error?: { message?: string } };
      if (errData?.error?.message) {
        errorMessage = errData.error.message;
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export async function listGoogleDocs(
  accessToken: string,
  searchQuery = ''
): Promise<DriveDocFile[]> {
  const qParts = [
    "mimeType='application/vnd.google-apps.document'",
    'trashed=false',
  ];
  const sanitized = searchQuery.trim().replace(/['\\]/g, '');
  if (sanitized) {
    qParts.push(`name contains '${sanitized}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(' and '),
    orderBy: 'modifiedTime desc',
    pageSize: '20',
    fields: 'files(id,name,modifiedTime,webViewLink)',
  });

  const data = await fetchGoogleApi<{ files?: DriveDocFile[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return data.files || [];
}

interface DocsParagraphElement {
  textRun?: { content?: string };
}

interface DocsStructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: {
    elements?: DocsParagraphElement[];
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: DocsStructuralElement[];
      }>;
    }>;
  };
}

interface DocsDocumentResponse {
  documentId: string;
  title: string;
  body?: {
    content?: DocsStructuralElement[];
  };
}

function extractTextFromElements(elements: DocsStructuralElement[] = []): string[] {
  const lines: string[] = [];

  for (const el of elements) {
    if (el.paragraph?.elements) {
      const text = el.paragraph.elements
        .map((pe) => pe.textRun?.content || '')
        .join('')
        .replace(/\r?\n$/, '')
        .trim();
      if (text) {
        lines.push(text);
      }
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const cellTexts = (row.tableCells || [])
          .map((cell) => extractTextFromElements(cell.content || []).join(' '))
          .filter(Boolean);
        if (cellTexts.length > 0) {
          lines.push(cellTexts.join(' | '));
        }
      }
    }
  }

  return lines;
}

export async function readGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<ParsedGoogleDoc> {
  const safeId = encodeURIComponent(documentId);
  const doc = await fetchGoogleApi<DocsDocumentResponse>(
    `https://docs.googleapis.com/v1/documents/${safeId}`,
    accessToken
  );

  const content = doc.body?.content || [];
  const lastEl = content[content.length - 1];
  const bodyEndIndex = Math.max(1, lastEl?.endIndex ?? 1);
  const paragraphs = extractTextFromElements(content);

  return {
    documentId: doc.documentId,
    title: doc.title || '제목 없는 문서',
    paragraphs,
    bodyEndIndex,
  };
}

function buildStoryboardDocumentText(
  project: StoryboardProject,
  episode: StoryboardEpisode
): string {
  const totalShots = episode.scenes.reduce((sum, sc) => sum + sc.shots.length, 0);
  const totalDuration = episode.scenes.reduce(
    (sum, sc) => sum + sc.shots.reduce((s, sh) => s + (Number(sh.duration) || 0), 0),
    0
  );

  const lines: string[] = [];
  lines.push(`${project.title || '무제 프로젝트'} — ${episode.name || '1회차'} 스토리보드`);
  lines.push('');
  lines.push(
    `촬영일: ${episode.shootingDate || '-'}  |  감독: ${project.director || '-'}  |  촬영: ${
      project.cinematographer || '-'
    }  |  화면비: ${project.aspectRatio}`
  );
  lines.push(
    `총 ${episode.scenes.length}씬  |  총 ${totalShots}컷  |  예상 러닝타임: ${formatDurationTimecode(
      totalDuration
    )}`
  );
  lines.push('────────────────────────────────────────────────────────');
  lines.push('');

  episode.scenes.forEach((scene, sIdx) => {
    const sceneHeader = [
      scene.epLabel ? `EP ${scene.epLabel}` : '',
      scene.sceneLabel ? `#S ${scene.sceneLabel}` : `씬 ${sIdx + 1}`,
    ]
      .filter(Boolean)
      .join('  ·  ');

    lines.push(`[${sceneHeader}] (${scene.shots.length}컷)`);
    lines.push('');

    scene.shots.forEach((shot) => {
      lines.push(
        `• 컷 ${shot.sceneNumber || '-'} (촬영순서 #${shot.shotOrder})  |  ${
          shot.shotSize || '-'
        }  |  ${shot.cameraAngle || '-'}  |  ${shot.focalLength || '-'}  |  ${
          shot.movement || '-'
        }  |  ${(shot.duration || 0).toFixed(1)}초  |  조명: ${shot.lighting || '-'}`
      );
      if (shot.description.trim()) {
        lines.push(`  내용: ${shot.description.trim()}`);
      }
      if (shot.remarks.trim()) {
        lines.push(`  비고: ${shot.remarks.trim()}`);
      }
      lines.push('');
    });

    lines.push('');
  });

  return lines.join('\n');
}

export async function createStoryboardGoogleDoc(
  accessToken: string,
  project: StoryboardProject,
  episode: StoryboardEpisode
): Promise<DriveDocFile> {
  const title = `${project.title || '무제 프로젝트'} - ${episode.name || '1회차'} 스토리보드`;
  const created = await fetchGoogleApi<DocsDocumentResponse>(
    'https://docs.googleapis.com/v1/documents',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ title }),
    }
  );

  const text = buildStoryboardDocumentText(project, episode);
  const safeId = encodeURIComponent(created.documentId);

  await fetchGoogleApi(
    `https://docs.googleapis.com/v1/documents/${safeId}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text,
            },
          },
        ],
      }),
    }
  );

  return {
    id: created.documentId,
    name: created.title || title,
    webViewLink: `https://docs.google.com/document/d/${safeId}/edit`,
  };
}

export async function overwriteStoryboardGoogleDoc(
  accessToken: string,
  documentId: string,
  project: StoryboardProject,
  episode: StoryboardEpisode
): Promise<DriveDocFile> {
  const existing = await readGoogleDoc(accessToken, documentId);
  const safeId = encodeURIComponent(documentId);
  const text = buildStoryboardDocumentText(project, episode);

  const requests: Array<Record<string, unknown>> = [];
  if (existing.bodyEndIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: existing.bodyEndIndex - 1,
        },
      },
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text,
    },
  });

  await fetchGoogleApi(
    `https://docs.googleapis.com/v1/documents/${safeId}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    }
  );

  return {
    id: existing.documentId,
    name: existing.title,
    webViewLink: `https://docs.google.com/document/d/${safeId}/edit`,
  };
}

export async function trashGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<void> {
  const safeId = encodeURIComponent(documentId);
  await fetchGoogleApi(
    `https://www.googleapis.com/drive/v3/files/${safeId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ trashed: true }),
    }
  );
}
