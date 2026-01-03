
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
// 这里直接复用用户提供的 Header 颜色，保证连线和实体头颜色一致
const BOLD_PALETTE = [
  '#9966ff', // Purple
  '#6666ff', // Indigo
  '#6699ff', // Blue
  '#66ff99', // Mint
  '#ffcc66', // Yellow/Amber
  '#ff9966', // Orange/Salmon
  '#ff6666', // Red
];

/**
 * 实体主题配置 (Entity Themes)
 * 
 * Header Colors: 由用户指定
 * Body Colors:   根据 Header 颜色搭配的协调浅色背景 (同色系极浅色)
 * Border Colors: 由用户指定 (aaaaaa, bbbbbb, cccccc, dddddd)
 * Text Colors:   由用户指定 (1a2a3a, 2a3a4a, 3a4a5a, 4a5a6a)
 */
const ENTITY_THEMES = [
    // 1. Purple
    { header: '#9966ff', body: '#F3E8FF', border: '#aaaaaa', text: '#1a2a3a' },
    
    // 2. Indigo
    { header: '#6666ff', body: '#EEF2FF', border: '#bbbbbb', text: '#2a3a4a' },
    
    // 3. Blue
    { header: '#6699ff', body: '#EFF6FF', border: '#cccccc', text: '#3a4a5a' },
    
    // 4. Mint Green
    { header: '#66ff99', body: '#ECFDF5', border: '#dddddd', text: '#4a5a6a' },
    
    // 5. Amber/Yellow
    { header: '#ffcc66', body: '#FFFBEB', border: '#aaaaaa', text: '#1a2a3a' },
    
    // 6. Orange/Salmon
    { header: '#ff9966', body: '#FFF7ED', border: '#bbbbbb', text: '#2a3a4a' },
    
    // 7. Red
    { header: '#ff6666', body: '#FEF2F2', border: '#cccccc', text: '#3a4a5a' },
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
