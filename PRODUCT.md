# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two audiences, weighted equally:
- People organizing private celebrations (weddings, birthdays, graduations, family parties) in Sinop - MT and region, usually comparing a few rental companies by phone/WhatsApp.
- Companies, organizers, producers and public bodies running corporate, agro and public events (product launches, company parties, field days, agricultural fairs, auctions, exhibitions, shows, municipal events, churches, sports).

Their job on the public site: understand which structure fits the event, check that the date is available, and ask for a quote quickly (online request or WhatsApp).

## Product Purpose
Universo Tendas rents tents and event structures (plus evaporative coolers) in Sinop - MT and region, with assembly and disassembly by its own team. The public site exists to generate quote requests. Success = a visitor sends an online reservation request (which enters the admin panel and holds stock while awaiting approval) or opens a WhatsApp conversation.

## Positioning
Local company with its own structures and own assembly team; the public site checks real availability for the chosen dates against the same stock the company manages internally, so the customer requests a specific structure for specific dates instead of a generic "call us".

## Operating Context
- Public site and admin panel share one backend and database (Next.js App Router, Prisma, PostgreSQL). Online requests are approved manually by the team; customers can look up their reservation and request (not perform) cancellation.
- Routes: `/` (landing), `/tendas` (catalog), `/tendas/[slug]` (product), `/reservar` (booking wizard, `?tenda=slug` preselects), `/minha-reserva` (lookup), `/login` (team).
- Event types served (confirmed): weddings and parties; corporate events; agro events and fairs; public events.

## Capabilities and Constraints
- Catalog in production (Nov 2026): tents 3x3, 4x4, 5x5, 6x6, 8x8, 10x10 and two evaporative coolers (110 V / 220 V). Prices are per day and come from the catalog; items without price show "Valor a consultar". No product descriptions or dimensions are filled in yet.
- Availability margin of 1 day before/after the event; only event days are charged.
- Photos come only from the admin catalog (`/api/public/photos/[id]`). The team will upload more real photos; layouts must look complete with few photos and fill themselves as photos arrive.
- Do not change booking rules, APIs, authentication, database or production settings in design work.

## Brand Commitments
- Name: Universo Tendas. Logo: `public/brand/universo-logo.png` (white wordmark on logo blue `#0c3f80`). The logo blue is the brand color; the user asked for blue as detail/highlight, not an all-blue site.
- Typeface: Inter (plain, no stylistic alternates on the public site).
- Language: Brazilian Portuguese.
- Contact data (from settings): WhatsApp (66) 9 9982-4544, phone (66) 3531-4760, R. das Nogueiras, 33 - Centro, Sinop - MT, Instagram @universotendas. Official domain https://universotendas.app.br.

## Evidence on Hand
- Real photos: currently 2 in production (Tenda 10x10, 1280px wide, outdoor assembled tent; Tenda 5x5, 470x380 cutout on white). More will be uploaded by the team.
- No testimonials, client list, certifications, years in business, number of events or any other metric exist. Never fabricate them. No stock or AI images presented as the company's work.

## Product Principles
1. Every page leads to a quote: the online request and WhatsApp are always one tap away.
2. Truth over polish: only real photos, real prices and real facts about the company.
3. The catalog is the source of truth; the site adapts to what is registered (photos, prices, featured items) instead of hard-coding content.
4. Booking reliability comes first: visual work never changes availability, reservation or approval behavior.

## Accessibility & Inclusion
Many visitors arrive on phones via WhatsApp/Instagram links; mobile is primary. Keep readable contrast, large touch targets and respect reduced-motion.
