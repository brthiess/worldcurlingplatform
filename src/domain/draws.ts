export const SINGLE_TEMPLATE = "application-single8-seeded-v1";
export const TRIPLE_TEMPLATE = "application-tko16-q8-233-v1";
export type DrawSource = { seed: number } | { winner: string; qualifier?: string } | { loser: string };
export type DrawTerminal = {kind: "qualified" | "eliminated" | "placed"; label: string; place?: number};
export type DrawFixture = {
  key: string;
  round: number;
  a: DrawSource;
  b: DrawSource;
  stage?: string;
  terminals?: {winner?: DrawTerminal; loser?: DrawTerminal};
};
export function sourceLabel(source: DrawSource, compact=false): string {
  if ("seed" in source) return compact ? String(source.seed) : `Seed ${source.seed}`;
  if ("loser" in source) return compact ? `L${source.loser}` : `Loser of ${source.loser}`;
  if (source.qualifier) return compact ? source.qualifier : `${source.qualifier} · Winner of ${source.winner}`;
  return compact ? `W${source.winner}` : `Winner of ${source.winner}`;
}
export function tripleKnockout(entries: string[]) {
  if(entries.length!==16 || new Set(entries).size!==16 || entries.some(e=>!e))
    throw new Error("Choose exactly sixteen distinct entries in seed order.");
  const games: DrawFixture[]=[];
  const seedOrder=[1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11];
  const key=(stage:string,n:number)=>stage+String(n).padStart(2,"0");
  for(let n=1;n<=8;n++) games.push({key:key("A",n),round:1,stage:"A",a:{seed:seedOrder[2*n-2]},b:{seed:seedOrder[2*n-1]}});
  for(let n=9;n<=14;n++) {
    const first=n<=12 ? (n-9)*2+1 : (n-13)*2+9;
    games.push({key:key("A",n),round:n<=12?2:3,stage:"A",a:{winner:key("A",first)},b:{winner:key("A",first+1)}});
  }
  const add=(k:string,round:number,a:DrawSource,b:DrawSource)=>games.push({key:k,round,stage:k[0],a,b});
  for(let n=1;n<=4;n++) add(key("B",n),2,{loser:key("A",2*n-1)},{loser:key("A",2*n)});
  add("B05",3,{winner:"B01"},{loser:"A10"});
  add("B06",3,{winner:"B02"},{loser:"A09"});
  add("B07",3,{winner:"B03"},{loser:"A12"});
  add("B08",3,{winner:"B04"},{loser:"A11"});
  add("B09",4,{loser:"A13"},{winner:"B07"});
  add("B10",4,{loser:"A14"},{winner:"B05"});
  add("B11",4,{winner:"B06"},{winner:"B08"});
  add("C01",3,{loser:"B01"},{loser:"B02"});
  add("C02",3,{loser:"B03"},{loser:"B04"});
  add("C03",4,{winner:"C01"},{loser:"B07"});
  add("C04",4,{winner:"C02"},{loser:"B05"});
  add("C05",4,{loser:"B06"},{loser:"B08"});
  add("C06",5,{winner:"C03"},{loser:"B10"});
  add("C07",5,{winner:"C04"},{loser:"B11"});
  add("C08",5,{winner:"C05"},{loser:"B09"});
  const qualifier=(winner:string,qualifier:string):DrawSource=>({winner,qualifier});
  add("P01",6,qualifier("A13","QA1"),qualifier("C08","QC3"));
  add("P02",6,qualifier("B09","QB1"),qualifier("B10","QB2"));
  add("P03",6,qualifier("A14","QA2"),qualifier("C07","QC2"));
  add("P04",6,qualifier("B11","QB3"),qualifier("C06","QC1"));
  add("P05",7,{winner:"P01"},{winner:"P02"});
  add("P06",7,{winner:"P03"},{winner:"P04"});
  add("P07",8,{winner:"P05"},{winner:"P06"});
  for(const g of games) {
    if(g.stage==="C") g.terminals={loser:{kind:"eliminated",label:"Qualification-stage eliminated"}};
    if(g.stage==="P") g.terminals={loser:{kind:"placed",label:g.key==="P07"?"Runner-up":g.round===7?"Playoff semifinal exit":"Playoff quarterfinal exit",place:g.key==="P07"?2:g.round===7?3:5}};
    for(const target of games) for(const s of [target.a,target.b]) if("winner" in s && s.winner===g.key && s.qualifier) g.terminals={...g.terminals,winner:{kind:"qualified",label:s.qualifier}};
  }
  games.find(g=>g.key==="P07")!.terminals!.winner={kind:"placed",label:"Champion",place:1};
  return {template:TRIPLE_TEMPLATE,games,byes:[] as ReturnType<typeof singleKnockout>["byes"]};
}
export function validateDrawFieldIdentity(
  entries: readonly { id: string; teamId: string | null }[],
) {
  const known = new Set<string>();
  for (const entry of entries) {
    if (entry.teamId === null) continue;
    if (known.has(entry.teamId))
      throw new Error(
        "The same known team cannot occupy two seeds. Resolve the duplicate entry records before drawing.",
      );
    known.add(entry.teamId);
  }
}
export function assignmentDecision(
  state: string,
  actual: string | null,
  expected: string,
) {
  return actual === expected
    ? "unchanged"
    : state === "scheduled"
      ? "assign"
      : "attention";
}
export function selectedDrawPath(
  graph: { games: DrawFixture[] },
  seed: number | undefined,
  entryId: string,
  games: {
    key: string;
    entryA: string | null;
    entryB: string | null;
    winnerEntryId: string | null;
  }[],
) {
  if (!entryId) return [];
  const path = new Set<string>();
  for (const node of graph.games) {
    const actual = games.find((g) => g.key === node.key);
    if (
      (actual && (actual.entryA === entryId || actual.entryB === entryId)) ||
      [node.a, node.b].some((source) => {
        if ("seed" in source) return source.seed === seed;
        const key = "winner" in source ? source.winner : source.loser;
        const upstream = games.find((g) => g.key === key);
        return (
          path.has(key) &&
          (!upstream?.winnerEntryId ||
            ("winner" in source
              ? upstream.winnerEntryId === entryId
              : upstream.winnerEntryId !== entryId &&
                (upstream.entryA === entryId || upstream.entryB === entryId)))
        );
      })
    )
      path.add(node.key);
  }
  return [...path];
}
export function singleKnockout(entries: string[]) {
  if (
    ![6, 8].includes(entries.length) ||
    new Set(entries).size !== entries.length ||
    entries.some((e) => !e)
  )
    throw new Error("Choose six or eight distinct entries in seed order.");
  const graph = {
    template: SINGLE_TEMPLATE,
    games: [
      { key: "Q1", round: 1, a: { seed: 1 }, b: { seed: 8 } },
      { key: "Q2", round: 1, a: { seed: 4 }, b: { seed: 5 } },
      { key: "Q3", round: 1, a: { seed: 2 }, b: { seed: 7 } },
      { key: "Q4", round: 1, a: { seed: 3 }, b: { seed: 6 } },
      { key: "S1", round: 2, a: { winner: "Q1" }, b: { winner: "Q2" } },
      { key: "S2", round: 2, a: { winner: "Q3" }, b: { winner: "Q4" } },
      { key: "F", round: 3, a: { winner: "S1" }, b: { winner: "S2" } },
    ] as DrawFixture[],
    byes: [] as {
      seed: number;
      omittedGame: string;
      destination: string;
      side: "a" | "b";
    }[],
  };
  if (entries.length === 6) {
    graph.games = graph.games
      .filter((g) => g.key !== "Q1" && g.key !== "Q3")
      .map((g) =>
        g.key === "S1"
          ? { ...g, a: { seed: 1 } }
          : g.key === "S2"
            ? { ...g, a: { seed: 2 } }
            : g,
      );
    graph.byes = [
      { seed: 1, omittedGame: "Q1", destination: "S1", side: "a" },
      { seed: 2, omittedGame: "Q3", destination: "S2", side: "a" },
    ];
  }
  return graph;
}
