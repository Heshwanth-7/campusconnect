# How a CampusConnect ticket works

A confirmed registration gets a random value called a nonce. The QR code carries four things: the registration ID, event ID, nonce, and expiry time (one hour after the event ends). The expiry is measured in milliseconds since 1 January 1970 UTC. The ticket page shows the student's name beside the QR. The server looks up that name again when a scan succeeds.

## How the server spots changes

The server encodes those four values as base64url text. It signs that exact text using HMAC-SHA256 and a private key called `QR_SECRET`. The QR contains the text, a dot, and the base64url signature. Anyone can read the text. Changing even one field requires a new signature that only someone with the key can make.

On a scan, the server calculates the expected signature and compares it using `crypto.timingSafeEqual`. Only after that check does it open the payload. It checks the expiry, the scanner's event, the registration status, and the current nonce. Only the event's organizer or an admin can submit a check-in.

## Why a ticket works once

The database records the check-in time only if the same confirmed registration still has that nonce and an empty check-in time. If two scanners read the same code together, one update changes the row. The other finds it already used. Opening or copying a ticket does not reset that time.

Cancellation clears the nonce. Re-registering or moving from the waitlist into a confirmed seat gives the student a fresh nonce. An old screenshot cannot claim the new seat. A ticket for another event cannot claim a seat here either.

## What a screenshot can do

A screenshot is a copy of the ticket. Whoever presents a valid copy first can use it. The success screen shows the registered student's name so the organizer can compare it with student ID when identity matters. Keep both the QR and the pasteable token private.
