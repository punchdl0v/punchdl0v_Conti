import React, { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  StoryboardEpisode,
  StoryboardProject,
  StoryboardScene,
} from '../types/storyboard';
import {
  clearCachedToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from '../services/googleDocsAuth';
import { DriveDocFile, isSafeHttpsUrl, WorkspaceAuthError } from '../services/googleDocsApi';
import {
  createStoryboardGoogleSheet,
  getSpreadsheetMetadata,
  listGoogleSheets,
  overwriteStoryboardGoogleSheet,
  parseSheetRowsToScenes,
  readSheetTabValues,
  SheetValuesPreview,
  SpreadsheetMetadata,
  trashGoogleSheet,
} from '../services/googleSheetsApi';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  project: StoryboardProject;
  episode: StoryboardEpisode;
  onClose: () => void;
  onImportScenes: (scenes: StoryboardScene[], sourceTitle: string) => void;
}

type ModalTab = 'export' | 'import';

type ConfirmState =
  | { type: 'overwrite'; doc: DriveDocFile; sheetTitle: string }
  | { type: 'trash'; doc: DriveDocFile }
  | null;

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  project,
  episode,
  onClose,
  onImportScenes,
}) => {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<ModalTab>('export');
  const [sheetsList, setSheetsList] = useState<DriveDocFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<DriveDocFile | null>(null);
  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [selectedTabTitle, setSelectedTabTitle] = useState<string>('');
  const [previewData, setPreviewData] = useState<SheetValuesPreview | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

  const [isMutating, setIsMutating] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    docUrl?: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, accessToken) => {
        setUser(authedUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAuthError = useCallback((err: unknown) => {
    if (err instanceof WorkspaceAuthError) {
      clearCachedToken();
      setToken(null);
      setNeedsAuth(true);
    }
    setStatusMessage({
      type: 'error',
      text: err instanceof Error ? err.message : 'Google Sheets 요청 중 오류가 발생했습니다.',
    });
  }, []);

  const fetchSheetsList = useCallback(
    async (query = searchQuery) => {
      const activeToken = token || (await getAccessToken());
      if (!activeToken) {
        setNeedsAuth(true);
        return;
      }

      setIsLoadingList(true);
      setStatusMessage(null);
      try {
        const files = await listGoogleSheets(activeToken, query);
        setSheetsList(files);
      } catch (err) {
        handleAuthError(err);
      } finally {
        setIsLoadingList(false);
      }
    },
    [handleAuthError, searchQuery, token]
  );

  useEffect(() => {
    if (isOpen && !needsAuth && token) {
      fetchSheetsList('');
    }
  }, [isOpen, needsAuth, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Google 로그인에 실패했습니다.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setSheetsList([]);
    setSelectedDoc(null);
    setMetadata(null);
    setSelectedTabTitle('');
    setPreviewData(null);
    setStatusMessage(null);
  };

  const loadSheetValues = async (
    spreadsheetId: string,
    tabTitle: string,
    mode: ModalTab
  ) => {
    if (mode !== 'import' || !tabTitle) return;
    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }
    setIsLoadingSheet(true);
    try {
      const values = await readSheetTabValues(activeToken, spreadsheetId, tabTitle);
      setPreviewData(values);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const handleSelectSpreadsheet = async (doc: DriveDocFile, targetMode = activeTab) => {
    setSelectedDoc(doc);
    setMetadata(null);
    setSelectedTabTitle('');
    setPreviewData(null);
    setStatusMessage(null);

    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }

    setIsLoadingSheet(true);
    try {
      const meta = await getSpreadsheetMetadata(activeToken, doc.id);
      setMetadata(meta);
      const firstTab = meta.sheets[0]?.title || '';
      setSelectedTabTitle(firstTab);

      if (targetMode === 'import' && firstTab) {
        const values = await readSheetTabValues(activeToken, doc.id, firstTab);
        setPreviewData(values);
      }
    } catch (err) {
      handleAuthError(err);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const handleCreateNewSheet = async () => {
    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }

    setIsMutating(true);
    setStatusMessage(null);
    try {
      const created = await createStoryboardGoogleSheet(activeToken, project, episode);
      setStatusMessage({
        type: 'success',
        text: `'${created.name}' Google Sheets 문서를 새로 생성했습니다.`,
        docUrl: isSafeHttpsUrl(created.webViewLink) ? created.webViewLink : undefined,
      });
      await fetchSheetsList(searchQuery);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmState) return;
    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      setConfirmState(null);
      setNeedsAuth(true);
      return;
    }

    setIsMutating(true);
    setStatusMessage(null);
    try {
      if (confirmState.type === 'overwrite') {
        const updated = await overwriteStoryboardGoogleSheet(
          activeToken,
          confirmState.doc.id,
          confirmState.sheetTitle,
          project,
          episode
        );
        setStatusMessage({
          type: 'success',
          text: `'${updated.name}'의 '${confirmState.sheetTitle}' 시트를 현재 회차 스토리보드로 업데이트했습니다.`,
          docUrl: isSafeHttpsUrl(updated.webViewLink) ? updated.webViewLink : undefined,
        });
      } else if (confirmState.type === 'trash') {
        await trashGoogleSheet(activeToken, confirmState.doc.id);
        if (selectedDoc?.id === confirmState.doc.id) {
          setSelectedDoc(null);
          setMetadata(null);
          setSelectedTabTitle('');
          setPreviewData(null);
        }
        setStatusMessage({
          type: 'success',
          text: `'${confirmState.doc.name}' 스프레드시트를 Google Drive 휴지통으로 이동했습니다.`,
        });
      }
      setConfirmState(null);
      await fetchSheetsList(searchQuery);
    } catch (err) {
      setConfirmState(null);
      handleAuthError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleImportSheet = () => {
    if (!previewData || previewData.rows.length === 0 || !selectedDoc) return;
    const parsedScenes = parseSheetRowsToScenes(
      previewData.rows,
      `${selectedDoc.name} · ${previewData.sheetTitle}`
    );
    if (parsedScenes.length === 0) return;
    onImportScenes(parsedScenes, `${selectedDoc.name} (${previewData.sheetTitle})`);
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Google Sheets 연동"
    >
      <div className="relative w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1B2A4A] px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-4 h-4 text-slate-200" />
            <h2 className="text-sm font-semibold tracking-tight">
              Google Sheets 연동 · {episode.name}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {!needsAuth && user && (
              <div className="flex items-center gap-2 text-xs text-slate-200">
                <span className="hidden sm:inline">{user.email || user.displayName}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 rounded border border-white/25 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  로그아웃
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {needsAuth ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center bg-[#F8F9FA]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#1B2A4A]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Google 계정으로 연결하기
            </h3>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
              스토리보드 11열 시트를 새 Google Sheets 파일로 내보내거나, 기존 Google Sheets의 샷 리스트를 불러와 씬과 컷으로 바로 변환할 수 있습니다.
            </p>

            {statusMessage?.type === 'error' && (
              <div className="mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {statusMessage.text}
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={handleLogin}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? '로그인 중...' : 'Sign in with Google'}
                  </span>
                  <span style={{ display: 'none' }}>Sign in with Google</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#F8F9FA] px-5 pt-2.5">
              <div className="flex items-center gap-6 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('export');
                    setStatusMessage(null);
                  }}
                  className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'export'
                      ? 'border-[#1B2A4A] text-[#1B2A4A]'
                      : 'border-transparent text-slate-500 hover:text-[#1B2A4A]'
                  }`}
                >
                  Google Sheets로 내보내기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('import');
                    setStatusMessage(null);
                    if (selectedDoc && selectedTabTitle) {
                      loadSheetValues(selectedDoc.id, selectedTabTitle, 'import');
                    }
                  }}
                  className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'import'
                      ? 'border-[#1B2A4A] text-[#1B2A4A]'
                      : 'border-transparent text-slate-500 hover:text-[#1B2A4A]'
                  }`}
                >
                  Google Sheets에서 불러오기
                </button>
              </div>
            </div>

            {/* Feedback Banner */}
            {statusMessage && (
              <div
                className={`mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
                  statusMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
                {statusMessage.docUrl && (
                  <a
                    href={statusMessage.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#1B2A4A] hover:underline whitespace-nowrap"
                  >
                    Google Sheets에서 열기
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 storyboard-scroll">
              {activeTab === 'export' && (
                <div className="rounded-xl border border-slate-200 bg-[#F8F9FA] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-[#1B2A4A]">
                      새 Google Sheets 스프레드시트로 저장
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600">
                      현재 회차({episode.name})의 모든 씬과 컷 항목(EP, #S, 컷, 촬영순서, 내용, 샷, 앵글, 화각, 무브먼트, 듀레이션, 조명, 비고)을 새 스프레드시트로 생성합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={handleCreateNewSheet}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B2A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#131E36] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isMutating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FilePlus2 className="w-3.5 h-3.5" />
                    )}
                    새 시트 만들기
                  </button>
                </div>
              )}

              {/* Search Drive Spreadsheets */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchSheetsList(searchQuery);
                      }
                    }}
                    placeholder="Google Sheets 파일 제목 검색..."
                    className="w-full rounded-lg border border-slate-200 bg-[#F8F9FA] pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={isLoadingList}
                  onClick={() => fetchSheetsList(searchQuery)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                  목록 조회
                </button>
              </div>

              {/* Two-Column Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Spreadsheets List */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                  <div className="border-b border-slate-200 bg-[#F8F9FA] px-3.5 py-2 text-xs font-semibold text-slate-700">
                    내 Google Sheets ({sheetsList.length}건)
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 storyboard-scroll">
                    {isLoadingList ? (
                      <div className="flex items-center justify-center py-10 text-xs text-slate-500 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#1B2A4A]" />
                        시트 목록 불러오는 중...
                      </div>
                    ) : sheetsList.length === 0 ? (
                      <div className="py-10 px-4 text-center text-xs text-slate-500">
                        표시할 Google Sheets 파일이 없습니다.
                      </div>
                    ) : (
                      sheetsList.map((doc) => {
                        const isSelected = selectedDoc?.id === doc.id;
                        const modifiedLabel = doc.modifiedTime
                          ? new Date(doc.modifiedTime).toLocaleDateString('ko-KR')
                          : '';
                        return (
                          <div
                            key={doc.id}
                            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 transition-colors ${
                              isSelected ? 'bg-[#1B2A4A]/5' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectSpreadsheet(doc)}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className="truncate text-xs font-medium text-slate-900">
                                {doc.name}
                              </div>
                              {modifiedLabel && (
                                <div className="mt-0.5 font-mono-tabular text-[11px] text-slate-400">
                                  수정일: {modifiedLabel}
                                </div>
                              )}
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              {isSafeHttpsUrl(doc.webViewLink) && (
                                <a
                                  href={doc.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="새 탭에서 열기"
                                  aria-label={`${doc.name} 열기`}
                                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1B2A4A]"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmState({ type: 'trash', doc })}
                                title="휴지통으로 이동"
                                aria-label={`${doc.name} 삭제`}
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Pane: Tab Selection & Export/Import */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                  <div className="border-b border-slate-200 bg-[#F8F9FA] px-3.5 py-2 text-xs font-semibold text-slate-700">
                    {activeTab === 'export' ? '시트 탭 선택 및 덮어쓰기' : '시트 탭 선택 및 미리보기'}
                  </div>

                  {!selectedDoc ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center text-xs text-slate-500 gap-2">
                      <FolderOpen className="w-5 h-5 text-slate-400" />
                      <span>
                        {activeTab === 'export'
                          ? '업데이트할 스프레드시트를 왼쪽 목록에서 선택하세요.'
                          : '불러올 스프레드시트를 왼쪽 목록에서 선택하세요.'}
                      </span>
                    </div>
                  ) : isLoadingSheet ? (
                    <div className="flex-1 flex items-center justify-center py-10 text-xs text-slate-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#1B2A4A]" />
                      시트 정보 불러오는 중...
                    </div>
                  ) : (
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {metadata?.title || selectedDoc.name}
                          </div>
                          {metadata && metadata.sheets.length > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <label
                                htmlFor="sheets-tab-select"
                                className="text-xs font-medium text-slate-500 whitespace-nowrap"
                              >
                                대상 시트 탭
                              </label>
                              <select
                                id="sheets-tab-select"
                                value={selectedTabTitle}
                                onChange={(e) => {
                                  const nextTab = e.target.value;
                                  setSelectedTabTitle(nextTab);
                                  loadSheetValues(selectedDoc.id, nextTab, activeTab);
                                }}
                                className="flex-1 rounded-md border border-slate-200 bg-[#F8F9FA] px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#1B2A4A] focus:bg-white focus:outline-none"
                              >
                                {metadata.sheets.map((tab) => (
                                  <option key={tab.sheetId} value={tab.title}>
                                    {tab.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {activeTab === 'export' ? (
                          <p className="text-xs leading-relaxed text-slate-600">
                            선택한 <strong>{selectedTabTitle || '시트'}</strong> 탭의 기존 셀 데이터를 비우고 현재 회차({episode.name}) 스토리보드로 업데이트합니다. 실행 전 확인 창에서 다시 확인합니다.
                          </p>
                        ) : previewData ? (
                          <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 bg-[#F8F9FA] storyboard-scroll">
                            {previewData.rows.length > 0 ? (
                              <table className="w-full border-collapse text-[11px] text-left">
                                <tbody className="divide-y divide-slate-200">
                                  {previewData.rows.slice(0, 15).map((row, rIdx) => (
                                    <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-200/70 font-semibold' : ''}>
                                      {row.slice(0, 8).map((cell, cIdx) => (
                                        <td
                                          key={cIdx}
                                          className="border-r border-slate-200 px-2 py-1 whitespace-nowrap max-w-[140px] truncate"
                                        >
                                          {cell || '-'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="p-4 text-center text-xs text-slate-400">
                                선택한 시트 탭에 데이터가 없습니다.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {activeTab === 'export' ? (
                        <button
                          type="button"
                          disabled={isMutating || !selectedTabTitle}
                          onClick={() =>
                            setConfirmState({
                              type: 'overwrite',
                              doc: selectedDoc,
                              sheetTitle: selectedTabTitle,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1B2A4A] bg-white px-4 py-2 text-xs font-semibold text-[#1B2A4A] hover:bg-[#1B2A4A]/5 disabled:opacity-50 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          선택한 시트 탭에 덮어쓰기
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!previewData || previewData.rows.length === 0}
                          onClick={handleImportSheet}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1B2A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#131E36] disabled:opacity-50 transition-colors"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                          시트 데이터로 씬 & 컷 가져오기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        {/* Explicit Confirmation Dialog */}
        {confirmState && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 p-4"
            role="alertdialog"
            aria-modal="true"
            aria-label="작업 확인"
          >
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 rounded-lg p-2 ${
                    confirmState.type === 'trash'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {confirmState.type === 'overwrite'
                      ? '기존 Google Sheets 탭 덮어쓰기'
                      : 'Google Sheets 파일 삭제 확인'}
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {confirmState.type === 'overwrite'
                      ? `'${confirmState.doc.name}' 스프레드시트의 '${confirmState.sheetTitle}' 탭 데이터를 비우고 현재 '${episode.name}' 스토리보드 내용으로 덮어쓸까요?`
                      : `'${confirmState.doc.name}' 스프레드시트를 Google Drive 휴지통으로 이동할까요?`}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setConfirmState(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={executeConfirmedAction}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition-colors ${
                    confirmState.type === 'trash'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#1B2A4A] hover:bg-[#131E36]'
                  }`}
                >
                  {isMutating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {confirmState.type === 'overwrite' ? '덮어쓰기 확인' : '휴지통으로 이동'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
