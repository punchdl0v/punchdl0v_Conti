import React, { useMemo } from 'react';
import { StoryboardScene } from '../types/storyboard';
import { formatDurationTimecode } from '../utils/exportUtils';

interface ScheduleSummaryViewProps {
  scenes: StoryboardScene[];
  onSelectScene: (sceneId: string) => void;
}

interface SceneAggregate {
  id: string;
  epLabel: string;
  sceneLabel: string;
  cutCount: number;
  totalDuration: number;
  lenses: string[];
  movements: string[];
  lightings: string[];
}

export const ScheduleSummaryView: React.FC<ScheduleSummaryViewProps> = ({
  scenes,
  onSelectScene,
}) => {
  const { sceneRows, totalShotsCount, uniqueLenses, uniqueMovements, uniqueLightings, totalDuration } =
    useMemo(() => {
      const allLenses = new Set<string>();
      const allMovements = new Set<string>();
      const allLightings = new Set<string>();
      let durationSum = 0;
      let shotsCount = 0;

      const rows: SceneAggregate[] = scenes.map((scene) => {
        const lenses: string[] = [];
        const movements: string[] = [];
        const lightings: string[] = [];
        let sceneDuration = 0;

        scene.shots.forEach((shot) => {
          shotsCount += 1;
          const dur = Number(shot.duration) || 0;
          sceneDuration += dur;
          durationSum += dur;

          const lens = shot.focalLength.trim();
          const move = shot.movement.trim();
          const light = shot.lighting.trim();

          if (lens) {
            allLenses.add(lens);
            if (!lenses.includes(lens)) lenses.push(lens);
          }
          if (move) {
            allMovements.add(move);
            if (!movements.includes(move)) movements.push(move);
          }
          if (light) {
            allLightings.add(light);
            if (!lightings.includes(light)) lightings.push(light);
          }
        });

        return {
          id: scene.id,
          epLabel: scene.epLabel.trim() || '-',
          sceneLabel: scene.sceneLabel.trim() || '제목 없는 씬',
          cutCount: scene.shots.length,
          totalDuration: sceneDuration,
          lenses,
          movements,
          lightings,
        };
      });

      return {
        sceneRows: rows,
        totalShotsCount: shotsCount,
        uniqueLenses: Array.from(allLenses),
        uniqueMovements: Array.from(allMovements),
        uniqueLightings: Array.from(allLightings),
        totalDuration: durationSum,
      };
    }, [scenes]);

  return (
    <div className="space-y-6">
      {/* Top 4-column Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">총 씬 수</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#1B2A4A]">
            {sceneRows.length}개 씬
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">총 컷 수</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {totalShotsCount}컷
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">예상 러닝타임</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {formatDurationTimecode(totalDuration)}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">필요 렌즈 화각</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {uniqueLenses.length}종
          </div>
        </div>
      </div>

      {/* Scene Breakdown Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">씬별 촬영 요약표</h2>
          <span className="text-xs text-slate-500">씬을 클릭하면 해당 씬만 시트에서 필터링합니다</span>
        </div>

        <div className="overflow-x-auto storyboard-scroll">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="bg-[#1B2A4A] text-white text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">EP</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">#S (씬)</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">컷 수</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">예상 시간</th>
                <th className="px-4 py-3 font-semibold">사용 화각</th>
                <th className="px-4 py-3 font-semibold">카메라 무브먼트</th>
                <th className="px-4 py-3 font-semibold">조명 세팅</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sceneRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    등록된 씬 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sceneRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {row.epLabel}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSelectScene(row.id)}
                        className="font-semibold text-[#1B2A4A] hover:underline text-left"
                      >
                        {row.sceneLabel}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-slate-900 whitespace-nowrap">
                      {row.cutCount}컷
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-slate-900 whitespace-nowrap">
                      {row.totalDuration.toFixed(1)}초 ({formatDurationTimecode(row.totalDuration)})
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-mono-tabular">
                      {row.lenses.join(' · ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {row.movements.join(' · ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {row.lightings.join(' · ') || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment & Lighting Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1B2A4A] pb-3 border-b border-slate-200">
            렌즈 · 화각 준비 리스트
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-700 font-mono-tabular">
            {uniqueLenses.length > 0 ? (
              uniqueLenses.map((lens) => <li key={lens}>{lens}</li>)
            ) : (
              <li className="text-slate-400">등록된 화각 없음</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1B2A4A] pb-3 border-b border-slate-200">
            그립 · 무브먼트 장비 요약
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {uniqueMovements.length > 0 ? (
              uniqueMovements.map((move) => <li key={move}>{move}</li>)
            ) : (
              <li className="text-slate-400">등록된 무브먼트 없음</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1B2A4A] pb-3 border-b border-slate-200">
            조명 세팅 체크리스트
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {uniqueLightings.length > 0 ? (
              uniqueLightings.map((light) => <li key={light}>{light}</li>)
            ) : (
              <li className="text-slate-400">등록된 조명 없음</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
