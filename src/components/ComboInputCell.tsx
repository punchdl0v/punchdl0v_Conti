import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface ComboInputCellProps {
  value: string;
  onChange: (value: string) => void;
  presets: string[];
  placeholder: string;
  ariaLabel: string;
  mono?: boolean;
}

export const ComboInputCell: React.FC<ComboInputCellProps> = ({
  value,
  onChange,
  presets,
  placeholder,
  ariaLabel,
  mono = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 180,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const estimatedMenuHeight = Math.min(presets.length * 34 + 12, 196);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight
        ? rect.top - estimatedMenuHeight - 4
        : rect.bottom + 4;

    const width = Math.max(rect.width, 224);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);

    setMenuPos({ top, left, width });
  }, [presets.length]);

  const toggleMenu = () => {
    if (!isOpen) {
      updateMenuPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleScroll = (e: Event) => {
      // Allow scrolling inside the dropdown menu itself (both scrollbar drag and mouse wheel)
      const target = e.target;
      if (menuRef.current && target instanceof Node && menuRef.current.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleResize = () => setIsOpen(false);

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center w-full rounded-md border border-transparent hover:border-slate-200 focus-within:border-[#1B2A4A] focus-within:bg-white transition-colors">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !isOpen) {
              e.preventDefault();
              updateMenuPosition();
              setIsOpen(true);
            } else if (e.key === 'Escape' && isOpen) {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`w-full bg-transparent px-2 py-1.5 text-[12.5px] leading-snug text-slate-800 placeholder:text-slate-400 focus:outline-none ${
            mono ? 'font-mono-tabular' : ''
          }`}
        />
        <button
          type="button"
          onClick={toggleMenu}
          title={`${ariaLabel} 목록 열기`}
          aria-label={`${ariaLabel} 프리셋 목록 열기`}
          aria-expanded={isOpen}
          className="no-print shrink-0 p-2 xl:p-1.5 text-slate-400 hover:text-[#1B2A4A] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1B2A4A] rounded"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-[#1B2A4A]' : ''}`} />
        </button>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={`${ariaLabel} 선택 목록`}
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            onWheel={(e) => {
              // Ensure wheel scroll operates inside the menu without closing or propagating unexpectedly
              e.stopPropagation();
            }}
            className="storyboard-scroll touch-pan-y fixed z-[9999] max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
          >
            {presets.map((preset) => {
              const selected = value === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(preset);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 lg:py-2 text-xs transition-colors whitespace-nowrap truncate block cursor-pointer ${
                    selected
                      ? 'bg-[#1B2A4A] text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
