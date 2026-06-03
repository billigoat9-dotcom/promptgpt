"use client";

import React from 'react';
import { Compass, Clock, Heart, Sparkles } from 'lucide-react';
import { NavSection } from '@/lib/types';
import { motion } from 'framer-motion';

interface MobileBottomNavProps {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  savedCount: number;
}

export default function MobileBottomNav({
  activeSection,
  onSectionChange,
  savedCount,
}: MobileBottomNavProps) {
  const items: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'discover', label: 'Discover', icon: <Compass size={22} /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={22} /> },
    { id: 'saved', label: 'Saved', icon: <Heart size={22} /> },
    { id: 'studio', label: 'Studio', icon: <Sparkles size={22} /> },
  ];

  return (
    <div className="mobile-only fixed bottom-0 left-0 right-0 z-50 bottom-nav bg-[#171717]">
      <div className="flex items-center justify-around px-2 pt-1">
        {items.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`bottom-nav-item relative flex-1 ${active ? 'active' : ''}`}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="relative">
                  {item.icon}
                  {/* Subtle purple glow ring when active */}
                  {active && (
                    <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-md -z-10 scale-125" />
                  )}
                </div>
                <span className={`transition-all ${active ? 'font-semibold tracking-[-0.1px]' : 'font-medium'}`}>
                  {item.label}
                </span>
              </motion.div>

              {/* Saved count badge - premium style */}
              {item.id === 'saved' && savedCount > 0 && (
                <div className="absolute -top-0.5 right-[18%] min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-violet-500 text-white text-[9px] font-mono font-medium tabular-nums shadow-[0_0_6px_rgba(167,139,250,0.5)]">
                  {savedCount > 9 ? '9+' : savedCount}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
