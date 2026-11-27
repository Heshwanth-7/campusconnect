# CampusConnect viva cheat sheet

## Before the examiner arrives

Open Docker Desktop and load the private settings from the README. Run the following from the repository root. The seed resets the demo registrations and bottle suggestion, so run it before each rehearsal. Use a normal browser window and a separate private window for two simultaneous accounts. Two tabs in one window share cookies.

```sh
docker compose up -d --wait
npm run db:deploy -w server
npm run seed
npm test
npm run dev
```

Leave the app running. Use a second terminal in the repository root with the same settings for the commands below. Open [the local app](http://localhost:5173). Student 1 is `demo-student@campusconnect.example`, Student 2 is `demo-student2@campusconnect.example`, and the organizer is `demo-organizer@campusconnect.example`. The default local password is `CampusDemo123!`.

## Two minutes — the last seat

**0:00–0:30.** “If two students count at the same time, both can see the last seat free. Checking the count and saving the seat must happen together.” Open Courtyard Acoustic Night as the organizer. Point out the full event and the waitlist.

**0:30–1:00.** Run the concurrency tests below. The first creates one seat and sends 20 real HTTP registration requests together. Expect one confirmation and 19 waiting students. The second gives five seats to 30 applicants.

```sh
npm run test -w server -- src/tests/registration.test.ts -t 'concurrent HTTP registrations' --reporter=verbose
```

**1:00–1:30.** “PostgreSQL locks this event's row until the transaction finishes. The next student counts again after the first student has saved. Students joining other events can continue.” Show the first-in promotion test.

```sh
npm run test -w server -- src/tests/registration.test.ts -t 'promotes the first waiting user' --reporter=verbose
```

**1:30–2:00.** Run the local test-database comparison below. Read the actual confirmed count aloud. This deliberately unlocked demo can overbook and its result varies. Explain that cancellation and capacity edits use the same event lock. [Seat lock design](SEAT_LOCK.md)

```sh
npm run demo:no-lock
```

## Two minutes — the signed, single-use QR

**0:00–0:30.** As Student 1 open **My Registrations → Courtyard Acoustic Night → View ticket**. Say, “The code holds the registration, event, a random value and an expiry. The server signs them with a secret. Editing the contents breaks that signature.”

**0:30–1:00.** In the organizer's separate window open **Courtyard Acoustic Night → Scan tickets**. Expand the student's manual token, copy it privately and paste it in the scanner. Choose **Check in**. Point out the name on the success screen.

**1:00–1:30.** Choose **Scan next ticket** and submit the same token. Show the already-used result. Open **Attendance** to see one check-in. “The database writes the time only while it is empty. A second scanner cannot claim the same row.”

**1:30–2:00.** Run the concurrent-scan test. Ten requests submit the same valid ticket, and exactly one succeeds. Cancellation clears the random value; a new confirmation gets a new one. Someone holding a screenshot can still be first, so the organizer can check student ID. [Ticket design](QR_SECURITY.md)

```sh
npm run test -w server -- src/tests/registration.test.ts -t '10 simultaneous scans' --reporter=verbose
```

## Two minutes — finding the blue bottle

**0:00–0:30.** Sign in as Students 1 and 2 in separate windows. Open **Lost & Found → Possible matches** in both. “One person lost a blue bottle in Lab 2. Another found one there. We compare open lost/found reports from different people, in the same category, up to 30 days apart.”

**0:30–1:00.** Point to the score breakdown. The seeded reports share all their meaningful words, location, colour, category and date, so they earn 100. Repeating “bottle” adds nothing. A suggestion needs 60 by default. For a worked example where one extra word lowers the score to 94, run

```sh
npm run test -w server -- src/tests/matching.test.ts -t 'blue bottles in Lab 2' --reporter=verbose
```

**1:00–1:30.** Student 1 clicks **Confirm**. Refresh Student 2's page. Contact details are still hidden. “A good score is a reason to ask. Either student may dismiss a wrong guess.”

**1:30–2:00.** Student 2 clicks **Confirm**. Refresh Student 1's page. Each can now see the other's name and email. Both posts become matched, and competing suggestions close together. This test covers the same privacy boundary. [Matching design](MATCHING.md)

```sh
npm run test -w server -- src/tests/lostfound.test.ts -t 'simultaneous reports stay open' --reporter=verbose
```

## Fifteen likely examiner questions

| Question | Short answer |
| --- | --- |
| 1. Why is a unique registration insufficient? | It prevents the same student joining twice. Two different students can still compete for the last seat. |
| 2. Why lock the event row? | Every writer for that event has a single row to wait on, even when there are no registrations yet. |
| 3. Who gets a cancelled seat? | The first waiting student by queue time, then registration ID to break a tie. Rejoining starts a fresh queue position. |
| 4. Can I shrink capacity below the confirmed count? | The server counts under the event lock and rejects the edit with HTTP 409. |
| 5. Can a student read the QR contents? | Yes. The signature lets the server detect changes. The student's name is looked up at scan time. |
| 6. Why include a nonce? | It is a random value tied to this confirmation. An old ticket fails after cancellation and a new confirmation. |
| 7. What if two doors scan together? | Only one conditional update can fill the empty check-in time. The other sees the used ticket. |
| 8. How long does the ticket work? | Up to one hour after the event ends, subject to the signed expiry, current event end and registration checks. |
| 9. How do you compare words? | Count distinct shared words and divide by all distinct words across both reports. Common filler words are ignored. |
| 10. How are the 100 points split? | Category 30, colour 15, title/description 30, location 15 and date 10. |
| 11. Who can see contact details? | Only the two participants once both confirm. Public report text is visible to signed-in campus users. |
| 12. What if an old refresh token is reused? | The server revokes all remaining refresh sessions for that user. Already issued access cookies expire within 15 minutes. |
| 13. Why check Origin if cookies are HttpOnly? | HttpOnly prevents JavaScript reading the cookie. Browsers still attach it to eligible requests, so the server checks the source of writes. |
| 14. Why enforce roles on the server? | Anyone can send an HTTP request without using the page. The API checks the current account and, where needed, ownership of the record. |
| 15. What works offline? | An installed app can reopen its cached shell. Sign-in, fresh tickets, check-in and other API operations need the server and database. |
