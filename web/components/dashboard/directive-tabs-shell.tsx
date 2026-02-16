"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast-context";
import { DIRECTIVE_TAB, DIRECTIVE_TAB_LABEL, type DirectiveTab } from "@/lib/directive-tabs";

const TAB_ORDER: DirectiveTab[] = [DIRECTIVE_TAB.SCHEDULES, DIRECTIVE_TAB.SYNC_VIDEOWALL];

type DirectiveTabsShellProps = {
    children: React.ReactNode;
    initialActiveDirectiveTab: DirectiveTab;
};

export function DirectiveTabsShell({
    children,
    initialActiveDirectiveTab,
}: DirectiveTabsShellProps) {
    const { showToast } = useToast();
    const [activeDirectiveTab, setActiveDirectiveTab] = useState<DirectiveTab>(initialActiveDirectiveTab);
    const [viewTab, setViewTab] = useState<DirectiveTab>(DIRECTIVE_TAB.SCHEDULES);
    const [isSaving, startSaving] = useTransition();

    useEffect(() => {
        setActiveDirectiveTab(initialActiveDirectiveTab);
    }, [initialActiveDirectiveTab]);

    const handleCheckboxChange = (tab: DirectiveTab, checked: boolean) => {
        if (!checked || tab === activeDirectiveTab) {
            return;
        }

        const previousTab = activeDirectiveTab;
        setActiveDirectiveTab(tab);

        startSaving(async () => {
            try {
                const response = await fetch("/api/dashboard/directive-tab", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activeDirectiveTab: tab }),
                });

                if (!response.ok) {
                    throw new Error("Failed to save directive tab");
                }
            } catch (error) {
                console.error(error);
                setActiveDirectiveTab(previousTab);
                showToast("Failed to save active tab.", "error");
            }
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-slate-700/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 pt-3 shadow-[0_10px_35px_-25px_rgba(2,6,23,0.9)]">
                <div className="flex items-end justify-center gap-2">
                    {TAB_ORDER.map((tab) => {
                        const isActiveDirectiveTab = activeDirectiveTab === tab;
                        const isViewingTab = viewTab === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                data-testid={`directive-tab-${tab}`}
                                onClick={() => setViewTab(tab)}
                                className={`relative -mb-px flex min-w-fit items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2 transition-colors ${
                                    isViewingTab
                                        ? "border-slate-300 bg-white text-slate-900 shadow-[0_14px_24px_-18px_rgba(15,23,42,0.55)]"
                                        : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                                }`}
                                aria-current={isViewingTab ? "page" : undefined}
                            >
                                <input
                                    data-testid={`directive-checkbox-${tab}`}
                                    type="checkbox"
                                    checked={isActiveDirectiveTab}
                                    disabled={isSaving}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => handleCheckboxChange(tab, event.target.checked)}
                                    className="h-4 w-4 cursor-pointer rounded-[4px] border border-slate-400 accent-indigo-600"
                                    aria-label={`Activate ${DIRECTIVE_TAB_LABEL[tab]} tab`}
                                />
                                <span className="select-none text-sm font-medium">{DIRECTIVE_TAB_LABEL[tab]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {viewTab === DIRECTIVE_TAB.SCHEDULES ? (
                <div data-testid="directive-schedules-panel" className="min-h-0 flex-1 overflow-hidden">
                    {children}
                </div>
            ) : (
                <div
                    data-testid="directive-sync-empty-panel"
                    className="m-4 flex min-h-0 flex-1 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]"
                >
                    <div className="relative h-full w-full overflow-hidden rounded-2xl">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.08),transparent_40%)]" />
                    </div>
                </div>
            )}
        </div>
    );
}
