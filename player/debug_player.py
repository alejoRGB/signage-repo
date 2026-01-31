
import json
import os
import datetime

home = os.path.expanduser("~")
playlist_path = os.path.join(home, "signage-player", "playlist.json")

print(f"Checking: {playlist_path}")

if not os.path.exists(playlist_path):
    print("ERROR: playlist.json NOT FOUND")
    exit(1)

with open(playlist_path, 'r') as f:
    data = json.load(f)

print(f"Device Name: {data.get('device_name')}")
print(f"Current Time (Player): {datetime.datetime.now()}")

print("\n--- SCHEDULE ---")
if data.get('schedule'):
    for item in data['schedule']['items']:
        print(f"Day {item['dayOfWeek']}: {item['startTime']} - {item['endTime']} -> Playlist: {item['playlist']['name']}")
else:
    print("No Schedule found.")

print("\n--- DEFAULT PLAYLIST ---")
if data.get('default_playlist'):
    def_pl = data['default_playlist']
    print(f"Name: {def_pl['name']}")
    print("Items:")
    for item in def_pl['items']:
        print(f" - [{item.get('type')}] {item.get('url')} (Duration: {item.get('duration')}s)")
else:
    print("No Default Playlist.")

print("\n--- LEGACY PLAYLIST ---")
if data.get('playlist'):
     print(f"Name: {data['playlist']['name']}")
