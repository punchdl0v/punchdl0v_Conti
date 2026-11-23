import { createEmptyShot } from '../data/sampleProject';
import {
  StoryboardEpisode,
  StoryboardProject,
  StoryboardScene,
  StoryboardShot,
} from '../types/storyboard';
import { DriveDocFile, WorkspaceAuthError } from './googleDocsApi';

export interface SpreadsheetTabInfo {
  sheetId: number;
  title: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: SpreadsheetTabInfo[];
}

export interface SheetValuesPreview {
  sheetTitle: string;
  rows: string[][];
}

async function fetchSheetsApi<T>(
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
    let errorMessage = `Google Sheets 요청 실패 (${res.status})`;
    try {
      const errData = (await res.json()) as { error?: { message?: string } };
      if (errData?.error?.message) {
        errorMessage = errData.error.message;
      }
    } catch {
      // Ignore parse error
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function listGoogleSheets(
  accessToken: string,
  searchQuery = ''
): Promise<DriveDocFile[]> {
  const qParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
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

  const data = await fetchSheetsApi<{ files?: DriveDocFile[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return data.files || [];
}

interface RawSpreadsheetResponse {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  properties?: { title?: string };
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const safeId = encodeURIComponent(spreadsheetId);
  const data = await fetchSheetsApi<RawSpreadsheetResponse>(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}?fields=spreadsheetId,properties.title,sheets(properties(sheetId,title))`,
    accessToken
  );

  const sheets: SpreadsheetTabInfo[] = (data.sheets || [])
    .map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title || '시트',
    }));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || '제목 없는 스프레드시트',
    sheets,
  };
}

export async function readSheetTabValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<SheetValuesPreview> {
  const safeId = encodeURIComponent(spreadsheetId);
  const range = encodeURIComponent(`${quoteSheetTitle(sheetTitle)}!A1:Z200`);
  const data = await fetchSheetsApi<{ values?: unknown[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${range}`,
    accessToken
  );

  const rows = (data.values || [])
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  return {
    sheetTitle,
    rows,
  };
}

function buildStoryboardSheetRows(
  project: StoryboardProject,
  episode: StoryboardEpisode
): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      '작품명',
      project.title || '무제 프로젝트',
      '회차',
      episode.name || '1회차',
      '촬영일',
      episode.shootingDate || '-',
      '감독',
      project.director || '-',
      '촬영',
      project.cinematographer || '-',
      '화면비',
      project.aspectRatio,
    ],
    [],
    [
      'EP',
      '#S',
      '컷',
      '촬영순서',
      '촬영 내용',
      '샷',
      '앵글',
      '화각',
      '무브먼트',
      '듀레이션(초)',
      '조명',
      '비고',
    ],
  ];

  episode.scenes.forEach((scene) => {
    scene.shots.forEach((shot) => {
      rows.push([
        scene.epLabel,
        scene.sceneLabel,
        shot.sceneNumber,
        shot.shotOrder,
        shot.description,
        shot.shotSize,
        shot.cameraAngle,
        shot.focalLength,
        shot.movement,
        Number(shot.duration) || 0,
        shot.lighting,
        shot.remarks,
      ]);
    });
  });

  return rows;
}

export async function createStoryboardGoogleSheet(
  accessToken: string,
  project: StoryboardProject,
  episode: StoryboardEpisode
): Promise<DriveDocFile> {
  const title = `${project.title || '무제 프로젝트'} - ${episode.name || '1회차'} 스토리보드`;
  const tabTitle = (episode.name || '스토리보드').slice(0, 80);

  const created = await fetchSheetsApi<RawSpreadsheetResponse>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: [
          {
            properties: {
              title: tabTitle,
              gridProperties: { frozenRowCount: 3 },
            },
          },
        ],
      }),
    }
  );

  const actualTabTitle = created.sheets?.[0]?.properties?.title || tabTitle;
  const actualSheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;
  const values = buildStoryboardSheetRows(project, episode);
  const safeId = encodeURIComponent(created.spreadsheetId);
  const range = encodeURIComponent(`${quoteSheetTitle(actualTabTitle)}!A1`);

  await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${range}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    }
  );

  // Format header row with deep navy (#1B2A4A) & white bold text
  await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: actualSheetId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 0,
                endColumnIndex: 12,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.106, green: 0.165, blue: 0.29 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: actualSheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 12,
              },
            },
          },
        ],
      }),
    }
  );

  return {
    id: created.spreadsheetId,
    name: created.properties?.title || title,
    webViewLink: `https://docs.google.com/spreadsheets/d/${safeId}/edit`,
  };
}

export async function overwriteStoryboardGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  project: StoryboardProject,
  episode: StoryboardEpisode
): Promise<DriveDocFile> {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const safeId = encodeURIComponent(spreadsheetId);
  const clearRange = encodeURIComponent(`${quoteSheetTitle(sheetTitle)}!A1:Z1000`);
  const writeRange = encodeURIComponent(`${quoteSheetTitle(sheetTitle)}!A1`);

  await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${clearRange}:clear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );

  const values = buildStoryboardSheetRows(project, episode);
  await fetchSheetsApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    }
  );

  return {
    id: metadata.spreadsheetId,
    name: metadata.title,
    webViewLink: `https://docs.google.com/spreadsheets/d/${safeId}/edit`,
  };
}

export async function trashGoogleSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  const safeId = encodeURIComponent(spreadsheetId);
  await fetchSheetsApi(
    `https://www.googleapis.com/drive/v3/files/${safeId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ trashed: true }),
    }
  );
}

export function parseSheetRowsToScenes(
  rows: string[][],
  fallbackSceneTitle: string
): StoryboardScene[] {
  if (rows.length === 0) return [];

  // Locate header row if present
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const joined = rows[i].join(' ');
    if (
      joined.includes('컷') ||
      joined.includes('촬영 내용') ||
      joined.includes('샷') ||
      joined.includes('듀레이션')
    ) {
      headerRowIdx = i;
      break;
    }
  }

  const headerRow = headerRowIdx >= 0 ? rows[headerRowIdx] : [];
  const dataRows = headerRowIdx >= 0 ? rows.slice(headerRowIdx + 1) : rows;

  const findCol = (keywords: string[], defaultIdx: number): number => {
    if (headerRow.length === 0) return defaultIdx;
    const found = headerRow.findIndex((h) =>
      keywords.some((kw) => h.toLowerCase().includes(kw.toLowerCase()))
    );
    return found >= 0 ? found : -1;
  };

  const colEp = findCol(['ep', '회차'], -1);
  const colScene = findCol(['#s', '씬'], -1);
  const colCut = findCol(['컷', '장면'], 0);
  const colOrder = findCol(['촬영순서', '순서'], 1);
  const colDesc = findCol(['촬영 내용', '내용', '액션'], 2);
  const colShot = findCol(['샷'], 3);
  const colAngle = findCol(['앵글'], 4);
  const colLens = findCol(['화각', '렌즈'], 5);
  const colMove = findCol(['무브먼트', '카메라'], 6);
  const colDur = findCol(['듀레이션', '시간'], 7);
  const colLight = findCol(['조명'], 8);
  const colRemark = findCol(['비고', '메모'], 9);

  const grouped = new Map<string, { epLabel: string; sceneLabel: string; shots: StoryboardShot[] }>();

  dataRows.forEach((row, idx) => {
    if (!row.some((cell) => cell.trim().length > 0)) return;

    const getVal = (colIdx: number) =>
      colIdx >= 0 && colIdx < row.length ? row[colIdx].trim() : '';

    const epLabel = colEp >= 0 ? getVal(colEp) : '';
    const sceneLabel = colScene >= 0 ? getVal(colScene) : fallbackSceneTitle;
    const key = `${epLabel}__${sceneLabel}`;

    const baseShot = createEmptyShot(idx + 1, getVal(colCut) || String(idx + 1));
    const parsedOrder = parseInt(getVal(colOrder), 10);
    const parsedDur = parseFloat(getVal(colDur).replace(/[^0-9.]/g, ''));

    const shot: StoryboardShot = {
      ...baseShot,
      shotOrder: Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : idx + 1,
      description: getVal(colDesc) || (headerRowIdx === -1 ? row.join(' · ') : ''),
      shotSize: getVal(colShot) || baseShot.shotSize,
      cameraAngle: getVal(colAngle) || baseShot.cameraAngle,
      focalLength: getVal(colLens) || baseShot.focalLength,
      movement: getVal(colMove) || baseShot.movement,
      duration: Number.isFinite(parsedDur) && parsedDur >= 0 ? parsedDur : baseShot.duration,
      lighting: getVal(colLight) || baseShot.lighting,
      remarks: getVal(colRemark),
    };

    if (!grouped.has(key)) {
      grouped.set(key, { epLabel, sceneLabel, shots: [] });
    }
    grouped.get(key)!.shots.push(shot);
  });

  return Array.from(grouped.values()).map((entry, idx) => ({
    id: `scene-sheet-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    epLabel: entry.epLabel,
    sceneLabel: entry.sceneLabel,
    shots: entry.shots.map((s, i) => ({ ...s, shotOrder: i + 1 })),
  }));
}
