#!/usr/bin/env python3
"""
The player's playlist, for the walkthrough's last chapter: a public Spotify
playlist's tracks with their 30-second previews and album covers, written to
src/lib/player/playlist.json.

    python3 scripts/spotify-playlist.py https://open.spotify.com/playlist/<id> [max tracks]

No account or key: the track list and preview URLs come from the playlist's
embed page (open.spotify.com/embed/playlist/<id>, its __NEXT_DATA__), and each
cover from Spotify's oEmbed for the track. Covers are kept as Spotify image
URLs at the 64 x 64 size Spotify serves (the OLED's resolution) and 300 x 300,
fetched by the page itself; nothing is re-hosted. Tracks without a preview
are skipped.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
# Spotify's album-art ids carry their size in the first 16 hex digits.
SIZES = {"300": "ab67616d00001e02", "64": "ab67616d00004851", "640": "ab67616d0000b273"}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read().decode()


def main(link, limit=12):
    pid = re.search(r"playlist[/:]([A-Za-z0-9]+)", link).group(1)
    page = get(f"https://open.spotify.com/embed/playlist/{pid}")
    data = json.loads(re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.S).group(1))
    entity = data["props"]["pageProps"]["state"]["data"]["entity"]
    tracks = []
    for t in entity["trackList"]:
        preview = (t.get("audioPreview") or {}).get("url")
        if not preview or not t.get("isPlayable", True):
            continue
        tid = t["uri"].split(":")[-1]
        url = f"https://open.spotify.com/track/{tid}"
        thumb = json.loads(get("https://open.spotify.com/oembed?url=" + urllib.parse.quote(url, safe="")))["thumbnail_url"]
        image = thumb.rsplit("/", 1)[1]
        rest = image[16:] if image[:16] in SIZES.values() else None
        tracks.append(
            {
                "title": t["title"],
                "artist": t["subtitle"],
                "url": url,
                "preview": preview,
                "cover": f"https://i.scdn.co/image/{SIZES['64']}{rest}" if rest else thumb,
                "art": f"https://i.scdn.co/image/{SIZES['300']}{rest}" if rest else thumb,
                "ms": t.get("duration"),
            }
        )
        print(f"  {len(tracks):>2}  {t['title']} — {t['subtitle']}")
        if len(tracks) >= limit:
            break
    out = {"name": entity["name"], "url": f"https://open.spotify.com/playlist/{pid}", "tracks": tracks}
    path = os.path.join(os.path.dirname(__file__), "..", "src/lib/player/playlist.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"{entity['name']}: {len(tracks)} tracks -> {os.path.normpath(path)}")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], *(int(a) for a in sys.argv[2:]))
