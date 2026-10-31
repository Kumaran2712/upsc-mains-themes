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

# ---------- World physical, world history, India drainage ----------
WD = json.load(open(os.path.join(HERE, "maps_world.json")))
eq0 = Transformer.from_crs("EPSG:4326", "+proj=eqearth +lon_0=10 +datum=WGS84", always_xy=True)
WFRAME = box(-170, -56, 189.99, 80)
def to_frame(g):  # shift western-hemisphere longitudes < -170 to the east so the Pacific is not split
    return g.intersection(WFRAME)
land50 = json.load(open(os.path.join(GEO, "ne_50m_land.geojson")))
land_w = unary_union([shape(f["geometry"]).buffer(0) for f in land50["features"]]).intersection(box(-180, -56, 180, 80)).simplify(0.12, preserve_topology=True)
fp, PW, PH = fitter(proj(land_w, eq0), 1000, pad=6)
def lines_at(lat):
    return path(proj(LineString([(x, lat) for x in range(-180, 181, 2)]), eq0), fp, prec=1)
geo_lines = dict(equator=lines_at(0), tropicN=lines_at(23.4365), tropicS=lines_at(-23.4365), arctic=lines_at(66.5634))
def label_at(g):
    rp = (max(getattr(g, "geoms", [g]), key=lambda q: q.area) if hasattr(g, "geoms") else g)
    rp = rp.representative_point() if rp.geom_type in ("Polygon", "MultiPolygon") else rp.interpolate(0.5, normalized=True)
    x, y = fp(*eq0.transform(rp.x, rp.y)); return round(x, 1), round(y, 1)
regions = json.load(open(os.path.join(GEO, "ne_50m_geography_regions_polys.geojson")))
by_region = {}
for f in regions["features"]:
    by_region.setdefault(f["properties"]["NAME"], []).append(shape(f["geometry"]).buffer(0))
phys = []
for it in WD["physical"]:
    assert it["ne"] in by_region, ("missing region", it["ne"])
    g = unary_union(by_region[it["ne"]]).simplify(0.08, preserve_topology=True)
    cx, cy = label_at(g)
    phys.append(dict(name=it["name"], kind=it["kind"], why=it["why"], themes=it["themes"], d=path(proj(g, eq0), fp, prec=0), cx=cx, cy=cy))
marine = json.load(open(os.path.join(GEO, "ne_50m_geography_marine_polys.geojson")))
by_sea = {}
for f in marine["features"]:
    if f["properties"].get("name"): by_sea.setdefault(f["properties"]["name"], []).append(shape(f["geometry"]).buffer(0))
seas = []
for it in WD["seas"]:
    assert it["ne"] in by_sea, ("missing sea", it["ne"])
    g = unary_union(by_sea[it["ne"]]).simplify(0.08, preserve_topology=True)
    cx, cy = label_at(g)
    seas.append(dict(name=it["name"], why=it["why"], themes=it["themes"], d=path(proj(g, eq0), fp, prec=1), cx=cx, cy=cy))
rv = json.load(open(os.path.join(GEO, "ne_10m_rivers_lake_centerlines.geojson")))
by_river = {}
for f in rv["features"]:
    if not f["geometry"]: continue
    for key in {f["properties"].get("name"), f["properties"].get("name_en")}:
        if key: by_river.setdefault(key, []).append(shape(f["geometry"]))
wrivers = []
for it in WD["rivers"]:
    assert it["ne"] in by_river, ("missing river", it["ne"])
    g = unary_union(by_river[it["ne"]]).simplify(0.05)
    cx, cy = label_at(g)
    wrivers.append(dict(name=it["name"], why=it["why"], themes=it["themes"], d=path(proj(g, eq0), fp, prec=1), cx=cx, cy=cy))
india_w = india.simplify(0.06, preserve_topology=True)
physical_map = dict(viewBox=f"0 0 {PW} {PH}", land=path(proj(land_w, eq0), fp, prec=0, min_len=2.5), india=path(proj(india_w, eq0), fp, prec=1),
                    lines=geo_lines, features=phys, seas=seas, rivers=wrivers)

# World history: countries in Natural Earth's India point-of-view edition, with India itself from Survey of India-based data.
cind = json.load(open(os.path.join(GEO, "ne_10m_admin_0_countries_ind.geojson")))
cshape = {f["properties"]["ADMIN"]: shape(f["geometry"]).buffer(0) for f in cind["features"]}
cont = {f["properties"]["ADMIN"]: f["properties"].get("CONTINENT") for f in cind["features"]}
for nm, (la, lo) in {"Gilgit": (35.92, 74.31), "Muzaffarabad": (34.37, 73.47), "Aksai Chin": (35.3, 79.2), "Tawang": (27.59, 91.87)}.items():
    if not cshape["India"].contains(Point(lo, la)):
        sys.exit(f"BOUNDARY CHECK FAILED in world countries file at {nm}. Use Natural Earth's India point-of-view edition.")
india_clip = india.buffer(0.02)
countries = []
for nm, g in cshape.items():
    if nm == "India" or g.is_empty: continue
    g2 = g.difference(india_clip).intersection(box(-180, -56, 180, 80)).simplify(0.22, preserve_topology=True)
    if g2.is_empty or g2.area < 0.15: continue
    countries.append(dict(name=nm, cont=cont.get(nm), d=path(proj(g2, eq0), fp, prec=0, min_len=2.5)))
pins = []
for pn in WD["history_pins"]:
    x, y = fp(*eq0.transform(pn["lon"], pn["lat"]))
    pins.append(dict(name=pn["name"], event=pn["event"], themes=pn["themes"], x=round(x, 1), y=round(y, 1)))
history_map = dict(viewBox=f"0 0 {PW} {PH}", countries=countries, india=path(proj(india_w, eq0), fp, prec=1), pins=pins)

# India drainage on the India map frame.
river_items = []
india_buf = india.buffer(0.15)
for it in WD["india_rivers"]:
    parts = [g for k in it["ne"] for g in by_river.get(k, [])]
    assert parts, ("missing Indian river", it["ne"])
    g = unary_union(parts).intersection(india_buf).simplify(0.01)
    if g.is_empty: sys.exit(f"River {it['name']} has no course inside India")
    gp = proj(g, lcc)
    mid = max(getattr(g, "geoms", [g]), key=lambda q: q.length).interpolate(0.5, normalized=True)
    cx, cy = pt(mid.x, mid.y)
    river_items.append(dict(name=it["name"], group=it["group"], flows=it["flows"], themes=it["themes"], d=path(gp, fi), cx=round(cx, 1), cy=round(cy, 1)))
rivers_map = dict(rivers=river_items)

# ---------- Layered India modules ----------
LM = json.load(open(os.path.join(HERE, "maps_india_layers.json")))
reg10 = json.load(open(os.path.join(GEO, "ne_10m_geography_regions_polys.geojson")))
by_reg10 = {}
for f in reg10["features"]:
    by_reg10.setdefault(f["properties"]["NAME"], []).append(shape(f["geometry"]).buffer(0))
IFRAME = box(66.5, 5.5, 98.5, 37.6)
state_names = set(states)
layer_modules = []
for mod in LM["modules"]:
    out_layers = []
    for L in mod["layers"]:
        o = {k: L[k] for k in ("id", "name", "kind", "note", "themes") if k in L}
        if L["kind"] == "states":
            groups = L.get("groups") or [{"label": L["name"], "items": L["items"]}]
            for g in groups:
                bad = [x for x in g["items"] if x not in state_names]
                if bad: sys.exit(f"{mod['slug']}/{L['id']}: unknown state(s) {bad}")
            o["groups"] = groups
            o["stateNotes"] = L.get("stateNotes", {})
        elif L["kind"] == "pins":
            items = []
            for it in L["items"]:
                x, y = pt(it["lon"], it["lat"])
                items.append(dict(name=it["name"], note=it["note"], x=round(x, 1), y=round(y, 1)))
            o["items"] = items
        elif L["kind"] == "features":
            items = []
            for it in L["items"]:
                if it["ne"] not in by_reg10: sys.exit(f"{mod['slug']}: missing Natural Earth region {it['ne']}")
                g = unary_union(by_reg10[it["ne"]]).intersection(IFRAME).simplify(0.03, preserve_topology=True)
                if g.is_empty: sys.exit(f"{mod['slug']}: region {it['ne']} is outside the India frame")
                rp = max(getattr(g, "geoms", [g]), key=lambda q: q.area).representative_point()
                cx, cy = pt(rp.x, rp.y)
                items.append(dict(name=it["name"], d=path(proj(g, lcc), fi), cx=round(cx, 1), cy=round(cy, 1)))
            o["items"] = items
        elif L["kind"] == "lines":
            items = []
            for it in L["items"]:
                pts_ = [pt(lon, lat) for lat, lon in it["path"]]
                d = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts_)
                mx, my = pts_[len(pts_) // 2]
                items.append(dict(name=it["name"], note=it["note"], d=d, cx=round(mx, 1), cy=round(my, 1)))
            o["items"] = items
        out_layers.append(o)
    layer_modules.append(dict(n=mod["n"], slug=mod["slug"], name=mod["name"], h1=mod["h1"], seo=mod["seo"], desc=mod["desc"], lead=mod["lead"], papers=mod["papers"], layers=out_layers))

data = dict(india=india_map, region=region_map, world=world_map, physical=physical_map, history=history_map, drainage=rivers_map, layerModules=layer_modules, boundaryChecks=list(CHECKS))
json.dump(data, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("India map", W, "x", H, "| states", len(state_items), "| tropic states:", tropic_states)
print("meridian states:", meridian_states)
print("extremes:", [(e["label"], e["lat"], e["lon"], e["state"]) for e in extremes])
print("neighbours drawn:", [n["name"] for n in neighbours], "| world chokepoints:", len(chokes))
print("physical:", len(phys), "features,", len(seas), "seas,", len(wrivers), "rivers | history:", len(countries), "countries,", len(pins), "pins | india rivers:", len(river_items))
print("layer modules:", [(m["slug"], len(m["layers"])) for m in layer_modules])
print("maps.json size:", os.path.getsize(OUT) // 1024, "KB")
