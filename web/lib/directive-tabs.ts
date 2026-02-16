export const DIRECTIVE_TAB = {
    SCHEDULES: "SCHEDULES",
    SYNC_VIDEOWALL: "SYNC_VIDEOWALL",
} as const;

export type DirectiveTab = (typeof DIRECTIVE_TAB)[keyof typeof DIRECTIVE_TAB];

export const DIRECTIVE_TAB_LABEL: Record<DirectiveTab, string> = {
    [DIRECTIVE_TAB.SCHEDULES]: "Schedules",
    [DIRECTIVE_TAB.SYNC_VIDEOWALL]: "Sync",
};
