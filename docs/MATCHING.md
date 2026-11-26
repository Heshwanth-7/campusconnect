# How CampusConnect matches lost and found items

When someone reports an item, CampusConnect looks for open posts from other students. One post must be lost and the other found. The categories must match, and the dates must be within 30 calendar days of each other. A database index helps narrow this search.

## A blue bottle in Lab 2

Suppose one student posts “Lost blue water bottle” and another posts “Found a blue bottle”. Both describe a “steel lid”, choose the Bottle category and enter Lab 2 on the same day.

| Clue | How we count it | Points |
| --- | --- | ---: |
| Category | Both selected Bottle. | 30 / 30 |
| Colour | Blue and BLUE match after lowercasing. Some common variants also match, such as gray and grey. | 15 / 15 |
| Title and description | Ignore everyday words such as “a” and report words such as “lost” and “found”. Four distinct words occur on both sides (blue, bottle, steel, lid). Five occur across the two posts including water. Four divided by five, times 30, gives 24. | 24 / 30 |
| Location | Both locations contain the words “lab” and “2”. Two shared words divided by two distinct words, times 15, gives 15. | 15 / 15 |
| Date | The items were lost and found on the same day. | 10 / 10 |
| **Total** | **30 + 15 + 24 + 15 + 10** | **94 / 100** |

The shared-word fraction is called Jaccard similarity. Repeating a word adds no points. We round each clue to the nearest whole point, then add. Date points fall evenly from ten on the same UTC calendar day to zero seven days apart. A find more than one day before the loss also earns zero date points. Other clues still count within the 30-day search window.

## What happens next

A score at or above MATCH_THRESHOLD (60 by default) creates a suggestion. The example scores 94, so both students receive a notification through the stub after the database saves it. Both posts stay open for other candidates.

Each student can confirm only their side. One confirmation keeps contact details hidden. The second confirmation marks both posts matched and lets each student see the other’s name and college email. Competing suggestions close at the same time. A transaction keeps simultaneous replies consistent.

“Not mine” dismisses the pair permanently. The owner can mark a post resolved when the search is over.
