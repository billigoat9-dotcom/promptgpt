"use client";

import React, { useState } from 'react';
import { 
  Compass, Clock, Heart, Sparkles, ChevronDown, ChevronRight, 
  X 
} from 'lucide-react';
import { CATEGORIES, TAGS } from '@/lib/mockData';
import { NavSection } from '@/lib/types';

interface SidebarProps {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  activeCategories: string[];
  activeTags: string[];
  onToggleCategory: (cat: string) => void;
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  savedCount: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  activeSection,
  onSectionChange,
  activeCategories,
  activeTags,
  onToggleCategory,
  onToggleTag,
  onClearFilters,
  savedCount,
  isOpen,
  onClose,
}: SidebarProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);

  const navItems: { id: NavSection; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'discover', label: 'Discover', icon: <Compass size={18} /> },
    { id: 'studio', label: 'Studio', icon: <Sparkles size={18} /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={18} /> },
    { id: 'saved', label: 'Saved', icon: <Heart size={18} />, count: savedCount },
  ];

  const hasActiveFilters = activeCategories.length > 0 || activeTags.length > 0;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#020203] border-r border-white/10">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 h-16 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-semibold tracking-tighter text-xl text-white">PromptGpt</div>
            <div className="text-[10px] text-white/40 -mt-1">AI PROMPT GALLERY</div>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-2 text-white/60 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <div className="px-2 pt-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onSectionChange(item.id);
              if (window.innerWidth < 1024) onClose();
            }}
            className={`sidebar-link w-full justify-between ${activeSection === item.id ? 'active' : ''}`}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.label}</span>
            </div>
            {item.count !== undefined && item.count > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-mono">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters header */}
      <div className="mt-6 px-6 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-[1px] text-white/40">FILTERS</div>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-[11px] font-medium text-violet-400 hover:text-violet-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="mt-2 px-3">
        <div 
          className="expand-header" 
          onClick={() => setCategoriesOpen(!categoriesOpen)}
        >
          <span>CATEGORIES</span>
          {categoriesOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
        {categoriesOpen && (
          <div className="flex flex-wrap gap-1.5 px-2 pb-3 pt-1">
            {CATEGORIES.map((cat) => {
              const active = activeCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className={`category-chip text-xs ${active ? 'active' : ''}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="px-3">
        <div 
          className="expand-header" 
          onClick={() => setTagsOpen(!tagsOpen)}
        >
          <span>TAGS</span>
          {tagsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
        {tagsOpen && (
          <div className="flex flex-wrap gap-1.5 px-2 pb-4">
            {TAGS.slice(0, 14).map((tag) => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`tag-chip text-xs ${active ? 'active' : ''}`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Footer */}
      <div className="p-6 border-t border-white/10 text-[10px] uppercase tracking-[2px] text-white/50">
        made for you
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-[240px] shrink-0 h-screen sticky top-0 z-40">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 w-[260px] z-[51] shadow-2xl">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
