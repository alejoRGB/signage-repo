"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, FileVideo, FileImage, ExternalLink } from "lucide-react";
import { upload } from '@vercel/blob/client';

type MediaItem = {
    id: string;
    name: string;
    type: string;
    url: string;
    createdAt: Date;
};

export default function MediaManager({ initialMedia }: { initialMedia: MediaItem[] }) {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };



    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);

        try {
            // 1. Upload directly to Vercel Blob (Client Side)
            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/media/upload',
                addRandomSuffix: true,
            });

            // 2. Determine type
            const type = file.type.startsWith("video") ? "video" : "image";

            // 3. Save metadata to our DB
            const res = await fetch("/api/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: file.name,
                    url: newBlob.url,
                    type: type,
                    filename: newBlob.pathname
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
            alert("Error uploading file");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            await fetch(`/api/media?id=${id}`, {
                method: "DELETE",
            });
            router.refresh();
        } catch (error) {
            alert("Error deleting file");
        }
    };

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white shadow sm:rounded-lg p-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Upload Media</h3>
                <div className="mt-2 max-w-xl text-sm text-gray-500">
                    <p>Upload images (JPEG, PNG) or videos (MP4) to display on your signs.</p>
                </div>
                <form onSubmit={handleUpload} className="mt-5 sm:flex sm:items-center">
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
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900 border p-2"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className={`mt-3 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm ${(!file || uploading) ? "opacity-50 cursor-not-allowed" : ""
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
            <h3 className="text-lg font-medium leading-6 text-gray-900 mt-8">Media Library ({initialMedia.length})</h3>

            {initialMedia.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <FileImage className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No media</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by uploading a file.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {initialMedia.map((item) => (
                        <div key={item.id} className="relative group bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="aspect-w-16 aspect-h-9 bg-gray-200 h-48 w-full flex items-center justify-center overflow-hidden">
                                {item.type === 'video' ? (
                                    <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
                                        <FileVideo className="h-12 w-12 text-gray-500" />
                                        <video src={item.url} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                    </div>
                                ) : item.type === 'image' ? (
                                    <img src={item.url} alt={item.name} className="object-cover w-full h-full" />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full bg-gray-100">
                                        <span className="text-gray-500 text-xs">Web</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-4">
                                <p className="block text-sm font-medium text-gray-900 truncate" title={item.name}>{item.name}</p>
                                <p className="block text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</p>
                            </div>

                            <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1 bg-white rounded-full shadow hover:bg-gray-100 text-gray-600">
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                                <button onClick={() => handleDelete(item.id)} className="p-1 bg-white rounded-full shadow hover:bg-red-50 text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
