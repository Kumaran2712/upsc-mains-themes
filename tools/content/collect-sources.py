"""Retrieve primary source candidates; lexical matches are never claim approval.

Full texts stay in ignored local files. Version only provenance/limited passages.
Run with --register-candidates to add missing placement packets. Existing manually
selected packets are preserved. The independent model gate must check support.
"""
from pathlib import Path
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import argparse
import hashlib
import json
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content/stage0/sources"


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.skipped = 0

    def handle_starttag(self, tag, attributes):
        if tag in ("script", "style", "noscript"): self.skipped += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"): self.skipped = max(0, self.skipped - 1)

    def handle_data(self, data):
        if not self.skipped: self.parts.append(data)


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def retrieve(source, refresh, offline=False):
    cache = SOURCES / "library" / (source["id"] + ".json")
    if cache.exists() and not refresh:
        metadata = json.loads(cache.read_text())
        text = (SOURCES / metadata["file"]).read_text()
        if digest(text) != metadata["sha256"]: raise ValueError("Cached source integrity failed")
        return {**source, **metadata, "text": text}
    if offline: raise ValueError("No local capture; offline mode made no network request")
    result = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location", "--proto", "=https", "--max-time", "45", "--max-filesize", "20000000", source["url"]], capture_output=True, check=True)
    if source["format"] == "pdf":
        if not result.stdout.startswith(b"%PDF"): raise ValueError("Expected PDF")
        with tempfile.TemporaryDirectory(prefix="stage0-source-") as directory:
            path = Path(directory) / "source.pdf"; path.write_bytes(result.stdout)
            text = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, check=True).stdout.decode("utf-8")
    else:
        parser = PlainText(); parser.feed(result.stdout.decode("utf-8", errors="replace"))
        text = " ".join(" ".join(parser.parts).split())
    if len(text.strip()) < 1000: raise ValueError("Source has insufficient extractable text")
    sha = digest(text)
    metadata = {"sha256": sha, "file": sha + ".txt", "retrievedAt": datetime.now(timezone.utc).isoformat()}
    (SOURCES / metadata["file"]).write_text(text)
    cache.parent.mkdir(parents=True, exist_ok=True); cache.write_text(json.dumps(metadata, indent=2) + "\n")
    return {**source, **metadata, "text": text}


ALIASES = {
    "democratic": ["democracy"], "constitutional": ["constitution"], "parliamentary": ["parliamentary system"],
    "socialist": ["socialism"], "secular": ["secularism"], "federal": ["federalism"],
    "defence": ["defense"], "globalisation": ["globalization"], "urbanisation": ["urbanization"],
    "industrialisation": ["industrialization"], "gnp": ["gross national product"], "gdp": ["gross domestic product"],
    "memorandum of understanding": ["memoranda of understanding"], "offence": ["offense"],
    "renewable resources": ["renewable resource"], "non-renewable resources": ["non-renewable resource"],
    "coordinates": ["coordinate"], "obligations": ["obligation"],
    "public institutions": ["public institution"], "constitutional body": ["constitutional bodies"],
    "regional organisations": ["regional organisation", "regional organizations"], "international institutions": ["international institution"],
    "world trade organization": ["world trade organisation"], "foreign portfolio investment": ["portfolio investment"],
    "multilateral relations": ["multilateralism"], "strategic interest": ["strategic interests"],
    "economic sanctions": ["economic and trade sanctions", "economic and financial sanctions"],
    "international security": ["international peace and security"],
    "direct tax": ["direct taxes"], "national interest": ["national interests"],
    "government departments": ["departments of the government", "government department"],
}


def candidate(placement, source):
    if placement["subject"] not in source["subjects"]: return None
    name = placement["name"].lower()
    names = [name] + ALIASES.get(name, [])
    patterns = [r"\b" + r"[\s-]+".join(map(re.escape, value.split())) + r"\b" for value in names]
    best = None
    # PDF layout padding must not consume the excerpt window. Normalize per
    # page first, retaining a real PDF page locator for every captured passage.
    if "_pages" not in source: source["_pages"] = [" ".join(page.split()) for page in source["text"].split("\f")]
    for page, text in enumerate(source["_pages"], 1):
        for match in re.finditer("|".join(patterns), text, re.IGNORECASE):
            start, end = max(0, match.start() - 140), min(len(text), match.end() + 380)
            passage = text[start:end]
            if len(passage) < 120: continue
            after = text[match.end():match.end() + 100].lower()
            score = 1 + (8 if re.match(r"\s*(is|are|means|refers to|defined as|denotes)\b", after) else 0)
            score += min(4, len(re.findall("|".join(patterns), passage, re.IGNORECASE)))
            if "exercise" in passage.lower() or "contents" in passage.lower(): score -= 4
            if best is None or score > best[0]:
                best = (score, {key: source[key] for key in ("title", "url", "retrievedAt", "sha256", "file")})
                best[1]["retrievalMethod"] = source.get("retrievalMethod", "direct-https-pdf-text-extraction" if source["format"] == "pdf" else "direct-https-html-text-extraction")
                best[1].update({"locator": f"PDF page {page}, passage containing {match.group()}" if source["format"] == "pdf" else f"Passage containing {match.group()}", "excerpt": passage})
    return best


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register-candidates", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--offline", action="store_true", help="Use verified local captures without network requests")
    parser.add_argument("--reselect-candidates", action="store_true", help="Refresh only automatically selected packets; preserve manually registered sources")
    args = parser.parse_args()
    SOURCES.mkdir(parents=True, exist_ok=True)
    library = json.loads((ROOT / "tools/content/source-library.json").read_text())["sources"]
    rows = subprocess.run(["node", "--input-type=module", "-e", "import {concepts} from './src/lib/stage0/curriculum.ts'; console.log(JSON.stringify(concepts.map(c=>({id:c.id,name:c.name,subject:c.subject.id}))))"], cwd=ROOT, capture_output=True, text=True, check=True)
    placements = json.loads(rows.stdout); fetched = []; failures = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        tasks = {pool.submit(retrieve, source, args.refresh, args.offline): source for source in library}
        for task in as_completed(tasks):
            source = tasks[task]
            try: fetched.append(task.result()); print("Retrieved:", source["id"], flush=True)
            except Exception as error: failures.append({"id": source["id"], "url": source["url"], "error": str(error)[:200]}); print("Unavailable:", source["id"], flush=True)
    report = []
    for placement in placements:
        packet = SOURCES / (placement["id"].replace("/", "--") + ".json")
        matches = sorted(filter(None, (candidate(placement, source) for source in fetched)), key=lambda value: (-value[0], value[1]["url"]))[:2]
        if packet.exists() and not (args.reselect_candidates and json.loads(packet.read_text()).get("candidateOnly") and matches): status = "existing-packet"
        elif matches:
            status = "candidate-packet" if args.register_candidates else "candidate-found"
            if args.register_candidates: packet.write_text(json.dumps({"candidateOnly": True, "sources": [value[1] for value in matches]}, ensure_ascii=False, indent=2) + "\n")
        else: status = "source-needed"
        report.append({"id": placement["id"], "status": status, "candidateSources": len(matches)})
    output = {"recordedAt": datetime.now(timezone.utc).isoformat(), "note": "Lexical candidates establish provenance only. Independent model review must verify support for the exact subject-specific claims before publication.", "retrievedDocuments": len(fetched), "unavailableSources": failures, "placements": report}
    (ROOT / "docs/stage0-source-coverage.json").write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"documents": len(fetched), "placements": len(report), "sourceNeeded": [row["id"] for row in report if row["status"] == "source-needed"]}), flush=True)


if __name__ == "__main__": main()
