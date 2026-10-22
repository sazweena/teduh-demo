# Simelarps Teduh pitch script

Source: supplied by the user in the project conversation on 22 October 2026.
Status: team script for comparison with the demo. Factual claims, numbers, and implementation claims have not been verified by this transcription.
Editorial note: punctuation is normalized to avoid em dashes; wording is otherwise retained.

## Teduh (Cool Routes)

Theme: Township of Tomorrow (Planet) | Team: Simelarps

### [0:00 - 1:00] SECTION 1: THE PROBLEM & CORE CONCEPT

**[Hui Yan / Pitch & Finance Lead]**

Good day, judges. We are Team Simelarps.

Sime Darby Property markets Elmina as a premier, sustainable "15-minute township". The idea is simple: everything you need should be a quick walk away. But at 1 PM under the blazing 35°C Malaysian sun, residents don't walk. They get into their cars and drive, even for an 800-meter trip to drop kids off at school or grab groceries.

Extreme heat is a real health issue. Over 50 heat-related illnesses were recorded in early 2026 alone. And when commuters were recently filmed walking under the scorching sun at Shah Alam LRT3 stations, local councils had to scramble with millions in emergency walkway budgets.

Developers plant thousands of trees and build beautiful linear parks, but nobody measures whether the actual daily walking routes residents take are shaded or safe. When complaints arise, the default corporate fix is often a RM1 to 2 million footbridge. But if a township only has RM300,000, that bridge never gets built, and the street remains unusable.

Teduh solves this problem. It is NOT a footbridge, it's an automated decision tool built on free public data. It FINDS Elmina's worst walks, picks the smartest FIXES within budget, and collects resident FEEDBACK, all before township handover.

### [1:00 - 2:15] SECTION 2: THE BACKEND FORMULAS

**[Wei Kei / Evidence & Pilot Lead]**

Let's talk about how our backend engine works under the hood.

Instead of expensive sensors, Teduh combines free, open-source data from OpenStreetMap for footpaths, Google Open Buildings for structure heights, Meta canopy maps for trees, and MET Malaysia weather APIs. We run this through three core formulas:

FIND Formula 1, Hourly Shade Percentage: At 1 PM in Shah Alam, the sun elevation hits 78 degrees/Celsius, meaning buildings provide almost 0% shade. Teduh calculates shadow vectors from building heights and layers Meta tree canopy data onto every street path to measure the exact shaded length every single hour.

FIND Formula 2, Priority Ranking: To decide which street needs help first, Teduh multiplies four simple scores from 0 to 1:

`Priority = Walkers × Sun Exposure × Vulnerable Groups × Crossing Gap`

Why do we multiply instead of add? If zero people walk a street, multiplying forces the total priority score to zero, no matter how sunny it is. We never waste money shading empty back lanes.

FIX Formula 3, Bang-for-Your-Buck Score:

`Fix Score = Daily Walking Trips Helped ÷ (Cost of Fix ÷ RM10,000)`

Teduh prioritizes fixes that help the most walkers per ringgit spent. For example, a RM45,000 shade sail at a bus stop that helps 900 trips gets funded before a RM70,000 street fix that helps 760 trips, maximizing daily impact within any budget cap.

### [2:15 - 3:45] SECTION 3: LIVE DEMO WALKTHROUGH

**[Sheikh Aqil / Product & Data Lead]** (Controlling live demo at sazweena.github.io/teduh-demo)

Now, let's see these formulas execute live across Elmina City Centre.

Step 1: FIND, The Planner Heatmap

Looking at the Sime Darby Planner Dashboard on the left, as I drag our time slider to 1:00 PM, watch Jalan Elmina 3 flash dark red. Clicking it reveals its priority score: 0.81, making it #1 out of 20 streets. The backend calculated 120 walkers per hour, 95% sun exposure, a primary school nearby, and a 150-meter gap to the nearest crossing.

Step 2: FIX, The Automated Budget Engine

Now, watch what happens when we scroll down to our budget slider. When we set an available budget of RM300,000, the system instantly runs our Value Formula across all proposed fixes. It skips multi-million ringgit bridges and auto-selects 5 high-yield fixes totaling RM263,000, including 8 trees, a shade sail, and a raised zebra crossing on Jalan Elmina 3. This single budget protects nearly 3,000 daily walking trips.

Step 3: FEEDBACK, Closing the Loop

On the right screen, we see the Resident View. A parent walking on Jalan Elmina 3 opens the "My Street" tab inside their SDP Owner App (or scans a QR code on a street sign with no app needed). They tap "Report a Problem", flag "Too hot / no shade", or simply tap "Me too" on an existing report.

Instantly, a notification badge pops up on the Sime Darby Planner inbox. As the planner updates the status to "Planned" or "Built", an instant push notification lands on the resident's phone.

### [3:45 - 4:25] SECTION 4: FEASIBILITY & PILOT ROADMAP

**[Hui Yan / Pitch & Finance Lead]**

Teduh is production-ready and fully feasible today:

Data Policy Compliant: Operates on 100% free public data under SDP's rules.

Low Overhead: Built on a lightweight web architecture that costs virtually nothing to maintain across townships.

Clear Ownership Split: Sime Darby executes low-cost shade fixes before handover, while handed-over road upgrades route directly to local councils like MBSA or JKR with clear data evidence.

Extra for HuiYan's understanding :) =

MBSA = (Majlis Bandaraya Shah Alam / Shah Alam City Council)

JKR = (Jabatan Kerja Raya / Public Works Department)

**[Wei Kei / Evidence & Pilot Lead]**

Our 3-Month Pilot Execution:

We propose testing Teduh on 1 Elmina street for 3 months. We will conduct 15-minute physical counts to calibrate our walker formula, install 1 raised crossing and 3 shade spots, and evaluate against our Go/No-Go gate at Month 3:

Our Month 3 Targets: Achieve 60%+ shade at 2 PM, increase foot traffic by +10%, and answer 80% of resident reports within 7 days.

### [4:25 - 4:45] SECTION 5: THE ASK & CLOSING

**[Wei Kei / Evidence & Pilot Lead]**

The business impact for Sime Darby is simple: avoiding just ONE unnecessary footbridge pays for 25 to 100 years of running Teduh across every single township. It turns the "15-minute township" from a marketing brochure promise into a comfortable reality at 2 PM.

**[Hui Yan / Pitch & Finance Lead]**

Give us one street, three months, and one pilot budget. Let's find the worst walk, build the smartest fix, and make Malaysia walkable together.

Thank you!
