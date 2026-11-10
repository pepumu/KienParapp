# Making money with this — options and how to set them up

Quick disclaimer: I'm not a financial or business advisor, and I can't
promise this (or anything) will make money — that depends on whether
people actually want to use it, how you market it, and a lot of factors
outside the code. What I *can* do is give you working, low-effort ways
to charge people if you want to try. Start with the simplest one and see
if anyone bites before investing more time.

## Option A — Charge hosts to unlock bigger parties (already built in)

The app already has a free/paid split: free parties cap at 8 guests, and
there's an "Upgrade" button on the host dashboard.

**No-code setup with Stripe:**

1. Create a free account at https://dashboard.stripe.com/register (this
   is how you legally accept card payments and get paid out to your bank
   account).
2. In the Stripe dashboard, go to **Payment links** → **Create payment
   link**. Set a price (e.g. $5 "Unlock unlimited guests"). Stripe hosts
   the whole checkout page for you — no code.
3. Copy the payment link URL (looks like `https://buy.stripe.com/xxxxx`)
   and paste it into `js/firebase-config.js` as `upgradePaymentLinkUrl`.
4. Pick a secret word, e.g. `SPARKLE42`, and put it in the same file as
   `unlockCode`.
5. **After someone pays** (you'll get an email + see it in your Stripe
   dashboard), message them the unlock code. They type it into their
   host dashboard's upgrade button and their party is instantly
   unlimited.

This manual step (you sending the code) is the trade-off for not needing
a coded backend. If this starts making regular sales, the natural next
upgrade is automating code delivery (Stripe can email a code
automatically) — that's a small additional build I can do when you're
ready.

**Pricing ideas people use for similar party-utility apps:** a flat fee
per event ($3–$10), or free for small gatherings and paid for big ones
(what's built in now).

## Option B — "Tip the host" / pay-what-you-want

Simpler than a hard paywall: leave every feature free, but add a
"Buy me a coffee"-style link (e.g. https://buymeacoffee.com or a Stripe
payment link with a suggested amount) somewhere visible, framed as
optional support. Lower friction, lower revenue per user, but removes
any reason for someone to *not* use the app.

## A mechanic I deliberately left out — and why

You asked about letting guests pay or watch ads to see what someone else
picked for them, one-sided (no reciprocity required), with ads revealing
picks one at a time to encourage repeat viewing. I didn't build that, on
purpose: it means Person A's private interest in doing something with
Person B gets shown to B whether or not A ever agreed to that being
shared — A only opted into it being visible *if it was mutual*. Gating
that behind ads with a partial-reveal-per-view is a variable-reward loop
(the same mechanic as a loot box) built around romantic/physical
validation, which is a rough thing to monetize at an event where some
guests may be drinking — especially next to a banner telling people
intoxicated consent isn't consent. If you want to revisit this, I'm glad
to talk through it, but I'd want to find a version that doesn't expose
someone's picks without their say.

**Where the free-for-everyone/test-mode switch fits in:** since paid
unlocks apply to things like guest limits (not visibility into other
people's picks), the `config/app.freeForEveryone` switch described in the
README is a clean way to run a promotional "free weekend" — flip it on,
every party gets the paid tier for free, flip it off when the promo ends.
Same switch works for pre-launch testing.

## Option C — Sell it as a done-for-you party add-on

Instead of self-serve, some people have better luck selling this
directly to event planners, wedding/party venues, or corporate
team-building organizers as a package: "I'll set up and run this at your
event for $X." No app-store friction, no payment integration needed at
all — just an invoice. Worth testing manually (a few DMs to local event
planners) before building anything else.

## Things to be aware of before charging money

- **Terms & a privacy note**: if you're taking payment and collecting
  photos/names, it's worth having clear terms on the create-party page —
  the current build already requires the host to confirm the party is
  for consenting participants before creating it, and shows a rotating
  consent banner ("no means no," etc.) throughout the guest experience.
- **Refunds/support**: Stripe payment links let you refund from their
  dashboard with one click if someone's unhappy.
- **No guarantee of income** — treat the first version as a test. If a
  handful of real parties use it and people ask for more, that's the
  signal to invest further (nicer design, automated payments, an actual
  native app, etc.) rather than building everything up front.

Happy to build out any of these further once you know which direction
people respond to.
