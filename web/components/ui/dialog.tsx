"use client";

import * as React from "react";
import { Dialog as HeadlessDialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";

// Context to handle open state if needed, though HeadlessDialog handles it via props.
// We need to map the shadcn-like API to Headless UI.

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => { } });

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
    // If controlled, use props. If uncontrolled, use state (simplified for now to rely on controlled for our modals)
    const [isOpen, setIsOpen] = React.useState(open || false);

    React.useEffect(() => {
        if (open !== undefined) setIsOpen(open);
    }, [open]);

    const handleOpenChange = (val: boolean) => {
        setIsOpen(val);
        onOpenChange?.(val);
    };

    return (
        <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
            {children}
        </DialogContext.Provider>
    );
};

export const DialogTrigger = ({ asChild, children, onClick }: { asChild?: boolean; children: React.ReactNode; onClick?: () => void }) => {
    const { onOpenChange } = React.useContext(DialogContext);

    // Clone element to inject onClick if asChild
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement, {
            onClick: (e: React.MouseEvent) => {
                onOpenChange(true);
                onClick?.();
                (children as any).props.onClick?.(e);
            }
        });
    }

    return (
        <button onClick={() => onOpenChange(true)}>
            {children}
        </button>
    );
};

export const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const { open, onOpenChange } = React.useContext(DialogContext);

    return (
        <Transition show={open} as={React.Fragment}>
            <HeadlessDialog as="div" className="relative z-50" onClose={() => onOpenChange(false)}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <HeadlessDialog.Panel className={`relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full ${className || 'sm:max-w-lg'}`}>
                                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        <span className="sr-only">Close</span>
                                        <X className="h-6 w-6" aria-hidden="true" />
                                    </button>
                                </div>
                                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                    {children}
                                </div>
                            </HeadlessDialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    );
};

export const DialogHeader = ({ children }: { children: React.ReactNode }) => {
    return <div className="mb-4">{children}</div>;
};

export const DialogTitle = ({ children }: { children: React.ReactNode }) => {
    return (
        <HeadlessDialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
            {children}
        </HeadlessDialog.Title>
    );
};
