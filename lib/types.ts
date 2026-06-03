export type Model = 'FluxArt' | 'VideoGen' | 'GPT Image' | 'Midjourney';

export interface Prompt {
  id: string;
  imageUrl: string;
  prompt: string;
  fullPrompt: string;
  creator: string;
  creatorAvatar: string;
  likes: number;
  views: number;
  model: Model;
  tags: string[];
  category: string;
  createdAt: string; // ISO
}

export interface StyleOption {
  id: string;
  label: string;
  emoji: string;
  modifier: string;
}

export interface ColorSwatch {
  id: string;
  label: string;
  value: string; // hex
  descriptor: string;
}

export type SortMode = 'trending' | 'latest' | 'most-viewed';
export type NavSection = 'discover' | 'studio' | 'timeline' | 'saved';
