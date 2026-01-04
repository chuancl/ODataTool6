
import { EntityType } from "@/utils/odata-helper";

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

// Dark Mode Palette (One Dark Pro Syntax Colors)
const PALETTE_DARK = [
  '#61afef', // Blue
  '#98c379', // Green
  '#e5c07b', // Yellow
  '#e06c75', // Red
  '#c678dd', // Purple
  '#56b6c2', // Cyan
  '#d19a66', // Orange
  '#be5046', // Dark Red
];

// Export lengths for graph coloring
export const PALETTE_LIGHT_LEN = PALETTE_LIGHT.length;
export const PALETTE_DARK_LEN = PALETTE_DARK.length;

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
            body: '#282c34', // One Dark Pro BG
            nav: '#21252b',  // One Dark Pro Panel BG
            border: '#3e4451', // One Dark Pro Border
            text: '#abb2bf' // One Dark Pro Text
        };
    }
};

/**
 * 图着色算法 (Greedy Coloring with Global Usage Balancing)
 * 为每个实体分配一个颜色索引，尽力保证相邻实体颜色不同，且颜色分布尽可能均匀
 */
export const computeGraphColoring = (entities: EntityType[], isDark: boolean): Record<string, number> => {
    const paletteLength = isDark ? PALETTE_DARK_LEN : PALETTE_LIGHT_LEN;
    const colors: Record<string, number> = {};
    const adj: Record<string, Set<string>> = {};
    const globalUsage = new Array(paletteLength).fill(0); // 记录每种颜色的全局使用次数

    // 1. 构建邻接表
    entities.forEach(e => {
        if (!adj[e.name]) adj[e.name] = new Set();
        e.navigationProperties.forEach(nav => {
            let target = nav.targetType;
            if (target) {
                if (target.startsWith('Collection(')) target = target.slice(11, -1);
                target = target.split('.').pop();
                if (target && target !== e.name) { // 忽略自引用
                    adj[e.name].add(target);
                    // 无向图视角：同时也记录反向关系
                    if (!adj[target]) adj[target] = new Set();
                    adj[target].add(e.name);
                }
            }
        });
    });

    // 2. 贪婪着色
    // 为了结果确定性，先按度数(连接数)降序排序，度数相同按名称排序
    const sortedEntities = [...entities].sort((a, b) => {
        const degreeA = adj[a.name]?.size || 0;
        const degreeB = adj[b.name]?.size || 0;
        if (degreeB !== degreeA) return degreeB - degreeA;
        return a.name.localeCompare(b.name);
    });

    sortedEntities.forEach(e => {
        const neighborColors = new Set<number>();
        (adj[e.name] || []).forEach(neighborName => {
            if (colors[neighborName] !== undefined) {
                neighborColors.add(colors[neighborName]);
            }
        });

        // 寻找所有未被邻居使用的合法颜色索引
        const validColors: number[] = [];
        for (let i = 0; i < paletteLength; i++) {
            if (!neighborColors.has(i)) {
                validColors.push(i);
            }
        }

        let chosenColor = -1;

        if (validColors.length > 0) {
            // 策略优化：在合法颜色中，选择【全局使用次数最少】的颜色
            // 这能确保颜色多样性，避免算法总是倾向于使用索引靠前的颜色 (0, 1, 2)
            validColors.sort((a, b) => {
                const usageDiff = globalUsage[a] - globalUsage[b];
                if (usageDiff !== 0) return usageDiff;
                return a - b; // 索引作为 Tie-breaker，保持确定性
            });
            chosenColor = validColors[0];
        } else {
            // 冲突不可避免：选择被【当前邻居】使用次数最少的颜色，以最小化局部视觉混淆
            const localUsageCount = new Array(paletteLength).fill(0);
            (adj[e.name] || []).forEach(neighborName => {
                if (colors[neighborName] !== undefined) {
                    localUsageCount[colors[neighborName]]++;
                }
            });
            
            let minLocalUsage = Infinity;
            // 默认选第一个，后续循环优化
            chosenColor = 0;

            for (let i = 0; i < paletteLength; i++) {
                if (localUsageCount[i] < minLocalUsage) {
                    minLocalUsage = localUsageCount[i];
                    chosenColor = i;
                } else if (localUsageCount[i] === minLocalUsage) {
                    // 如果局部冲突程度相同，优先选全局使用较少的
                    if (globalUsage[i] < globalUsage[chosenColor]) {
                        chosenColor = i;
                    }
                }
            }
        }

        colors[e.name] = chosenColor;
        globalUsage[chosenColor]++;
    });

    return colors;
};
