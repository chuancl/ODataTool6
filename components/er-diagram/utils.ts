
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

export const getColor = (index: number, isBoldMode: boolean = false) => {
    if (isBoldMode) {
        return BOLD_PALETTE[index % BOLD_PALETTE.length];
    }
    return PALETTE[index % PALETTE.length];
};
