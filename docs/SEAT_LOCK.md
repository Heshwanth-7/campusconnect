# How CampusConnect locks a seat

Imagine two students click Register when one seat is left. If both requests count the confirmed registrations before either writes, both see a free seat. Both can confirm, even though the event only has room for one. The unique constraint stops one student from taking two rows, but it cannot stop two different students from taking the same last seat.

## How the lock fixes it

Every registration, cancellation, and capacity edit first locks the same PostgreSQL event row with `SELECT … FROM "Event" … FOR UPDATE`. Another write for that event waits for the transaction to finish. The next request then counts the confirmed rows again and sees the previous request's committed changes. Requests for different events lock different rows.

If all seats are taken, the student joins the waitlist. A confirmed cancellation gives the seat to the first waiting student, ordered by queue time and then registration ID. Increasing capacity fills the new seats in that order. A student who cancels and rejoins keeps the same registration ID and gets a fresh queue time. The API rejects capacity below the confirmed count. Notification stubs run after commit, when the lock has already been released.

## Run the proof

Start local PostgreSQL and set `DATABASE_URL_TEST` in your shell or your existing server environment file. It must point to the separate `campusconnect_test` database.

```sh
docker compose up -d --wait
npm test
npm run demo:no-lock
```

The tests use `Promise.all` with distinct verified users. They expect 1 confirmed out of 20 for a one-seat event, and 5 confirmed out of 30 for a five-seat event. The test runner applies migrations first and sets `connection_limit=32` per test worker. The Prisma PostgreSQL adapter passes that value to the pool as its maximum size. Seat transactions allow 20 seconds to acquire a connection and 30 seconds to finish while requests wait on the event lock.

The demo uses the local test database and removes its temporary rows when it finishes. It has one seat and 20 users. It deliberately counts and writes without the event lock, with a short delay between those operations to make overlap easy to see. The number of confirmed registrations can vary between runs. This is a demonstration, with no expected pass count.
