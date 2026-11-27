# For You feed

After login, students choose topics from the shared interest list. Continuing with an empty selection completes onboarding. Profile lets students change or clear their choices. The authenticated `PATCH /api/users/me/interests` endpoint accepts `{"interests":["robotics"]}` and returns the updated user.

Authenticated `GET /api/feed` returns up to 20 upcoming approved events in an `events` array. Each includes a numeric score and readable reasons. Confirmed and waitlisted registrations hide an event for that student. Cancelling makes it eligible again.

| Rule | Points |
| --- | ---: |
| Each distinct matching tag | +10 |
| At least one interest matches the category | +5 |
| Starts within 7 days | +8 |
| Starts between 7 and 30 days from now | Linear decline from +8 to 0 |
| No confirmed seats left | −4 |

Events sort by descending score, then ascending start time and ID. With no interests, only start time and ID determine order. Full events remain visible with a waitlist reason. The pure scorer takes its clock from `context.now`.
