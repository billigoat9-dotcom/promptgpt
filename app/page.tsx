"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import PromptCard from '@/components/PromptCard';
import DetailModal from '@/components/DetailModal';
import MobileBottomNav from '@/components/MobileBottomNav';

import { Prompt, NavSection, SortMode } from '@/lib/types';
import { filterPrompts, sortPrompts, copyToClipboard } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';

export default function PromptGpt() {
  // Core data
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());


  // Filters & UI state
  const [activeSection, setActiveSection] = useState<NavSection>('discover');
  const [activeModel, setActiveModel] = useState<string>('All');
  const [activeSort, setActiveSort] = useState<SortMode>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Modal
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  // Mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Three-dot menu state
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  // Fetch prompts dynamically + check admin session
  useEffect(() => {
    async function loadData() {
      try {
        // Strong bust for the data API (the server itself will also bust Cloudinary)
        const promptsRes = await fetch('/api/prompts?ts=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (promptsRes.ok) {
          const data = await promptsRes.json();
          setPrompts(data);
        }
      } catch (err) {
        console.error('Failed to load data', err);
      } finally {
        setIsLoadingPrompts(false);
      }
    }

    loadData();

    // Persist saved
    const saved = localStorage.getItem('promptgpt_saved');
    if (saved) {
      setSavedIds(new Set(JSON.parse(saved)));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('promptgpt_saved', JSON.stringify(Array.from(savedIds)));
  }, [savedIds]);

  // Derived filtered + sorted list
  const filteredPrompts = useMemo(() => {
    let result = [...prompts];

    // Apply base filters
    result = filterPrompts(result, activeModel, searchQuery, activeCategories, activeTags, activeSection);

    // View mode specific filters
    if (activeSection === 'saved') {
      result = result.filter(p => savedIds.has(p.id));
    } else if (activeSection === 'studio') {
      // Show only user-generated in this session + any explicitly saved
      result = result.filter(p => generatedIds.has(p.id) || savedIds.has(p.id));
    }

    // Sort
    result = sortPrompts(result, activeSort);

    return result;
  }, [prompts, activeModel, searchQuery, activeCategories, activeTags, activeSection, activeSort, savedIds, generatedIds]);

  // Handlers
  const toggleCategory = (cat: string) => {
    setActiveCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleTag = (tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setActiveCategories([]);
    setActiveTags([]);
    setSearchQuery('');
    setActiveModel('All');
  };

  const handleSectionChange = (section: NavSection) => {
    setActiveSection(section);
    setSidebarOpen(false);

    // Smart presets per section
    if (section === 'timeline') {
      setActiveSort('latest');
    } else if (section === 'discover') {
      setActiveSort('trending');
    } else if (section === 'saved') {
      // Keep current sort but filter is handled in useMemo
    }
  };

  const handleModelChange = (model: string) => {
    setActiveModel(model);
    // Auto-switch to discover when filtering
    if (activeSection === 'saved' || activeSection === 'studio') {
      setActiveSection('discover');
    }
  };

  const toggleSave = (id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info('Removed from Saved');
      } else {
        next.add(id);
        toast.success('Saved to your collection');
      }
      return next;
    });
  };

  const handleLike = (id: string) => {
    setPrompts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, likes: p.likes + 1 } : p
      )
    );
  };

  const openDetail = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    // Increment views optimistically
    setPrompts(prev =>
      prev.map(p =>
        p.id === prompt.id ? { ...p, views: p.views + 1 } : p
      )
    );
  };

  const closeDetail = () => setSelectedPrompt(null);

  const handleCopyPrompt = async (prompt: Prompt, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const success = await copyToClipboard(prompt.fullPrompt);
    if (success) {
      toast.success('Prompt copied');
    } else {
      toast.error('Copy failed');
    }
  };

  const handleRemix = (prompt: Prompt) => {
    closeDetail();
    // For now, just copy the full prompt to clipboard as a nice UX
    copyToClipboard(prompt.fullPrompt).then(() => {
      toast.success('Prompt copied — ready to use in any generator!');
    });
  };

  // No generate functionality in main UI anymore — moved to disabled three-dot menu
  const handleGenerate = (_newPrompt: Prompt) => {
    // Disabled for now
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedPrompt) closeDetail();
        else if (sidebarOpen) setSidebarOpen(false);
        else if (menuOpen) setMenuOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const search = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        search?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedPrompt, sidebarOpen, menuOpen]);

  const savedCount = savedIds.size;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] transition-colors">
      {/* Sidebar (fixed on desktop, drawer on mobile) */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        activeCategories={activeCategories}
        activeTags={activeTags}
        onToggleCategory={toggleCategory}
        onToggleTag={toggleTag}
        onClearFilters={clearFilters}
        savedCount={savedCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top header bar (mobile) - Minimal MeiGen style */}
        <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-[var(--border)] bg-[var(--bg-elevated)] backdrop-blur-3xl z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-[var(--text-secondary)] active:text-[var(--text-primary)]">
            <Menu size={21} />
          </button>
          <div className="font-semibold tracking-[-0.5px] text-[16.5px]">PromptGpt</div>
          <div className="flex items-center gap-2">
            {/* Three-dot menu */}
            <button
              onClick={toggleMenu}
              className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass)] transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal size={19} />
            </button>
          </div>
        </div>

        {/* Top Filters */}
        <TopBar
          activeModel={activeModel}
          onModelChange={handleModelChange}
          activeSort={activeSort}
          onSortChange={setActiveSort}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Gallery Area + Right Panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Gallery - Tight MeiGen masonry (2 columns on mobile) */}
          <div className="flex-1 overflow-y-auto px-2 sm:px-4 pt-2 pb-24 lg:pb-8 overscroll-contain bg-[var(--bg)]">
            {/* Results header - Clean MeiGen aesthetic */}
            <div className="flex items-baseline justify-between mb-3.5 relative">
              <div>
                <div className="text-[9.5px] uppercase tracking-[3px] text-white/40 font-medium">
                  {activeSection === 'saved' ? 'YOUR COLLECTION' : 
                   activeSection === 'studio' ? 'YOUR CREATIONS' : 
                   activeSection === 'timeline' ? 'LATEST PROMPTS' : 'DISCOVER'}
                </div>
                <div className="text-[18px] sm:text-[19.5px] font-semibold tracking-[-0.6px] mt-1 text-white/90 leading-none">
                  Scroll and get your favorite prompt
                </div>
              </div>

              {/* Admin Link removed from public homepage as requested.
                  Admin panel is only accessible via direct /admin URL. */}


              {/* Three-dot menu (Generate moved here, disabled) */}
              <div className="relative">
                <button
                  onClick={toggleMenu}
                  className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  aria-label="More options"
                >
                  <MoreHorizontal size={19} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#0f0f14] border border-white/10 shadow-xl py-1 z-50 text-sm text-white">
                    <div className="px-4 py-2 text-white/60 text-xs tracking-widest">MORE</div>
                    <div className="px-4 py-2 hover:bg-white/5 cursor-pointer text-white">Settings</div>
                    <div className="px-4 py-2 hover:bg-white/5 cursor-pointer text-white">Help &amp; Feedback</div>
                    <div className="h-px bg-white/10 my-1" />
                    
                    {/* Generate option - disabled as requested */}
                    <div 
                      className="px-4 py-2 text-white/40 cursor-not-allowed flex items-center justify-between"
                      title="Coming soon"
                    >
                      Generate New Prompt
                      <span className="text-[10px] px-1.5 py-px bg-white/10 rounded">Soon</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Masonry Gallery */}
            {isLoadingPrompts ? (
              /* MeiGen-style Minimal Skeletons */
              <div className="masonry-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-image" />
                    <div className="skeleton-text long" />
                    <div className="skeleton-text short" />
                  </div>
                ))}
              </div>
            ) : filteredPrompts.length > 0 ? (
              <div className="masonry-grid">
                <AnimatePresence>
                  {filteredPrompts.map((prompt, index) => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      isSaved={savedIds.has(prompt.id)}
                      onClick={() => openDetail(prompt)}
                      onCopy={(e) => handleCopyPrompt(prompt, e)}
                      onToggleSave={(e) => {
                        e.stopPropagation();
                        toggleSave(prompt.id);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <X size={32} className="text-white/40" />
                </div>
                <div className="text-xl font-semibold text-white">No prompts found</div>
                <p className="text-white/50 mt-1 max-w-xs">Try adjusting your filters or search terms.</p>
                <button onClick={clearFilters} className="mt-6 btn-ghost">Clear all filters</button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        savedCount={savedCount}
      />

      {/* Detail Modal */}
      <DetailModal
        prompt={selectedPrompt}
        isSaved={selectedPrompt ? savedIds.has(selectedPrompt.id) : false}
        onClose={closeDetail}
        onToggleSave={() => selectedPrompt && toggleSave(selectedPrompt.id)}
        onRemix={handleRemix}
        onLike={() => selectedPrompt && handleLike(selectedPrompt.id)}
      />
    </div>
  );
}
