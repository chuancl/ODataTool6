
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

// 新增：高饱和度、鲜艳、奔放的色板 (用于亮色模式 Edge 连线等)
// 依然保留这组用于 Edge，因为 Edge 需要足够醒目
const BOLD_PALETTE = [
  '#9966ff', // Purple
  '#6666ff', // Indigo
  '#6699ff', // Blue
  '#66ff99', // Mint
  '#ffff66', // Yellow
  '#ffcc66', // Orange
  '#ff9966', // Salmon
  '#ff6666', // Red
];

/**
 * 实体主题配置 (Entity Themes)
 * 根据用户指定的色值范围进行组合
 * 
 * Header Colors: 9966ff, 6666ff, 6699ff, 66ff99, ffff66, ffcc66, ff9966, ff6666
 * Body Colors:   abcdef (Blueish), bedcaf (Greenish), cafedb (Minty), decafb (Purpleish)
 * Border Colors: aaaaaa, bbbbbb, cccccc, dddddd
 * Text Colors:   1a2a3a, 2a3a4a, 3a4a5a, 4a5a6a
 */
const ENTITY_THEMES = [
    // 1. Purple Header -> Lavender Body
    { header: '#9966ff', body: '#decafb', border: '#aaaaaa', text: '#1a2a3a' },
    
    // 2. Indigo Header -> Pale Blue Body
    { header: '#6666ff', body: '#abcdef', border: '#bbbbbb', text: '#2a3a4a' },
    
    // 3. Blue Header -> Pale Blue Body
    { header: '#6699ff', body: '#abcdef', border: '#cccccc', text: '#3a4a5a' },
    
    // 4. Green Header -> Minty Body
    { header: '#66ff99', body: '#cafedb', border: '#dddddd', text: '#4a5a6a' },
    
    // 5. Yellow Header -> Greenish/Neutral Body (Contrast)
    { header: '#ffff66', body: '#bedcaf', border: '#aaaaaa', text: '#1a2a3a' },
    
    // 6. Orange Header -> Greenish/Neutral Body
    { header: '#ffcc66', body: '#bedcaf', border: '#bbbbbb', text: '#2a3a4a' },
    
    // 7. Salmon Header -> Lavender Body (Warm/Cool contrast)
    { header: '#ff9966', body: '#decafb', border: '#cccccc', text: '#3a4a5a' },
    
    // 8. Red Header -> Minty/Greenish Body (Complementaryish) or Blueish
    { header: '#ff6666', body: '#cafedb', border: '#dddddd', text: '#4a5a6a' },
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
