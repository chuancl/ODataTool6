
import { faker } from '@faker-js/faker';
import { EntityType, EntityProperty, ParsedSchema } from '@/utils/odata-helper';
import { DEFAULT_STRATEGIES, FAKER_DEFINITIONS } from './faker-definitions';

export type MockStrategyType = 'faker' | 'custom.null' | 'custom.empty' | 'custom.undefined' | 'custom.increment' | 'custom.age' | 'custom.placeholder';

export interface MockStrategy {
    value: string;
    label: string;
    category: string;
    type: MockStrategyType;
    fakerModule?: string;
    fakerMethod?: string;
    allowedTypes?: string[]; 
}

export interface AutoIncrementConfig {
    start: number; step: number; prefix: string; suffix: string;
}

export interface MockFieldConfig {
    path: string; property: EntityProperty; strategy: string; incrementConfig?: AutoIncrementConfig;
}

// 统一合并所有策略 (默认 + Faker)
export const ALL_STRATEGIES = [...DEFAULT_STRATEGIES, ...FAKER_DEFINITIONS];

export const getGroupedStrategies = () => {
    const groups: Record<string, MockStrategy[]> = {};
    ALL_STRATEGIES.forEach(s => {
        if (!groups[s.category]) groups[s.category] = [];
        groups[s.category].push(s);
    });
    return groups;
};

export const isStrategyCompatible = (strategyValue: string, odataType: string): boolean => {
    const strategy = ALL_STRATEGIES.find(s => s.value === strategyValue);
    if (!strategy) return false;
    if (!strategy.allowedTypes) return true;
    
    // Relaxed check for integers/bytes mapping to number.int
    const integerTypes = ['Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Byte', 'Edm.SByte'];
    if (integerTypes.includes(odataType) && strategy.value === 'number.int') return true;
    if (integerTypes.includes(odataType) && strategy.type === 'custom.age') return true;
    
    return strategy.allowedTypes.includes(odataType);
};

// 递归扁平化实体属性，自动展开 ComplexType
export const flattenEntityProperties = (
    entity: EntityType, 
    schema: ParsedSchema, 
    prefix: string = '',
    depth: number = 0
): { path: string, property: EntityProperty }[] => {
    // 递归深度保护
    if (depth > 5) return [];

    let results: { path: string, property: EntityProperty }[] = [];
    
    entity.properties.forEach(p => {
        const currentPath = prefix ? `${prefix}.${p.name}` : p.name;
        
        // 查找是否为 ComplexType
        const typeName = p.type.split('.').pop();
        const complexType = schema.complexTypes.find(ct => ct.name === typeName) || 
                            schema.entities.find(e => e.name === typeName && e.keys.length === 0);

        if (complexType) {
            results = results.concat(flattenEntityProperties(complexType, schema, currentPath, depth + 1));
        } else {
            results.push({ path: currentPath, property: p });
        }
    });
    return results;
};

export const suggestStrategy = (prop: EntityProperty): string => {
    const name = prop.name.toLowerCase();
    const type = prop.type;
    
    // 1. Exact Name Matches (High Priority)
    if (name.includes('age') && (['Edm.Byte', 'Edm.SByte', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.String'].includes(type))) {
        return 'custom.age';
    }

    // 2. Type Matches
    if (type === 'Edm.Boolean') return 'datatype.boolean';
    if (type === 'Edm.Guid') return 'string.uuid';
    if (type.includes('Date')) return 'date.recent';
    
    // Updated: Include Byte/SByte in number suggestions
    if (['Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Byte', 'Edm.SByte'].includes(type)) return 'number.int';
    if (['Edm.Decimal', 'Edm.Double', 'Edm.Single'].includes(type)) return 'commerce.price';
    
    // 3. String Semantic Matches
    if (type === 'Edm.String') {
        if (name === 'street' || name.includes('street')) return 'location.streetAddress';
        if (name === 'city' || name.includes('city')) return 'location.city';
        if (name === 'zip' || name.includes('zip') || name.includes('postal')) return 'location.zipCode';
        if (name === 'country' || name.includes('country')) return 'location.country';
        if (name === 'state' || name.includes('state') || name.includes('province')) return 'location.state';
        
        if (name.includes('email')) return 'internet.email';
        if (name.includes('phone')) return 'phone.number';
        if (name.includes('url')) return 'internet.url';
        if (name.includes('name')) {
            if (name.includes('first')) return 'person.firstName';
            if (name.includes('last')) return 'person.lastName';
            if (name.includes('product')) return 'commerce.productName';
            return 'person.fullName';
        }
        if (name.includes('id') || name.includes('key')) return 'string.uuid';
        return 'lorem.word';
    }
    
    return 'custom.null';
};

export const generateValue = (strategyValue: string, prop: EntityProperty, index: number, incrementConfig?: AutoIncrementConfig): any => {
    const strategy = ALL_STRATEGIES.find(s => s.value === strategyValue);
    if (!strategy) return null;

    if (strategy.type === 'custom.null') return null;
    if (strategy.type === 'custom.empty') return "";
    if (strategy.type === 'custom.placeholder') return "__PLACEHOLDER_VALUE__";
    
    // Age Logic: 18-90
    if (strategy.type === 'custom.age') {
        const age = Math.floor(Math.random() * (90 - 18 + 1)) + 18;
        return enforceConstraints(age, prop);
    }

    if (strategy.type === 'custom.increment') {
        const conf = incrementConfig || { start: 1, step: 1, prefix: '', suffix: '' };
        const numVal = conf.start + (index * conf.step);
        const valStr = `${conf.prefix}${numVal}${conf.suffix}`;
        if (prop.type !== 'Edm.String' && !conf.prefix && !conf.suffix) return numVal;
        return valStr;
    }

    if (strategy.type === 'faker' && strategy.fakerModule && strategy.fakerMethod) {
        try {
            // @ts-ignore
            const module = faker[strategy.fakerModule];
            if (module && typeof module[strategy.fakerMethod] === 'function') {
                return enforceConstraints(module[strategy.fakerMethod](), prop);
            } else {
                return `[Missing ${strategy.value}]`;
            }
        } catch (e) {
            return "Error";
        }
    }
    return enforceConstraints(null, prop);
};

const enforceConstraints = (val: any, prop: EntityProperty): any => {
    if (val === null || val === undefined) return val;
    if (prop.type === 'Edm.String') {
        let str = String(val);
        if (prop.maxLength && prop.maxLength > 0) str = str.substring(0, prop.maxLength);
        return str;
    }
    if (['Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Byte', 'Edm.SByte'].includes(prop.type)) {
        let num = typeof val === 'number' ? val : parseInt(val);
        if (isNaN(num)) return 0;
        
        // Byte Constraints
        if (prop.type === 'Edm.Byte') {
             num = Math.abs(num) % 256; 
        }
        else if (prop.type === 'Edm.SByte') {
             // Simple clamp for signed byte -128 to 127
             if (num > 127) num = 127;
             if (num < -128) num = -128;
        }
        else if (prop.type === 'Edm.Int16') { 
            if (num > 32767) num = 32767; 
            if (num < -32768) num = -32768; 
        }
        return Math.floor(num);
    }
    if (['Edm.Decimal', 'Edm.Double', 'Edm.Single'].includes(prop.type)) {
        let num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) return 0;
        if (prop.scale !== undefined && prop.scale >= 0) num = parseFloat(num.toFixed(prop.scale));
        return num;
    }
    if (prop.type.includes('Date') && val instanceof Date) return val.toISOString();
    return val;
};
