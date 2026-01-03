
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@nextui-org/button";
import { Input } from "@nextui-org/input";
import { Card, CardBody } from "@nextui-org/card";
import { Select, SelectItem } from "@nextui-org/select";
import { ScrollShadow } from "@nextui-org/scroll-shadow";
import { ODataVersion, ParsedSchema } from '@/utils/odata-helper';
import { Sparkles, Settings2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useEntityActions } from './query-builder/hooks/useEntityActions';
import { CodeModal } from './query-builder/CodeModal';
import { ResultTabs } from './query-builder/ResultTabs';
import { StrategySelect } from './mock-data/StrategySelect';
import { useToast } from '@/components/ui/ToastContext';
import { 
    flattenEntityProperties, 
    suggestStrategy, 
    generateValue, 
    isStrategyCompatible,
    MockFieldConfig,
    AutoIncrementConfig
} from './mock-data/mock-utils';

interface Props {
  url: string;
  version: ODataVersion;
  schema: ParsedSchema | null;
  isDark?: boolean;
}

const MockDataGenerator: React.FC<Props> = ({ url, version, schema, isDark = true }) => {
  const [count, setCount] = useState('5');
  const [entitySets, setEntitySets] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  
  // 扁平化后的属性列表 (包含 path, property)
  const [flatProperties, setFlatProperties] = useState<{ path: string, property: any }[]>([]);
  
  // 配置状态: Map<Path, Config>
  const [configs, setConfigs] = useState<Record<string, MockFieldConfig>>({});
  
  // 数据状态
  const [mockData, setMockData] = useState<any[]>([]);
  const [currentDraft, setCurrentDraft] = useState<Record<number, Record<string, any>>>({});

  const toast = useToast();

  // 1. 初始化实体列表
  useEffect(() => {
    if (!schema) return;
    let sets: string[] = [];
    if (schema.entitySets && schema.entitySets.length > 0) {
        sets = schema.entitySets.map(es => es.name);
    } else if (schema.entities && schema.entities.length > 0) {
        sets = schema.entities.map(e => e.name + 's');
    }
    setEntitySets(sets);
    if (sets.length > 0) setSelectedEntity(sets[0]);
  }, [schema]);

  // 2. 获取当前选中实体的 Schema 定义并初始化配置
  const currentSchema = useMemo(() => {
      if (!selectedEntity || !schema || !schema.entities) return null;
      const setInfo = schema.entitySets.find(es => es.name === selectedEntity);
      let entityType = null;
      if (setInfo) {
          const typeName = setInfo.entityType.split('.').pop();
          entityType = schema.entities.find(e => e.name === typeName);
      } else {
          entityType = schema.entities.find(s => selectedEntity.includes(s.name));
      }
      return entityType || null;
  }, [selectedEntity, schema]);

  // 辅助函数：生成默认配置
  const generateDefaultConfigs = useCallback((props: { path: string, property: any }[]) => {
      const newConfigs: Record<string, MockFieldConfig> = {};
      props.forEach(item => {
          newConfigs[item.path] = {
              path: item.path,
              property: item.property,
              strategy: suggestStrategy(item.property),
              incrementConfig: { start: 1, step: 1, prefix: '', suffix: '' } // default
          };
      });
      return newConfigs;
  }, []);

  // 3. 当 Schema 变化时，重新扁平化并生成默认配置
  useEffect(() => {
      if (!currentSchema || !schema) return;
      
      const flattened = flattenEntityProperties(currentSchema, schema);
      setFlatProperties(flattened);
      setConfigs(generateDefaultConfigs(flattened));
      
      setMockData([]);
      setCurrentDraft({});
  }, [currentSchema, schema, generateDefaultConfigs]);

  // 4. 更新配置的 Helper
  const updateConfig = (path: string, updates: Partial<MockFieldConfig>) => {
      setConfigs(prev => ({
          ...prev,
          [path]: { ...prev[path], ...updates }
      }));
  };

  const updateIncrementConfig = (path: string, key: keyof AutoIncrementConfig, value: any) => {
      setConfigs(prev => ({
          ...prev,
          [path]: {
              ...prev[path],
              incrementConfig: {
                  ...prev[path].incrementConfig!,
                  [key]: value
              }
          }
      }));
  };

  // 重置配置
  const handleResetDefaults = () => {
      if (flatProperties.length === 0) return;
      setConfigs(generateDefaultConfigs(flatProperties));
      toast.success("已重置所有字段为默认生成策略 (Reset to defaults)");
  };

  // 5. 生成数据核心逻辑
  const generateData = () => {
    if (!currentSchema) return;
    const num = parseInt(count) || 5;
    
    const newData = Array.from({ length: num }).map((_, i) => {
      // Change 'id' to '__id' to mark it as internal field
      const row: any = { __id: i, __selected: true };
      
      // 遍历所有扁平化配置，构建嵌套对象
      Object.values(configs).forEach(conf => {
          const val = generateValue(conf.strategy, conf.property, i, conf.incrementConfig);
          
          // 处理嵌套路径 "Address.City" -> row.Address.City
          const parts = conf.path.split('.');
          let current = row;
          for (let k = 0; k < parts.length - 1; k++) {
              const part = parts[k];
              if (!current[part]) current[part] = {};
              current = current[part];
          }
          current[parts[parts.length - 1]] = val;
      });
      
      return row;
    });
    
    setMockData(newData);
    setCurrentDraft({});
    toast.success(`Generated ${num} rows of data`);
  };

  // 6. Action Hook 集成
  const { 
      prepareCreate, 
      isOpen: isModalOpen, 
      onOpenChange: onModalOpenChange, 
      codePreview, 
      modalAction, 
      executeBatch 
  } = useEntityActions(
      url, 
      version, 
      schema, 
      selectedEntity, 
      currentSchema, 
      async () => {},
      () => {}, 
      () => {}
  );

  const handleCreateSelected = (selectedItems: any[]) => {
      prepareCreate(selectedItems);
  };

  const downloadJson = (content: string, filename: string, type: 'json' | 'xml') => {
      const blob = new Blob([content], { type: type === 'json' ? 'application/json' : 'application/xml' });
      const u = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = u; link.download = `${selectedEntity}_Mock.${type === 'json' ? 'json' : 'xml'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(u);
  };

  const mergedJson = useMemo(() => {
      if (mockData.length === 0) return '[]';
      const merged = mockData.map((item, index) => {
          const draft = currentDraft[index];
          if (!draft) return item;
          return { ...item, ...draft };
      });
      return JSON.stringify(merged, null, 2);
  }, [mockData, currentDraft]);

  const handleJsonSync = (newData: any[]) => {
      setMockData(newData);
      setCurrentDraft({});
  };

  return (
    <div className="flex flex-col gap-4 h-full relative">
      {/* 顶部控制栏 */}
      <Card className="border-none shadow-sm bg-content1 shrink-0">
        <CardBody className="p-3">
           <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
              <div className="flex items-center gap-4 flex-1 w-full">
                <Select 
                    label="Target Entity" 
                    size="sm" 
                    variant="bordered" 
                    className="max-w-[240px]"
                    selectedKeys={selectedEntity ? [selectedEntity] : []}
                    onChange={(e) => setSelectedEntity(e.target.value)}
                >
                    {entitySets.map(es => <SelectItem key={es} value={es}>{es}</SelectItem>)}
                </Select>
                <Input 
                    label="Row Count" 
                    type="number" 
                    value={count} 
                    onValueChange={setCount} 
                    className="max-w-[100px]" 
                    variant="bordered"
                    size="sm"
                />
                <Button color="primary" onPress={generateData} startContent={<Sparkles size={16}/>} className="font-semibold">
                  Generate Data
                </Button>
              </div>
           </div>
        </CardBody>
      </Card>

      <div className="flex gap-4 flex-1 min-h-0">
          {/* 左侧：配置面板 */}
          <div className="w-[320px] bg-content1 rounded-xl border border-divider flex flex-col shrink-0">
             <div className="p-3 border-b border-divider font-bold text-sm flex items-center gap-2 text-default-600">
                 <Settings2 size={16} /> Field Configuration
             </div>
             
             <ScrollShadow className="flex-1 p-3">
                 {!currentSchema ? (
                     <div className="text-default-400 text-xs text-center mt-10">Select an Entity first</div>
                 ) : (
                    <div className="flex flex-col gap-4">
                        {flatProperties.map(fp => {
                            const conf = configs[fp.path];
                            if (!conf) return null;
                            const isCompatible = isStrategyCompatible(conf.strategy, fp.property.type);
                            
                            return (
                                <div key={fp.path} className="flex flex-col gap-1 border-b border-divider/50 pb-3 last:border-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <label className="text-[11px] font-bold text-default-700 truncate max-w-[200px]" title={fp.path}>
                                            {fp.path}
                                            {fp.property.nullable === false && <span className="text-danger ml-1">*</span>}
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[9px] text-default-400 font-mono bg-default-100 px-1 rounded">{fp.property.type.split('.').pop()}</span>
                                            {!isCompatible && <AlertTriangle size={10} className="text-warning" />}
                                        </div>
                                    </div>
                                    
                                    {/* New Strategy Selector Component */}
                                    <StrategySelect 
                                        value={conf.strategy}
                                        odataType={fp.property.type}
                                        onChange={(val) => updateConfig(fp.path, { strategy: val })}
                                        label={fp.path}
                                    />

                                    {/* Auto-Increment Settings - Always visible for 'custom.increment' */}
                                    {conf.strategy === 'custom.increment' && (
                                        <div className="grid grid-cols-2 gap-2 mt-1 bg-default-50 p-2 rounded border border-divider">
                                            <Input 
                                                label="Start" size="sm" type="number" variant="bordered"
                                                classNames={{ input: "text-[10px]", label: "text-[9px]" }}
                                                value={String(conf.incrementConfig?.start)}
                                                onValueChange={(v) => updateIncrementConfig(fp.path, 'start', Number(v))}
                                            />
                                            <Input 
                                                label="Step" size="sm" type="number" variant="bordered"
                                                classNames={{ input: "text-[10px]", label: "text-[9px]" }}
                                                value={String(conf.incrementConfig?.step)}
                                                onValueChange={(v) => updateIncrementConfig(fp.path, 'step', Number(v))}
                                            />
                                            <Input 
                                                label="Prefix" size="sm" variant="bordered"
                                                classNames={{ input: "text-[10px]", label: "text-[9px]" }}
                                                value={conf.incrementConfig?.prefix}
                                                onValueChange={(v) => updateIncrementConfig(fp.path, 'prefix', v)}
                                            />
                                            <Input 
                                                label="Suffix" size="sm" variant="bordered"
                                                classNames={{ input: "text-[10px]", label: "text-[9px]" }}
                                                value={conf.incrementConfig?.suffix}
                                                onValueChange={(v) => updateIncrementConfig(fp.path, 'suffix', v)}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                 )}
             </ScrollShadow>
             
             <div className="p-2 border-t border-divider">
                 <Button size="sm" variant="light" fullWidth onPress={handleResetDefaults} startContent={<RefreshCw size={14}/>}>
                     Reset to Defaults
                 </Button>
             </div>
          </div>

          {/* 右侧：结果 */}
          <ResultTabs 
             queryResult={mockData}
             rawJsonResult={mergedJson}
             rawXmlResult=""
             loading={false}
             isDark={isDark}
             onDelete={() => {}} 
             onUpdate={() => {}} 
             onExport={() => {}} 
             downloadFile={downloadJson}
             entityName={selectedEntity}
             schema={schema}
             onCreate={handleCreateSelected}
             enableEdit={true}
             enableDelete={false}
             hideUpdateButton={true}
             hideXmlTab={true}
             onDraftChange={setCurrentDraft}
             enableJsonEdit={true}
             onJsonChange={handleJsonSync}
          />
      </div>

      <CodeModal 
          isOpen={isModalOpen}
          onOpenChange={onModalOpenChange}
          code={codePreview}
          action={modalAction}
          onExecute={executeBatch}
      />
    </div>
  );
};

export default MockDataGenerator;
