"""Study order for the roadmap: one chain per subject, in standard-book order.

A chain fixes the order its themes appear in: each theme needs the one before it, and a theme
later in the chain is never a prerequisite of an earlier one. Cross-subject prerequisites from
question links still apply where the stages allow. Read by tools/build_roadmap.py.

Stage (tier) of a chain theme comes from TIERS in build_roadmap.py unless TIER_OVERRIDE says otherwise;
tiers must never go down along a chain (the build checks).
"""
from polity_pilot import CHAIN as POLITY, TIER as POLITY_TIER

CHAINS = {
    "polity": [k for k in POLITY["polity"] if k != "envconst"],
    # Spectrum order: expansion, administration and economy, 1857, reform, nationalism, Gandhi, final phase, after 1947
    "modern": ["brexpansion", "colonadmin", "coloneco", "revolt", "reform", "earlynat", "gandhi", "ideologies", "finalphase",
               "statesreorg", "consolidation", "earlyfp"],
    # Chronological
    "world": ["revolutions", "industrialrev", "worldwars", "decolon"],
    # Ancient to medieval
    "culture": ["harappan", "vedic", "buddhistart", "sculpture", "temple", "bhakti", "patronage", "sources"],
    # NCERT Class 12 sociology order
    "society": ["diversity", "caste", "tribal", "family", "population", "secularism", "communalism", "regionalism",
                "urbsoc", "migration", "newurban", "globsoc", "techsoc", "ageing", "smartcity", "urbfloods"],
    "women": ["womenhist", "gender", "sexratio", "shg", "womenpol", "womeneco"],
    # NCERT physical geography, then hazards, then resources
    "geography": ["tectonics", "atmosphere", "monsoon", "oceans", "quakes", "landslides", "cyclones", "cloudburst", "coastal",
                  "dmframe", "glaciers", "polar", "water", "groundwater", "irrigation", "riverlink", "forests", "wetlands",
                  "fragile", "landdeg", "mining", "oil", "industryloc"],
    # Macro basics first, then sectors
    "economy": ["growth", "inflation", "budget", "employment", "planning", "poverty", "fininc", "digieco", "manufacturing",
                "fdi", "infra", "inclusive", "transport"],
    "agriculture": ["cropping", "landreform", "greenrev", "subsidies", "pds", "agrimarket", "foodproc", "agritech", "allied"],
    "governance": ["policy", "civilservices", "egov", "dbt", "citizen", "anticorrupt", "civilsoc", "health", "education",
                   "skills"],
    "justice": ["hunger", "affirmative", "commissions", "disability", "children"],
    "environment": ["airpoll", "riverpoll", "waste", "eia", "envconst", "climateimpact", "climateregime", "renewables", "energysec", "nuclear"],
    # Neighbourhood, extended neighbourhood, great powers, institutions, diaspora
    "ir": ["neighbourhood", "pakistan", "china", "centralasia", "westasia", "africa", "indopacific", "greatpower",
           "groupings", "un", "wto", "diaspora"],
    "science": ["sciday", "space", "biotech", "healthtech", "pandemic", "aitech", "ipr"],
    "security": ["lwe", "northeast", "terror", "terrorfin", "organised", "border", "maritime", "cyber", "dataprot",
                 "socialmedia", "forces"],
}
TIER_OVERRIDE = dict(POLITY_TIER)
