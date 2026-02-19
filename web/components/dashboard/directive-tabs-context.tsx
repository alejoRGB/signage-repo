"use client";

import { createContext, useContext } from "react";
import { DIRECTIVE_TAB, type DirectiveTab } from "@/lib/directive-tabs";

type DirectiveTabsContextValue = {
    activeDirectiveTab: DirectiveTab;
    viewTab: DirectiveTab;
    isSyncVideowallEnabled: boolean;
};

const DEFAULT_VALUE: DirectiveTabsContextValue = {
    activeDirectiveTab: DIRECTIVE_TAB.SCHEDULES,
    viewTab: DIRECTIVE_TAB.SCHEDULES,
    isSyncVideowallEnabled: false,
};

export const DirectiveTabsContext = createContext<DirectiveTabsContextValue>(DEFAULT_VALUE);

export function useDirectiveTabs() {
    return useContext(DirectiveTabsContext);
}

