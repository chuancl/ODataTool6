
import React, { createContext, useContext } from 'react';

export type UpdateResult = { item: any, changes: any };
export type GetUpdatesFn = () => UpdateResult[];

export interface TableContextType {
    register: (id: string, getUpdates: GetUpdatesFn) => void;
    unregister: (id: string) => void;
}

export const TableContext = createContext<TableContextType | null>(null);

export const useTableContext = () => useContext(TableContext);
