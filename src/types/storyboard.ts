export type AspectRatio = '16:9' | '2:1' | '2.39:1' | '1.85:1' | '4:3';

export type GuideOverlay = 'none' | 'thirds' | 'center' | 'cinemascope';

export interface StoryboardShot {
  id: string;
  sceneNumber: string; // 컷
  shotOrder: number; // 촬영순서
  frameImage: string; // 촬영구도 (URL or DataURL)
  guideOverlay: GuideOverlay; // 촬영구도 가이드선
  description: string; // 촬영 내용
  shotSize: string; // 샷 (ECU, CU, MS, WS 등)
  cameraAngle: string; // 앵글 (Eye Level, High Level, Low Level)
  focalLength: string; // 화각
  movement: string; // 무브먼트
  duration: number; // 듀레이션 (초)
  lighting: string; // 조명
  remarks: string; // 비고
}

export interface StoryboardScene {
  id: string;
  epLabel: string;
  sceneLabel: string;
  shots: StoryboardShot[];
}

export interface StoryboardEpisode {
  id: string;
  name: string; // 예: 1회차, 2회차
  shootingDate: string;
  scenes: StoryboardScene[];
}

export interface StoryboardProject {
  title: string;
  episode?: string;
  epLabel?: string;
  sceneLabel?: string;
  shootingDate?: string;
  director: string;
  cinematographer: string;
  aspectRatio: AspectRatio;
  updatedAt: string;
  episodes: StoryboardEpisode[];
  scenes?: StoryboardScene[];
  shots?: StoryboardShot[];
}

export const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: string; cssAspect: string }[] = [
  { value: '16:9', label: '16:9 (HD / 드라마 표준)', cssAspect: 'aspect-video' },
  { value: '2:1', label: '2:1 (유니비지움 / OTT)', cssAspect: 'aspect-[2/1]' },
  { value: '2.39:1', label: '2.39:1 (시네마스코프)', cssAspect: 'aspect-[2.39/1]' },
  { value: '1.85:1', label: '1.85:1 (아카데미 플랫)', cssAspect: 'aspect-[1.85/1]' },
  { value: '4:3', label: '4:3 (클래식 / 레트로)', cssAspect: 'aspect-[4/3]' },
];

export const SHOT_SIZE_PRESETS = [
  'EWS (익스트림 와이드)',
  'WS (와이드 샷)',
  'FS (풀 샷)',
  'MS (미디엄 샷)',
  'MCU (미디엄 클로즈업)',
  'CU (클로즈업)',
  'ECU (익스트림 클로즈업)',
  'Wide OTS (와이드 오버 더 숄더)',
  'Tight OTS (타이트 오버 더 숄더)',
  'POV (1인칭 시점)',
  '2-Shot (투샷)',
  '3-Shot (쓰리샷)',
  'Group Shot (그룹 샷)',
  'INS (인서트)',
];

export const CAMERA_ANGLE_PRESETS = [
  'Eye Level',
  'High Level',
  'Low Level',
  'Dutch Angle',
  "Bird's-eye view (Camera)",
  "Bird's-eye view(Drone)",
];

export const FOCAL_LENGTH_PRESETS = [
  'Fish-eye(어안)',
  '14mm',
  '18mm',
  '24mm',
  '35mm',
  '50mm',
  '75mm',
  '90mm Macro',
  '135mm',
  'Petzval 27mm',
  'Petzval 50mm',
  'Petzval 80mm',
  '7artisans Bokeh 37mm',
  '7artisans Bokeh 57mm',
];

export const MOVEMENT_PRESETS = [
  'FIX (고정)',
  '좌 팬',
  '우 팬',
  '틸 업',
  '틸 다운',
  'DOLLY IN (전진)',
  'DOLLY OUT (후진)',
  'HANDHELD (핸드헬드)',
  'Front Follow(프론트 팔로우)',
  'Back Follow(백 팔로우)',
  '트래킹',
  'CRANE UP',
  'CRANE DOWN',
  'Quick Pan(퀵 팬)',
  'ZOOM IN',
  'ZOOM OUT',
];

export const LIGHTING_PRESETS = [
  '자연광(주간)',
  '자연광(매직아워)',
  '야간 가로등',
  '하이키',
  '로우키',
  '역광 / 실루엣',
  '텅스텐 3200K',
  '데이라이트 5600K',
  '네온 / 색조명',
];
