
// 生成字符串 Hash
export const generateHashCode = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
};

// Light Mode Palette (High Saturation for White BG - Original BOLD_PALETTE)
const PALETTE_LIGHT = [
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

// Dark Mode Palette (Optimized for Dark BG - Lighter/Fresher shades)
const PALETTE_DARK = [
  '#a78bfa', // Violet 400
  '#818cf8', // Indigo 400
  '#60a5fa', // Blue 400
  '#fbbf24', // Amber 400
  '#fb923c', // Orange 400
  '#f87171', // Red 400
  '#2dd4bf', // Teal 400 (Replaces old Teal #14b8a6)
  '#4ade80', // Green 400 (Replaces old Lime #84cc16)
  '#60a5fa', // Blue 400
];

/**
 * 实体主题配置 (Entity Themes for Light Mode)
 */
const ENTITY_THEMES_LIGHT = [
    // 1. Purple
    { header: '#9966ff', body: '#e9dfff', nav: '#d8b4fe', border: '#aaaaaa', text: '#1a2a3a' },
    // 2. Indigo
    { header: '#6666ff', body: '#dbeafe', nav: '#c7d2fe', border: '#bbbbbb', text: '#2a3a4a' },
    // 3. Blue
    { header: '#6699ff', body: '#cfe4fc', nav: '#a5cfff', border: '#cccccc', text: '#3a4a5a' },
    // 4. Amber/Yellow
    { header: '#ffcc66', body: '#fef3c7', nav: '#fde68a', border: '#dddddd', text: '#4a5a6a' },
    // 5. Orange
    { header: '#ff9966', body: '#ffe4cc', nav: '#ffdcb3', border: '#aaaaaa', text: '#1a2a3a' },
    // 6. Red
    { header: '#ff6666', body: '#fee2e2', nav: '#fecaca', border: '#bbbbbb', text: '#2a3a4a' },
    // 7. Teal
    { header: '#14b8a6', body: '#ccfbf1', nav: '#99f6e4', border: '#cccccc', text: '#3a4a5a' },
    // 8. Lime
    { header: '#84cc16', body: '#dceeb8', nav: '#c6ec7e', border: '#dddddd', text: '#4a5a6a' },
    // 9. Bright Blue
    { header: '#3b82f6', body: '#d1e5fd', nav: '#93c5fd', border: '#aaaaaa', text: '#1a2a3a' },
];

export const getColor = (index: number, isDark: boolean = false) => {
    const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT;
    return palette[index % palette.length];
};

export const getEntityTheme = (index: number, isDark: boolean = false) => {
    if (!isDark) {
        return ENTITY_THEMES_LIGHT[index % ENTITY_THEMES_LIGHT.length];
    } else {
        // Dark Mode: Construct theme object dynamically using Dark Palette
        const headerColor = PALETTE_DARK[index % PALETTE_DARK.length];
        return {
            header: headerColor,
            // Fallbacks for properties unused in Dark Mode EntityNode logic
            body: '#000000', 
            nav: '#000000', 
            border: '#333333', 
            text: '#ffffff'
        };
    }
};
