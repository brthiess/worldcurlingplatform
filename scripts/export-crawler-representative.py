"""One-time bounded export; never imports crawler code or connects a live database.

All inputs must be the checksum-verified, standalone frozen research files.
Output is private NDJSON consumed by the platform worker, not a public upload API.
"""
import argparse, base64, hashlib, json, pathlib, sqlite3

VERSION = "wcp-crawler-representative-export-v1"
GAMES = ["src:cz:game:9205:13:366859", "src:cz:game:9694:2:389825",
         "src:cz:game:9473:13:391274", "src:cz:game:8129:14:322560"]
EXPECTED = {
    "snapshot": "41d9df9a3a821845ef0b01c8739be342f257e8c43dcc763853ca59b1e6d350ae",
    "registry": "717bde33140a8a89bc4855ea35bd5f4463aacb2612d7449d1b392ffe4ce7a807",
    "hammer_html": "f73d059f96fdbe9217d190cf7aa5335b5498c529a1d6c39090204a10b4b84b4f",
}
def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""): h.update(chunk)
    return h.hexdigest()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ["snapshot", "registry", "manifest", "hammer-proof", "hammer-html", "output"]:
        p.add_argument("--"+name, required=True, type=pathlib.Path)
    a = p.parse_args()
    paths = {k:getattr(a,k).resolve(strict=True) for k in ["snapshot","registry","manifest","hammer_proof","hammer_html"]}
    hashes = {k:digest(v) for k,v in paths.items()}
    for k,v in EXPECTED.items():
        if hashes[k] != v: raise ValueError("Frozen input digest mismatch: "+k)
    registry = json.loads(paths["registry"].read_text("utf8"))
    proof = json.loads(paths["hammer_proof"].read_text("utf8"))
    if proof["gameId"] != GAMES[0] or proof["bodySha256"] != EXPECTED["hammer_html"]:
        raise ValueError("Hammer proof does not match retained body/game")
    # URI is explicitly read-only and immutable: never substitute mutable WAL files.
    c = sqlite3.connect(paths["snapshot"].as_uri()+"?mode=ro&immutable=1", uri=True)
    c.execute("PRAGMA query_only=ON")
    revision_row = c.execute("SELECT generation,payload FROM revisions WHERE revision=690").fetchone()
    if revision_row is None or revision_row[0] != registry["active"] or registry["generations"][registry["active"]]["revision"] != 690:
        raise ValueError("Pinned revision does not match the paired registry")
    source_metadata = json.loads(revision_row[1])
    predicate = "first_revision<=690 AND (last_revision IS NULL OR last_revision>690)"
    selected = set(GAMES + ["src:cz:entry:9133:1004524", "src:cz:entry:9479:1004524"])
    rows, evidence_ids = {}, set()
    while selected:
        key = sorted(selected)[0]; selected.remove(key)
        if key in rows: continue
        row = c.execute("SELECT kind,payload FROM versions WHERE id=? AND "+predicate,(key,)).fetchone()
        if row is None: raise ValueError("Missing selected scoped record: "+key)
        kind,payload = row[0],json.loads(row[1]); rows[key]=(kind,payload)
        evidence_ids.update(payload.get("evidence_ids",[]))
        if payload.get("event_id"): selected.add(payload["event_id"])
        selected.update(payload.get("entry_ids",[]))
        for lineup in payload.get("lineups",[]):
            if lineup: selected.update(lineup.get("person_ids",[]))
        for profile in payload.get("team_profiles",[]):
            for member in profile.get("members",[]):
                if member.get("person_id"): selected.add(member["person_id"])
    interpretation = {"id":"baden2025-final-reported-hammer-v1", "gameId":GAMES[0],
        "entryId":"src:cz:entry:9205:192891", "basis":"reported_marker_with_same_game_publisher_corroboration",
        "bodySha256":hashes["hammer_html"], "bodyBytes":paths["hammer_html"].stat().st_size,
        "sourceUrl":"https://www.curlingzone.com/game.php?showgameid=366859",
        "corroboratingUrl":proof["corroboratingPublisherUrl"], "observedAt":proof["projectionObservedAt"],
        "historicalParserVersion":None, "supportingInterpretation":proof}
    header = {"format":VERSION,"revision":690,"generation":"g-20261019T043008Z-ae35fa55",
        "sourceSchemaVersion":source_metadata["schema_version"],"sourceRevisionMetadata":source_metadata,
        "sourceDigests":hashes,"sourceRegistry":registry,"selection":{"gameIds":GAMES,
        "entryCollisionKeys":["src:cz:entry:9133:1004524","src:cz:entry:9479:1004524"]},
        "limitations":["Representative selected records, not full historical coverage", "Original game parser versions may be unknown", "No human certification or canonical mapping"]}
    out = a.output.resolve()
    if out in paths.values(): raise ValueError("Output cannot replace input")
    with out.open("x",encoding="utf8",newline="\n") as f:
        def emit(kind,key,payload): f.write(json.dumps({"kind":kind,"key":key,"payload":payload},ensure_ascii=False,separators=(",",":"))+"\n")
        emit("manifest",VERSION,header)
        emit("raw_body", "raw-body-134743", {"snapshotIndex":134743,"gameId":GAMES[0],
             "sourceScope":["events","9205","draws","13","games","366859"],
             "observedAt":proof["projectionObservedAt"],"bodySha256":hashes["hammer_html"],
             "bodyBytes":paths["hammer_html"].stat().st_size,
             "encoding":"base64","body":base64.b64encode(paths["hammer_html"].read_bytes()).decode("ascii")})
        emit("interpretation",interpretation["id"],interpretation)
        for key,(kind,payload) in sorted(rows.items()):
            emit({"events":"event","entries":"entry","games":"game","persons":"person"}[kind],key,payload)
        for key in sorted(evidence_ids):
            row=c.execute("SELECT payload FROM evidence_versions WHERE id=? AND "+predicate,(key,)).fetchone()
            if row is None: raise ValueError("Missing selected evidence: "+key)
            emit("evidence",key,json.loads(row[0]))
    c.close()
    after = {k:digest(v) for k,v in paths.items()}
    if after != hashes: raise ValueError("Source changed during export")
    print(json.dumps({"exportVersion":VERSION,"sourceBefore":hashes,"sourceAfter":after,
          "sourceUnchanged":True,"outputSha256":digest(out),"records":len(rows),"evidenceRecords":len(evidence_ids)}))

if __name__ == "__main__": main()
