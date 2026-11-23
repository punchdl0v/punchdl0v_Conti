import React from 'react';
import { GuideOverlay } from '../types/storyboard';

interface FrameGuideOverlayProps {
  guide: GuideOverlay;
}

export const FrameGuideOverlay: React.FC<FrameGuideOverlayProps> = ({ guide }) => {
  if (guide === 'none') return null;

  if (guide === 'thirds') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/60 shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/60 shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/60 shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/60 shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
      </div>
    );
  }

  if (guide === 'center') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/55 shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/55 shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 border border-white/75 rounded-full" />
      </div>
    );
  }

  if (guide === 'cinemascope') {
    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        <div className="h-[13%] w-full bg-[#0F172A]/85" />
        <div className="h-[13%] w-full bg-[#0F172A]/85" />
      </div>
    );
  }

  return null;
};
