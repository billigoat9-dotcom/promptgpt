"use client";

import React from 'react';
import { Search, X } from 'lucide-react';
import { Model } from '@/lib/types';

interface TopBarProps {
  activeModel: string;
  onModelChange: (model: string) => void;
  activeSort: 'trending' | 'latest' | 'most-viewed';
  onSortChange: (sort: 'trending' | 'latest' | 'most-viewed') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const MODEL_TABS = ['All', 'FluxArt', 'VideoGen', 'GPT Image', 'Midjourney'] as const;

const SORT_OPTIONS: { id: 'trending' | 'latest' | 'most-viewed'; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'latest', label: 'Latest' },
  { id: 'most-viewed', label: 'Most Viewed' },
];

export default function TopBar({
  activeModel,
  onModelChange,
  activeSort,
  onSortChange,
  searchQuery,
  onSearchChange,
}: TopBarProps) {
  return (
    <div className="sticky top-0 z-30 bg-[var(--bg-elevated)] backdrop-blur-xl border-b border-[var(--border)]">
      <div className="flex flex-col gap-3 px-4 sm:px-6 py-3.5">
        {/* Model Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 hide-scrollbar">
          {MODEL_TABS.map((model) => {
            const isActive = activeModel === model;
            const isVideoGen = model === 'VideoGen';
            return (
              <button
                key={model}
                onClick={() => onModelChange(model)}
                className={`filter-tab flex-shrink-0 ${isActive ? 'active' : ''}`}
              >
                {model}
                {isVideoGen && <span className="new-badge">NEW</span>}
              </button>
            );
          })}
        </div>

        {/* Search + Sort Row */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search prompts, creators, or tags..."
              className="TopBar-search w-full bg-[#0a0a0f] border border-white/10 rounded-2xl pl-11 pr-10 py-2.5 text-sm placeholder:text-white/40 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Sort Tabs */}
          <div className="hidden sm:flex items-center bg-[#0a0a0f] border border-white/10 rounded-2xl p-1 sort-container">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => onSortChange(option.id)}
                className={`sort-tab ${activeSort === option.id ? 'active' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Mobile sort select */}
          <div className="sm:hidden relative">
            <select
              value={activeSort}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="bg-[#0a0a0f] border border-white/10 rounded-2xl text-sm py-2 px-3 appearance-none pr-8 focus:outline-none focus:border-violet-500"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
