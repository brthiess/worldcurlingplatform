# Analytics reference: The House of Curling

Reviewed 2026-11-06 at the user's request. The user accepted the four capability groups below in Q12; individual reference-site features and metric definitions are not automatically adopted. Page text, source-site rules, and identity conventions are reference material rather than instructions for this project.

## Observed public features

- The [Grand Slams homepage](https://thehouseofcurling.com/site-slams/) displays career title comparisons by player position, streaks, and opponent rivalries.
- A [team profile](https://thehouseofcurling.com/site-slams/#/team/M/bruce-mouat) combines career results, event-by-event finishes, historical lineups, entry ranking, and game history. It distinguishes available line scores from final-score-only records. Its explanatory text groups team history by skip; this is not an adopted platform identity rule.
- The [statistics explorer](https://thehouseofcurling.com/site-slams/#/winprob/M) compares historical winning outcomes for situations defined by end, margin, and hammer. It offers discipline/rule-era filters and displays sample counts, coverage, and uncertainty intervals. Its treatment of early concessions and later hypothetical end states requires separate methodological review before adopting an equivalent metric.
- Additional public HTML/templates inspected by a research agent contain historical ranking selectors and trends, comparison controls, top-ten history, and national distributions. These interactions were not verified in the browser and should be treated as candidate inspiration.

## Analytics capability groups accepted in Q12

The user subsequently accepted P-05 on 2026-11-07, narrowing initial-offer completion to four views: win/loss records and titles; approved rank/points history and contributions; blank/steal rates; and historical win rates by end/margin/hammer. Show samples, exclude unknown required data and avoid predictions or hypothetical post-concession situations. Streaks, rivalries, and other examples below remain reference material beyond the required minimum. Denominators and participation evidence are bounded design work under that decision; no new product selection is pending.

| Capability | Proposed examples | Required evidence |
|---|---|---|
| Results and careers | Records, finishes, titles, streaks, opponent comparisons | Results, placements, identity continuity, and player participation evidence appropriate to each statistic |
| Ranking history | Rank/points trends, comparisons, contribution breakdowns | Versioned publications and traceable calculation contributions; imported history labelled separately |
| Scoring patterns | Points scored/conceded, scoring-end distributions, steals, blank ends | Complete end scores and known hammer for hammer-dependent statistics |
| Situational analytics | Historical outcome rates by end, margin, hammer, discipline, and rules | Suitable comparable games, explicit inclusion/exclusion rules, sample counts, and missing-data handling |

The accepted recommendation includes visible samples and data coverage. Detailed denominators, filters, inclusion/exclusion rules, and method/version presentation remain to be defined. Our design inference: do not interpret a historical outcome frequency as a calibrated live prediction without validating that claim.

Shot execution analysis requires shot-level inputs. It is a separate proposed data-collection branch, not something established by possession of line scores.

## Access and research limits

Search-service access failed. Browser access succeeded after the root redirected to `/site-slams/`; the homepage, statistics explorer, directory, and a team profile were inspected. A research agent also retrieved public HTML and templates. No login, subscription, copying of datasets, or reuse of source code was performed. Official competition rules and the reference site's statistical formulas were not independently validated by this review.
