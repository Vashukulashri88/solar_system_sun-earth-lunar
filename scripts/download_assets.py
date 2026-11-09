import os
import sys
import json
import urllib.request
from PIL import Image

BASE_DIR = r"C:\Users\ckceg\.gemini\antigravity\scratch\earth-sun-moon-orbit-sim"
TEXTURES_DIR = os.path.join(BASE_DIR, "assets", "textures")
SEASONAL_DIR = os.path.join(TEXTURES_DIR, "seasonal")
DATA_DIR = os.path.join(BASE_DIR, "assets", "data")

def download_url(url, dest_path, min_bytes=10000):
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > min_bytes:
        print(f"Already exists: {dest_path} ({os.path.getsize(dest_path)} bytes)")
        return True
    print(f"Downloading {url} -> {dest_path}...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            if len(content) < min_bytes:
                print(f"ERROR: Downloaded content too small ({len(content)} bytes) for {url}")
                return False
            with open(dest_path, "wb") as f:
                f.write(content)
        print(f"Saved: {dest_path} ({len(content)} bytes)")
        return True
    except Exception as e:
        print(f"ERROR downloading {url}: {e}")
        return False

def verify_image(path, expected_w, expected_h):
    try:
        with Image.open(path) as im:
            w, h = im.size
            fmt = im.format
            print(f"Image verified: {os.path.basename(path)}: {fmt} {w}x{h}")
            if w != expected_w or h != expected_h:
                print(f"WARNING: dimensions mismatch (expected {expected_w}x{expected_h}, got {w}x{h})")
            return True
    except Exception as e:
        print(f"ERROR verifying image {path}: {e}")
        return False

def main():
    os.makedirs(TEXTURES_DIR, exist_ok=True)
    os.makedirs(SEASONAL_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Solar System Scope 8k textures
    base_8k = {
        "8k_earth_daymap.jpg": ("https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg", 8192, 4096),
        "8k_earth_nightmap.jpg": ("https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg", 8192, 4096),
        "8k_earth_clouds.jpg": ("https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg", 8192, 4096),
        "8k_moon.jpg": ("https://www.solarsystemscope.com/textures/download/8k_moon.jpg", 8192, 4096),
        "8k_stars_milky_way.jpg": ("https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg", 8192, 4096),
    }

    for name, (url, w, h) in base_8k.items():
        dest = os.path.join(TEXTURES_DIR, name)
        ok = download_url(url, dest, 100000)
        if not ok or not verify_image(dest, w, h):
            print(f"FATAL: Failed on {name}")
            sys.exit(1)

    # Specular map: download 8k TIFF and convert to PNG
    spec_tif = os.path.join(TEXTURES_DIR, "8k_earth_specular_map.tif")
    spec_png = os.path.join(TEXTURES_DIR, "8k_earth_specular_map.png")
    if not os.path.exists(spec_png) or os.path.getsize(spec_png) < 100000:
        download_url("https://www.solarsystemscope.com/textures/download/8k_earth_specular_map.tif", spec_tif, 100000)
        print("Converting specular TIFF to PNG...")
        with Image.open(spec_tif) as im:
            im.save(spec_png, format="PNG", optimize=True)
        print(f"Converted: {spec_png} ({os.path.getsize(spec_png)} bytes)")
    verify_image(spec_png, 8192, 4096)
    if os.path.exists(spec_tif):
        os.remove(spec_tif) # Clean up temp TIFF to save disk space

    # 2. 12 Monthly Blue Marble (8K: downsampled from NASA 21600x10800)
    months = [
        ("january", "200401", 1),
        ("february", "200402", 2),
        ("march", "200403", 3),
        ("april", "200404", 4),
        ("may", "200405", 5),
        ("june", "200406", 6),
        ("july", "200407", 7),
        ("august", "200408", 8),
        ("september", "200409", 9),
        ("october", "200410", 10),
        ("november", "200411", 11),
        ("december", "200412", 12)
    ]
    Image.MAX_IMAGE_PIXELS = None
    for month_name, yyyymm, m_idx in months:
        dest = os.path.join(SEASONAL_DIR, f"earth_month_{m_idx:02d}.jpg")
        if os.path.exists(dest) and os.path.getsize(dest) > 1000000:
            with Image.open(dest) as im:
                if im.size == (8192, 4096):
                    print(f"Already exists 8K: {dest}")
                    continue
        temp_dest = os.path.join(SEASONAL_DIR, f"temp_{yyyymm}.jpg")
        url = f"https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/{month_name}/world.{yyyymm}.3x21600x10800.jpg"
        ok = download_url(url, temp_dest, 10000000)
        if not ok:
            # Fallback to 5400x2700 if 21600 fails
            url_fallback = f"https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/{month_name}/world.{yyyymm}.3x5400x2700.jpg"
            download_url(url_fallback, temp_dest, 100000)
        with Image.open(temp_dest) as im:
            im_8k = im.resize((8192, 4096), Image.Resampling.LANCZOS)
            im_8k.save(dest, format="JPEG", quality=88, optimize=True)
        if os.path.exists(temp_dest):
            os.remove(temp_dest)
        if not verify_image(dest, 8192, 4096):
            print(f"FATAL: Failed on seasonal month {m_idx}")
            sys.exit(1)

    # 3. Country GeoJSON
    countries_dest = os.path.join(DATA_DIR, "countries.geojson")
    countries_url = "https://cdn.jsdelivr.net/gh/vasturiano/three-globe@master/example/country-polygons/ne_110m_admin_0_countries.geojson"
    download_url(countries_url, countries_dest, 10000)
    with open(countries_dest, "r", encoding="utf-8") as f:
        data = json.load(f)
        print(f"Countries loaded: {len(data.get('features', []))} features")

    # 4. Yale Bright Star Catalogue
    stars_dest = os.path.join(DATA_DIR, "bsc5p_radec_min.json")
    stars_url = "https://raw.githubusercontent.com/frostoven/BSC5P-JSON-XYZ/primary/catalogs/bsc5p_radec_min.json"
    download_url(stars_url, stars_dest, 100000)
    with open(stars_dest, "r", encoding="utf-8") as f:
        data = json.load(f)
        print(f"Stars loaded: {len(data)} stars")

    print("ALL ASSETS SUCCESSFULLY DOWNLOADED AND VERIFIED!")

if __name__ == "__main__":
    main()
