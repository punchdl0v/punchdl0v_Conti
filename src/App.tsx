import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Printer,
  Search,
  TableProperties,
  Trash2,
  X,
} from 'lucide-react';
import {
  createEmptyEpisode,
  createEmptyScene,
  createEmptyShot,
  SAMPLE_PROJECT,
} from './data/sampleProject';
import { FrameEditorModal } from './components/FrameEditorModal';
import { GoogleDocsModal } from './components/GoogleDocsModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { PresentationView } from './components/PresentationView';
import { PrintExportModal } from './components/PrintExportModal';
import { ScheduleSummaryView } from './components/ScheduleSummaryView';
import { StoryboardTable } from './components/StoryboardTable';
import {
  ASPECT_RATIO_OPTIONS,
  AspectRatio,
  GuideOverlay,
  StoryboardEpisode,
  StoryboardProject,
  StoryboardScene,
  StoryboardShot,
} from './types/storyboard';
import {
  exportStoryboardToCSV,
  formatDurationTimecode,
} from './utils/exportUtils';

type ActiveTab = 'sheet' | 'presentation' | 'schedule';

const STORAGE_KEY = 'storyboard_maker_project_v1';

function migrateShots(rawShots: unknown[]): StoryboardShot[] {
  return rawShots.map((item, index) => {
    const s = item as Partial<StoryboardShot> & { shotAngle?: string };
    let shotSize = s.shotSize;
    let cameraAngle = s.cameraAngle;

    if (shotSize === undefined || cameraAngle === undefined) {
      const legacy = s.shotAngle || '';
      const parts = legacy.split('·').map((p) => p.trim());
      shotSize = shotSize ?? (parts[0] || 'MS (미디엄 샷)');
      if (!cameraAngle) {
        if (legacy.includes('하이') || legacy.includes('High')) {
          cameraAngle = 'High Level';
        } else if (legacy.includes('로우') || legacy.includes('Low')) {
          cameraAngle = 'Low Level';
        } else {
          cameraAngle = 'Eye Level';
        }
      }
    }

    return {
      id: s.id || `shot-${Date.now()}-${index}`,
      sceneNumber: s.sceneNumber ?? String(index + 1),
      shotOrder: typeof s.shotOrder === 'number' ? s.shotOrder : index + 1,
      frameImage: s.frameImage ?? '',
      guideOverlay: s.guideOverlay ?? 'none',
      description: s.description ?? '',
      shotSize,
      cameraAngle,
      focalLength: s.focalLength ?? '',
      movement: s.movement ?? '',
      duration: typeof s.duration === 'number' ? s.duration : 4.0,
      lighting: s.lighting ?? '',
      remarks: s.remarks ?? '',
    };
  });
}

function migrateScenes(rawScenes: unknown[], fallbackEpLabel = ''): StoryboardScene[] {
  return rawScenes.map((item, idx) => {
    const sc = item as Partial<StoryboardScene>;
    const isUntouchedSample1 =
      sc.id === 'scene-sample-1' &&
      sc.epLabel === 'EP.01' &&
      sc.sceneLabel === 'S#01 · 심야 골목';
    const isUntouchedSample2 =
      sc.id === 'scene-sample-2' &&
      sc.epLabel === 'EP.01' &&
      sc.sceneLabel === 'S#02 · 심야 카페 창가';

    return {
      id: sc.id || `scene-${Date.now()}-${idx}`,
      epLabel: isUntouchedSample1 || isUntouchedSample2 ? '' : (sc.epLabel ?? fallbackEpLabel),
      sceneLabel: isUntouchedSample1 || isUntouchedSample2 ? '' : (sc.sceneLabel ?? ''),
      shots: Array.isArray(sc.shots) ? migrateShots(sc.shots) : [],
    };
  });
}

function normalizeEpisodeName(rawName: string | undefined, idx: number): string {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return `${idx + 1}회차`;
  if (/^\d+$/.test(trimmed)) return `${trimmed}회차`;
  if (/^Ep\.\d+$/i.test(trimmed)) return `${idx + 1}회차`;
  return trimmed;
}

function migrateProject(raw: unknown): StoryboardProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<StoryboardProject>;

  let episodes: StoryboardEpisode[] = [];

  if (Array.isArray(parsed.episodes) && parsed.episodes.length > 0) {
    episodes = parsed.episodes.map((ep, idx) => {
      return {
        id: ep.id || `ep-${Date.now()}-${idx}`,
        name: normalizeEpisodeName(ep.name, idx),
        shootingDate: ep.shootingDate ?? '',
        scenes:
          Array.isArray(ep.scenes) && ep.scenes.length > 0
            ? migrateScenes(ep.scenes, '')
            : [createEmptyScene(1, '')],
      };
    });
  } else if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
    episodes = [
      {
        id: `ep-migrated-${Date.now()}`,
        name:
          parsed.episode && !parsed.episode.includes('빗속')
            ? normalizeEpisodeName(parsed.episode, 0)
            : '1회차',
        shootingDate: parsed.shootingDate ?? '',
        scenes: migrateScenes(parsed.scenes, parsed.epLabel ?? ''),
      },
    ];
  } else if (Array.isArray(parsed.shots)) {
    episodes = [
      {
        id: `ep-migrated-${Date.now()}`,
        name: normalizeEpisodeName(parsed.episode, 0),
        shootingDate: parsed.shootingDate ?? '',
        scenes: [
          {
            id: `scene-migrated-${Date.now()}`,
            epLabel: parsed.epLabel ?? '',
            sceneLabel: parsed.sceneLabel ?? '',
            shots: migrateShots(parsed.shots),
          },
        ],
      },
    ];
  } else {
    return null;
  }

  return {
    title: parsed.title ?? '무제 프로젝트',
    director: parsed.director ?? '',
    cinematographer: parsed.cinematographer ?? '',
    aspectRatio: parsed.aspectRatio ?? '16:9',
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    episodes,
  };
}

function loadInitialProject(): StoryboardProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = migrateProject(JSON.parse(raw));
      if (migrated) return migrated;
    }
  } catch {
    // Fallback to embedded or sample project
  }
  const embedded = (
    window as Window & { __INITIAL_STORYBOARD_PROJECT__?: unknown }
  ).__INITIAL_STORYBOARD_PROJECT__;
  if (embedded) {
    const migratedEmbedded = migrateProject(embedded);
    if (migratedEmbedded) return migratedEmbedded;
  }
  return SAMPLE_PROJECT;
}

export default function App() {
  const [project, setProject] = useState<StoryboardProject>(loadInitialProject);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>(
    () => project.episodes[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('sheet');
  const [searchQuery, setSearchQuery] = useState('');
  const [sceneIdFilter, setSceneIdFilter] = useState<string>('ALL');
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [draggedEpisodeId, setDraggedEpisodeId] = useState<string | null>(null);
  const [dragOverEpisodeId, setDragOverEpisodeId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isGoogleDocsModalOpen, setIsGoogleDocsModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<{
    sceneId: string;
    shotId: string;
  } | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const sceneEndRef = useRef<HTMLDivElement>(null);

  // Ensure activeEpisodeId always points to a valid episode
  const activeEpisode = useMemo(() => {
    return (
      project.episodes.find((ep) => ep.id === activeEpisodeId) ||
      project.episodes[0]
    );
  }, [project.episodes, activeEpisodeId]);

  useEffect(() => {
    if (activeEpisode && activeEpisode.id !== activeEpisodeId) {
      setActiveEpisodeId(activeEpisode.id);
    }
  }, [activeEpisode, activeEpisodeId]);

  // Auto-persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // Ignore quota errors cleanly
    }
  }, [project]);

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    window.setTimeout(() => {
      setNoticeMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const activeScenes = activeEpisode?.scenes || [];

  // Flattened shots for the active episode
  const episodeShots = useMemo(
    () => activeScenes.flatMap((scene) => scene.shots),
    [activeScenes]
  );

  const episodeDuration = useMemo(
    () => episodeShots.reduce((sum, s) => sum + (Number(s.duration) || 0), 0),
    [episodeShots]
  );

  const hasActiveFilter = searchQuery.trim().length > 0 || sceneIdFilter !== 'ALL';

  // Filtered scenes & shots for active episode
  const filteredScenes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeScenes
      .filter((scene) => sceneIdFilter === 'ALL' || scene.id === sceneIdFilter)
      .map((scene) => {
        if (!q) return scene;
        const sceneHeaderMatch =
          scene.epLabel.toLowerCase().includes(q) ||
          scene.sceneLabel.toLowerCase().includes(q);
        if (sceneHeaderMatch) return scene;

        const matchingShots = scene.shots.filter(
          (shot) =>
            shot.sceneNumber.toLowerCase().includes(q) ||
            String(shot.shotOrder).includes(q) ||
            shot.description.toLowerCase().includes(q) ||
            shot.shotSize.toLowerCase().includes(q) ||
            shot.cameraAngle.toLowerCase().includes(q) ||
            shot.focalLength.toLowerCase().includes(q) ||
            shot.movement.toLowerCase().includes(q) ||
            shot.lighting.toLowerCase().includes(q) ||
            shot.remarks.toLowerCase().includes(q)
        );
        return { ...scene, shots: matchingShots };
      })
      .filter((scene) => !q || scene.shots.length > 0);
  }, [activeScenes, searchQuery, sceneIdFilter]);

  const updateProjectMeta = (patch: Partial<StoryboardProject>) => {
    setProject((prev) => ({
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  };

  const updateActiveEpisode = (
    updater: (ep: StoryboardEpisode) => StoryboardEpisode
  ) => {
    if (!activeEpisode) return;
    setProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      episodes: prev.episodes.map((ep) =>
        ep.id === activeEpisode.id ? updater(ep) : ep
      ),
    }));
  };

  const handleSelectEpisode = (epId: string) => {
    setActiveEpisodeId(epId);
    setSceneIdFilter('ALL');
    setSearchQuery('');
  };

  const handleAddEpisode = () => {
    const nextIdx = project.episodes.length + 1;
    const newEp = createEmptyEpisode(nextIdx);
    setProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      episodes: [...prev.episodes, newEp],
    }));
    setActiveEpisodeId(newEp.id);
    setSceneIdFilter('ALL');
    setSearchQuery('');
    setActiveTab('sheet');
    showNotice(`${newEp.name} 스토리보드가 추가되었습니다.`);
  };

  const handleDeleteEpisode = (epId: string) => {
    if (project.episodes.length <= 1) return;
    const remaining = project.episodes.filter((ep) => ep.id !== epId);
    setProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      episodes: remaining,
    }));
    if (activeEpisodeId === epId && remaining[0]) {
      setActiveEpisodeId(remaining[0].id);
    }
    setSceneIdFilter('ALL');
    setSearchQuery('');
    showNotice('회차가 삭제되었습니다.');
  };

  const handleMoveEpisode = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= project.episodes.length ||
      toIndex >= project.episodes.length
    ) {
      return;
    }
    setProject((prev) => {
      const nextEpisodes = [...prev.episodes];
      const [moved] = nextEpisodes.splice(fromIndex, 1);
      nextEpisodes.splice(toIndex, 0, moved);
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        episodes: nextEpisodes,
      };
    });
    showNotice('회차 순서를 변경했습니다.');
  };

  const updateSceneMeta = (sceneId: string, patch: Partial<StoryboardScene>) => {
    updateActiveEpisode((ep) => ({
      ...ep,
      scenes: ep.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...patch } : sc)),
    }));
  };

  const handleAddScene = () => {
    if (!activeEpisode) return;
    updateActiveEpisode((ep) => {
      const nextSceneIndex = ep.scenes.length + 1;
      const newScene = createEmptyScene(nextSceneIndex, '');
      return {
        ...ep,
        scenes: [...ep.scenes, newScene],
      };
    });
    setSearchQuery('');
    setSceneIdFilter('ALL');
    setActiveTab('sheet');
    showNotice('새 씬과 첫 컷이 추가되었습니다.');
    window.setTimeout(() => {
      sceneEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
  };

  const handleImportSceneFromDocs = (sceneTitle: string, lines: string[]) => {
    if (!activeEpisode) return;
    const importedLines = lines.slice(0, 30);
    const shots: StoryboardShot[] =
      importedLines.length > 0
        ? importedLines.map((line, index) => ({
            ...createEmptyShot(index + 1, String(index + 1)),
            description: line,
          }))
        : [createEmptyShot(1, '1')];

    const newScene: StoryboardScene = {
      id: `scene-docs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      epLabel: '',
      sceneLabel: sceneTitle,
      shots,
    };

    updateActiveEpisode((ep) => ({
      ...ep,
      scenes: [...ep.scenes, newScene],
    }));
    setSearchQuery('');
    setSceneIdFilter('ALL');
    setActiveTab('sheet');
    showNotice(`Google Docs '${sceneTitle}' 내용을 새 씬(${shots.length}컷)으로 불러왔습니다.`);
    window.setTimeout(() => {
      sceneEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
  };

  const handleImportScenesFromSheets = (
    importedScenes: StoryboardScene[],
    sourceTitle: string
  ) => {
    if (!activeEpisode || importedScenes.length === 0) return;
    const totalImportedShots = importedScenes.reduce((sum, sc) => sum + sc.shots.length, 0);

    updateActiveEpisode((ep) => ({
      ...ep,
      scenes: [...ep.scenes, ...importedScenes],
    }));
    setSearchQuery('');
    setSceneIdFilter('ALL');
    setActiveTab('sheet');
    showNotice(
      `Google Sheets '${sourceTitle}'에서 ${importedScenes.length}개 씬(${totalImportedShots}컷)을 불러왔습니다.`
    );
    window.setTimeout(() => {
      sceneEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
  };

  const handleDeleteScene = (sceneId: string) => {
    updateActiveEpisode((ep) => {
      if (ep.scenes.length <= 1) return ep;
      return {
        ...ep,
        scenes: ep.scenes.filter((sc) => sc.id !== sceneId),
      };
    });
    if (sceneIdFilter === sceneId) {
      setSceneIdFilter('ALL');
    }
    showNotice('씬이 삭제되었습니다.');
  };

  const handleAddShotToScene = (targetSceneId?: string) => {
    updateActiveEpisode((ep) => {
      if (ep.scenes.length === 0) {
        return {
          ...ep,
          scenes: [createEmptyScene(1, '')],
        };
      }

      const resolvedSceneId =
        targetSceneId ||
        (sceneIdFilter !== 'ALL'
          ? sceneIdFilter
          : ep.scenes[ep.scenes.length - 1].id);

      return {
        ...ep,
        scenes: ep.scenes.map((sc) => {
          if (sc.id !== resolvedSceneId) return sc;
          const nextOrder = sc.shots.length + 1;
          return {
            ...sc,
            shots: [...sc.shots, createEmptyShot(nextOrder, String(nextOrder))],
          };
        }),
      };
    });
    showNotice('새 컷이 추가되었습니다.');
  };

  const handleUpdateShot = (sceneId: string, shotId: string, patch: Partial<StoryboardShot>) => {
    updateActiveEpisode((ep) => ({
      ...ep,
      scenes: ep.scenes.map((sc) =>
        sc.id === sceneId
          ? {
              ...sc,
              shots: sc.shots.map((shot) =>
                shot.id === shotId ? { ...shot, ...patch } : shot
              ),
            }
          : sc
      ),
    }));
  };

  const handleDuplicateShot = (sceneId: string, shotId: string) => {
    updateActiveEpisode((ep) => ({
      ...ep,
      scenes: ep.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        const idx = sc.shots.findIndex((s) => s.id === shotId);
        if (idx === -1) return sc;
        const source = sc.shots[idx];
        const clone: StoryboardShot = {
          ...source,
          id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };
        const nextShots = [...sc.shots];
        nextShots.splice(idx + 1, 0, clone);
        return {
          ...sc,
          shots: nextShots.map((s, i) => ({ ...s, shotOrder: i + 1 })),
        };
      }),
    }));
    showNotice('선택한 컷을 복제했습니다.');
  };

  const handleDeleteShot = (sceneId: string, shotId: string) => {
    updateActiveEpisode((ep) => ({
      ...ep,
      scenes: ep.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        return {
          ...sc,
          shots: sc.shots
            .filter((s) => s.id !== shotId)
            .map((s, i) => ({ ...s, shotOrder: i + 1 })),
        };
      }),
    }));
    showNotice('컷이 삭제되었습니다.');
  };

  const handleMoveShot = (sceneId: string, fromIndex: number, toIndex: number) => {
    updateActiveEpisode((ep) => ({
      ...ep,
      scenes: ep.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= sc.shots.length ||
          toIndex >= sc.shots.length
        ) {
          return sc;
        }
        const nextShots = [...sc.shots];
        const [moved] = nextShots.splice(fromIndex, 1);
        nextShots.splice(toIndex, 0, moved);
        return {
          ...sc,
          shots: nextShots.map((s, i) => ({ ...s, shotOrder: i + 1 })),
        };
      }),
    }));
  };

  const editingShot = useMemo(() => {
    if (!editingContext) return null;
    const sc = activeScenes.find((s) => s.id === editingContext.sceneId);
    return sc?.shots.find((sh) => sh.id === editingContext.shotId) || null;
  }, [activeScenes, editingContext]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col">
      {/* Top Navigation Bar: Row 1 (3-Zone Contract) + Row 2 (Episode Tabs) */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        {/* Row 1: Brand | Primary Nav | Primary Action */}
        <div className="mx-auto flex max-w-[1640px] items-center justify-between gap-4 lg:gap-8 px-4 sm:px-5 lg:px-6 py-2.5">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => setActiveTab('sheet')}
            className="text-lg font-bold tracking-tight text-[#1B2A4A] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2A4A] rounded"
          >
            스토리보드 메이커
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="주요 작업 화면"
            className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium"
          >
            {[
              { id: 'sheet' as ActiveTab, label: '스토리보드 시트' },
              { id: 'presentation' as ActiveTab, label: '프레젠테이션 뷰' },
              { id: 'schedule' as ActiveTab, label: '촬영 관련 요약' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#1B2A4A] text-[#1B2A4A] font-semibold'
                      : 'border-transparent text-slate-500 hover:text-[#1B2A4A]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('sheet');
                setIsPrintModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B2A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#131E36] transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              인쇄 / PDF 출력
            </button>
          </div>
        </div>

        {/* Mobile View Tabs */}
        <div className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 text-xs font-medium">
          {[
            { id: 'sheet' as ActiveTab, label: '스토리보드 시트' },
            { id: 'presentation' as ActiveTab, label: '프레젠테이션 뷰' },
            { id: 'schedule' as ActiveTab, label: '촬영 관련 요약' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap shrink-0 pb-1 border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#1B2A4A] text-[#1B2A4A] font-semibold'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: Episode Management Bar (1회차, 2회차, ... + 새 회차 추가) */}
        <div className="border-t border-slate-100 bg-[#F8F9FA]">
          <div className="mx-auto flex max-w-[1640px] items-center gap-2.5 lg:gap-3 px-4 sm:px-5 lg:px-6 py-1.5 overflow-x-auto storyboard-scroll">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap shrink-0">
              회차별 보기
            </span>
            <div className="h-3.5 w-px bg-slate-300 shrink-0" aria-hidden="true" />

            <div className="flex items-center gap-1.5 shrink-0" role="tablist" aria-label="회차 선택">
              {project.episodes.map((ep, idx) => {
                const isActive = ep.id === activeEpisode?.id;
                const isEditing = editingEpisodeId === ep.id;
                const isDragged = draggedEpisodeId === ep.id;
                const isDragOver = dragOverEpisodeId === ep.id && draggedEpisodeId !== ep.id;
                const cutCount = ep.scenes.reduce((sum, sc) => sum + sc.shots.length, 0);

                return (
                  <div
                    key={ep.id}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      if (isEditing) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', ep.id);
                      setDraggedEpisodeId(ep.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedEpisodeId && draggedEpisodeId !== ep.id) {
                        setDragOverEpisodeId(ep.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverEpisodeId === ep.id) {
                        setDragOverEpisodeId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromId = draggedEpisodeId || e.dataTransfer.getData('text/plain');
                      if (fromId && fromId !== ep.id) {
                        const fromIdx = project.episodes.findIndex((item) => item.id === fromId);
                        if (fromIdx !== -1) {
                          handleMoveEpisode(fromIdx, idx);
                        }
                      }
                      setDraggedEpisodeId(null);
                      setDragOverEpisodeId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedEpisodeId(null);
                      setDragOverEpisodeId(null);
                    }}
                    className={`group/ep inline-flex items-center rounded-md border text-xs transition-all shrink-0 select-none ${
                      isActive
                        ? 'border-[#1B2A4A] bg-[#1B2A4A] text-white font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#1B2A4A]'
                    } ${isDragged ? 'opacity-45' : ''} ${
                      isDragOver ? 'ring-2 ring-[#1B2A4A] ring-offset-1' : ''
                    }`}
                  >
                    {isEditing ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1">
                        <input
                          type="text"
                          autoFocus
                          value={ep.name}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            setProject((prev) => ({
                              ...prev,
                              updatedAt: new Date().toISOString(),
                              episodes: prev.episodes.map((item) =>
                                item.id === ep.id ? { ...item, name: nextName } : item
                              ),
                            }));
                          }}
                          onBlur={() => {
                            if (!ep.name.trim()) {
                              setProject((prev) => ({
                                ...prev,
                                episodes: prev.episodes.map((item) =>
                                  item.id === ep.id ? { ...item, name: `${idx + 1}회차` } : item
                                ),
                              }));
                            }
                            setEditingEpisodeId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              e.currentTarget.blur();
                            }
                          }}
                          aria-label={`${idx + 1}회차 이름 수정`}
                          className={`w-24 rounded px-1.5 py-0.5 text-xs focus:outline-none ${
                            isActive
                              ? 'bg-white/15 text-white placeholder:text-slate-300'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        />
                        <span
                          className={`font-mono-tabular text-[11px] ${
                            isActive ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {cutCount}컷
                        </span>
                      </div>
                    ) : (
                      <div
                        role="tab"
                        tabIndex={0}
                        aria-selected={isActive}
                        title={
                          isActive
                            ? '클릭하여 이름 수정 · 드래그하여 순서 이동'
                            : '클릭하여 회차 전환 · 드래그하여 순서 이동'
                        }
                        onClick={() => {
                          if (isActive) {
                            setEditingEpisodeId(ep.id);
                          } else {
                            handleSelectEpisode(ep.id);
                          }
                        }}
                        onDoubleClick={() => {
                          handleSelectEpisode(ep.id);
                          setEditingEpisodeId(ep.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isActive) {
                              setEditingEpisodeId(ep.id);
                            } else {
                              handleSelectEpisode(ep.id);
                            }
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2A4A] rounded-l-md"
                      >
                        <span>{ep.name || `${idx + 1}회차`}</span>
                        <span
                          className={`font-mono-tabular text-[11px] ${
                            isActive ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {cutCount}컷
                        </span>
                      </div>
                    )}

                    {project.episodes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEpisode(ep.id);
                        }}
                        title={`${ep.name} 삭제`}
                        aria-label={`${ep.name} 삭제`}
                        className={`pr-2 py-1.5 transition-colors ${
                          isActive
                            ? 'text-slate-300 hover:text-white'
                            : 'text-slate-300 hover:text-red-600'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddEpisode}
              className="inline-flex items-center gap-1 rounded-md border border-[#1B2A4A] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              새 회차 추가
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="print-container mx-auto w-full max-w-[1640px] flex-1 px-3 sm:px-5 lg:px-6 py-4 space-y-3.5">
        {/* Print-Only Header */}
        <div className="hidden print-only mb-4 border-b-2 border-[#1B2A4A] pb-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold text-[#1B2A4A]">스토리보드 시트</div>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                {project.title || '무제 프로젝트'}{' '}
                {activeEpisode?.name ? `— ${activeEpisode.name}` : ''}
              </h1>
            </div>
            <div className="text-right text-xs text-slate-600 font-mono-tabular">
              <div>
                촬영일: {activeEpisode?.shootingDate || '-'} · 감독: {project.director || '-'} · 촬영:{' '}
                {project.cinematographer || '-'} · 화면비: {project.aspectRatio}
              </div>
              <div className="mt-0.5">
                총 {activeScenes.length}씬 · {episodeShots.length}컷 · 예상 러닝타임{' '}
                {formatDurationTimecode(episodeDuration)}
              </div>
            </div>
          </div>
        </div>

        {/* Project Metadata & Toolbar */}
        <section className="no-print rounded-xl border border-slate-200 bg-white px-4 lg:px-5 py-3 lg:py-3.5">
          <div className="space-y-2.5">
            {/* Row 1: 작품명, 회차, 촬영일(캘린더) + 우측 요약 지표 */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 lg:gap-4">
              <div className="flex flex-wrap items-center gap-x-3.5 xl:gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="project-title" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    작품명
                  </label>
                  <input
                    id="project-title"
                    type="text"
                    value={project.title}
                    onChange={(e) => updateProjectMeta({ title: e.target.value })}
                    placeholder="영화 / 드라마 제목"
                    className="w-40 sm:w-44 xl:w-60 rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1.5 text-sm font-semibold text-[#1B2A4A] focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="project-episode" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    회차
                  </label>
                  <input
                    id="project-episode"
                    type="text"
                    value={activeEpisode?.name || ''}
                    onChange={(e) =>
                      updateActiveEpisode((ep) => ({ ...ep, name: e.target.value }))
                    }
                    placeholder="예: 1회차"
                    className="w-24 sm:w-28 xl:w-36 rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="project-shooting-date" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    촬영일
                  </label>
                  <input
                    id="project-shooting-date"
                    type="date"
                    value={activeEpisode?.shootingDate || ''}
                    onChange={(e) =>
                      updateActiveEpisode((ep) => ({
                        ...ep,
                        shootingDate: e.target.value,
                      }))
                    }
                    className="rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1 text-xs font-mono-tabular font-medium text-slate-800 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Right: Clean Unboxed Tabular Totals */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono-tabular shrink-0">
                <span>씬 {activeScenes.length}개</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>총 {episodeShots.length}컷</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-semibold text-[#1B2A4A]">
                  러닝타임 {formatDurationTimecode(episodeDuration)}
                </span>
                <span aria-hidden="true" className="hidden xl:inline text-slate-300">·</span>
                <span className="hidden xl:inline text-slate-400">
                  {noticeMessage || '브라우저 자동 저장됨'}
                </span>
              </div>
            </div>

            {/* Row 2: 감독, 촬영, 화면비 */}
            <div className="flex flex-wrap items-center gap-x-4 xl:gap-x-5 gap-y-2 pt-0.5">
              <div className="flex items-center gap-2">
                <label htmlFor="project-director" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                  감독
                </label>
                <input
                  id="project-director"
                  type="text"
                  value={project.director}
                  onChange={(e) => updateProjectMeta({ director: e.target.value })}
                  placeholder="성명"
                  className="w-24 sm:w-28 rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1 text-xs text-slate-800 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="project-dop" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                  촬영
                </label>
                <input
                  id="project-dop"
                  type="text"
                  value={project.cinematographer}
                  onChange={(e) => updateProjectMeta({ cinematographer: e.target.value })}
                  placeholder="성명"
                  className="w-24 sm:w-28 rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1 text-xs text-slate-800 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="project-aspect" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                  화면비
                </label>
                <select
                  id="project-aspect"
                  value={project.aspectRatio}
                  onChange={(e) =>
                    updateProjectMeta({ aspectRatio: e.target.value as AspectRatio })
                  }
                  className="rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                >
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Workspace Action & Filter Toolbar */}
          {activeTab === 'sheet' && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
              {/* Left: Search & Scene Filter */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="씬, 내용, 샷, 앵글, 조명 검색..."
                    aria-label="스토리보드 검색"
                    className="w-full sm:w-56 lg:w-52 xl:w-64 rounded-lg border border-slate-200 bg-[#F8F9FA] pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                  />
                </div>

                <select
                  value={sceneIdFilter}
                  onChange={(e) => setSceneIdFilter(e.target.value)}
                  aria-label="씬 필터"
                  className="max-w-[200px] lg:max-w-[170px] xl:max-w-[220px] rounded-lg border border-slate-200 bg-[#F8F9FA] px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                >
                  <option value="ALL">
                    전체 씬 ({activeScenes.length}개 · {episodeShots.length}컷)
                  </option>
                  {activeScenes.map((sc, idx) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.epLabel ? `${sc.epLabel} · ` : ''}
                      {sc.sceneLabel || `씬 ${idx + 1}`}
                    </option>
                  ))}
                </select>

                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSceneIdFilter('ALL');
                    }}
                    className="text-xs font-medium text-[#1B2A4A] hover:underline whitespace-nowrap"
                  >
                    필터 해제
                  </button>
                )}
              </div>

              {/* Right: Google Docs, CSV Export & + 새 씬 추가 / + 새 컷 추가 */}
              <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setIsGoogleDocsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-[#1B2A4A]" />
                  Google Docs
                </button>

                <button
                  type="button"
                  onClick={() => setIsGoogleSheetsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#1B2A4A]" />
                  Google Sheets
                </button>

                <button
                  type="button"
                  onClick={() => exportStoryboardToCSV(project)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <TableProperties className="w-3.5 h-3.5 text-slate-500" />
                  CSV 내보내기
                </button>

                <button
                  type="button"
                  onClick={handleAddScene}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B2A4A] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-colors whitespace-nowrap"
                >
                  <Layers className="w-3.5 h-3.5" />
                  + 새 씬 추가
                </button>

                <button
                  type="button"
                  onClick={() => handleAddShotToScene()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B2A4A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#131E36] transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  새 컷 추가
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Active View Content */}
        {activeTab === 'sheet' && (
          <div className="space-y-6">
            {filteredScenes.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white py-16 px-6 text-center">
                <h3 className="text-base font-semibold text-slate-900">
                  검색 조건과 일치하는 씬 또는 컷이 없습니다
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  검색어나 씬 필터를 초기화하면 전체 내용을 다시 볼 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSceneIdFilter('ALL');
                  }}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              filteredScenes.map((scene) => {
                const sceneDuration = scene.shots.reduce(
                  (sum, s) => sum + (Number(s.duration) || 0),
                  0
                );

                return (
                  <div key={scene.id} className="space-y-2.5 print:break-inside-avoid-page">
                    {/* EP & #S Bar directly above each scene's StoryboardTable */}
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 print:rounded-none print:border-slate-300 print:px-3 print:py-2">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 flex-1 min-w-[260px]">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`ep-input-${scene.id}`}
                            className="font-mono-tabular text-xs font-bold tracking-tight text-[#1B2A4A] whitespace-nowrap"
                          >
                            EP
                          </label>
                          <input
                            id={`ep-input-${scene.id}`}
                            type="text"
                            value={scene.epLabel}
                            onChange={(e) =>
                              updateSceneMeta(scene.id, { epLabel: e.target.value })
                            }
                            aria-label="EP"
                            className="w-32 sm:w-36 rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-[#1B2A4A] focus:border-[#1B2A4A] focus:bg-white focus:outline-none print:border-transparent print:bg-transparent print:px-1"
                          />
                        </div>

                        <div className="hidden sm:block h-4 w-px bg-slate-200" aria-hidden="true" />

                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <label
                            htmlFor={`scene-input-${scene.id}`}
                            className="font-mono-tabular text-xs font-bold tracking-tight text-[#1B2A4A] whitespace-nowrap"
                          >
                            #S
                          </label>
                          <input
                            id={`scene-input-${scene.id}`}
                            type="text"
                            value={scene.sceneLabel}
                            onChange={(e) =>
                              updateSceneMeta(scene.id, { sceneLabel: e.target.value })
                            }
                            aria-label="#S"
                            className="w-full max-w-lg rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#1B2A4A] focus:bg-white focus:outline-none print:border-transparent print:bg-transparent print:px-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono-tabular text-xs text-slate-500">
                          {scene.shots.length}컷 · {formatDurationTimecode(sceneDuration)}
                        </span>

                        <div className="no-print flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddShotToScene(scene.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#1B2A4A] hover:bg-slate-50 transition-colors whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            이 씬에 컷 추가
                          </button>

                          {activeScenes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteScene(scene.id)}
                              title="이 씬 삭제"
                              aria-label="이 씬 삭제"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <StoryboardTable
                      shots={scene.shots}
                      totalCount={scene.shots.length}
                      aspectRatio={project.aspectRatio}
                      hasActiveFilter={hasActiveFilter}
                      onUpdateShot={(shotId, patch) =>
                        handleUpdateShot(scene.id, shotId, patch)
                      }
                      onDeleteShot={(shotId) => handleDeleteShot(scene.id, shotId)}
                      onDuplicateShot={(shotId) => handleDuplicateShot(scene.id, shotId)}
                      onMoveShot={(fromIdx, toIdx) =>
                        handleMoveShot(scene.id, fromIdx, toIdx)
                      }
                      onOpenEditor={(shot) =>
                        setEditingContext({ sceneId: scene.id, shotId: shot.id })
                      }
                      onAddShot={() => handleAddShotToScene(scene.id)}
                      onResetFilters={() => {
                        setSearchQuery('');
                        setSceneIdFilter('ALL');
                      }}
                    />
                  </div>
                );
              })
            )}

            <div ref={sceneEndRef} className="no-print flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleAddScene}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B2A4A] bg-white px-4 py-2 text-xs font-semibold text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" />
                + 새 씬 추가
              </button>
            </div>
          </div>
        )}

        {activeTab === 'presentation' && (
          <PresentationView
            shots={episodeShots}
            aspectRatio={project.aspectRatio}
            projectTitle={`${project.title || '무제 프로젝트'}${
              activeEpisode?.name ? ` · ${activeEpisode.name}` : ''
            }`}
            onSwitchToSheet={() => setActiveTab('sheet')}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleSummaryView
            scenes={activeScenes}
            onSelectScene={(sceneId) => {
              setSceneIdFilter(sceneId);
              setActiveTab('sheet');
            }}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="no-print border-t border-slate-200 bg-white py-3.5 px-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-2">
          <span>스토리보드 메이커 · 영화 및 드라마 프리프로덕션 시트</span>
          <span>11열 가로형 규격: 컷 / 촬영순서 / 촬영구도 / 촬영 내용 / 샷 / 앵글 / 화각 / 무브먼트 / 듀레이션 / 조명 / 비고</span>
        </div>
      </footer>

      {/* Sketch & Composition Editor Modal */}
      {editingShot && editingContext && (
        <FrameEditorModal
          isOpen={Boolean(editingShot)}
          shotOrder={editingShot.shotOrder}
          sceneNumber={editingShot.sceneNumber}
          initialImage={editingShot.frameImage}
          initialGuide={editingShot.guideOverlay}
          onClose={() => setEditingContext(null)}
          onSave={(imageDataUrl: string, guide: GuideOverlay) => {
            handleUpdateShot(editingContext.sceneId, editingContext.shotId, {
              frameImage: imageDataUrl,
              guideOverlay: guide,
            });
          }}
        />
      )}

      {/* Print & PDF Export Modal */}
      {activeEpisode && (
        <PrintExportModal
          isOpen={isPrintModalOpen}
          project={project}
          episode={activeEpisode}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* Google Docs Integration Modal */}
      {activeEpisode && (
        <GoogleDocsModal
          isOpen={isGoogleDocsModalOpen}
          project={project}
          episode={activeEpisode}
          onClose={() => setIsGoogleDocsModalOpen(false)}
          onImportScene={handleImportSceneFromDocs}
        />
      )}

      {/* Google Sheets Integration Modal */}
      {activeEpisode && (
        <GoogleSheetsModal
          isOpen={isGoogleSheetsModalOpen}
          project={project}
          episode={activeEpisode}
          onClose={() => setIsGoogleSheetsModalOpen(false)}
          onImportScenes={handleImportScenesFromSheets}
        />
      )}
    </div>
  );
}
