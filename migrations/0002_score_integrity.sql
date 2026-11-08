ALTER TABLE game_end_score DROP CONSTRAINT game_end_score_check;
ALTER TABLE game_end_score ADD CONSTRAINT score_state_points CHECK((state = 'played' AND points IS NOT NULL AND points BETWEEN 0 AND 8) OR (state <> 'played' AND points IS NULL));
