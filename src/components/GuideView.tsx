import React from 'react';

export const GuideView: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-[#1B2A4A] pb-3 border-b border-slate-200">
          샷 사이즈 &amp; 앵글 표준 약어
        </h2>
        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          {[
            ['EWS / ELS', '익스트림 와이드 샷 — 배경과 공간의 규모, 분위기를 제시하는 오프닝 설정 샷'],
            ['WS / LS', '와이드 샷 — 인물의 전신과 주변 환경·동선을 함께 담는 구도'],
            ['FS', '풀 샷 — 머리부터 발끝까지 인물의 전신을 프레임에 채우는 구도'],
            ['MS', '미디엄 샷 — 허리 위 상반신 중심, 대화와 자연스러운 제스처 전달'],
            ['CU / ECU', '클로즈업 / 익스트림 클로즈업 — 미세한 표정 변화, 눈빛, 중요 소품 강조'],
            ['OTS', '오버 더 숄더 — 앞 인물의 어깨 너머로 상대방을 바라보는 대화 시점 구도'],
            ['로우 / 하이 / 더치', '인물의 위압감(로우), 고립·조감(하이), 심리적 불안·긴장(더치 앵글)'],
          ].map(([term, desc]) => (
            <div key={term} className="py-3 grid grid-cols-[120px_1fr] gap-3">
              <dt className="font-mono-tabular font-semibold text-[#1B2A4A]">{term}</dt>
              <dd className="text-slate-600 leading-relaxed">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-[#1B2A4A] pb-3 border-b border-slate-200">
            카메라 무브먼트 &amp; 화각 선택 기준
          </h2>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            {[
              ['14mm ~ 24mm', '넓은 시야와 원근감 과장, 공간감 및 역동적 동선 강조'],
              ['35mm ~ 50mm', '인간의 시야와 가장 유사한 자연스러운 왜곡, 드라마 대화 표준 화각'],
              ['85mm ~ 135mm', '얕은 심도와 배경 압축 효과, 인물 클로즈업 및 감정 집중'],
              ['FIX / PAN / TILT', '삼각대 고정(FIX), 수평 회전(PAN), 수직 회전(TILT)'],
              ['DOLLY / TRACKING', '레일·지미집을 이용한 전진·후진(DOLLY) 및 피사체 동행(TRACKING)'],
            ].map(([term, desc]) => (
              <div key={term} className="py-3 grid grid-cols-[130px_1fr] gap-3">
                <dt className="font-mono-tabular font-semibold text-[#1B2A4A]">{term}</dt>
                <dd className="text-slate-600 leading-relaxed">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">작업 단축키 및 팁</h3>
          <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
            <li>• 촬영구도 썸네일을 클릭하면 내장 스케치 패드가 열리며, 동선 화살표·구도 스탬프를 바로 그릴 수 있습니다.</li>
            <li>• 탐색기에서 촬영구도 칸으로 이미지 파일을 드래그 앤 드롭하면 즉시 컷 이미지로 등록됩니다.</li>
            <li>• 프레젠테이션 뷰에서는 좌·우 방향키(← / →)로 컷을 이동하고 스페이스바로 애니매틱을 재생합니다.</li>
            <li>• 상단 ‘인쇄 / PDF 출력’을 누르면 A4 가로(Landscape) 1열 스토리보드 규격에 맞춰 출력됩니다.</li>
          </ul>
        </div>
      </section>
    </div>
  );
};
