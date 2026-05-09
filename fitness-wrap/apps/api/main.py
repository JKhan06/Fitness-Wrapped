from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import zipfile
from lxml import etree
from datetime import datetime, date
from collections import defaultdict
from typing import Any, Iterable
import gzip
import math
import calendar
import csv
import io
import json
from datetime import timezone
try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve data/ relative to this file (not the shell working directory)
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Cache the last successfully processed Apple Health zip so the web viewer can fetch without re-uploading.
LAST_APPLE_ZIP_PATH: Path | None = None
LAST_EXPORT_XML_MEMBER: str | None = None
LAST_STRAVA_PATH: Path | None = None
LAST_GOOGLE_TAKEOUT_ZIP_PATH: Path | None = None
LAST_YEAR: int = 2025
def _find_latest_google_takeout_zip_in_uploads() -> Path | None:
    """Return the newest .zip in UPLOADS_DIR that looks like a Google Takeout export containing Google Fit sleep session JSON."""
    zips = list(UPLOADS_DIR.glob("*.zip"))
    if not zips:
        return None

    zips.sort(key=lambda p: p.stat().st_mtime, reverse=True)

    for zp in zips:
        try:
            with zipfile.ZipFile(zp, "r") as z:
                names = z.namelist()
                # Typical path: Takeout/Fit/All sessions/<date>_SLEEP.json
                # But Google Takeout folder names can vary, so just look for any *_SLEEP.json under Takeout/.
                has_sleep = any(
                    n.upper().endswith("_SLEEP.JSON") and (n.startswith("Takeout/") or "/TAKEOUT/" in n.upper())
                    for n in names
                )
                if has_sleep:
                    return zp
        except Exception:
            continue

    return None


def _find_latest_health_zip_in_uploads() -> Path | None:
    """Return the newest .zip in UPLOADS_DIR that looks like an Apple Health export (contains export.xml)."""
    zips = list(UPLOADS_DIR.glob("*.zip"))
    if not zips:
        return None

    zips.sort(key=lambda p: p.stat().st_mtime, reverse=True)

    for zp in zips:
        try:
            with zipfile.ZipFile(zp, "r") as z:
                if any(name.endswith("export.xml") for name in z.namelist()):
                    return zp
        except Exception:
            continue

    return None


def _find_latest_strava_upload_in_uploads() -> Path | None:
    """Return the newest Strava upload in UPLOADS_DIR.

    Accepts either:
    - a .zip that contains activities.csv
    - a raw activities.csv file
    """
    # Prefer raw CSV if present
    csvs = list(UPLOADS_DIR.glob("*activities*.csv"))
    csvs.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    if csvs:
        return csvs[0]

    # Otherwise find a zip that contains activities.csv
    zips = list(UPLOADS_DIR.glob("*.zip"))
    zips.sort(key=lambda p: p.stat().st_mtime, reverse=True)

    for zp in zips:
        try:
            with zipfile.ZipFile(zp, "r") as z:
                if any(name.lower().endswith("activities.csv") for name in z.namelist()):
                    return zp
        except Exception:
            continue

    return None


def _find_export_xml_member(zip_path: Path) -> str:
    """Find export.xml inside an Apple Health zip and return the member name."""
    with zipfile.ZipFile(zip_path, "r") as z:
        candidates = [n for n in z.namelist() if n.endswith("export.xml")]
        if not candidates:
            raise HTTPException(status_code=400, detail="export.xml not found inside zip")
        return candidates[0]


def _parse_apple_dt(s: str) -> datetime:
    """Parse Apple Health datetime strings like '2025-01-03 10:12:45 -0500'."""
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z")


def _duration_to_minutes(value: str | None, unit: str | None) -> float:
    if value is None:
        return 0.0
    try:
        v = float(value)
    except ValueError:
        return 0.0
    u = (unit or "").lower()
    if u in ("min", "mins", "minute", "minutes"):
        return v
    if u in ("s", "sec", "secs", "second", "seconds"):
        return v / 60.0
    if u in ("h", "hr", "hrs", "hour", "hours"):
        return v * 60.0
    return v


def _quantity_to_float(value: str | None) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def _distance_to_km(value: str | None, unit: str | None) -> float:
    v = _quantity_to_float(value)
    u = (unit or "").lower()
    if u in ("km", "kilometer", "kilometers"):
        return v
    if u in ("m", "meter", "meters"):
        return v / 1000.0
    if u in ("mi", "mile", "miles"):
        return v * 1.609344
    return v


def _sleep_asleep_hours(
    record_type: str | None, record_value: str | None, start_dt: datetime, end_dt: datetime
) -> float:
    if record_type != "HKCategoryTypeIdentifierSleepAnalysis":
        return 0.0
    if record_value != "HKCategoryValueSleepAnalysisAsleep":
        return 0.0
    seconds = max(0.0, (end_dt - start_dt).total_seconds())
    return seconds / 3600.0


def _month_name(m: int) -> str:
    try:
        return calendar.month_name[m]
    except Exception:
        return str(m)


def _compute_longest_streak(days: set[date]):
    if not days:
        return 0, None, None
    s = sorted(days)
    best_len = 1
    best_start = s[0]
    best_end = s[0]

    cur_len = 1
    cur_start = s[0]

    for i in range(1, len(s)):
        if (s[i] - s[i - 1]).days == 1:
            cur_len += 1
        else:
            if cur_len > best_len:
                best_len = cur_len
                best_start = cur_start
                best_end = s[i - 1]
            cur_len = 1
            cur_start = s[i]

    if cur_len > best_len:
        best_len = cur_len
        best_start = cur_start
        best_end = s[-1]

    return best_len, best_start, best_end


def _pretty_date(d: date | None) -> str:
    if d is None:
        return ""
    return d.strftime("%b %d")


# --- Google Fit (Takeout) sleep helpers ---

def _google_fit_tzinfo():
    # Prefer Toronto (matches your other data); fallback to system local; fallback to UTC.
    if ZoneInfo is not None:
        try:
            return ZoneInfo("America/Toronto")
        except Exception:
            pass
    try:
        return datetime.now().astimezone().tzinfo or timezone.utc
    except Exception:
        return timezone.utc


def parse_google_fit_sleep_from_takeout_zip(zip_path: Path, year: int) -> dict[str, Any]:
    """Parse Google Takeout -> Google Fit sleep sessions.

    Returns:
      {
        'ok': bool,
        'totals': {'sleepHours': float, 'avgSleepHours': float, 'sleepSessions': int},
        'monthly': {'sleepHours': [{'month': 1..12, 'hours': float}, ...]}
      }

    Notes:
    - We treat each sleep session record as one session.
    - We use start time to assign a session to a month.
    """
    tzinfo = _google_fit_tzinfo()

    total_sleep_hours = 0.0
    sleep_sessions = 0
    sleep_hours_by_month: dict[int, float] = defaultdict(float)

    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            # Collect all sleep JSON files
            sleep_files = [
                n
                for n in z.namelist()
                if n.upper().endswith("_SLEEP.JSON")
                and (n.startswith("Takeout/") or "/TAKEOUT/" in n.upper())
            ]

            if not sleep_files:
                return {"ok": False, "error": "No Google Fit sleep session JSON found in Takeout zip."}

            for name in sleep_files:
                try:
                    raw = z.read(name)
                except Exception:
                    continue

                try:
                    payload = json.loads(raw.decode("utf-8"))
                except Exception:
                    try:
                        payload = json.loads(raw.decode("utf-8", errors="replace"))
                    except Exception:
                        continue

                # Takeout sleep JSON can be either:
                # (A) one dict per file: {fitnessActivity: 'sleep', startTime: ISO, endTime: ISO, duration: '123.45s'}
                # (B) a list of sessions, or a wrapper with 'sessions'/'data' containing dicts with startTimeMillis/endTimeMillis

                def _parse_iso_dt(s: str) -> datetime | None:
                    if not s:
                        return None
                    s = str(s).strip()
                    # Normalize Zulu suffix
                    if s.endswith("Z"):
                        s = s.replace("Z", "+00:00")
                    # fromisoformat expects +HH:MM offset
                    try:
                        dt = datetime.fromisoformat(s)
                        # Ensure tz-aware
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        return dt.astimezone(tzinfo)
                    except Exception:
                        return None

                def _parse_duration_seconds(dur: Any) -> float | None:
                    if dur is None:
                        return None
                    if isinstance(dur, (int, float)):
                        return float(dur)
                    sdur = str(dur).strip()
                    # Typical: '13778.070s'
                    if sdur.endswith("s"):
                        try:
                            return float(sdur[:-1])
                        except Exception:
                            return None
                    try:
                        return float(sdur)
                    except Exception:
                        return None

                # Case (A): payload itself is a single-session dict
                if isinstance(payload, dict) and payload.get("fitnessActivity") == "sleep":
                    start_dt = _parse_iso_dt(payload.get("startTime"))
                    end_dt = _parse_iso_dt(payload.get("endTime"))
                    dur_sec = _parse_duration_seconds(payload.get("duration"))

                    if start_dt and start_dt.year == year:
                        if end_dt and end_dt > start_dt:
                            hours = (end_dt - start_dt).total_seconds() / 3600.0
                        elif dur_sec is not None:
                            hours = float(dur_sec) / 3600.0
                        else:
                            hours = 0.0

                        if hours > 0:
                            total_sleep_hours += hours
                            sleep_sessions += 1
                            sleep_hours_by_month[start_dt.month] += hours

                    continue

                # Case (B): list/wrapper formats
                items = payload if isinstance(payload, list) else payload.get("sessions") or payload.get("data") or []
                if not isinstance(items, list):
                    continue

                for sess in items:
                    if not isinstance(sess, dict):
                        continue

                    # Common keys: startTimeMillis / endTimeMillis
                    sm = sess.get("startTimeMillis")
                    em = sess.get("endTimeMillis")
                    if sm is None or em is None:
                        continue

                    try:
                        start_dt = datetime.fromtimestamp(int(sm) / 1000.0, tz=timezone.utc).astimezone(tzinfo)
                        end_dt = datetime.fromtimestamp(int(em) / 1000.0, tz=timezone.utc).astimezone(tzinfo)
                    except Exception:
                        continue

                    if start_dt.year != year:
                        continue

                    hours = max(0.0, (end_dt - start_dt).total_seconds()) / 3600.0
                    if hours <= 0:
                        continue

                    total_sleep_hours += hours
                    sleep_sessions += 1
                    sleep_hours_by_month[start_dt.month] += hours

    except Exception as e:
        return {"ok": False, "error": f"Failed to read Takeout zip: {e}"}

    avg_sleep = (total_sleep_hours / sleep_sessions) if sleep_sessions else 0.0

    monthly_series = [{"month": m, "hours": round(sleep_hours_by_month.get(m, 0.0), 2)} for m in range(1, 13)]

    return {
        "ok": True,
        "totals": {
            "sleepHours": round(total_sleep_hours, 2),
            "avgSleepHours": round(avg_sleep, 2),
            "sleepSessions": int(sleep_sessions),
        },
        "monthly": {"sleepHours": monthly_series},
    }


# --- Strava helpers ---

def _polyline_encode(coords: list[tuple[float, float]]) -> str:
    """
    Encode a list of (lat, lon) pairs into a Google/Strava-style polyline.
    """
    def _encode_value(v: int) -> str:
        v = ~(v << 1) if v < 0 else (v << 1)
        out = []
        while v >= 0x20:
            out.append(chr((0x20 | (v & 0x1F)) + 63))
            v >>= 5
        out.append(chr(v + 63))
        return "".join(out)

    last_lat = 0
    last_lng = 0
    result = []

    for lat, lng in coords:
        lat_i = int(round(lat * 1e5))
        lng_i = int(round(lng * 1e5))

        d_lat = lat_i - last_lat
        d_lng = lng_i - last_lng

        result.append(_encode_value(d_lat))
        result.append(_encode_value(d_lng))

        last_lat = lat_i
        last_lng = lng_i

    return "".join(result)


def _downsample_coords(coords: list[tuple[float, float]], max_points: int = 600) -> list[tuple[float, float]]:
    """
    Downsample points to keep payload light while preserving shape.
    Simple stride downsample is fine for this UI use-case.
    """
    n = len(coords)
    if n <= max_points:
        return coords
    stride = max(1, int(math.ceil(n / max_points)))
    return coords[::stride]

# --- Helper: compute bounds for a list of coordinates
def _coords_bounds(coords: list[tuple[float, float]]) -> dict[str, float] | None:
    if not coords:
        return None
    lats = [c[0] for c in coords]
    lons = [c[1] for c in coords]
    return {
        "minLat": float(min(lats)),
        "maxLat": float(max(lats)),
        "minLon": float(min(lons)),
        "maxLon": float(max(lons)),
    }


def _extract_coords_from_gpx(xml_bytes: bytes) -> list[tuple[float, float]]:
    """
    Extract (lat, lon) from a GPX file.
    """
    try:
        root = etree.fromstring(xml_bytes)
    except Exception:
        return []

    # GPX typically uses namespaces; search by local-name to be robust.
    pts = root.xpath("//*[local-name()='trkpt']")
    coords: list[tuple[float, float]] = []
    for p in pts:
        try:
            lat = float(p.get("lat"))
            lon = float(p.get("lon"))
            coords.append((lat, lon))
        except Exception:
            continue
    return coords


def _extract_coords_from_tcx(xml_bytes: bytes) -> list[tuple[float, float]]:
    """
    Extract (lat, lon) from a TCX file.
    """
    try:
        root = etree.fromstring(xml_bytes)
    except Exception:
        return []

    # TCX uses namespaces; use local-name queries.
    # Typical path: Trackpoint -> Position -> LatitudeDegrees/LongitudeDegrees
    lats = root.xpath("//*[local-name()='LatitudeDegrees']")
    lons = root.xpath("//*[local-name()='LongitudeDegrees']")
    coords: list[tuple[float, float]] = []

    # Pair sequentially; safest is to walk trackpoints
    tps = root.xpath("//*[local-name()='Trackpoint']")
    for tp in tps:
        try:
            lat_nodes = tp.xpath(".//*[local-name()='LatitudeDegrees']/text()")
            lon_nodes = tp.xpath(".//*[local-name()='LongitudeDegrees']/text()")
            if not lat_nodes or not lon_nodes:
                continue
            lat = float(lat_nodes[0])
            lon = float(lon_nodes[0])
            coords.append((lat, lon))
        except Exception:
            continue

    # Fallback pairing if Trackpoint traversal yielded nothing
    if not coords and len(lats) == len(lons) and len(lats) > 0:
        for i in range(len(lats)):
            try:
                coords.append((float(lats[i].text), float(lons[i].text)))
            except Exception:
                continue

    return coords


def _read_zip_member_bytes(z: zipfile.ZipFile, name: str) -> bytes | None:
    try:
        with z.open(name) as f:
            return f.read()
    except Exception:
        return None


def _extract_activity_route_from_zip(upload_zip_path: Path, activity_id: str | None) -> dict[str, Any] | None:
    """
    Try to locate the activity file (GPX/TCX) for a given Activity ID inside a Strava export zip.
    Returns:
      { "polyline": "<encoded>", "bounds": {minLat,maxLat,minLon,maxLon} }
    """
    if not activity_id:
        return None

    aid = str(activity_id).strip()
    if not aid:
        return None

    try:
        with zipfile.ZipFile(upload_zip_path, "r") as z:
            names = z.namelist()

            candidates = [
                n
                for n in names
                if ("activities/" in n.lower() or n.lower().startswith("activities"))
                and (aid in n)
                and (
                    n.lower().endswith(".gpx")
                    or n.lower().endswith(".tcx")
                    or n.lower().endswith(".gpx.gz")
                    or n.lower().endswith(".tcx.gz")
                )
            ]

            if not candidates:
                candidates = [
                    n
                    for n in names
                    if (aid in n)
                    and (
                        n.lower().endswith(".gpx")
                        or n.lower().endswith(".tcx")
                        or n.lower().endswith(".gpx.gz")
                        or n.lower().endswith(".tcx.gz")
                    )
                ]

            if not candidates:
                return None

            candidates.sort(
                key=lambda n: (0 if n.lower().endswith((".gpx", ".gpx.gz")) else 1, len(n))
            )
            chosen = candidates[0]

            raw = _read_zip_member_bytes(z, chosen)
            if not raw:
                return None

            if chosen.lower().endswith(".gz"):
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    return None

            if chosen.lower().endswith(".gpx"):
                coords = _extract_coords_from_gpx(raw)
            elif chosen.lower().endswith(".tcx"):
                coords = _extract_coords_from_tcx(raw)
            else:
                return None

            coords = _downsample_coords(coords, max_points=700)
            if len(coords) < 2:
                return None

            return {
                "polyline": _polyline_encode(coords),
                "bounds": _coords_bounds(coords),
            }
    except Exception:
        return None

def _parse_hms_to_seconds(s: str | None) -> int:
    if not s:
        return 0
    s = str(s).strip()
    try:
        if ":" not in s:
            return int(float(s))
    except Exception:
        pass

    parts = s.split(":")
    try:
        parts_i = [int(float(p)) for p in parts]
    except Exception:
        return 0

    if len(parts_i) == 3:
        h, m, sec = parts_i
        return h * 3600 + m * 60 + sec
    if len(parts_i) == 2:
        m, sec = parts_i
        return m * 60 + sec
    return 0


def _parse_strava_date(row: dict[str, str]) -> datetime | None:
    for k in ("Activity Date", "Start Date", "Start Date Local", "Date"):
        v = row.get(k)
        if not v:
            continue
        v = v.strip()
        for fmt in (
            "%d %b %Y, %H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(v, fmt)
            except Exception:
                continue
    return None


def _strava_distance_to_km(value: str | None) -> float:
    if value is None:
        return 0.0
    s = str(value).strip().replace(",", "")
    try:
        v = float(s)
    except Exception:
        return 0.0
    if v > 1000:
        return v / 1000.0
    return v


def parse_strava_metrics_from_upload(upload_path: Path, year: int) -> dict[str, Any]:
    def read_activities_csv_bytes_from_zip(z: zipfile.ZipFile) -> bytes | None:
        candidates = [n for n in z.namelist() if n.lower().endswith("activities.csv")]
        if not candidates:
            return None
        candidates.sort(key=len)
        with z.open(candidates[0]) as f:
            return f.read()

    if str(upload_path).lower().endswith(".zip"):
        with zipfile.ZipFile(upload_path, "r") as z:
            csv_bytes = read_activities_csv_bytes_from_zip(z)
    else:
        csv_bytes = upload_path.read_bytes()

    if not csv_bytes:
        return {"ok": False, "error": "activities.csv not found in Strava upload"}

    try:
        text = csv_bytes.decode("utf-8")
    except Exception:
        text = csv_bytes.decode("utf-8", errors="replace")

    reader = csv.DictReader(io.StringIO(text))

    total_km = 0.0
    total_seconds = 0
    total_elev_m = 0.0

    longest_run_km = 0.0
    longest_run_date: str | None = None
    longest_ride_km = 0.0
    longest_ride_date: str | None = None
    longest_run_id: str | None = None
    longest_ride_id: str | None = None
    longest_run_seconds = 0
    longest_ride_seconds = 0

    weekly_km: dict[tuple[int, int], float] = defaultdict(float)
    km_by_month: dict[int, float] = defaultdict(float)

    for row in reader:
        dt = _parse_strava_date(row)
        if not dt or dt.year != year:
            continue

        activity_type = (row.get("Activity Type") or row.get("Type") or "").strip().lower()
        activity_id = (row.get("Activity ID") or row.get("Activity ID ") or row.get("ActivityId") or "").strip() or None
        km = _strava_distance_to_km(row.get("Distance"))
        sec = _parse_hms_to_seconds(row.get("Moving Time") or row.get("Elapsed Time") or row.get("Time"))

        elev_s = row.get("Elevation Gain") or row.get("Total Elevation Gain")
        try:
            elev_m = float(str(elev_s).replace(",", "").strip()) if elev_s not in (None, "") else 0.0
        except Exception:
            elev_m = 0.0

        total_km += km
        total_seconds += sec
        total_elev_m += elev_m

        km_by_month[dt.month] += km
        iso = dt.isocalendar()
        weekly_km[(iso[0], iso[1])] += km

        if "run" in activity_type and km > longest_run_km:
            longest_run_km = km
            longest_run_date = dt.date().isoformat()
            longest_run_id = activity_id
            longest_run_seconds = int(sec or 0)

        if ("ride" in activity_type or "bike" in activity_type or "cycling" in activity_type) and km > longest_ride_km:
            longest_ride_km = km
            longest_ride_date = dt.date().isoformat()
            longest_ride_id = activity_id
            longest_ride_seconds = int(sec or 0)

    biggest_week_km = 0.0
    biggest_week_key: tuple[int, int] | None = None
    if weekly_km:
        biggest_week_key, biggest_week_km = max(weekly_km.items(), key=lambda x: x[1])

    monthly_series = [{"month": m, "km": round(km_by_month.get(m, 0.0), 2)} for m in range(1, 13)]

    longest_run_polyline: str | None = None
    longest_ride_polyline: str | None = None
    longest_run_bounds: dict[str, float] | None = None
    longest_ride_bounds: dict[str, float] | None = None

    if str(upload_path).lower().endswith(".zip"):
        run_route = _extract_activity_route_from_zip(upload_path, longest_run_id)
        ride_route = _extract_activity_route_from_zip(upload_path, longest_ride_id)

        if run_route:
            longest_run_polyline = run_route.get("polyline")
            longest_run_bounds = run_route.get("bounds")
        if ride_route:
            longest_ride_polyline = ride_route.get("polyline")
            longest_ride_bounds = ride_route.get("bounds")

    # Derived paces (seconds per km)
    longest_run_pace_sec_per_km: float | None = None
    if longest_run_km and longest_run_seconds:
        try:
            longest_run_pace_sec_per_km = float(longest_run_seconds) / float(longest_run_km)
        except Exception:
            longest_run_pace_sec_per_km = None

    longest_ride_pace_sec_per_km: float | None = None
    if longest_ride_km and longest_ride_seconds:
        try:
            longest_ride_pace_sec_per_km = float(longest_ride_seconds) / float(longest_ride_km)
        except Exception:
            longest_ride_pace_sec_per_km = None

    return {
        "ok": True,
        "totals": {
            "km": round(total_km, 2),
            "hours": round(total_seconds / 3600.0, 2),
            "elevGainM": round(total_elev_m, 0),
        },
        "highlights": {
            "longestRunKm": round(longest_run_km, 2),
            "longestRunDate": longest_run_date,
            "longestRunTimeSeconds": int(longest_run_seconds or 0),
            "longestRunPaceSecondsPerKm": round(longest_run_pace_sec_per_km, 2) if longest_run_pace_sec_per_km is not None else None,
            "longestRunPolyline": longest_run_polyline,
            "longestRunBounds": longest_run_bounds,

            "longestRideKm": round(longest_ride_km, 2),
            "longestRideDate": longest_ride_date,
            "longestRideTimeSeconds": int(longest_ride_seconds or 0),
            "longestRidePaceSecondsPerKm": round(longest_ride_pace_sec_per_km, 2) if longest_ride_pace_sec_per_km is not None else None,
            "longestRidePolyline": longest_ride_polyline,
            "longestRideBounds": longest_ride_bounds,

            "biggestWeekKm": round(biggest_week_km, 2),
            "biggestWeek": {"isoYear": biggest_week_key[0], "isoWeek": biggest_week_key[1]} if biggest_week_key else None,
        },
        "monthly": {"km": monthly_series},
    }


def parse_year_metrics_from_health_zip(zip_path: Path, export_xml_member: str, year: int) -> dict[str, Any]:
    total_steps = 0.0
    total_walk_run_km = 0.0
    total_flights = 0.0

    total_sleep_hours = 0.0
    longest_sleep_hours = 0.0
    sleep_sessions = 0
    
    steps_by_month: dict[int, float] = defaultdict(float)
    walk_run_km_by_month: dict[int, float] = defaultdict(float)
    flights_by_month: dict[int, float] = defaultdict(float)
    sleep_hours_by_month: dict[int, float] = defaultdict(float)

    active_days: set[date] = set()
    steps_by_day: dict[date, float] = defaultdict(float)

    with zipfile.ZipFile(zip_path, "r") as z:
        with z.open(export_xml_member) as xml_file:
            context = etree.iterparse(xml_file, events=("end",), tag=("Record",))

            for _event, elem in context:
                tag = elem.tag

                if tag == "Record":
                    r_type = elem.get("type")
                    start_s = elem.get("startDate")
                    end_s = elem.get("endDate")

                    if not start_s:
                        elem.clear()
                        continue

                    try:
                        start_dt = _parse_apple_dt(start_s)
                    except Exception:
                        elem.clear()
                        continue

                    if start_dt.year != year:
                        elem.clear()
                        continue

                    month = start_dt.month

                    if r_type == "HKQuantityTypeIdentifierStepCount":
                        v = _quantity_to_float(elem.get("value"))
                        d = start_dt.date()
                        total_steps += v
                        steps_by_month[month] += v
                        steps_by_day[d] += v
                        active_days.add(d)
                        elem.clear()
                        continue

                    if r_type == "HKQuantityTypeIdentifierDistanceWalkingRunning":
                        km = _distance_to_km(elem.get("value"), elem.get("unit"))
                        total_walk_run_km += km
                        walk_run_km_by_month[month] += km
                        active_days.add(start_dt.date())
                        elem.clear()
                        continue

                    if r_type == "HKQuantityTypeIdentifierFlightsClimbed":
                        v = _quantity_to_float(elem.get("value"))
                        total_flights += v
                        flights_by_month[month] += v
                        active_days.add(start_dt.date())
                        elem.clear()
                        continue

                    if r_type == "HKCategoryTypeIdentifierSleepAnalysis" and end_s:
                        try:
                            end_dt = _parse_apple_dt(end_s)
                        except Exception:
                            elem.clear()
                            continue

                        hours = _sleep_asleep_hours(r_type, elem.get("value"), start_dt, end_dt)
                        if hours > 0:
                            total_sleep_hours += hours
                            sleep_hours_by_month[month] += hours
                            longest_sleep_hours = max(longest_sleep_hours, hours)
                            sleep_sessions += 1

                        elem.clear()
                        continue

                    elem.clear()
                    continue

                elem.clear()

    def _monthly_series(d: dict[int, float], key: str, round_to: int = 2):
        return [{"month": m, key: round(d.get(m, 0.0), round_to)} for m in range(1, 13)]

    best_steps_month = max(range(1, 13), key=lambda m: steps_by_month.get(m, 0.0))

    streak_len, streak_start, streak_end = _compute_longest_streak(active_days)

    active_days_count = len(active_days)
    avg_steps_per_day = (total_steps / active_days_count) if active_days_count else 0.0
    avg_km_per_day = (total_walk_run_km / active_days_count) if active_days_count else 0.0

    cn_tower_equiv = (total_steps / 1776.0) if total_steps else 0.0

    if steps_by_day:
        max_step_day, max_step_value = max(steps_by_day.items(), key=lambda x: x[1])
    else:
        max_step_day, max_step_value = None, 0.0

    top_step_months = sorted(steps_by_month.items(), key=lambda x: x[1], reverse=True)[:3]

    return {
        "totals": {
            "steps": int(round(total_steps)),
            "walkRunKm": round(total_walk_run_km, 2),
            "flights": int(round(total_flights)),
            "sleepHours": round(total_sleep_hours, 2),
            "avgSleepHours": round((total_sleep_hours / sleep_sessions), 2) if sleep_sessions > 0 else 0,
            "longestSleepHours": round(longest_sleep_hours, 2),
            "activeDays": len(active_days),
            "avgStepsPerActiveDay": round(avg_steps_per_day, 0),
            "avgKmPerActiveDay": round(avg_km_per_day, 2),
            "longestStreakDays": int(streak_len),
            "longestStreakStart": streak_start.isoformat() if streak_start else None,
            "longestStreakEnd": streak_end.isoformat() if streak_end else None,
            "cnTowerEquiv": round(cn_tower_equiv, 1),
            "maxStepsInADay": int(round(max_step_value)),
            "maxStepsDate": max_step_day.isoformat() if max_step_day else None,
        },
        "monthly": {
            "steps": _monthly_series(steps_by_month, "steps", round_to=0),
            "walkRunKm": _monthly_series(walk_run_km_by_month, "km"),
            "flights": _monthly_series(flights_by_month, "flights", round_to=0),
            "sleepHours": _monthly_series(sleep_hours_by_month, "hours"),
        },
        "bestMonths": {
            "steps": {"month": best_steps_month, "name": _month_name(best_steps_month)},
        },
        "topStepMonths": [{"month": m, "name": _month_name(m), "steps": int(round(v))} for m, v in top_step_months],
    }


def _build_wrapped_response(
    zip_path: Path,
    export_xml_member: str,
    year: int,
    strava_path: Path | None = None,
    google_takeout_path: Path | None = None,
) -> dict[str, Any]:
    metrics = parse_year_metrics_from_health_zip(zip_path, export_xml_member, year)

    google_sleep: dict[str, Any] | None = None
    if google_takeout_path is not None and google_takeout_path.exists():
        google_sleep = parse_google_fit_sleep_from_takeout_zip(google_takeout_path, year)
        if not (google_sleep and google_sleep.get("ok")):
            google_sleep = None

    # If Google sleep exists, override Apple-derived sleep values.
    if google_sleep is not None:
        metrics["totals"]["sleepHours"] = google_sleep["totals"]["sleepHours"]
        metrics["totals"]["avgSleepHours"] = google_sleep["totals"]["avgSleepHours"]
        metrics["monthly"]["sleepHours"] = google_sleep["monthly"]["sleepHours"]

    strava_metrics: dict[str, Any] | None = None
    if strava_path is not None and strava_path.exists():
        strava_metrics = parse_strava_metrics_from_upload(strava_path, year)

    return {
        "year": year,
        "headline": f"Your {year} in Motion",
        "stats": {
            "activeDays": metrics["totals"]["activeDays"],
            "steps": metrics["totals"]["steps"],
            "avgStepsPerActiveDay": metrics["totals"]["avgStepsPerActiveDay"],
            "avgKmPerActiveDay": metrics["totals"]["avgKmPerActiveDay"],
            "longestStreakDays": metrics["totals"]["longestStreakDays"],
            "longestStreakStart": metrics["totals"]["longestStreakStart"],
            "longestStreakEnd": metrics["totals"]["longestStreakEnd"],
            "cnTowerEquiv": metrics["totals"]["cnTowerEquiv"],
            "walkRunKm": metrics["totals"]["walkRunKm"],
            "flights": metrics["totals"]["flights"],
            "sleepHours": metrics["totals"]["sleepHours"],
            "avgSleepHours": metrics["totals"]["avgSleepHours"],
            "strava": strava_metrics,
        },
        "slides": [
            {
                "type": "hero",
                "title": f"Your {year} in Motion",
                "bigNumber": f"{metrics['totals']['activeDays']} active days",
                "subtitle": f"{metrics['totals']['steps']:,} steps • {metrics['totals']['walkRunKm']} km • {metrics['totals']['flights']} flights",
            },
            {
                "type": "insight",
                "title": "Totals",
                "bullets": [
                    f"Walking/Running distance: {metrics['totals']['walkRunKm']} km",
                    f"Avg steps / active day: {int(metrics['totals']['avgStepsPerActiveDay']):,}",
                    f"Longest streak: {metrics['totals']['longestStreakDays']} days ({metrics['totals']['longestStreakStart']} → {metrics['totals']['longestStreakEnd']})",
                    f"Flights climbed: {metrics['totals']['flights']}",
                    f"Sleep (asleep): {metrics['totals']['sleepHours']} hours",
                    f"Avg sleep (per session): {metrics['totals']['avgSleepHours']} hours",
                ],
            },
            {
                "type": "insight",
                "title": "Your year in one line",
                "bullets": [
                    f"You climbed the CN Tower ~{metrics['totals']['cnTowerEquiv']} times (by steps)",
                    f"On active days you averaged {int(metrics['totals']['avgStepsPerActiveDay']):,} steps and {metrics['totals']['avgKmPerActiveDay']} km",
                ],
            },
            {
                "type": "insight",
                "title": "Your biggest day",
                "bullets": [
                    f"Most steps in a day: {metrics['totals']['maxStepsInADay']:,}",
                    f"Date: {metrics['totals']['maxStepsDate']}",
                ],
            },
            {
                "type": "insight",
                "title": "Top step months",
                "bullets": [f"{m['name']}: {m['steps']:,} steps" for m in metrics["topStepMonths"]],
            },
            {
                "type": "chart",
                "title": "Steps per month",
                "chartType": "bar",
                "data": metrics["monthly"]["steps"],
                "xKey": "month",
                "yKey": "steps",
            },
            {
                "type": "chart",
                "title": "Sleep hours per month",
                "chartType": "line",
                "data": metrics["monthly"]["sleepHours"],
                "xKey": "month",
                "yKey": "hours",
            },
            {
                "type": "insight",
                "title": "Best months (steps)",
                "bullets": [
                    f"Most steps: {metrics['bestMonths']['steps']['name']} (month {metrics['bestMonths']['steps']['month']})",
                ],
            },
            *(
                [
                    {
                        "type": "insight",
                        "title": "Strava highlights",
                        "bullets": [
                            f"Total Strava distance: {strava_metrics['totals']['km']} km",
                            f"Total Strava time: {strava_metrics['totals']['hours']} hours",
                            f"Elevation gain: {int(strava_metrics['totals']['elevGainM'])} m",
                        ],
                    },
                    {
                        "type": "insight",
                        "title": "Biggest efforts",
                        "bullets": [
                            f"Longest run: {strava_metrics['highlights']['longestRunKm']} km ({strava_metrics['highlights']['longestRunDate']})",
                            f"Longest ride: {strava_metrics['highlights']['longestRideKm']} km ({strava_metrics['highlights']['longestRideDate']})",
                            f"Biggest week: {strava_metrics['highlights']['biggestWeekKm']} km (ISO week {strava_metrics['highlights']['biggestWeek']['isoWeek'] if strava_metrics['highlights']['biggestWeek'] else 'N/A'})",
                        ],
                    },
                    {
                        "type": "chart",
                        "title": "Strava distance per month",
                        "chartType": "line",
                        "data": strava_metrics["monthly"]["km"],
                        "xKey": "month",
                        "yKey": "km",
                    },
                ]
                if (strava_metrics is not None and strava_metrics.get("ok"))
                else []
            ),
        ],
        "debug": {
            "export_xml_path": export_xml_member,
            "uploaded_zip": str(zip_path),
            "google_takeout_zip": str(google_takeout_path) if google_takeout_path is not None else None,
        },
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/wrapped")
def wrapped_get(year: int | None = None):
    """Viewer endpoint: returns WrappedResponse from the most recent upload on disk (no upload required)."""
    global LAST_APPLE_ZIP_PATH, LAST_EXPORT_XML_MEMBER, LAST_STRAVA_PATH, LAST_GOOGLE_TAKEOUT_ZIP_PATH, LAST_YEAR

    y = int(year) if year is not None else int(LAST_YEAR)

    zip_path = LAST_APPLE_ZIP_PATH
    export_member = LAST_EXPORT_XML_MEMBER

    if zip_path is None or export_member is None or not zip_path.exists():
        zip_path = _find_latest_health_zip_in_uploads()
        if zip_path is None:
            raise HTTPException(
                status_code=404,
                detail="No Apple Health export.zip found in data/uploads (must contain export.xml).",
            )
        export_member = _find_export_xml_member(zip_path)

    # Remember for next time
    LAST_APPLE_ZIP_PATH = zip_path
    LAST_EXPORT_XML_MEMBER = export_member
    LAST_YEAR = y

    # Optional Strava: use cached path or newest upload found on disk
    strava_path = LAST_STRAVA_PATH
    if strava_path is None or not strava_path.exists():
        strava_path = _find_latest_strava_upload_in_uploads()

    LAST_STRAVA_PATH = strava_path

    google_takeout_path = LAST_GOOGLE_TAKEOUT_ZIP_PATH
    if google_takeout_path is None or not google_takeout_path.exists():
        google_takeout_path = _find_latest_google_takeout_zip_in_uploads()
    LAST_GOOGLE_TAKEOUT_ZIP_PATH = google_takeout_path

    return _build_wrapped_response(zip_path, export_member, y, strava_path=strava_path, google_takeout_path=google_takeout_path)


@app.post("/wrapped")
async def wrapped(
    year: int = 2025,
    apple_health_zip: UploadFile = File(...),
    strava_file: UploadFile | None = File(default=None),
    google_takeout_zip: UploadFile | None = File(default=None),
):
    if not apple_health_zip.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload Apple Health export.zip")

    zip_path = UPLOADS_DIR / apple_health_zip.filename
    contents = await apple_health_zip.read()
    zip_path.write_bytes(contents)

    export_xml_path = _find_export_xml_member(zip_path)

    # Seed cache for GET /wrapped
    global LAST_APPLE_ZIP_PATH, LAST_EXPORT_XML_MEMBER, LAST_STRAVA_PATH, LAST_GOOGLE_TAKEOUT_ZIP_PATH, LAST_YEAR
    LAST_APPLE_ZIP_PATH = zip_path
    LAST_EXPORT_XML_MEMBER = export_xml_path
    LAST_YEAR = int(year)
    # We'll set LAST_STRAVA_PATH below if a Strava file was uploaded.

    strava_path: Path | None = None
    if strava_file is not None and strava_file.filename:
        strava_path = UPLOADS_DIR / strava_file.filename
        strava_path.write_bytes(await strava_file.read())
        LAST_STRAVA_PATH = strava_path

    google_takeout_path: Path | None = None
    if google_takeout_zip is not None and google_takeout_zip.filename:
        if not google_takeout_zip.filename.lower().endswith(".zip"):
            raise HTTPException(status_code=400, detail="Please upload Google Takeout as a .zip")
        google_takeout_path = UPLOADS_DIR / google_takeout_zip.filename
        google_takeout_path.write_bytes(await google_takeout_zip.read())
        LAST_GOOGLE_TAKEOUT_ZIP_PATH = google_takeout_path

    return _build_wrapped_response(
        zip_path,
        export_xml_path,
        int(year),
        strava_path=strava_path,
        google_takeout_path=google_takeout_path,
    )