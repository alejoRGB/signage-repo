"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, FileVideo, FileImage, ExternalLink, Globe } from "lucide-react";
import { upload } from '@vercel/blob/client';
import AddWebsiteModal from "@/components/media/add-website-modal";
import ConfirmModal from "@/components/confirm-modal";
import { useToast } from "@/components/ui/toast-context";

type MediaItem = {
    id: string;
    name: string;
    type: string;
    url: string;
    width: number | null;
    height: number | null;
    fps: number | null;
    duration: number | null;
    createdAt: Date;
};

export default function MediaManager({ initialMedia }: { initialMedia: MediaItem[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isAddWebsiteOpen, setIsAddWebsiteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const extractMetadata = (file: File): Promise<{ width: number; height: number; fps?: number; duration?: number }> => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            if (file.type.startsWith("image")) {
                const img = new Image();
                img.onload = () => {
                    resolve({ width: img.naturalWidth, height: img.naturalHeight, duration: 10 }); // Default 10s for images
                    URL.revokeObjectURL(url);
                };
                img.onerror = () => {
                    resolve({ width: 0, height: 0, duration: 10 });
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            } else if (file.type.startsWith("video")) {
                const video = document.createElement("video");
                video.preload = "metadata";

                const onLoaded = () => {
                    let duration = video.duration;
                    // Hack: invalid duration often comes as Infinity or NaN for Blobs
                    if (!Number.isFinite(duration)) duration = 0;

                    // If 0, try a hack: seek to end? No, that's heavy.
                    // Just resolve what we have, but if it's 0, we might want to try harder?
                    // Let's resolve. The user said "always detected", so if it's 0, it's a failure.
                    // But usually this works if we just wait properly for 'loadedmetadata'.

                    resolve({
                        width: video.videoWidth,
                        height: video.videoHeight,
                        fps: 30,
                        duration: Math.ceil(duration) || 0 // Use ceil to avoid 0.99s becoming 0s
                    });
                    URL.revokeObjectURL(url);
                };

                video.onloadedmetadata = () => {
                    if (video.duration === Infinity) {
                        // Fix for Chrome bug with Blobs: set currentTime to trigger duration calc
                        video.currentTime = 1e101;
                        video.ontimeupdate = () => {
                            video.currentTime = 0;
                            video.ontimeupdate = null;
                            // The duration should be fixed now
                            // We call onLoaded manually or wait? 
                            // simpler: just re-read duration in a small timeout or directly
                            let d = video.duration;
                            if (d === Infinity) d = 0;
                            resolve({
                                width: video.videoWidth,
                                height: video.videoHeight,
                                fps: 30,
                                duration: Math.ceil(d)
                            });
                            URL.revokeObjectURL(url);
                        };
                    } else {
                        onLoaded();
                    }
                };

                video.onerror = () => {
                    resolve({ width: 0, height: 0, duration: 0 });
                    URL.revokeObjectURL(url);
                };
                video.src = url;
            } else {
                resolve({ width: 0, height: 0, duration: 10 });
            }
        });
    };

    const handleAddWebsite = async (data: { name: string; url: string; duration: number; cacheForOffline: boolean; orientation: string }) => {
        try {
            const res = await fetch("/api/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    url: data.url,
                    type: "web",
                    filename: null,
                    width: null,
                    height: null,
                    fps: null,
                    size: 0,
                    duration: data.duration,
                    cacheForOffline: data.cacheForOffline,
                    orientation: data.orientation
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to add website");
            }

            showToast("Website added successfully", "success");
            router.refresh();
        } catch (error) {
            console.error(error);
            showToast("Failed to add website", "error");
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);

        try {
            // 1. Extract Metadata
            const metadata = await extractMetadata(file);

            // 2. Upload directly to Vercel Blob (Client Side)
            const uniqueFilename = `${Date.now()}-${file.name}`;
            const newBlob = await upload(uniqueFilename, file, {
                access: 'public',
                handleUploadUrl: '/api/media/upload',
            });

            // 3. Determine type
            const type = file.type.startsWith("video") ? "video" : "image";

            // 4. Save metadata to our DB
            const res = await fetch("/api/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: file.name,
                    url: newBlob.url,
                    type: type,
                    filename: newBlob.pathname,
                    width: metadata.width,
                    height: metadata.height,
                    fps: metadata.fps,
                    size: file.size,
                    duration: metadata.duration
                }),
            });

            if (!res.ok) throw new Error("Failed to save media metadata");

            setFile(null);
            // Reset file input value
            const fileInput = document.getElementById("file-upload") as HTMLInputElement;
            if (fileInput) fileInput.value = "";

            router.refresh();
        } catch (error) {
            console.error(error);
            showToast("Error uploading file", "error");
        } finally {
            setUploading(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        try {
            const res = await fetch(`/api/media?id=${deleteId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error("Failed to delete media");
            }
            router.refresh();
        } catch (error) {
            showToast("Error deleting file", "error");
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-6">
            <ConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Delete Media"
                message="Are you sure you want to permanently delete this file? This action cannot be undone."
                confirmText="Delete"
                isDestructive={true}
            />

            <AddWebsiteModal
                isOpen={isAddWebsiteOpen}
                onClose={() => setIsAddWebsiteOpen(false)}
                onAdd={handleAddWebsite}
            />

            {/* Upload Section */}
            <div className="bg-card border border-border sm:rounded-lg p-6 shadow-none">
                <div className="sm:flex sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-foreground">Upload Media</h3>
                        <div className="mt-2 max-w-xl text-sm text-muted-foreground">
                            <p>Upload images/videos or add dashboard URLs.</p>
                        </div>
                    </div>
                    <div className="mt-4 sm:mt-0 sm:flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsAddWebsiteOpen(true)}
                            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                        >
                            <Globe className="mr-2 h-4 w-4 text-primary" />
                            Add Website
                        </button>
                    </div>
                </div>

                <form onSubmit={handleUpload} className="mt-5 sm:flex sm:items-center gap-4">
                    <div className="w-full sm:max-w-xs">
                        <label htmlFor="file-upload" className="sr-only">
                            Choose file
                        </label>
                        <input
                            type="file"
                            id="file-upload"
                            name="file-upload"
                            accept="image/*,video/*"
                            onChange={handleFileChange}
                            className="block w-full rounded-md border border-border bg-black/20 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all focus:outline-none focus:border-primary"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className={`mt-3 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm transition-all ${(!file || uploading) ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                    >
                        {uploading ? (
                            <>Loading...</>
                        ) : (
                            <><Upload className="mr-2 h-4 w-4" /> Upload</>
                        )}
                    </button>
                </form>
            </div>

            {/* Gallery Section */}
            <h3 className="text-lg font-medium leading-6 text-foreground mt-8 mb-4">Media Library <span className="text-muted-foreground ml-2 text-sm font-normal">({initialMedia.length} items)</span></h3>

            {initialMedia.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg border-2 border-dashed border-border">
                    <FileImage className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No media</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Get started by uploading a file or adding a website.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {initialMedia.map((item) => (
                        <div key={item.id} className="group relative bg-card border border-border rounded-xl overflow-hidden shadow-none hover:border-primary/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300">
                            <div className="aspect-video w-full relative bg-black/50 overflow-hidden">
                                {item.type === 'video' ? (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <video src={item.url} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                                        <FileVideo className="h-10 w-10 text-white/50 relative z-10" />
                                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-[10px] font-mono text-white/90 z-10 backdrop-blur-sm">
                                            {item.duration ? `${item.duration}s` : 'Unknown'}
                                        </div>
                                    </div>
                                ) : item.type === 'web' ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                                        <Globe className="h-10 w-10 text-primary/50 mb-2 group-hover:text-primary transition-colors" />
                                        <span className="text-primary/70 text-xs font-medium px-2 rounded-full border border-primary/20 bg-primary/5">WEB CONTENT</span>
                                    </div>
                                ) : (
                                    <div className="relative w-full h-full">
                                        <img src={item.url} alt={item.name} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                                        {item.width && (
                                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-[10px] font-mono text-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                {item.width}x{item.height}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Overlay Actions */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-white/10 rounded-full text-white hover:bg-primary hover:scale-110 transition-all border border-white/20 backdrop-blur-sm"
                                        title="View"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                    <button
                                        onClick={() => setDeleteId(item.id)}
                                        className="p-2 bg-white/10 rounded-full text-white hover:bg-red-500 hover:scale-110 transition-all border border-white/20 backdrop-blur-sm"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 border-t border-border bg-card/50">
                                <p className="block text-sm font-medium text-foreground truncate" title={item.name}>{item.name}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">
                                        {item.type}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
