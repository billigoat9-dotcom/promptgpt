"use client";

import React from 'react';
import { Prompt } from '@/lib/types';
import { motion } from 'framer-motion';

interface PromptCardProps {
  prompt: Prompt;
  isSaved: boolean;
  onClick: () => void;
  onCopy: (e: React.MouseEvent) => void;
  onToggleSave: (e: React.MouseEvent) => void;
}

export default function PromptCard({
  prompt,
  isSaved,
  onClick,
  onCopy,
  onToggleSave,
}: PromptCardProps) {
  const modelClass = prompt.model.replace(/\s/g, '-');

  return (
    <motion.div
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      onClick={onClick}
      className="prompt-card group cursor-pointer select-none overflow-hidden rounded-xl bg-[#050507] border border-white/[0.04] shadow-[0_6px_30px_-10px_rgb(0,0,0)] active:shadow-[0_3px_16px_-6px_rgb(0,0,0)]"
    >
      <div className="relative w-full overflow-hidden bg-black">
        <img
          src={prompt.imageUrl}
          alt={prompt.prompt}
          className="w-full h-auto object-cover transition-transform duration-[650ms] ease-out group-hover:scale-[1.065]"
          loading="lazy"
        />

        {/* Subtle cinematic top + bottom gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-black/40 pointer-events-none" />

        {/* Minimal Model Badge - Top Left (MeiGen style) */}
        <div className="absolute top-3 left-3 z-10">
          <div className={`model-badge ${modelClass} !text-[9px] !px-2.5 !py-0.5 shadow-md backdrop-blur-sm bg-black/60 border border-white/10`}>
            {prompt.model === 'GPT Image' ? 'GPT-4o' : prompt.model}
          </div>
        </div>

        {/* Very subtle bottom gradient for premium depth */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Optional faint title at very bottom (minimal) */}
        <div className="absolute bottom-3 left-3 right-3 z-10 opacity-0 group-hover:opacity-90 transition-opacity duration-300">
          <p className="text-white/70 text-[11px] leading-tight line-clamp-2 tracking-[-0.1px] drop-shadow">
            {prompt.prompt.length > 78 ? prompt.prompt.slice(0, 75) + '...' : prompt.prompt}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
