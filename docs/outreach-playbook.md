# Trybe Instagram Outreach Playbook

Operating rules for Claude when prospecting and DMing barbers from the owner's Instagram account. Facts and voice come from `docs/trybe-briefing.md`. Don't claim anything that isn't in that file.

**Authorisation:** the owner has authorised Claude to send these DMs directly from their logged-in Instagram in Chrome, without approving each one first. Claude never asks for or stores the Instagram password; it works only in the existing logged-in browser.

## 1. Who qualifies (private barbers only)

**Include** a barber if at least one of these is true:
- Bio says home studio, private studio, mobile, "by appointment only", "DM to book", a suburb with no shop name, or "renting at …" / "chair at …" with their own booking link.
- The booking link (Booksy, Square, Setmore, Fresha, The Cut, Goldie, Squire, Acuity, etc.) shows **exactly one team member / staff**.
- They take bookings by DM only (bio says "DM to book", no link).

**Exclude** if any of these is true:
- The account is a shop/business page, or the booking link lists 2+ barbers.
- Bio says they work for a shop and bookings go through the shop's system.
- The link is already a Trybe page (`trybe.au/...`), or they're a known Trybe user.
- There's an existing DM thread with them in the inbox (already contacted, or a customer). Search the inbox for the handle before sending.
- They're a student or apprentice, or only post walk-ins.
- The account looks inactive (no post in 60+ days), private, or non-barber.

**Markets:** AU, NZ, US, Canada, UK. Use the regional pitch for non-AU barbers.

## 2. Where to find them

- Hashtags: #homestudiobarber #privatebarber #mobilebarber #barbersydney #barbermelbourne #barberbrisbane #barberperth #barberadelaide #barbergoldcoast #aucklandbarber #barberlondon etc.
- Followers/following of well-known Trybe barbers (@doctortama, @cutsbygreeny, @barber.josh.o.p) and of barber educators.
- Location tags for suburbs (not shop locations).
- Accounts tagged in other barbers' posts.

Record which source each prospect came from.

## 3. Pitch variants (rotate; never send identical text twice in a row)

Fill `[SOFTWARE]` with what they visibly use ("DMs" if no link). Every variant mentions @gettrybe. Lightly personalise: first name if it's obvious, a real detail from their work (a fade, a style, their city). Never invent details.

**A: Core (control)**
> Hey bro, Sam here from @gettrybe! Just had a look at your profile, we're a booking and payments platform fully tailored to private barbers like yourself. We've had a bunch of barbers jump over recently who used to take bookings through [SOFTWARE] and they're loving it. Would be keen to help you get set up!

**B: Question-led**
> Hey bro, love your work! I'm from @gettrybe, a booking app built for independent barbers. Keen to hear how you're finding [SOFTWARE]? Always curious what barbers like and don't like about it 🙌

**C: Free + we do the work**
> Hey bro, I'm from @gettrybe, a free booking and payments app for private barbers. No monthly fees, and we cover SMS reminders. If you ever wanted to switch from [SOFTWARE], we'll import all your clients and bookings for you and make you a video showing your clients how to book. Happy to answer any questions!

**D: Credibility / social proof**
> Hey bro, just came across your page, mad work! I'm from @gettrybe, a booking platform for private barbers, backed by Josh O.P. and operating in 5 countries. Heaps of barbers have jumped over from [SOFTWARE] recently. Would love you to check it out!

**E: Compliment opener (short)**
> That [specific cut/detail] is clean bro 🔥 I'm from @gettrybe, a booking app made for barbers running their own clientele. Have you ever looked at switching from [SOFTWARE]? Keen to show you what we do!

**Regional tweak (US/CA/UK/NZ):** add "we're out of Australia and just launched in [the US / Canada / the UK / NZ]" after the @gettrybe mention.

Use "bro" unless their profile suggests otherwise (then use their name). Use 0–1 emoji.

## 4. Sending rules

- **Max 15 DMs per day.** Spread them across the day with irregular gaps (at least 20 minutes, varied, not on round times). Don't send in bursts.
- Rotate variants evenly (about 3 per variant per day) so results are comparable.
- Before each send: confirm the barber qualifies, confirm there's no existing thread, then fill and personalise the template.
- **Stop immediately and tell the owner** if Instagram shows any warning, "action blocked", "try again later", a captcha or verification prompt, or a message-request limit. Don't retry that day.
- Never send links in the first DM (it increases spam flags). Send the App Store link only after they reply.
- Never message anyone who has said no or asked not to be contacted.
- Never ask for passwords or bank details.
- **Replies:** don't auto-reply to prospects. Log the reply and flag it to the owner for a fast human response (the briefing says slow replies were the biggest lost-deal cause). If the owner asks Claude to reply, use the standard answers in the briefing §4.

## 5. Logging

Append every send to `outreach/tracker.csv` (one row per barber). Fill in `replied` / `outcome` when checking the inbox. At the end of each day, summarise: number sent, sends by variant, new replies, and reply rate per variant to date.

Outcome values: `no_reply`, `replied_interested`, `replied_not_interested`, `downloaded`, `live`, `blocked_or_error`.
