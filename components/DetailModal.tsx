"use client";

import React, { useState } from 'react';
import { X, Copy, Heart, ExternalLink, ArrowRight, Eye } from 'lucide-react';
import { Prompt } from '@/lib/types';
import { formatNumber, timeAgo, copyToClipboard } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getTranslation } from '@/lib/mockData';

interface DetailModalProps {
  prompt: Prompt | null;
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onRemix: (prompt: Prompt) => void;
  onLike: () => void;
}

export default function DetailModal({
  prompt,
  isSaved,
  onClose,
  onToggleSave,
  onRemix,
  onLike,
}: DetailModalProps) {
  const [showTranslated, setShowTranslated] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!prompt) return null;

  const displayText = showTranslated ? getTranslation(prompt.id) : prompt.fullPrompt;

  const handleCopy = async () => {
    const success = await copyToClipboard(displayText);
    if (success) {
      setCopied(true);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error('Failed to copy');
    }
  };

  const handleViewOnX = () => {
    const text = encodeURIComponent(
      `Check out this amazing AI prompt:\n\n"${prompt.prompt}"\n\nMade with ${prompt.model} on PromptGpt`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 modal-backdrop"
        />

        {/* Modal - Compact & Responsive */}
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className="relative w-full max-w-[720px] lg:max-w-[780px] modal-content rounded-t-3xl lg:rounded-3xl overflow-hidden shadow-2xl border border-white/5"
        >
          <div className="flex flex-col lg:flex-row">
            {/* Image side - Controlled & Compact */}
            <div className="lg:w-[42%] relative bg-black">
              <div className="relative aspect-[4/3] lg:aspect-auto lg:h-[380px] max-h-[320px] lg:max-h-none">
                <img
                  src={prompt.imageUrl}
                  alt={prompt.prompt}
                  className="modal-image absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 lg:bg-gradient-to-r lg:from-black/60 lg:via-black/5 lg:to-transparent" />
              </div>

              {/* Close button - Better positioned */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-black/70 hover:bg-black/85 active:bg-black/95 text-white backdrop-blur-md transition-all active:scale-95 border border-white/10 z-10"
              >
                <X size={19} />
              </button>
            </div>

            {/* Content side - Compact & Scrollable */}
            <div className="lg:w-[58%] p-4 sm:p-5 lg:p-6 flex flex-col max-h-[60vh] lg:max-h-[460px] overflow-y-auto bg-[#050507]">
              {/* Header - Compact */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`model-badge ${prompt.model.replace(/\s/g, '-')} !text-[9px] !px-2.5 !py-0.5`}>
                    {prompt.model}
                  </div>
                  <div className="text-[10px] text-white/50 font-mono tracking-[0.5px]">
                    {timeAgo(prompt.createdAt)}
                  </div>
                </div>

                <h3 className="text-[15px] sm:text-[16px] leading-snug font-semibold tracking-[-0.3px] text-white pr-1">
                  {prompt.prompt}
                </h3>
              </div>

              {/* Creator + Stats Row - Tightened */}
              <div className="mt-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={prompt.creatorAvatar}
                    alt=""
                    className="w-7 h-7 rounded-full ring-1 ring-white/15 object-cover"
                  />
                  <div>
                    <div className="font-semibold text-[13.5px] tracking-[-0.1px] text-white">{prompt.creator}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <button 
                    onClick={onLike} 
                    className="flex items-center gap-1 text-white/80 hover:text-red-400 active:text-red-500 transition-colors"
                  >
                    <Heart size={16} className={isSaved ? "fill-red-500 text-red-500" : ""} />
                    <span className="font-medium tabular-nums text-sm">{formatNumber(prompt.likes)}</span>
                  </button>
                  <div className="flex items-center gap-1 text-white/60">
                    <Eye size={15} />
                    <span className="font-mono text-xs tabular-nums">{formatNumber(prompt.views)}</span>
                  </div>
                </div>
              </div>

              {/* Full Prompt - Compact */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="uppercase text-[9px] font-semibold tracking-[1.5px] text-white/50">Full Prompt</div>
                  <button
                    onClick={() => setShowTranslated(!showTranslated)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/15 hover:bg-white/5 active:bg-white/10 flex items-center gap-1 transition-colors text-white/80"
                  >
                    {showTranslated ? 'Original' : 'Translate'}
                    <ArrowRight size={12} />
                  </button>
                </div>

                <div className="bg-[#08080c] border border-white/8 rounded-2xl p-3.5 text-[13.5px] leading-[1.55] text-white/90 tracking-[-0.1px]">
                  {displayText}
                </div>
              </div>

              {/* Tags - Compact */}
              {prompt.tags.length > 0 && (
                <div className="mt-4">
                  <div className="uppercase text-[9px] font-semibold tracking-[1.5px] text-white/50 mb-1.5">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {prompt.tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.035] border border-white/8 text-white/80">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions - Compact buttons */}
              <div className="mt-auto pt-5 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleCopy}
                  className="btn-ghost flex items-center justify-center gap-2 text-[14px] py-3 active:scale-[0.985] font-medium"
                >
                  <Copy size={16} />
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>

                <button
                  onClick={handleViewOnX}
                  className="btn-ghost flex items-center justify-center gap-2 text-[14px] py-3 font-medium"
                >
                  <ExternalLink size={16} />
                  View on X
                </button>

                <button
                  onClick={onToggleSave}
                  className="btn-ghost flex items-center justify-center gap-2 text-[14px] py-3 active:scale-[0.985] font-medium"
                >
                  <Heart className={isSaved ? "fill-red-500 text-red-500" : ""} size={16} />
                  {isSaved ? 'Saved' : 'Save to Collection'}
                </button>

                <button
                  onClick={() => onRemix(prompt)}
                  className="btn-primary flex items-center justify-center gap-2 text-[14px] py-[13px] font-semibold active:scale-[0.985]"
                >
                  Remix in Studio →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
