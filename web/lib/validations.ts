import { z } from "zod";
import xss from "xss";

// Helper to sanitize strings
const sanitize = (value: string) => xss(value);

// Auth Schemas
export const RegisterSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").transform(sanitize),
    username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens").transform(sanitize),
    email: z.string().email("Invalid email address").transform(sanitize),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const LoginSchema = z.object({
    username: z.string().min(1, "Username is required").transform(sanitize),
    password: z.string().min(1, "Password is required"),
});

// Playlist Schemas
export const PlaylistItemSchema = z.object({
    mediaItemId: z.string().min(1, "Media Item ID is required").transform(sanitize),
    order: z.number().int().min(0, "Order must be a non-negative integer"),
    duration: z.number().int().positive("Duration must be positive").optional(), // Duration might be overrideable later
});

export const CreatePlaylistSchema = z.object({
    name: z.string().min(1, "Playlist name is required").max(100, "Name is too long").transform(sanitize),
    type: z.enum(["media", "web"]).optional().default("media"),
    orientation: z.enum(["landscape", "portrait", "portrait-270"]).optional().default("landscape"),
    items: z.array(PlaylistItemSchema).optional(),
});

export const UpdatePlaylistSchema = CreatePlaylistSchema.partial();

// Schedule Schemas
export const CreateScheduleSchema = z.object({
    name: z.string().min(1, "Schedule name is required").max(100).transform(sanitize),
    items: z.array(z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
        playlistId: z.string().min(1).transform(sanitize),
    })).optional(),
});

// Device Schemas
export const CreateDeviceSchema = z.object({
    name: z.string().min(1, "Device name is required").max(50).transform(sanitize),
});

export const UpdateDeviceSchema = z.object({
    name: z.string().min(1).max(50).transform(sanitize).optional(),
    status: z.enum(["online", "offline", "unpaired"]).optional(),
    activePlaylistId: z.string().optional().nullable().transform((val) => val ? sanitize(val) : val),
    defaultPlaylistId: z.string().optional().nullable().transform((val) => val ? sanitize(val) : val),
    scheduleId: z.string().optional().nullable().transform((val) => val ? sanitize(val) : val),
});

// Admin User Schemas
export const CreateUserSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const ResetPasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const UpdateUserSchema = z.object({
    isActive: z.boolean().optional(),
    name: z.string().optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
});

export const CreateMediaItemSchema = z.object({
    name: z.string().min(1, "Name is required").transform(sanitize),
    url: z.string().url("Invalid URL").transform(sanitize),
    type: z.enum(["image", "video"]),
    filename: z.string().min(1, "Filename is required").transform(sanitize),
    width: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional(),
    height: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional(),
    fps: z.union([z.number(), z.string().transform((val) => parseFloat(val))]).nullable().optional(),
    size: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional(),
    duration: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional().default(10),
    cacheForOffline: z.boolean().optional().default(false),
});
