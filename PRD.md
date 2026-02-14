# Product Requirements Document (PRD)
# Digital Signage System

## 1. Overview

**Product Name:** Digital Signage System  
**Version:** 1.0  
**Last Updated:** February 2026  
**Purpose:** Cloud-based digital signage management system with web dashboard and Raspberry Pi player client.

### 1.1 System Architecture

The system consists of two main components:

1. **Web Dashboard** (Next.js + PostgreSQL/Prisma)
   - Management interface for users and administrators
   - Hosted on Vercel with Neon PostgreSQL database
   - RESTful API backend

2. **Player Client** (Python + MPV + Chromium)
   - Raspberry Pi software that displays content
   - Syncs with cloud dashboard via API
   - Supports offline playback

---

## 2. User Roles and Authentication

### 2.1 User Roles

**ADMIN:**
- Can create, edit, and delete user accounts
- Can reset user passwords
- Has administrative functions only (no access to user content)
- Does NOT have access to other users' devices, media, playlists, or schedules

**USER:**
- Standard user with full access to their own content
- Can manage devices, media, playlists, and schedules
- Cannot create other users or access admin functions

### 2.2 Authentication Features

**Login:**
- Email and password authentication
- Session-based authentication using NextAuth
- Protected routes via middleware

**User Management (Admin Only):**
- Admins can create new users with email, name, and password
- Admins can reset any user's password
- Admins can activate/deactivate user accounts
- Users CANNOT self-register
- Password recovery functionality does NOT exist

**Sessions:**
- Users remain logged in until they explicitly sign out
- Session tokens managed by NextAuth

---

## 3. Device Management

### 3.1 Device Pairing

**Pairing Flow:**
1. Raspberry Pi player starts unpaired
2. Player calls `/api/device/register` to generate a unique pairing code (6-digit alphanumeric)
3. Player displays pairing code on screen (black background with white text using PIL/feh)
4. User enters pairing code in web dashboard
5. Dashboard validates code and pairs device to user account
6. Player receives confirmation and saves device token to `config.json`

**Pairing Code:**
- 6-character alphanumeric code
- Expires after a configurable time period
- Unique per device registration attempt
- Displayed fullscreen on device until paired

### 3.2 Device Properties

Each device has:
- **Name:** User-assigned friendly name (editable)
- **Token:** Unique authentication token (auto-generated, immutable)
- **Status:** `unpaired` or `paired`
- **Owner:** Single user (devices cannot be shared between users)
- **Last Seen:** Timestamp of last heartbeat/sync (updates every 60 seconds)
- **Online Status:** Calculated as online if `lastSeenAt` < 5 minutes ago
- **Active Playlist:** Currently playing playlist (optional)
- **Default Playlist:** Fallback playlist when no schedule matches (optional)
- **Schedule:** Assigned weekly schedule (optional)

### 3.3 Device Operations

**View Devices:**
- List all devices belonging to logged-in user
- Display: name, status badge (online/offline), last seen time, assigned playlist/schedule
- Auto-refresh every 10 seconds

**Edit Device:**
- Change device name
- Assign default playlist
- Assign schedule
- Changes sync to device within 60 seconds (on next heartbeat)

**Delete Device:**
- Permanently removes device from account
- Requires confirmation modal
- Device becomes unpaired and must re-pair to be used again

**View Device Logs:**
- Real-time logs from player client
- Logs stored in `DeviceLog` table with levels: INFO, WARNING, ERROR
- Displayed in modal with newest first
- Logs sent from player via `/api/device/logs` endpoint

**Manual Device Addition:**
- Feature has been REMOVED (not available in current version)
- Only pairing via code is supported

### 3.4 Device Sync

**Sync Endpoint:** `/api/device/sync`

**Sync Frequency:**
- Player sends heartbeat every 60 seconds
- Updates `lastSeenAt` timestamp
- Downloads playlist/schedule changes

**Sync Payload Sent to Player:**
```json
{
  "device_name": "string",
  "default_playlist": { playlist object with items },
  "schedule": { schedule object with items },
  "playlist": { legacy fallback playlist }
}
```

**Offline Behavior:**
- Player caches last synced data in `playlist.json`
- Continues playback using cached playlists and schedule
- Downloads media files to local storage (`~/signage-player/media/`)
- Resumes sync when internet connection restored

---

## 4. Media Library

### 4.1 Media Types

**IMAGE:**
- Supported formats: All browser-supported image formats (JPEG, PNG, GIF, WebP, etc.)
- Metadata extracted: width, height
- Default duration: 10 seconds (configurable per playlist item)
- No file size limit

**VIDEO:**
- Supported formats: All MPV-supported formats (MP4, AVI, MKV, WebM, etc.)
- Metadata extracted: width, height, fps (30fps default), duration (in seconds)
- Duration: Auto-detected from video file metadata
- Duration is NOT editable in playlists (uses actual video length)
- No file size limit

**WEB:**
- Any URL (websites, dashboards, web apps)
- Default duration: 10 seconds (configurable per playlist item)
- Orientation: `landscape` or `portrait-clockwise` or `portrait-counterclockwise`
- Cache for Offline: boolean flag
  - When `true`: Player attempts to load the page even when offline (uses browser cache)
  - When `false`: Page skipped if device is offline
  - No snapshot or pre-rendering occurs; relies on browser caching

### 4.2 Media Upload

**Upload Process:**
1. User selects file (image or video) via file input
2. Frontend extracts metadata using browser APIs (Image/Video element)
3. File uploaded to Vercel Blob Storage via `/api/media/upload`
4. Metadata saved to database via `/api/media` POST
5. Media item appears in library immediately

**Metadata Extraction:**
- Images: width, height detected via Image.onload
- Videos: width, height, duration, fps detected via Video.loadedmetadata
- Duration ceiling applied to avoid fractional seconds

**Add Website:**
- User clicks "Add Website" button
- Modal prompts for: name, URL, duration, orientation, cache offline checkbox
- Saved via `/api/media` POST with `type: "web"`

### 4.3 Media Management

**View Media:**
- Grid gallery view (4 columns on desktop)
- Thumbnails for images/videos
- Globe icon for web pages
- Display: name, type badge, resolution, creation date

**Delete Media:**
- Confirmation modal required
- Deletes from database and Vercel Blob Storage
- Cannot delete media currently used in playlists (enforcement TBD)

**Preview:**
- External link icon opens media in new tab
- Works for images, videos, and web URLs

---

## 5. Playlists

### 5.1 Playlist Types

**MEDIA Playlist:**
- Contains only images and videos
- Supports landscape orientation only
- Items play in sequential order, looping infinitely

**WEB Playlist:**
- Contains only web pages
- Supports orientation per playlist: `landscape`, `portrait-clockwise`, `portrait-counterclockwise`
- Screen rotation applies to entire playlist
- Items play in sequential order, looping infinitely

**Mixed Playlists:** NOT SUPPORTED (enforced at UI level)

### 5.2 Playlist Properties

- **Name:** User-defined name
- **Type:** `media` or `web` (set at creation, immutable)
- **Orientation:** For web playlists only (`landscape`, `portrait-clockwise`, `portrait-counterclockwise`)
- **Items:** Ordered list of playlist items
- **Owner:** User who created the playlist

### 5.3 Playlist Editor

**Create Playlist:**
- User prompted for name and type
- Empty playlist created
- Redirected to playlist editor

**Add Items:**
- Library panel shows filtered media:
  - Media playlists: show only images and videos
  - Web playlists: show only web pages
- Click media item to add to playlist
- Items added to end of playlist

**Reorder Items:**
- Up/Down arrow buttons to change order
- Order determines playback sequence

**Remove Items:**
- Trash icon removes item from playlist
- Order re-indexed automatically

**Duration Override:**
- Images and web pages: duration editable (MM:SS format via custom input)
- Videos: duration read-only (shows actual video duration)

**Save Playlist:**
- Saves name and items array via `/api/playlists/:id` PUT
- Changes sync to devices on next heartbeat

### 5.4 Playlist Assignment

**Default Playlist:**
- Assigned per device in device settings
- Plays when no schedule rule matches current time
- Fallback when schedule has gaps

**Active Playlist (Legacy):**
- Deprecated in favor of schedules
- Still supported for backward compatibility

---

## 6. Schedules

### 6.1 Schedule Concept

A schedule is a weekly calendar that assigns playlists to specific time slots across the week.

**Schedule Properties:**
- **Name:** User-defined name
- **Items:** List of schedule rules
- **Owner:** User who created the schedule
- **Devices:** Multiple devices can share the same schedule

### 6.2 Schedule Items (Rules)

Each schedule item defines:
- **Day of Week:** 0=Sunday, 1=Monday, ..., 6=Saturday
- **Start Time:** HH:MM (24-hour format)
- **End Time:** HH:MM (24-hour format)
- **Playlist ID:** Which playlist to play during this slot

**Rules:**
- Time ranges are inclusive: `[startTime, endTime)`
- Multiple rules can exist per day
- Rules CANNOT overlap on the same day (enforced with validation)
- Gaps are allowed (default playlist plays during gaps)
- Midnight wrap supported: `endTime: "00:00"` treated as `"24:00"`

### 6.3 Schedule Editor

**UI Layout:**
- 7 columns (one per day: Sunday-Saturday)
- Each day shows its schedule items sorted by start time
- Add Item button per day

**Add Schedule Item:**
- Default times: 08:00 - 12:00
- Validates for overlaps before adding
- Shows error toast if overlap detected

**Edit Schedule Item:**
- Time inputs: browser native `<input type="time">`
- Playlist dropdown: shows all user's playlists
- Real-time overlap validation
- Blocks update if overlap detected

**Remove Schedule Item:**
- X button on item card
- No confirmation required

**Copy Day Schedule:**
- Copy icon on day header
- Modal prompts for target day
- Replaces all items on target day with source day's items

**Save Schedule:**
- Saves name and all items via `/api/schedules/:scheduleId` PATCH
- Changes sync to devices on next heartbeat

### 6.4 Schedule Playback Logic

**Player Schedule Resolution (every 10 seconds):**
1. Get current day of week and time
2. Check schedule items for matching rule (dayOfWeek + time range)
3. If match found: play that playlist
4. If no match: play default playlist
5. If no default: play legacy active playlist
6. If none: stop playback

**Example:**
- Monday 09:30: Schedule says Playlist A → plays Playlist A
- Monday 14:00: No schedule rule → plays Default Playlist
- Schedule changes mid-playback: player detects change within 10 seconds and hot-swaps

**Gap Behavior:**
- If no schedule rule matches current time: default playlist plays
- If no default playlist assigned: playback stops (blank screen)

**Multiple Devices:**
- Multiple devices can be assigned the same schedule
- Each device independently resolves schedule based on its local clock

---

## 7. Player (Raspberry Pi Client)

### 7.1 Player Architecture

**Technology Stack:**
- Python 3
- MPV (video/image playback)
- Chromium (web page rendering in kiosk mode)
- feh (pairing code display)
- unclutter (hide mouse cursor)

**Player Modes:**
1. **Pairing Mode:** Displays pairing code until device is paired
2. **Media-Only Mode:** Uses MPV with M3U playlist for seamless video/image playback
3. **Web-Only Mode:** Item-by-item playback supporting web pages

### 7.2 Installation

**Setup Script:** `player/setup_device.sh`
- Installs dependencies (Python, MPV, Chromium, feh, unclutter)
- Creates `~/signage-player/` directory
- Copies player scripts
- Installs systemd service for auto-start on boot
- Sets timezone

**One-Line Install:**
```bash
curl -sL https://raw.githubusercontent.com/alejoRGB/signage-repo/master/player/setup_device.sh | bash
```

### 7.3 Playback Engine

**Media-Only Playlists:**
- Generates M3U playlist file
- Launches MPV with `--loop-playlist=inf`
- Seamless transitions (no black screens between items)
- Image display duration: per item or 10s default
- Video duration: auto-detected from file

**Web-Only Playlists:**
- Item-by-item controller loop
- For web items:
  - Closes MPV
  - Launches Chromium in kiosk mode (`--kiosk --app=URL`)
  - Waits for duration
  - Reuses browser instance if same URL
- Checks for playlist changes every 60 seconds (hot-swap support)

### 7.4 Screen Rotation

**Supported Orientations:**
- `landscape` (0°)
- `portrait-clockwise` (90° CW)
- `portrait-counterclockwise` (270° CW / 90° CCW)

**Rotation Mechanism:**
- Uses `xrandr` to rotate display
- Applied when playlist orientation changes
- Browser restarted automatically on orientation change
- Resets to landscape on player exit

### 7.5 Offline Support

**Cached Data:**
- Last sync data stored in `~/signage-player/playlist.json`
- Media files downloaded to `~/signage-player/media/`

**Offline Behavior:**
- Player continues using cached playlists and schedule
- Web pages with `cacheForOffline: false` are skipped
- Web pages with `cacheForOffline: true` attempt to load (may or may not work depending on browser cache)
- Resumes sync when internet returns

**Internet Check:**
- Simple socket connection to 8.8.8.8:53 (Google DNS)
- Checked before attempting to load web content

### 7.6 Logging

**Log Levels:** INFO, WARNING, ERROR

**Log Destinations:**
- Console output (stdout)
- Remote logging to dashboard via `/api/device/logs` POST

**Log Viewer:**
- Available in dashboard via device actions menu
- Real-time updates
- Useful for debugging playback issues

### 7.7 Screen Resolution

- **No limitations:** Player supports any resolution the Raspberry Pi and connected display support
- Automatically adapts to display resolution
- Fullscreen mode via MPV and Chromium kiosk mode

### 7.8 Multi-Device Sync

- **NOT SUPPORTED:** No synchronized playback between multiple devices
- Each device plays independently based on its own schedule

---

## 8. API Endpoints

### 8.1 Authentication

**POST** `/api/auth/[...nextauth]`
- NextAuth endpoints for login/logout

### 8.2 Device Management

**POST** `/api/device/register`
- Register new device, generate pairing code
- Returns: `{ pairing_code, device_token, poll_interval }`

**GET** `/api/device/status?token={token}`
- Check if device has been paired
- Returns: `{ status: "paired" | "unpaired" }`

**POST** `/api/device/sync`
- Fetch playlists and schedule for device
- Body: `{ device_token, playing_playlist_id }`
- Returns: `{ device_name, default_playlist, schedule, playlist }`
- Updates `lastSeenAt` timestamp (heartbeat)

**POST** `/api/device/pair`
- Pair device using pairing code
- Body: `{ pairingCode }`
- Returns: paired device object

**POST** `/api/device/logs`
- Submit log entry from player
- Body: `{ device_token, level, message }`

**GET** `/api/devices`
- List all devices for current user

**PUT** `/api/devices/:id`
- Update device (name, defaultPlaylistId, scheduleId)

**DELETE** `/api/devices/:id`
- Delete device

**GET** `/api/devices/:id/logs`
- Get logs for specific device

### 8.3 Media Management

**GET** `/api/media`
- List all media items for current user

**POST** `/api/media`
- Create media item (after upload or for web pages)
- Body: `{ name, url, type, filename, width, height, fps, size, duration, cacheForOffline, orientation }`

**DELETE** `/api/media?id={id}`
- Delete media item

**POST** `/api/media/upload`
- Vercel Blob upload handler (client-side upload)

**GET** `/api/media/download/:id`
- Download media file (for player sync)

### 8.4 Playlist Management

**GET** `/api/playlists`
- List all playlists for current user

**POST** `/api/playlists`
- Create new playlist
- Body: `{ name, type, orientation }`

**PUT** `/api/playlists/:id`
- Update playlist
- Body: `{ name, items: [{ mediaItemId, duration }] }`

**DELETE** `/api/playlists/:id`
- Delete playlist

### 8.5 Schedule Management

**GET** `/api/schedules`
- List all schedules for current user

**POST** `/api/schedules`
- Create new schedule
- Body: `{ name }`

**PATCH** `/api/schedules/:scheduleId`
- Update schedule
- Body: `{ name, items: [{ dayOfWeek, startTime, endTime, playlistId }] }`

**DELETE** `/api/schedules/:scheduleId`
- Delete schedule

### 8.6 Admin Endpoints

**POST** `/api/admin/users/create`
- Create new user (admin only)
- Body: `{ email, password, name, username }`

**PUT** `/api/admin/users/:id`
- Update user (admin only)

**DELETE** `/api/admin/users/:id`
- Delete user (admin only)

**POST** `/api/admin/users/:id/reset-password`
- Reset user password (admin only)
- Body: `{ newPassword }`

---

## 9. Data Models

### 9.1 User
```
id: String (cuid)
email: String (unique)
password: String (hashed)
name: String?
username: String? (unique)
role: Role (USER | ADMIN)
isActive: Boolean (default: true)
createdAt: DateTime
updatedAt: DateTime
```

### 9.2 Device
```
id: String (cuid)
name: String?
token: String (unique, cuid)
status: String (default: "unpaired")
lastSeenAt: DateTime?
userId: String?
activePlaylistId: String?
playingPlaylistId: String? (reported by device)
defaultPlaylistId: String?
scheduleId: String?
pairingCode: String? (unique)
pairingCodeExpiresAt: DateTime?
createdAt: DateTime
updatedAt: DateTime
```

### 9.3 MediaItem
```
id: String (cuid)
name: String
type: String (image | video | web)
url: String (Blob URL or web URL)
filename: String?
duration: Int (seconds, default: 10)
width: Int?
height: Int?
fps: Float?
size: Int (bytes, default: 0)
cacheForOffline: Boolean (default: false)
userId: String
createdAt: DateTime
updatedAt: DateTime
```

### 9.4 Playlist
```
id: String (cuid)
name: String
type: String (media | web, default: media)
orientation: String (landscape | portrait-clockwise | portrait-counterclockwise, default: landscape)
userId: String
createdAt: DateTime
updatedAt: DateTime
```

### 9.5 PlaylistItem
```
id: String (cuid)
order: Int
playlistId: String
mediaItemId: String
duration: Int (seconds, default: 10)
```

### 9.6 Schedule
```
id: String (cuid)
name: String
userId: String
createdAt: DateTime
updatedAt: DateTime
```

### 9.7 ScheduleItem
```
id: String (cuid)
scheduleId: String
dayOfWeek: Int (0=Sunday, 6=Saturday)
startTime: String (HH:MM)
endTime: String (HH:MM)
playlistId: String
```

### 9.8 DeviceLog
```
id: String (cuid)
deviceId: String
level: String (INFO | WARNING | ERROR)
message: String
createdAt: DateTime
```

### 9.9 Admin
```
id: String (cuid)
email: String (unique)
password: String (hashed)
name: String?
createdAt: DateTime
updatedAt: DateTime
```

---

## 10. Key User Flows

### 10.1 Device Setup Flow
1. User installs player on Raspberry Pi using one-line install command
2. Player boots and generates pairing code
3. Player displays code on screen (black background, white text)
4. User logs into web dashboard
5. User navigates to Devices tab
6. User clicks "Pair Device"
7. User enters pairing code
8. System validates and pairs device to user account
9. Player receives confirmation and saves token
10. Player screen clears and begins syncing content

### 10.2 Content Publishing Flow
1. User uploads media (images/videos) or adds web pages
2. User creates playlist(s) and adds media items
3. User creates schedule (optional) with time-based rules
4. User assigns default playlist and/or schedule to device
5. Changes sync to device within 60 seconds
6. Device begins playing updated content

### 10.3 Schedule-Based Playback Flow
1. Player syncs schedule and all referenced playlists
2. Every 10 seconds, player checks current day/time
3. Player finds matching schedule rule
4. If rule playlist differs from current: hot-swap to new playlist
5. If no rule matches: play default playlist
6. Loop continues 24/7

---

## 11. Technical Specifications

### 11.1 Frontend
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4
- **State Management:** React useState, SWR for data fetching
- **UI Components:** Custom components (buttons, modals, inputs)
- **Authentication:** NextAuth
- **File Upload:** Vercel Blob Client SDK

### 11.2 Backend
- **Framework:** Next.js API Routes
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Storage:** Vercel Blob Storage
- **Authentication:** NextAuth with credentials provider

### 11.3 Player Client
- **Language:** Python 3
- **Video Player:** MPV
- **Web Browser:** Chromium (kiosk mode)
- **Image Viewer:** feh (for pairing code)
- **Dependencies:** requests, Pillow, xrandr, unclutter
- **Service Management:** systemd

### 11.4 Deployment
- **Web:** Vercel (production)
- **Database:** Neon PostgreSQL (serverless)
- **Storage:** Vercel Blob
- **Player:** Self-hosted on Raspberry Pi

---

## 12. Limitations and Known Constraints

1. **No user self-registration:** Only admins can create accounts
2. **No password recovery:** Lost passwords must be reset by admin
3. **No file size limits:** Uploads are unrestricted (may cause performance issues with very large files)
4. **No multi-user device sharing:** Each device belongs to exactly one user
5. **No synchronized playback:** Devices play independently
6. **Web page offline caching is best-effort:** Depends on browser cache, not pre-rendered
7. **Admin role has limited scope:** Admins manage users but not user content
8. **Mixed playlists not supported:** Playlists are either media-only or web-only
9. **Video duration is immutable:** Cannot be overridden in playlists
10. **No resolution restrictions:** Player supports any resolution but not optimized for specific displays

---

## 13. Testing Scenarios

### 13.1 Authentication
- ✅ User can log in with valid credentials
- ✅ User cannot log in with invalid credentials
- ✅ User session persists across page reloads
- ✅ User can log out successfully
- ✅ Protected routes redirect to login when unauthenticated

### 13.2 Device Management
- ✅ Device generates unique pairing code on startup
- ✅ User can pair device using valid pairing code
- ✅ Pairing with invalid code fails with error
- ✅ Device status updates to "paired" after pairing
- ✅ Device heartbeat updates `lastSeenAt` every 60 seconds
- ✅ Device shows as "online" when lastSeenAt < 5 minutes
- ✅ Device shows as "offline" when lastSeenAt > 5 minutes
- ✅ User can edit device name
- ✅ User can assign default playlist to device
- ✅ User can assign schedule to device
- ✅ User can delete device with confirmation
- ✅ Device logs are viewable in dashboard
- ✅ Only device owner can see their devices

### 13.3 Media Library
- ✅ User can upload image file
- ✅ Image metadata (width, height) extracted correctly
- ✅ User can upload video file
- ✅ Video metadata (width, height, duration, fps) extracted correctly
- ✅ User can add web page with URL
- ✅ User can set web page orientation
- ✅ User can toggle "cache for offline" for web pages
- ✅ User can delete media item with confirmation
- ✅ Media grid displays thumbnails correctly
- ✅ Only media owner can see their media items

### 13.4 Playlists
- ✅ User can create media playlist
- ✅ User can create web playlist
- ✅ Media playlist only shows images/videos in library
- ✅ Web playlist only shows web pages in library
- ✅ User can add items to playlist
- ✅ User can reorder items (up/down)
- ✅ User can remove items from playlist
- ✅ Duration is editable for images and web pages
- ✅ Duration is read-only for videos
- ✅ Playlist saves successfully
- ✅ Empty playlists are allowed

### 13.5 Schedules
- ✅ User can create schedule
- ✅ User can add schedule item to any day
- ✅ User can edit start time, end time, and playlist
- ✅ Overlapping schedule items are rejected with error
- ✅ User can remove schedule item
- ✅ User can copy day's schedule to another day
- ✅ Schedule saves successfully
- ✅ Multiple devices can share same schedule
- ✅ Empty schedules are allowed

### 13.6 Player Playback
- ✅ Unpaired player displays pairing code
- ✅ Paired player syncs playlists successfully
- ✅ Media-only playlist plays seamlessly in MPV
- ✅ Web playlist opens Chromium in kiosk mode
- ✅ Images display for configured duration
- ✅ Videos play for actual duration
- ✅ Web pages display for configured duration
- ✅ Playlist loops infinitely
- ✅ Schedule rules are evaluated correctly
- ✅ Default playlist plays during schedule gaps
- ✅ Player hot-swaps playlist when schedule changes
- ✅ Screen rotation changes for web playlists
- ✅ Player continues playback when offline (with cached data)
- ✅ Web pages with cacheForOffline=false skip when offline
- ✅ Player resumes sync when internet restored

### 13.7 Admin Functions
- ✅ Admin can create new user
- ✅ Admin can reset user password
- ✅ Admin can activate/deactivate user
- ✅ Admin cannot access user's devices
- ✅ Admin cannot access user's media
- ✅ Regular user cannot access admin panel

---

## 14. Edge Cases and Error Handling

1. **Pairing code expires:** User gets error and must restart player
2. **Device deleted while playing:** Player continues with cached content until token invalidated
3. **Schedule item spans midnight:** Handled via "00:00" → "24:00" conversion
4. **No default playlist and no schedule match:** Player stops playback (blank screen)
5. **Playlist deleted while assigned to device:** Device continues playing until next sync (then stops or falls back)
6. **Schedule with no items:** Same as no schedule (plays default playlist)
7. **Web page fails to load:** Player logs error and continues to next item after duration
8. **Browser crashes during playback:** Player detects crash and skips to next item
9. **Rotation change mid-playback:** Browser restarts to apply new rotation
10. **Very large media files:** No limit enforced, may cause storage issues on device
11. **Multiple schedule rules for same time:** First match in database order is used (undefined behavior, should be prevented by overlap validation)
12. **User deletes media used in playlist:** Media item removed from playlist automatically (cascade delete)

---

## End of Document

This PRD documents all features and functionalities of the Digital Signage System as of February 2026. It is intended for use by automated testing services and development teams to understand system behavior comprehensively.
