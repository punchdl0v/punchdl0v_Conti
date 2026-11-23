import {
  StoryboardEpisode,
  StoryboardProject,
  StoryboardScene,
  StoryboardShot,
} from '../types/storyboard';

export const SAMPLE_PROJECT: StoryboardProject = {
  title: '새벽 두 시의 교차로',
  director: '김서진',
  cinematographer: '이도현',
  aspectRatio: '16:9',
  updatedAt: new Date().toISOString(),
  episodes: [
    {
      id: 'ep-sample-1',
      name: '1회차',
      shootingDate: '2026-11-24',
      scenes: [
        {
          id: 'scene-sample-1',
          epLabel: '',
          sceneLabel: '',
          shots: [
            {
              id: 'shot-sample-1',
              sceneNumber: '1',
              shotOrder: 1,
              frameImage: '/src/assets/images/storyboard_shot_ws_1795414043083.jpg',
              guideOverlay: 'none',
              description:
                '빗속 야간 골목. 검은 우산을 쓴 서진이 편의점 불빛 아래 홀로 걸어와 멈춰 선다. 젖은 아스팔트에 간판 불빛이 번진다.',
              shotSize: 'EWS (익스트림 와이드)',
              cameraAngle: 'Eye Level',
              focalLength: '24mm',
              movement: 'CRANE DOWN',
              duration: 6.0,
              lighting: '야간 가로등',
              remarks: '살수차 1대 대기, 노면 젖음 유지, 우산 빗소리 동시녹음',
            },
          ],
        },
        {
          id: 'scene-sample-2',
          epLabel: '',
          sceneLabel: '',
          shots: [
            {
              id: 'shot-sample-2',
              sceneNumber: '1',
              shotOrder: 1,
              frameImage: '/src/assets/images/storyboard_shot_ots_1795414043349.jpg',
              guideOverlay: 'none',
              description:
                '심야 카페 창가. 서진의 어깨 너머로, 따뜻한 머그잔을 두 손으로 감싸 쥔 채 불안한 눈빛으로 시선을 피하는 수아.',
              shotSize: 'Wide OTS (와이드 오버 더 숄더)',
              cameraAngle: 'Eye Level',
              focalLength: '50mm',
              movement: 'DOLLY IN (전진)',
              duration: 5.5,
              lighting: '텅스텐 3200K',
              remarks: '창문 외부 빗물 분사 장치, 서진→수아 랙 포커스',
            },
            {
              id: 'shot-sample-3',
              sceneNumber: '2',
              shotOrder: 2,
              frameImage: '/src/assets/images/storyboard_shot_cu_1795414043636.jpg',
              guideOverlay: 'none',
              description:
                '"정말 그날 밤 아무도 못 봤어?" 낮게 가라앉은 목소리로 묻는 서진. 흔들림 없는 시선이 화면 좌측을 향한다.',
              shotSize: 'CU (클로즈업)',
              cameraAngle: 'Low Level',
              focalLength: '75mm',
              movement: 'FIX (고정)',
              duration: 4.0,
              lighting: '로우키',
              remarks: '우측 턱선 림라이트 강조, 대사 직후 1초 호흡 유지',
            },
            {
              id: 'shot-sample-4',
              sceneNumber: '3',
              shotOrder: 3,
              frameImage: '/src/assets/images/storyboard_shot_ecu_1795414044547.jpg',
              guideOverlay: 'none',
              description:
                '서진의 손이 접힌 편지와 오래된 황동 열쇠를 나무 테이블 위에 조용히 내려놓는다.',
              shotSize: 'ECU (익스트림 클로즈업)',
              cameraAngle: 'High Level',
              focalLength: '90mm Macro',
              movement: '틸 다운',
              duration: 3.5,
              lighting: '역광 / 실루엣',
              remarks: '소품팀 황동 열쇠·편지지 여분 3세트, 마찰음 SFX 체크',
            },
          ],
        },
      ],
    },
  ],
};

export function createEmptyShot(nextOrder: number, sceneNumber?: string): StoryboardShot {
  return {
    id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sceneNumber: sceneNumber ?? String(nextOrder),
    shotOrder: nextOrder,
    frameImage: '',
    guideOverlay: 'none',
    description: '',
    shotSize: 'MS (미디엄 샷)',
    cameraAngle: 'Eye Level',
    focalLength: '35mm',
    movement: 'FIX (고정)',
    duration: 4.0,
    lighting: '자연광(주간)',
    remarks: '',
  };
}

export function createEmptyScene(_sceneIndex = 1, epLabel = ''): StoryboardScene {
  return {
    id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    epLabel,
    sceneLabel: '',
    shots: [createEmptyShot(1, '1')],
  };
}

export function createEmptyEpisode(episodeIndex: number): StoryboardEpisode {
  return {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${episodeIndex}회차`,
    shootingDate: '',
    scenes: [createEmptyScene(1, '')],
  };
}
