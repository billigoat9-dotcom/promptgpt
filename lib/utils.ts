import { Prompt, SortMode } from './types';

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 10000) return Math.floor(num / 1000) + 'k';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString();
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'mo ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'm ago';
  return 'just now';
}

export function sortPrompts(prompts: Prompt[], mode: SortMode): Prompt[] {
  const sorted = [...prompts];
  if (mode === 'trending') {
    sorted.sort((a, b) => (b.likes * 0.65 + b.views * 0.00035) - (a.likes * 0.65 + a.views * 0.00035));
  } else if (mode === 'latest') {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (mode === 'most-viewed') {
    sorted.sort((a, b) => b.views - a.views);
  }
  return sorted;
}

export function filterPrompts(
  prompts: Prompt[],
  modelFilter: string,
  searchQuery: string,
  activeCategories: string[],
  activeTags: string[],
  viewMode: string
): Prompt[] {
  let result = [...prompts];

  // Model filter
  if (modelFilter !== 'All') {
    result = result.filter(p => p.model === modelFilter);
  }

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(
      p =>
        p.prompt.toLowerCase().includes(q) ||
        p.fullPrompt.toLowerCase().includes(q) ||
        p.creator.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Category filter (OR within categories)
  if (activeCategories.length > 0) {
    result = result.filter(p => activeCategories.includes(p.category));
  }

  // Tag filter (must include ALL selected tags)
  if (activeTags.length > 0) {
    result = result.filter(p => activeTags.every(tag => p.tags.includes(tag)));
  }

  // View mode presets
  if (viewMode === 'saved') {
    // This is handled outside via saved set
  }

  return result;
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  // Fallback
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve(true);
  } catch {
    document.body.removeChild(textArea);
    return Promise.resolve(false);
  }
}
