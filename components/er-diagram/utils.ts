
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

// 新增：高饱和度、鲜艳的色板 (用于亮色模式 Edge 连线等)
// 复用用户指定的 Header 颜色，保持连线与实体头部颜色一致
const BOLD_PALETTE = [
  '#9966ff', // Purple
  '#6666ff', // Indigo
  '#6699ff', // Blue
  '#ffcc66', // Amber
  '#ff9966', // Orange
  '#ff6666', // Red
  '#14b8a6', // Teal
  '#84cc16', // Lime
  '#3b82f6', // Blue 500
];

/**
 * 实体主题配置 (Entity Themes)
 * 
 * Header: 指定深色
 * Body:   协调的同色系中浅色 (避免太浅看不清，也避免太深影响文字阅读)
 * Border: 指定灰色循环 (aaaaaa, bbbbbb, cccccc, dddddd)
 * Text:   指定深色循环 (1a2a3a, 2a3a4a, 3a4a5a, 4a5a6a)
 */
const ENTITY_THEMES = [
    // 1. Purple
    { header: '#9966ff', body: '#e0ccff', border: '#aaaaaa', text: '#1a2a3a' },
    
    // 2. Indigo
    { header: '#6666ff', body: '#ccccff', border: '#bbbbbb', text: '#2a3a4a' },
    
    // 3. Blue
    { header: '#6699ff', body: '#99ccff', border: '#cccccc', text: '#3a4a5a' },
    
    // 4. Amber/Yellow (Body 稍微加深一点点，保证在亮屏下可见)
    { header: '#ffcc66', body: '#ffe6b3', border: '#dddddd', text: '#4a5a6a' },
    
    // 5. Orange
    { header: '#ff9966', body: '#ffcc99', border: '#aaaaaa', text: '#1a2a3a' },
    
    // 6. Red
    { header: '#ff6666', body: '#ffb3b3', border: '#bbbbbb', text: '#2a3a4a' },
    
    // 7. Teal
    { header: '#14b8a6', body: '#99f6e4', border: '#cccccc', text: '#3a4a5a' },
    
    // 8. Lime
    { header: '#84cc16', body: '#bef264', border: '#dddddd', text: '#4a5a6a' },

    // 9. Bright Blue
    { header: '#3b82f6', body: '#93c5fd', border: '#aaaaaa', text: '#1a2a3a' },
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
