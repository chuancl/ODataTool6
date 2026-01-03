
// 生成字符串 Hash
export const generateHashCode = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
};

// 预定义一组好看的颜色作为 fallback (原有暗色/柔和模式)
const PALETTE = [
  '#F5A524', '#F31260', '#9353D3', '#006FEE', '#17C964', 
  '#06B6D4', '#F97316', '#EC4899', '#8B5CF6', '#10B981'
];

// 新增：高饱和度、鲜艳、奔放的色板 (用于亮色模式)
// 包含：Cyan, Hot Pink, Lime, Bright Orange, Electric Purple, Yellow, etc.
const BOLD_PALETTE = [
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#f97316', // Orange
  '#d946ef', // Fuchsia
  '#8b5cf6', // Violet
  '#eab308', // Yellow
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#f59e0b', // Amber
];

// 新增：协调的双色主题 (Header/Body Pair)
// 格式: { header: 深色/艳丽色, body: 浅色/同色系背景, border: 边框色(通常同header), text: 主体文字色 }
const ENTITY_THEMES = [
    // Cyan Theme
    { header: '#0891b2', body: '#ecfeff', border: '#0891b2', text: '#164e63' }, // Cyan 600 / 50
    // Rose Theme
    { header: '#e11d48', body: '#fff1f2', border: '#e11d48', text: '#881337' }, // Rose 600 / 50
    // Emerald Theme
    { header: '#059669', body: '#ecfdf5', border: '#059669', text: '#064e3b' }, // Emerald 600 / 50
    // Violet Theme
    { header: '#7c3aed', body: '#f5f3ff', border: '#7c3aed', text: '#4c1d95' }, // Violet 600 / 50
    // Amber Theme
    { header: '#d97706', body: '#fffbeb', border: '#d97706', text: '#78350f' }, // Amber 600 / 50
    // Blue Theme
    { header: '#2563eb', body: '#eff6ff', border: '#2563eb', text: '#1e3a8a' }, // Blue 600 / 50
    // Fuchsia Theme
    { header: '#c026d3', body: '#fdf4ff', border: '#c026d3', text: '#701a75' }, // Fuchsia 600 / 50
    // Teal Theme
    { header: '#0d9488', body: '#f0fdfa', border: '#0d9488', text: '#134e4a' }, // Teal 600 / 50
    // Lime Theme
    { header: '#65a30d', body: '#f7fee7', border: '#65a30d', text: '#365314' }, // Lime 600 / 50
    // Orange Theme
    { header: '#ea580c', body: '#fff7ed', border: '#ea580c', text: '#7c2d12' }, // Orange 600 / 50
];

export const getColor = (index: number, isBoldMode: boolean = false) => {
    if (isBoldMode) {
        return BOLD_PALETTE[index % BOLD_PALETTE.length];
    }
    return PALETTE[index % PALETTE.length];
};

export const getEntityTheme = (index: number) => {
    return ENTITY_THEMES[index % ENTITY_THEMES.length];
};
