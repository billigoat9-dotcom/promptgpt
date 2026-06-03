"use client";

import React, { useState, useRef } from 'react';
import { Upload, Sparkles, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { STYLE_OPTIONS, COLOR_SWATCHES, getRandomImageUrl } from '@/lib/mockData';
import { Prompt, StyleOption, ColorSwatch } from '@/lib/types';
import { toast } from 'sonner';

interface GeneratePanelProps {
  onGenerate: (newPrompt: Prompt) => void;
  initialPrompt?: string;
  initialStyles?: string[];
  onClearInitial?: () => void;
}

export default function GeneratePanel({ 
  onGenerate, 
  initialPrompt = '', 
  initialStyles = [], 
  onClearInitial 
}: GeneratePanelProps) {
  const [promptText, setPromptText] = useState(initialPrompt);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(initialStyles);
  const [selectedColor, setSelectedColor] = useState<ColorSwatch | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sync external initial prompt
  React.useEffect(() => {
    if (initialPrompt) setPromptText(initialPrompt);
    if (initialStyles.length) setSelectedStyles(initialStyles);
  }, [initialPrompt, initialStyles]);

  const toggleStyle = (style: StyleOption) => {
    setSelectedStyles(prev =>
      prev.includes(style.id)
        ? prev.filter(id => id !== style.id)
        : [...prev, style.id]
    );
  };

  const selectColor = (color: ColorSwatch) => {
    setSelectedColor(prev => (prev?.id === color.id ? null : color));
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      // Simulate image-to-prompt
      setTimeout(() => {
        if (!promptText.trim()) {
          setPromptText('A highly detailed portrait of a mysterious traveler in a desert at golden hour, cinematic lighting, intricate fabric details');
          toast.info('Image analyzed. Prompt pre-filled.');
        }
      }, 520);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const clearImage = () => {
    setUploadedImage(null);
  };

  const generatePrompt = async () => {
    if (!promptText.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);

    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 850));

    // Build enhanced prompt
    let enhancedPrompt = promptText.trim();

    const styleMods = STYLE_OPTIONS
      .filter(s => selectedStyles.includes(s.id))
      .map(s => s.modifier);
    
    if (styleMods.length) {
      enhancedPrompt += ', ' + styleMods.join(', ');
    }
    if (selectedColor) {
      enhancedPrompt += ', ' + selectedColor.descriptor;
    }
    if (uploadedImage) {
      enhancedPrompt += ', inspired by uploaded reference image';
    }

    const newPrompt: Prompt = {
      id: 'gen_' + Date.now(),
      imageUrl: getRandomImageUrl(),
      prompt: promptText.trim().slice(0, 120),
      fullPrompt: enhancedPrompt,
      creator: 'You',
      creatorAvatar: 'https://picsum.photos/id/201/64/64',
      likes: 0,
      views: 1,
      model: 'FluxArt',
      tags: ['generated', ...selectedStyles.slice(0, 2).map(id => STYLE_OPTIONS.find(s => s.id === id)?.label.toLowerCase() || '')].filter(Boolean),
      category: 'Concept Art',
      createdAt: new Date().toISOString(),
    };

    onGenerate(newPrompt);

    // Reset form
    setPromptText('');
    setSelectedStyles([]);
    setSelectedColor(null);
    setUploadedImage(null);
    setIsGenerating(false);

    if (onClearInitial) onClearInitial();

    toast.success('New prompt generated and added to gallery!', {
      description: 'You can find it at the top of the feed.',
    });
  };

  return (
    <div className="generate-panel w-full xl:w-80 2xl:w-84 h-full flex flex-col border-l border-white/10 bg-[#0a0a0f] p-5 overflow-y-auto">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="text-violet-400" size={20} />
        <div>
          <div className="font-semibold text-lg tracking-tight">Generate</div>
          <div className="text-xs text-white/50 -mt-0.5">Create new prompts instantly</div>
        </div>
      </div>

      {/* Prompt textarea */}
      <div>
        <label className="text-xs font-semibold tracking-widest text-white/50 mb-1.5 block">YOUR PROMPT</label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="A majestic cyberpunk phoenix rising from neon ruins at midnight..."
          className="generate-textarea textarea w-full rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-violet-500/30"
          maxLength={280}
        />
        <div className="text-[10px] text-right text-white/40 mt-0.5">{promptText.length}/280</div>
      </div>

      {/* Image to Prompt */}
      <div className="mt-4">
        <label className="text-xs font-semibold tracking-widest text-white/50 mb-1.5 block">IMAGE TO PROMPT</label>
        
        {!uploadedImage ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`upload-zone flex flex-col items-center justify-center rounded-2xl py-7 cursor-pointer hover:bg-white/5 ${isDragOver ? 'dragover' : ''}`}
          >
            <Upload className="text-white/50 mb-2" size={22} />
            <div className="text-sm font-medium">Drop image or click to upload</div>
            <div className="text-[11px] text-white/40 mt-0.5">PNG, JPG up to 10MB</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden border border-white/10">
            <img src={uploadedImage} alt="Uploaded" className="w-full h-36 object-cover" />
            <button onClick={clearImage} className="absolute top-2 right-2 p-1 bg-black/70 rounded-full text-white/80 hover:text-white">
              <X size={14} />
            </button>
            <div className="absolute bottom-2 left-2 bg-black/60 text-xs px-2 py-px rounded">Reference image</div>
          </div>
        )}
      </div>

      {/* Style carousel */}
      <div className="mt-5">
        <label className="text-xs font-semibold tracking-widest text-white/50 mb-2 block">STYLE MODIFIERS</label>
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar -mx-0.5">
          {STYLE_OPTIONS.map((style) => {
            const isActive = selectedStyles.includes(style.id);
            return (
              <div
                key={style.id}
                onClick={() => toggleStyle(style)}
                className={`style-chip snap-start flex-shrink-0 ${isActive ? 'active' : ''}`}
              >
                <span>{style.emoji}</span>
                <span>{style.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Color Palette */}
      <div className="mt-4">
        <label className="text-xs font-semibold tracking-widest text-white/50 mb-2 block">COLOR DIRECTION</label>
        <div className="flex flex-wrap gap-2.5">
          {COLOR_SWATCHES.map((color) => (
            <div
              key={color.id}
              onClick={() => selectColor(color)}
              className={`color-swatch active:scale-95 ${selectedColor?.id === color.id ? 'active' : ''}`}
              style={{ backgroundColor: color.value }}
              title={color.label}
            />
          ))}
        </div>
        {selectedColor && (
          <div className="text-xs text-white/50 mt-1.5">{selectedColor.descriptor}</div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={generatePrompt}
        disabled={isGenerating || !promptText.trim()}
        className="generate-button mt-7 w-full btn-primary disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base py-[17px] font-semibold tracking-[-0.2px]"
      >
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            GENERATING...
          </>
        ) : (
          <>
            <Sparkles size={18} /> GENERATE NOW
          </>
        )}
      </button>

      <p className="text-[10px] text-center text-white/40 mt-3 leading-snug">
        Generates instantly in the gallery. <br />All generations are stored locally.
      </p>
    </div>
  );
}
