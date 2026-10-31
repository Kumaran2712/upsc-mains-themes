"""Build src/data/maps.json (SVG paths for the Maps tab) from boundary data.

Usage:
  python3 tools/build_maps.py <geo_dir>

<geo_dir> must contain:
  states.json      India states/UTs, simplified with mapshaper from DataMeet's
                   Survey of India-based States/Admin2 (CC BY-SA 2.5 / ODbL), e.g.
                   mapshaper Admin2.shp -simplify 1.5% keep-shapes -filter-slivers -o format=geojson precision=0.001 states.json
  ne_50m_admin_0_countries.geojson, ne_110m_land.geojson   Natural Earth (public domain)

India's boundary is drawn ONLY from the Survey of India-based states file. The build
stops if the simplified outline fails any boundary check (PoK, Gilgit-Baltistan,
Aksai Chin, Shaksgam, Siachen, Arunachal, island groups inside; neighbours outside).
Neighbouring countries are clipped so they never overlap India's territory.
"""
import json, os, sys
from pyproj import Transformer
from shapely.geometry import shape, Point, LineString, box, mapping
import warnings; warnings.filterwarnings('ignore', category=DeprecationWarning)
from shapely.ops import unary_union, transform

HERE = os.path.dirname(os.path.abspath(__file__))
GEO = sys.argv[1]
OUT = os.path.join(HERE, "..", "src", "data", "maps.json")
P = json.load(open(os.path.join(HERE, "maps_points.json")))

# ---------- India (Survey of India-based) ----------
st = json.load(open(os.path.join(GEO, "states.json")))
states = {f["properties"]["ST_NM"]: shape(f["geometry"]).buffer(0) for f in st["features"]}
assert len(states) == 36, len(states)
india = unary_union(list(states.values())).buffer(0)

CHECKS = {
    "Gilgit (Gilgit-Baltistan)": (35.92, 74.31, True), "Muzaffarabad (PoK)": (34.37, 73.47, True),
    "Aksai Chin": (35.3, 79.2, True), "Shaksgam Valley": (36.0, 76.6, True), "Siachen": (35.4, 77.1, True),
    "Tawang (Arunachal Pradesh)": (27.59, 91.87, True), "Indira Point (Great Nicobar)": (6.76, 93.83, True),
    "Kavaratti (Lakshadweep)": (10.57, 72.64, True), "Kanyakumari": (8.09, 77.54, True),
    "Lahore": (31.55, 74.34, False), "Kathmandu": (27.7, 85.32, False), "Dhaka": (23.81, 90.41, False),
    "Lhasa": (29.65, 91.11, False), "Colombo": (6.93, 79.86, False),
}
fails = [k for k, (la, lo, exp) in CHECKS.items() if india.buffer(0.02 if exp else 0).contains(Point(lo, la)) != exp]
if fails:
    sys.exit(f"BOUNDARY CHECK FAILED for: {fails}. Do not publish.")
print("Boundary checks: all", len(CHECKS), "passed")

lcc = Transformer.from_crs("EPSG:4326", "EPSG:7755", always_xy=True)   # India NSF LCC, as recommended by SoI
eqe = Transformer.from_crs("EPSG:4326", "+proj=eqearth +lon_0=30 +datum=WGS84", always_xy=True)

def fitter(geom_proj, width, pad=12):
    minx, miny, maxx, maxy = geom_proj.bounds
    s = (width - 2 * pad) / (maxx - minx)
    height = round((maxy - miny) * s + 2 * pad)
    f = lambda x, y: (pad + (x - minx) * s, pad + (maxy - y) * s)
    return f, width, height

def path(geom, f, prec=0, min_len=0):
    out = []
    polys = getattr(geom, "geoms", [geom])
    for p in polys:
        if p.geom_type == "Polygon":
            rings = [p.exterior, *p.interiors]
        elif p.geom_type in ("LineString", "LinearRing"):
            rings = [p]
        else:
            continue
        for r in rings:
            pts = [f(x, y) for x, y in r.coords]
            if min_len and LineString(pts).length < min_len:
                continue
            seg, last = [], None
            for x, y in pts:
                q = (round(x, prec), round(y, prec))
                if q != last:
                    seg.append(q); last = q
            if len(seg) < 2:
                continue
            d = "M" + " L".join(f"{x:g} {y:g}" for x, y in seg)
            out.append(d + ("Z" if r.geom_type == "LinearRing" or p.geom_type == "Polygon" else ""))
    return "".join(out)

proj = lambda g, t: transform(lambda x, y, z=None: t.transform(x, y), g)

# India map
india_p = proj(india, lcc)
fi, W, H = fitter(india_p, 1000)
pt = lambda lon, lat: fi(*lcc.transform(lon, lat))
# graticule
grat = []
for lat in range(5, 40, 5):
    grat.append(LineString([(lon / 2, lat) for lon in range(130, 202)]))
for lon in range(65, 100, 5):
    grat.append(LineString([(lon, lat / 2) for lat in range(10, 80)]))
grat_d = "".join(path(proj(g, lcc), fi) for g in grat)
tropic_lat = 23.4365
tropic = LineString([(x / 10, tropic_lat) for x in range(670, 980)])
meridian = LineString([(82.5, y / 10) for y in range(70, 370)])
tropic_states = sorted(k for k, g in states.items() if g.intersects(tropic))
meridian_states = sorted(k for k, g in states.items() if g.intersects(meridian))
# extreme points computed from the data
coords = [c for p in getattr(india, "geoms", [india]) for c in p.exterior.coords]
mainland = max(getattr(india, "geoms", [india]), key=lambda p: p.area)
mcoords = list(mainland.exterior.coords)
def which_state(lon, lat):
    p = Point(lon, lat)
    return min(states, key=lambda k: states[k].distance(p))
ext = {
    "Northernmost": max(coords, key=lambda c: c[1]), "Southernmost": min(coords, key=lambda c: c[1]),
    "Easternmost": max(coords, key=lambda c: c[0]), "Westernmost": min(coords, key=lambda c: c[0]),
    "Southernmost (mainland)": min(mcoords, key=lambda c: c[1]),
}
def dms(v, pos, neg):
    d = int(abs(v)); m = round((abs(v) - d) * 60)
    if m == 60: d, m = d + 1, 0
    return f"{d}°{m:02d}′{pos if v >= 0 else neg}"
extremes = []
for label, (lon, lat) in ext.items():
    x, y = fi(*lcc.transform(lon, lat))
    extremes.append(dict(label=label, lat=dms(lat, "N", "S"), lon=dms(lon, "E", "W"), state=which_state(lon, lat), x=round(x, 1), y=round(y, 1)))
state_items = []
for k, g in sorted(states.items()):
    gp = proj(g, lcc); rp = g.representative_point()
    cx, cy = pt(rp.x, rp.y)
    state_items.append(dict(name=k, d=path(gp, fi), cx=round(cx, 1), cy=round(cy, 1), area=round(g.area, 3)))
lat_labels = [dict(t=f"{lat}°N", x=round(pt(67.2, lat)[0], 1), y=round(pt(67.2, lat)[1], 1)) for lat in range(10, 40, 5)]
lon_labels = [dict(t=f"{lon}°E", x=round(pt(lon, 6.2)[0], 1), y=round(pt(lon, 6.2)[1], 1)) for lon in range(70, 100, 5)]
india_map = dict(
    viewBox=f"0 0 {W} {H}", outline=path(india_p, fi), states=state_items, graticule=grat_d,
    tropic=path(proj(tropic, lcc), fi), meridian=path(proj(meridian, lcc), fi),
    tropicStates=tropic_states, meridianStates=meridian_states, extremes=extremes,
    latLabels=lat_labels, lonLabels=lon_labels,
    tropicLabel=dict(x=round(pt(85.6, 22.4)[0], 1), y=round(pt(85.6, 22.4)[1], 1)),
    meridianLabel=dict(x=round(pt(82.8, 36.0)[0], 1), y=round(pt(82.8, 36.0)[1], 1)),
)

# ---------- Neighbourhood (India + neighbours, LCC) ----------
ne = json.load(open(os.path.join(GEO, "ne_50m_admin_0_countries.geojson")))
by_name = {f["properties"]["ADMIN"]: shape(f["geometry"]).buffer(0) for f in ne["features"]}
frame = box(58, -2, 104, 42)
nb_items, nb_geoms = [], []
for n in P["neighbours"]:
    g = by_name[n["ne"]].difference(india.buffer(0.01)).intersection(frame).simplify(0.02, preserve_topology=True).buffer(0)
    nb_geoms.append(g)
    nb_items.append((n, g))
region_all = unary_union([india] + nb_geoms)
fr, RW, RH = fitter(proj(region_all, lcc), 1000)
neighbours = []
for n, g in nb_items:
    gp = proj(g, lcc); rp = (max(getattr(g, "geoms", [g]), key=lambda p: p.area)).representative_point()
    cx, cy = fr(*lcc.transform(rp.x, rp.y))
    neighbours.append(dict(name=n["name"], border_km=n["border_km"], note=n["note"], themes=n["themes"],
                           d=path(gp, fr), cx=round(cx, 1), cy=round(cy, 1)))
ilx, ily = fr(*lcc.transform(78.5, 22.0))
region_map = dict(viewBox=f"0 0 {RW} {RH}", india=path(proj(india, lcc), fr), neighbours=neighbours, indiaLabel=dict(x=round(ilx, 1), y=round(ily, 1)),
                  totalLandBorderKm=round(sum(n["border_km"] for n in P["neighbours"] if n["border_km"]), 1))

# ---------- World (land only, no country borders) + India outline ----------
land = json.load(open(os.path.join(GEO, "ne_110m_land.geojson")))
land_g = unary_union([shape(f["geometry"]).buffer(0) for f in land["features"]]).intersection(box(-95, -48, 155, 66))
fw, WW, WH = fitter(proj(land_g, eqe), 1000, pad=8)
india_small = india.simplify(0.05, preserve_topology=True)
chokes = []
for c in P["chokepoints"]:
    x, y = fw(*eqe.transform(c["lon"], c["lat"]))
    chokes.append(dict(name=c["name"], connects=c["connects"], why=c["why"], themes=c["themes"], x=round(x, 1), y=round(y, 1),
                       minor=bool(c.get("minor")), dx=c.get("dx", 9), dy=c.get("dy", -9), anchor=c.get("anchor", "start")))
world_map = dict(viewBox=f"0 0 {WW} {WH}", land=path(proj(land_g, eqe), fw, prec=1, min_len=3), india=path(proj(india_small, eqe), fw, prec=1), chokepoints=chokes)

data = dict(india=india_map, region=region_map, world=world_map, boundaryChecks=list(CHECKS))
json.dump(data, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("India map", W, "x", H, "| states", len(state_items), "| tropic states:", tropic_states)
print("meridian states:", meridian_states)
print("extremes:", [(e["label"], e["lat"], e["lon"], e["state"]) for e in extremes])
print("neighbours drawn:", [n["name"] for n in neighbours], "| world chokepoints:", len(chokes))
print("maps.json size:", os.path.getsize(OUT) // 1024, "KB")
