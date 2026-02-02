"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Key, Copy, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";

export default function ResetPasswordModal({ userId, userName }: { userId: string, userName: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [newPassword, setNewPassword] = useState<string | null>(null);
    const { showToast } = useToast();
    const router = useRouter();

    const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const password = formData.get("password") as string;

        try {
            const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to reset password");
            }

            // Success
            setNewPassword(password);
            showToast("Password reset successfully", "success");
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setNewPassword(null);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast("Password copied to clipboard", "success");
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogTrigger asChild>
                <button
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                >
                    <Key className="h-4 w-4 mr-2" />
                    Reset Password
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{newPassword ? "Password Reset Successful" : `Reset Password for ${userName}`}</DialogTitle>
                </DialogHeader>

                {newPassword ? (
                    <div className="space-y-4">
                        <div className="rounded-md bg-green-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <Check className="h-5 w-5 text-green-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-green-800">Password Updated</h3>
                                    <div className="mt-2 text-sm text-green-700">
                                        <p>The new password is active immediately. Please copy it now.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-md space-y-3 border border-gray-200">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">New Password</label>
                                <div className="mt-1 flex items-center justify-between">
                                    <div className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border border-gray-300 flex-1 mr-2">
                                        {newPassword}
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(newPassword)}
                                        className="p-2 text-gray-500 hover:text-indigo-600"
                                        title="Copy Password"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="space-y-4">
                        <div className="rounded-md bg-amber-50 p-4 mb-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-amber-800">Warning</h3>
                                    <div className="mt-2 text-sm text-amber-700">
                                        <p>This will maintain the user's data but invalidate their old password immediately.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Set New Password
                            </label>
                            <input
                                type="text"
                                name="password"
                                id="password"
                                required
                                minLength={6}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                placeholder="Enter new password"
                            />
                        </div>

                        <div className="mt-5 sm:mt-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex w-full justify-center rounded-md border border-transparent bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? "Updating..." : "Update Password"}
                            </button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
