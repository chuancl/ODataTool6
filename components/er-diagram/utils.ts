
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

// 新增：暖色、鲜艳、奔放的色板 (用于亮色模式)
// 侧重于 Red, Orange, Amber, Pink, Purple 等暖色调
const WARM_PALETTE = [
  '#ff5722', // Deep Orange
  '#f44336', // Red
  '#e91e63', // Pink
  '#ff9800', // Orange
  '#9c27b0', // Purple
  '#ffc107', // Amber (Darker)
  '#f50057', // Pink Accent
  '#d500f9', // Purple Accent
  '#ff1744', // Red Accent
  '#ff6d00', // Orange Accent
];

export const getColor = (index: number, isBoldMode: boolean = false) => {
    if (isBoldMode) {
        return WARM_PALETTE[index % WARM_PALETTE.length];
    }
    return PALETTE[index % PALETTE.length];
};
