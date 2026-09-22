# Spec — Commande au comptoir (Le Comptoir Sushi 36)

*Status: built and running. 137 tests passing.*

## 1. Context

During a rush, staff at Comptoir Sushi 36 are too busy to take every order in person. Customers queue just to *place* an order, not to pay. This builds an ordering menu customers open on their own phone (NFC tap or link at the counter): they browse, build an order, submit it, and the kitchen ticket prints immediately so prep starts before they reach the counter. The customer keeps an on-screen order number; staff look it up on a status screen and charge them on the existing POS.

Starting point — the two files provided:

- **`index.html`** — the real site: landing card + bilingual (FR/EN) **read-only** menu sheet rendered from a `CARTE` array of 14 sections. Self-contained, no prices, no ordering.
- **`comptoir-demo.html`** — a sketch of the ordering idea: steppers, running total, a white ticket screen with a `Math.random()` order number. Nothing is sent anywhere.

**Why this cannot stay a single static file.** A phone browser cannot reach a kitchen printer, and a page that shows an order number without a server has no way to know whether anything printed. Both hard requirements — *the kitchen receives the ticket the moment the order is placed*, and *staff can tell whether it printed* — need a server that owns the printer connection and the order records. So: the customer UI stays inside the HTML file as asked; a small Node server sits behind it.

Out of scope, unchanged: no POS or payment-terminal integration, no accounts, no SMS/email, no online payment. Payment stays manual, in person, at the counter.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Printer | **Epson TM-m30, Server Direct Print (SDP)** | The shop's printer. SDP has the printer *poll* the server, so it works from a cloud host with no port forwarding, no static IP, no VPN — and it reports back whether each job actually printed, which is what makes honest status possible. |
| Prices | **None shown anywhere** | Removes all tax/total code and every chance of the screen disagreeing with the POS. Ticket and staff screen carry items and quantities only. |
| Runtime | **Node 24+, zero runtime dependencies** | `node:http`, `node:sqlite`, `node:test` are all built in. Same language as the page's own JavaScript, so the menu is *one* file shared by page and server instead of two copies that drift. |
| Menu sheet | **Becomes the ordering menu** | One menu, no "which screen am I on". The existing design — bamboo planks, section plates, FR/EN toggle — is kept; each dish line gains a stepper. |
| Staff screen | **Unguessable URL, no PIN** | Plus `noindex` and `no-referrer` headers so the address can't leak through search engines or referrer headers, and structured so a PIN is a one-line addition later. Residual risk, stated once: anyone who obtains the link can read the day's orders and trigger reprints. |
| Order numbers | **Server-assigned, shuffled, `#100`–`#999`, never repeating within a service day** | Three digits is easy to say across a counter and easy to search. The order is scrambled so it doesn't read as a sequence, but it is a *permutation*, not a draw: each number is used once per day, so two customers can never share one. A true random draw over 900 values collides after roughly 37 orders — one lunch rush. Day starts at 04:00, not midnight, so a late service doesn't roll over mid-shift. |
| Customer name | **Required, no phone or email** | Staff call either the name or the number, so the name earns its place on the ticket and the staff screen. Asked at the last moment, once the order is ready to send. It's the only free text in the system that reaches the printer, so it's bounded and stripped of control characters. |

## 3. User flow

### 3.1 Customer

1. Taps the NFC card → phone opens the site → taps **Commander**.
2. The menu sheet opens exactly as today, but every dish has a `−  0  +` stepper. A bar pinned to the bottom shows `3 articles` and **Envoyer ma commande**, disabled while the cart is empty.
3. Taps send. A **review panel** lists every dish and quantity with a total — the last moment an error costs nothing, since a sent order prints in the kitchen within the second and cannot be recalled. **Modifier** goes back to the menu.
4. Confirms. A panel asks for their first name — at the last moment, because nobody gives a name to browse a menu, but everybody accepts once the order is ready to go. The confirm button locks on tap and cannot be pressed twice. Going back one step returns to the review, not the menu.
5. A **transition** shows a ticket sliding out of a printer while the order is sent, held for at least 1.4 s. A receipt that appeared instantly would look like nothing had happened; a failure, by contrast, interrupts it immediately rather than making the customer wait out a false suspense.
6. **Success:** a full-screen receipt on light "paper" carrying the shop's logo, a very large `#137`, the name, the full order, the date and time, the instruction to come to the counter when name or number is called — highlighted as a whole sentence, since it is the one thing they must leave with — and a live status line:
   - `✓ Envoyée en cuisine` — printed, confirmed by the printer.
   - `Envoi en cuisine…` — in flight, still polling.
   - `⚠ La cuisine n'a pas reçu le ticket. Montrez ce numéro au comptoir.` — the printer did not confirm.

   The order number is shown **in all three cases**, because the order exists on the server regardless of what the paper did, and staff can serve it from the status screen either way.
7. **Failure to submit at all** (no signal, server down): no number is invented. The screen says the order was not sent and offers **Réessayer**, keeping the cart intact.
8. Hears their name or number called, walks to the counter, shows the screen, pays as usual.

### 3.2 Kitchen

The printer polls the server every few seconds. When an order is waiting it receives one ticket and prints it. Worst-case latency is one poll interval.

### 3.3 Staff

Open the status screen on the counter tablet. Today's orders, newest first, each showing number, time, items, and a print badge:

Each row leads with the number and the customer's name, since staff call either one.

- **IMPRIMÉ** (green) — the printer confirmed it.
- **EN COURS** (grey) — sent, awaiting confirmation.
- **NON IMPRIMÉ** (red) — failed or timed out. A **Réimprimer** button re-queues it.

A persistent red banner appears whenever the printer has not polled recently: **⚠ IMPRIMANTE HORS LIGNE — les commandes arrivent, rien ne s'imprime.** This is the single most important thing on the screen; without it a quiet printer looks identical to a quiet lunch. A **Suspendre les commandes** toggle stops new orders (shown to customers as "commandes en pause").

## 4. Architecture

```
comptoir-commande/
├─ package.json            type:module; scripts: start, test
├─ README.md               run it, point the printer at it, edit the menu
├─ SPEC.md                 this document
├─ src/
│  ├─ menu.js              THE menu — sections, dishes, stable ids
│  ├─ config.js            env vars + defaults, validated at boot
│  ├─ order.js             pure: validate a submitted cart against the menu
│  ├─ day.js               pure: service-day boundary (America/Toronto, 04:00)
│  ├─ numero.js            pure: the shuffled, never-repeating day numbers
│  ├─ ticket.js            pure: order → ePOS-Print XML
│  ├─ store.js             SQLite: orders, print jobs, day offset
│  ├─ epson-sdp.js         the two things the printer says, and our answers
│  └─ server.js            routing, node:http wiring, menu injection
├─ public/
│  ├─ index.html           the page, now orderable
│  └─ comptoir.html        staff status screen
├─ scripts/
│  ├─ fake-printer.js      polls like a real TM-m30, prints to the terminal
│  └─ build-static.js      a standalone page for static hosting
└─ test/                   one file per src module, plus the full HTTP flow
```

**One menu, one copy.** `src/menu.js` is the single source of truth. The server injects it into `index.html` at a `<!--MENU_JSON-->` marker on each request, so the page cannot drift from the validator or the ticket formatter. `npm run build:static` writes a filled copy if the page is ever needed standalone again.

**Small functions, one job each.** The pure modules — `order`, `day`, `numero`, `ticket` — take their inputs as arguments and return values, with the clock passed in. That is what makes the timeout and day-rollover cases testable without waiting a minute or changing the system date.

## 5. Data model

```sql
CREATE TABLE orders (
  id               TEXT PRIMARY KEY,     -- internal uuid
  client_order_id  TEXT NOT NULL UNIQUE, -- idempotency key from the phone
  service_day      TEXT NOT NULL,        -- '2026-09-22'
  number           INTEGER NOT NULL,     -- 1..999, unique within service_day
  items_json       TEXT NOT NULL,        -- resolved names + qty, frozen at submit time
  lang             TEXT NOT NULL,        -- 'fr' | 'en' (customer UI only)
  created_at       INTEGER NOT NULL
);

CREATE TABLE print_jobs (
  id           TEXT PRIMARY KEY,         -- alphanumeric, ≤30 chars (Epson limit)
  order_id     TEXT NOT NULL REFERENCES orders(id),
  attempt      INTEGER NOT NULL,         -- 1 = original, 2+ = retry or reprint
  is_reprint   INTEGER NOT NULL,
  status       TEXT NOT NULL,            -- en_attente | envoyee | imprimee | echec
  error_code   TEXT,                     -- Epson code, e.g. EPTR_COVER_OPEN
  claimed_at   INTEGER,
  finished_at  INTEGER,
  created_at   INTEGER NOT NULL
);
```

`items_json` freezes the dish names at submit time, so editing the menu later never rewrites a ticket that already printed.

## 6. HTTP API

### Customer

| Route | Behaviour |
|---|---|
| `GET /` | the page, menu injected |
| `GET /api/etat` | `{ouvert, imprimanteEnLigne}` — lets the page disable ordering when paused |
| `POST /api/commandes` | `{clientOrderId, lang, items:[{id, qty}]}` → `201 {id, numero, statutImpression, items}`. A repeat of the same `clientOrderId` returns `200` with **the original order**, never a second one. |
| `GET /api/commandes/:id` | `{numero, statutImpression, imprimanteEnLigne}` — polled by the confirmation screen for ~60 s, then it stops |

### Printer

`POST /imprimante/<SECRET>`, `application/x-www-form-urlencoded`. One URL for both message types, because SDP posts both to the same address.

### Staff

`GET /comptoir/<SECRET>`, plus `GET …/commandes`, `POST …/commandes/:id/reimprimer`, `POST …/pause`.

### Validation

Rejected with a clear French message and no server crash: unknown item id, `qty` outside 1–20, more than 40 items total, empty cart, malformed JSON, body over 32 KB, wrong content type, missing `clientOrderId`, missing fields.

Rate limit: 5 orders per IP per 10 minutes. A prank with the link should not be able to empty a paper roll.

## 7. The Epson protocol

Verified against Epson's *Server Direct Print User's Manual* (M00062910 Rev. K), not assumed.

**The printer asks** — `POST`, `application/x-www-form-urlencoded`, on a configurable interval:

```
ConnectionType=GetRequest&ID=<shop id>
```

**We answer** with `text/xml; charset=utf-8` and the next ticket, or **an empty body when there is nothing to print** — that is the documented idle answer:

```xml
<PrintRequestInfo Version="2.00">
  <ePOSPrint>
    <Parameter>
      <devid>local_printer</devid>
      <timeout>10000</timeout>
      <printjobid>J7K2M9</printjobid>
    </Parameter>
    <PrintData>
      <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">…</epos-print>
    </PrintData>
  </ePOSPrint>
</PrintRequestInfo>
```

**The printer reports back** after printing:

```
ConnectionType=SetResponse&ID=…&ResponseFile=<xml>
```

where the XML carries `<printjobid>` and `<response success="true|false" code="…"/>`.

- `success="true"` → `imprimee`.
- `success="false"` → `echec`, keeping the Epson code (`EPTR_COVER_OPEN`, `EPTR_REC_EMPTY`, …) and showing it to staff, because "no paper" and "printer unplugged" need different responses from a human.

Constraints the implementation must respect, from the manual:

- `printjobid` is **1–30 alphanumeric characters** — no dashes, so no raw UUIDs.
- UTF-8 only, no BOM.
- **Exactly one ticket is dispatched per poll.** Not for throughput, but so a result is never ambiguous: if the printer's firmware only speaks `Version="1.00"` — which omits `printjobid` from the reply — the result can still be attributed correctly.

**Online detection:** the poll is the heartbeat. No `GetRequest` within 3× the configured interval → offline, banner up.

**Timeouts:** a job stuck in `envoyee` past 60 s is marked `echec` and re-queued once. A second failure stays `echec` and waits for a human.

## 8. Ticket layout

80 mm roll, `font_a`. Nothing on it depends on prices.

```
       COMPTOIR SUSHI 36
          C U I S I N E

            #137
           ÉLOÏSE
      mar. 22 sept. - 12h41
--------------------------------
2x  SAUMON FUME
    Sushi Pizza (6 mcx)

1x  POKE BOL - SAUMON
    Poke Bol
--------------------------------
          3 articles

   ** NON PAYE - ENCAISSER **
```

Three deliberate choices:

- **The name is printed large, under the number.** Staff call one or the other, and both have to be readable at a glance on a ticket pinned to the pass.
- **The ticket is always French**, whatever language the customer browsed in. It is read by the kitchen, and the names must match the words they use.
- **`NON PAYÉ` is on every ticket.** Payment is manual and in person; a printed ticket must never be mistaken for a paid one.
- **A reprint prints `*** RÉIMPRESSION ***` at the top**, so a reprinted ticket never becomes a second portion of food.

**Accents carry risk.** Latin accents on a thermal printer depend on the code page the firmware selects. `config.js` gets a `TICKET_ASCII` switch that folds `é→e`, `ô→o` — a legible ticket beats a correct one full of `?`. The first physical test print decides which mode ships; both are covered by tests.

## 9. Failure handling — the honesty requirement

| What breaks | Customer sees | Staff sees | Order survives |
|---|---|---|---|
| Printer out of paper | number + ⚠ not received | red **NON IMPRIMÉ**, code `EPTR_REC_EMPTY` | yes |
| Printer unplugged | number + ⚠ not received | red offline banner | yes |
| Printer slow | number + "envoi…" then ✓ | grey **EN COURS** → green | yes |
| Phone loses signal mid-submit | "not sent", **Réessayer**, cart kept | nothing — no order was created | — |
| Customer taps send twice | one number, once | one order, one ticket | yes |
| Customer reloads and resubmits | the same number | no duplicate | yes |
| Server restarts | unchanged | unchanged | yes — SQLite on disk |

The rule throughout: **never show a number for an order the server did not accept, and never claim a ticket printed unless the printer said so.**

## 10. Tests

`node:test` + `node:assert`. One devDependency, `jsdom`, used only to run the page's own JavaScript against a real DOM.

**Main flow** — submit a cart → order stored, number assigned → printer polls → gets the XML → acks success → status `imprimee` → staff screen shows green. Asserted end to end through the real HTTP layer with a fake printer.

**Edge cases**

- *Bad input:* unknown id, qty 0 / −1 / 21, 41 items, empty cart, malformed JSON, 33 KB body, wrong content type, missing `clientOrderId`, missing fields → correct status code, French message, no crash.
- *Printer not responding:* no poll → offline; job times out → `echec` + one retry; ack `success="false"` → `echec` with the code preserved; reprint re-queues and the XML carries the `RÉIMPRESSION` banner; empty answer when the queue is empty.
- *Duplicate submissions:* same `clientOrderId` twice → one row, one job, same number returned; two simultaneous submits → exactly one ticket; double-tap in jsdom → one `fetch`.
- *Order numbers:* every one of the 900 is used exactly once per day, checked exhaustively; never consecutive; a different order each day; the day's shuffle survives a server restart; past 900 orders it continues into four digits rather than repeating; resets across the 04:00 boundary; concurrent submits never collide.
- *Customer name:* required; trimmed and de-spaced; accents, hyphens and apostrophes kept; control characters stripped; 30 characters maximum; empty or non-text refused.
- *Ticket:* snapshot of the XML; grouping by section; long names wrap; accents in both modes; reprint banner; `NON PAYÉ` always present; `printjobid` always ≤30 alphanumeric.
- *Menu:* every dish has a unique non-empty id; ids match what the page renders.
- *UI (jsdom):* steppers add/remove; send disabled on empty cart; double-tap guarded; submit failure keeps the cart; success screen shows the server's number, never a local one.

## 11. Assumptions to confirm

1. **Nigiris & Gunkans are `2 mcx / Sashimi 1 mcx`.** A ticket reading just "Maguro" doesn't tell the kitchen whether to make 2 nigiri or 1 sashimi — that would break the ticket's one job. Plan: split each of those lines into two orderable choices (*nigiri, 2 mcx* / *sashimi, 1 mcx*).
2. **Extras** (gingembre, wasabi, sauce épicée, feuille de soya, feuille de riz) become orderable lines rather than decorative chips.
3. **Shop hours** go in `config.js` — placeholder values to be replaced with the real ones. Outside them, ordering is closed.
4. **No allergy/notes field in v1.** The customer speaks to staff at the counter to pay anyway, and free text on a kitchen ticket is a misreading risk. Easy to add later.
5. **Orders are purged after 7 days**, names included. No phone, email or any other contact detail is ever collected.

## 12. Build order

1. `menu.js` + `order.js` + tests — the data and the validator.
2. `day.js`, `store.js`, order numbering + tests.
3. `ticket.js` + tests — the XML, before anything can print.
4. `print-queue.js` + `epson-sdp.js` + tests with a fake printer — the critical path.
5. `server.js` / `routes.js` + API tests.
6. `public/index.html` — ordering UI inside the existing page + jsdom tests.
7. `public/comptoir.html` — staff screen.
8. `README.md` — running it, pointing the TM-m30 at it, editing the menu.

## 13. Verification

- `npm test` — full suite green.
- `npm start`, open `localhost:3000` at iPhone width: order, submit, see the number.
- `scripts/fake-printer.js` polls like a real TM-m30 and prints the ticket to the terminal, so the whole flow is checkable before the hardware is touched. It can be told to fail, go silent, or report `EPTR_REC_EMPTY` to exercise every failure row in §9.
- Final check on the real TM-m30: set *Server Direct Print* → URL `https://<host>/imprimante/<secret>`, interval 3 s, and confirm accents and the 80 mm layout on paper.

---

## Prerequisite

Node 24+ is not currently installed on this machine. It is needed before any of the above can run.
