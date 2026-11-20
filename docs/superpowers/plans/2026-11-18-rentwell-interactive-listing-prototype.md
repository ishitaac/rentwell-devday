# RentWell Interactive Listing Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current RentWell renter listings design into an aligned, clickable Figma prototype with a dedicated listing-details page and explainable Decision Receipt.

**Architecture:** Keep the existing browse and manager frames as the entry points. Rework the reusable listing-card component so all instances share fixed content zones, then add desktop and mobile listing-details frames populated from one synthetic listing. Wire card, expansion, save, compare, back, and manager-preview interactions with Figma prototype reactions.

**Tech Stack:** Figma Design, Figma variables and local components, auto-layout, Figma prototype reactions, existing RentWell synthetic listing data.

**Spec:** `docs/superpowers/specs/2026-11-18-rentwell-interactive-listing-design.md`

## Global Constraints

- Target Figma file: `uANsE5yy4kK0vukX0urKdT` (`RentWell — Listings & Property Manager`).
- Preserve the existing RentWell colors, DM Sans/Manrope typography, navigation, spacing, buttons, and cards.
- Use the existing `RentWell / Primitives` and `RentWell / Semantic` variables.
- Use synthetic demo content and label uncertain or missing values honestly.
- Explain the Fair Rent result; do not introduce an unsupported black-box score.
- Desktop frames remain 1440 px wide; mobile frames remain 390 px wide.

## Review Focus

- Long property names wrap without changing the outer card height or button alignment.
- Missing fee or comparison data produces an explicit warning rather than a fabricated conclusion.
- Browser-style Back navigation returns to the renter listings frame without a dead end.
- Mobile content fits 390 px without clipping, horizontal scrolling, or desktop-only controls.
- Every interactive control has one intended reaction and no conflicting prototype action.

---

### Task 1: Standardize the reusable listing card

**Design surfaces:**
- Modify component: `Listing Card` (`4:48`)
- Verify instances in: `Renter / Browse Listings / Desktop` (`4:94`)
- Verify instances in: `Renter / Browse Listings / Mobile` (`4:420`)

**Interfaces:**
- Consumes: existing Listing Card text properties and RentWell design variables.
- Produces: a fixed-height card whose image, title/meta block, cost block, disclosure block, and action row align across all instances.

- [ ] **Step 1: Record the current component and instance bounds**

Use a read-only Figma query to return the component width/height, instance bounds, title text heights, and action-row Y positions.

- [ ] **Step 2: Apply fixed content zones with auto-layout**

Keep the 184 px image, reserve two title lines and one metadata line, set cost/disclosure sections to consistent heights, and pin the action row at the bottom. Preserve text wrapping and component text properties.

- [ ] **Step 3: Verify alignment**

Query every desktop card instance. Expected: equal outer heights and identical action-row Y positions; long titles remain fully visible.

- [ ] **Step 4: Capture the browse composition**

Take one screenshot of the desktop and mobile browse frames. Expected: cards form a level bottom edge and no text clips.

### Task 2: Build the dedicated listing-details frames

**Design surfaces:**
- Create: `Renter / Listing Details / Desktop`
- Create: `Renter / Listing Details / Mobile`
- Reuse: existing local buttons, icons, variables, header, and synthetic listing images.

**Interfaces:**
- Consumes: `Avenues Garden Apartment` demo values and the aligned Listing Card entry point from Task 1.
- Produces: canonical desktop and mobile detail frames with named action nodes for Task 3.

- [ ] **Step 1: Build the desktop details frame**

Create a 1440 px auto-layout frame containing the existing site header, Back to listings, image gallery, property facts, amenities, manager/contact block, and a sticky-looking right-side Decision Receipt.

- [ ] **Step 2: Populate the Decision Receipt**

Use: advertised rent `$1,299`, recurring fees `$65`, true monthly cost `$1,364`, estimated move-in cost `$2,728`, comparable range `$1,280–$1,390`, result `Within the expected neighborhood range`, confidence `Medium`, source count `8 comparable rentals`, and warning `Pet fee has not been disclosed`.

- [ ] **Step 3: Build the mobile details frame**

Create a 390 px auto-layout frame using the same content hierarchy, with the receipt placed after core property information and full-width actions.

- [ ] **Step 4: Validate structure and responsiveness**

Expected: both frames use only DM Sans and Manrope, include image fills, contain the complete receipt copy, and have no clipped text or content wider than the frame.

### Task 3: Create interactive states and wire the prototype

**Design surfaces:**
- Create desktop and mobile detail variants/states for expanded calculation and saved status.
- Modify the first renter card's `View details` action, Back control, `How we calculated this`, `Save rental`, `Add to compare`, and `Request a tour` controls.
- Modify the manager editor's rent/fee preview interaction only as a demonstration state.

**Interfaces:**
- Consumes: named frames and controls from Task 2.
- Produces: a Figma presentation flow with deterministic `ON_CLICK` navigation and state changes.

- [ ] **Step 1: Create expanded-calculation states**

Duplicate each details frame into an expanded state that reveals the comparison method, comparable count, update date, and included/excluded fee explanation.

- [ ] **Step 2: Create saved states**

Create saved-state variants where `Save rental` becomes `Saved` without changing layout dimensions.

- [ ] **Step 3: Add prototype reactions**

After materializing nodes, use `setReactionsAsync` with `ON_CLICK` and `NODE` actions: card to details, Back to browse, calculation link to expanded state, save action to saved state, and saved action back to unsaved state. Use Smart Animate at 0.2 seconds only between same-layout states; use Dissolve or Instant for page navigation.

- [ ] **Step 4: Add demonstration outcomes for secondary actions**

Link `Add to compare`, `Request a tour`, and the manager preview change to clearly labeled confirmation states or overlays; do not simulate payments, applications, or live synchronization.

- [ ] **Step 5: Verify reaction coverage**

Read each named control's reactions. Expected: exactly one intended click reaction per control and destinations that resolve to visible frames.

### Task 4: Validate the complete presentation flow

**Design surfaces:**
- Verify wrapper: `RentWell / Listings & Manager` (`4:92`)
- Verify all new details and interaction-state frames.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: an evidence-backed handoff for team review and later React implementation.

- [ ] **Step 1: Run structural validation**

Return frame dimensions, component/instance counts, image-fill counts, font families, long-text bounds, and prototype destination IDs.

- [ ] **Step 2: Run the prototype path manually**

Present from renter listings and exercise: open listing → expand calculation → save → return → reopen → request tour. Expected: no dead ends and all controls provide visible feedback.

- [ ] **Step 3: Capture the final composition**

Take a full deliverable screenshot and one targeted screenshot of the listing-details page. Expected: aligned cards, complete receipt, and mobile/desktop parity.

- [ ] **Step 4: Record implementation handoff**

Document frame names, node IDs, interaction map, exact receipt formulas/copy, and any intentionally simulated behavior for the later React branch.
