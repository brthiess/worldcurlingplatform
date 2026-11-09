import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFavorites,
  writeFavorites,
  contextLink,
  filterEvents,
  eventStatus,
} from "../src/domain/discovery";
test("favorites retain canonical identity, reject hostile or corrupt storage and deduplicate", () => {
  assert.deepEqual(readFavorites("{bad"), []);
  assert.deepEqual(readFavorites('{"version":2,"items":[]}'), []);
  assert.deepEqual(
    readFavorites(
      '{"version":1,"items":[{"kind":"team","id":"core-7"},{"kind":"team","id":"core-7"},{"kind":"player","id":"../private"}]}',
    ),
    [{ kind: "team", id: "core-7" }],
  );
  assert.equal(
    writeFavorites([{ kind: "team", id: "core-7" }]),
    '{"version":1,"items":[{"kind":"team","id":"core-7"}]}',
  );
});
test("calendar status uses recorded game state and date overlap respects division scope", () => {
  assert.equal(
    eventStatus(["scheduled"], "2020-01-01", "2020-01-03", "2026-11-08"),
    "unknown",
  );
  assert.equal(
    eventStatus(
      ["confirmed", "confirmed"],
      "2020-01-01",
      "2020-01-03",
      "2026-11-08",
    ),
    "completed",
  );
  assert.equal(
    eventStatus(["live"], "2020-01-01", "2020-01-03", "2026-11-08"),
    "live",
  );
  const events = [
    {
      id: "a",
      name: "Prairie",
      seriesName: "Open",
      location: "Regina",
      startsOn: "2026-11-08",
      endsOn: "2026-11-10",
      status: "live",
      divisions: [
        { id: "men", name: "Men", discipline: "men_four" },
        { id: "women", name: "Women", discipline: "women_four" },
      ],
    },
  ];
  assert.deepEqual(
    filterEvents(events, {
      from: "2026-11-10",
      to: "2026-11-10",
      discipline: "women_four",
      division: "men",
    }),
    [],
  );
  assert.equal(
    filterEvents(events, {
      q: "  PRAIRIE ",
      from: "2026-11-10",
      status: "live",
      division: "women",
    }).length,
    1,
  );
  assert.deepEqual(
    filterEvents(events, { from: "2026-11-12", to: "2026-11-01" }),
    [],
  );
});
test("context links preserve only safe public navigation and explicit division overrides", () => {
  assert.equal(
    contextLink(
      "/games/game-2",
      "?division=men&draw=draw-2&from=2026-11-08&token=secret&returnTo=https://evil.test",
    ),
    "/games/game-2?division=men&draw=draw-2&from=2026-11-08",
  );
  assert.equal(
    contextLink(
      "/events/prairie?division=women",
      "?division=men&draw=draw-1&q=Prairie",
    ),
    "/events/prairie?division=women&q=Prairie",
  );
});
test("cross-event navigation cannot carry an unrelated division or draw",()=>{
 assert.equal(contextLink("/events/prairie-2026","?event=main-triple-2026&division=main-triple-sixteen&draw=old&q=Main"),"/events/prairie-2026?q=Main&event=prairie-2026");
});
test("a completed selected division does not inherit a sibling division's live label",()=>{
 const e={name:"Shared edition",seriesName:"Shared",location:"Regina",startsOn:"2026-11-08",endsOn:"2026-11-10",status:"live",divisions:[{id:"men",name:"Men",discipline:"men_four",status:"live"},{id:"women",name:"Women",discipline:"women_four",status:"completed"}]};
 assert.equal(filterEvents([e],{division:"women",status:"completed"})[0]?.status,"completed");
 assert.equal(filterEvents([e],{discipline:"women_four",status:"live"}).length,0);
});
