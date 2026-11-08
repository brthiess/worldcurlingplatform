ALTER TABLE game ADD COLUMN hammer_end integer CHECK(hammer_end BETWEEN 1 AND 20);
CREATE TABLE game_end_hammer (
 game_id text NOT NULL REFERENCES game(id) ON DELETE CASCADE,
 end_number integer NOT NULL CHECK(end_number BETWEEN 1 AND 20),
 hammer text CHECK(hammer IN ('a','b')),
 PRIMARY KEY(game_id,end_number)
);
-- Initial game.hammer describes the current live end. Give that existing fact
-- an explicit end without inferring historical hammer progression.
UPDATE game g SET hammer_end = coalesce((SELECT max(end_number)+1 FROM game_end_score s WHERE s.game_id=g.id AND s.state IN ('played','unknown')),1) WHERE g.state='live';
INSERT INTO game_end_hammer(game_id,end_number,hammer) SELECT id,hammer_end,hammer FROM game WHERE hammer IS NOT NULL AND hammer_end IS NOT NULL;
