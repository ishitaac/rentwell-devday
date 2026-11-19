# RentWell Listings and Manager Screens — Design Specification

**Date:** November 18, 2026
**Status:** Approved for implementation planning
**Audience:** RentWell hackathon team, designers, and implementers

## Intent

Add the two missing sides of the RentWell listing workflow without redesigning the merged renter experience:

1. a renter-facing page for browsing available rentals; and
2. a property-manager page for selecting, editing, saving, and previewing existing listings.

The pages should support the business story that RentWell makes rental costs more transparent. They should look native to the existing product and remain small enough to implement and demonstrate reliably before the competition.

## User and business goals

### Renter

- Find relevant rentals without leaving RentWell.
- See base rent and mandatory recurring fees separately.
- Understand an estimated true monthly housing cost before opening the decision checker.
- Move directly from a listing into the existing rental-analysis journey.

### Property manager

- Import a demo listing from a property-management system and maintain its transparent renter-facing details.
- Preview exactly what a renter will see.
- Edit renter-visible information and save the changes locally for the demo.

### Business

- Connect the proposed property-manager subscription to a visible, credible product workflow.
- Preserve renter trust: payment or subscription status must never affect a fair-rent comparison.
- Demonstrate one shared listing record flowing from the manager workspace to the renter experience.

## Constraints

- The existing Figma Make foundation has already been merged and should not be rebuilt.
- The two screens will be implemented in separate Git branches.
- The competition favors a coherent pitch over feature volume.
- Current RentCast data is a dated snapshot, not live inventory.
- The committed RentCast snapshot contains only 20 comparison records and must not be presented as a complete inventory feed.
- Synthetic property-manager listings and metrics must be labeled as demo data.
- No protected-class information is used for listing discovery or ranking.

## Approaches considered

### Modify the existing Figma Make prototype directly

Fastest, but it mixes both replacement screens into one code-based prototype and makes it difficult to align design changes with two independent Git branches.

### Duplicate the Make prototype for each screen

Provides isolation, but creates two copies of the visual system that can drift.

### Create one standard Figma Design file with two product sections — selected

Create a stable design source with one renter section and one manager section. Reuse the existing RentWell visual language, then implement each page on its own Git branch. This preserves design consistency while keeping code review and integration isolated.

## Shared experience model

```text
Manager selects and edits listing
              ↓
Manager saves and previews listing
              ↓
Renter browses and opens listing details
              ↓
Renter starts the existing Rental Decision Check
```

The MVP contains only two page concepts. Supporting interactions open drawers or sheets rather than creating additional pages.

The manager dashboard also presents a visible **Import from property software** prototype action. It demonstrates where a future Entrata or other property-management-platform connection would begin without claiming that the competition build performs live synchronization.

## Data audit before UI design

### Current committed RentCast snapshot

The snapshot retrieved on November 18, 2026 contains 20 active Salt Lake City records. The metadata count matches the actual row count, there are no exact duplicate rows, and two records are missing square footage. All records have city, state, zip code, property type, bedrooms, bathrooms, price, listed date, and last-seen date.

The 20 records cover:

- 16 apartments, 2 townhouses, 1 single-family property, and 1 condo;
- studios through four-bedroom properties;
- rents from $750 to $2,875, with a snapshot median of $1,197; and
- nine zip codes.

All 20 records share the same listed date, and their last-seen timestamps fall within the same second. This is acceptable for a small cached comparison snapshot, but it is not evidence of broad or representative Salt Lake City inventory.

### Field coverage

| UI need | In committed snapshot | Available in broader RentCast listing schema | Manager or synthetic data required |
| --- | --- | --- | --- |
| Listed rent | Yes | Yes | No |
| Bedrooms, bathrooms, property type | Yes | Yes | No |
| Square footage | 18 of 20 | Yes, but may be absent | Fallback label required |
| City, state, zip code | Yes | Yes | No |
| Street address and listing ID | No; intentionally removed | Yes | Only if the team chooses to retrieve and retain them later |
| Active/inactive status | Query metadata only | Yes | Manager status for first-party listings |
| Listing and last-seen dates | Yes | Yes | No |
| Photos | No | No | Yes |
| Marketing title and description | No | No | Yes |
| Neighborhood name | No | No direct field | Yes, or derive from an approved geographic source |
| Amenities | No | No | Yes |
| Mandatory renter fees | No | No | Yes |
| Security deposit | No | No | Yes |
| Move-in availability date | No | No | Yes |

The broader RentCast schema also includes listing contacts and office information. Those fields are not needed for the competition experience and remain excluded.

### Data decision

Use two separate data layers:

1. **Manager listing layer:** synthetic first-party listings provide the renter-facing inventory, including title, photos, neighborhood, fees, deposit, availability, amenities, and description.
2. **Market comparison layer:** the sanitized RentCast snapshot provides the dated rent benchmark used after the renter chooses **Check this rental**.

The UI must never imply that the 20 RentCast comparison records are RentWell-managed properties available to rent.

## Synthetic listing dataset

Create one deterministic enrichment fixture for all 20 sanitized RentCast records. A generated demo-listings dataset combines the preserved market fields with clearly separated synthetic presentation fields. Both pages consume the generated dataset so dashboard totals, renter results, filters, previews, and the competition demo stay consistent.

### Coverage

- All 20 enriched demo listings are visible in both the renter and manager experiences.
- Studios through four-bedroom homes.
- Apartments plus at least one condo, townhouse, and single-family property.
- Multiple Salt Lake City neighborhoods and zip codes.
- Base rents within the observed RentCast snapshot range of $750 to $2,875, without copying the API records row for row.
- A mix of listings with explicit recurring fees and listings explicitly marked as having no mandatory recurring fees.
- At least one missing square-footage value to exercise the UI fallback.

### Fixture fields

Each synthetic listing includes:

- stable fictional listing ID;
- fictional manager ID, never a person's name or contact information;
- fictional property title;
- real neighborhood, city, state, and zip-code labels without a street address;
- property type, bedrooms, bathrooms, and optional square footage;
- base rent;
- recurring fee line items such as parking, utilities, pet rent, or technology fee;
- fee-disclosure state;
- derived true monthly cost when fee disclosure is complete;
- security deposit;
- available date when known;
- design-safe image references;
- amenities and a short fictional description;
- fixed created and updated dates for reproducible screenshots and tests.

### Synthetic-data rules

- All records are labeled `synthetic` in the data and **Demo listing** in the competition UI.
- No real street address, unit number, property-manager name, email, or phone number is used.
- Every record includes complete renter-visible data so any listing can be selected for the edit demonstration.
- At least two records explicitly state **No mandatory recurring fees** rather than representing missing fees as zero.
- Manager total and renter result counts are derived from the fixture rather than hard-coded.
- True monthly cost is calculated from base rent plus known mandatory recurring fees; unknown fees never default to zero.
- The RentCast snapshot remains separate and is used only to compare the selected synthetic listing's asking rent with the market snapshot.
- The committed generated dataset can be rebuilt locally without a RentCast API key.
- A failed or mismatched enrichment build must not overwrite the last valid generated dataset.

### Design-data relationship

Figma should use the same 20 fixture identities and values that will later be committed as code. Four fixed, locally stored illustrative images can be reused across the listings. The repository includes an asset manifest with each source, creator, license link, and the disclosure that the image is not the pictured property's actual photograph. This prevents the mockup and application from telling different stories during the pitch and allows any teammate to present without relying on an external image host.

## Shared manager-listing information

Both screens use the same conceptual listing record:

- listing ID
- title and neighborhood
- city and state
- property type
- bedrooms, bathrooms, and square footage
- base monthly rent
- mandatory recurring fee items and total
- estimated true monthly cost (`base rent + mandatory recurring fees`)
- security deposit
- available date
- images
- amenities
- inventory source label: demo manager listing for the competition build
- fee-disclosure state: complete or needs information
- last updated date

Contact details, owner data, and RentCast agent or office fields are outside this shared record. Market-comparison metadata remains a separate structure and is not merged into the manager listing record.

## Screen 1: Renter — Browse Listings

### Primary objective

Help a renter narrow the available choices and move one listing into RentWell's existing decision workflow.

### Desktop layout

```text
┌──────────────────────────────────────────────────────────────┐
│ RentWell | Browse Rentals | Check a Rental | Roommates       │
├──────────────────────────────────────────────────────────────┤
│ Find a rental with fewer cost surprises                     │
│ [Neighborhood or keyword                    ] [Search]       │
│ [Price] [Beds] [Move-in] [Property type] [More filters]     │
├──────────────────────────────────────────────────────────────┤
│ 12 rentals in Salt Lake City                    [Sort ▾]     │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│ │ image      │ │ image      │ │ image      │                 │
│ │ listing    │ │ listing    │ │ listing    │                 │
│ │ cost       │ │ cost       │ │ cost       │                 │
│ │ [Details]  │ │ [Details]  │ │ [Details]  │                 │
│ └────────────┘ └────────────┘ └────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

### Page structure

1. Existing RentWell header with **Browse Rentals** as the active item.
2. Compact search hero, not a second marketing homepage.
3. Filter row for price, bedrooms, move-in date, property type, and fee disclosure.
4. Results row with count and sorting.
5. Three-column desktop card grid; two columns at tablet width; one column on mobile.
6. Details drawer on desktop and full-height sheet on mobile.

### Listing card content

- Primary image with save control.
- Title and neighborhood.
- Bedrooms, bathrooms, and square footage.
- Base rent as the largest price.
- Mandatory recurring fees immediately below the base rent.
- Estimated true monthly cost when fee information is complete.
- Availability date.
- Source label such as **Demo manager listing** in the competition build.
- Primary action: **View details**.
- Secondary action: **Check this rental**.

The card must not show a fair-rent verdict before the comparison is calculated. It may say **Market check available**, but not **Fair**, **Good deal**, or similar.

### Details drawer

- Larger image and property facts.
- Monthly cost breakdown.
- Deposit and move-in costs.
- Amenities.
- Fee-disclosure note.
- Data/source label and updated date.
- Primary action: **Run Rental Decision Check**.

After the renter starts the check, the selected manager listing supplies the asking rent and property attributes, while the RentCast snapshot supplies the comparison population.

### States

- Loading skeleton.
- No results with clear-filter action.
- Missing fee information shown as **Fees not fully disclosed**, never `$0`.
- Saved and unsaved card states.
- Synthetic inventory clearly labeled as demo data for the competition.

## Screen 2: Manager — Listing Dashboard

### Primary objective

Help a property manager select an existing listing, edit its renter-visible information, save the changes locally, and preview the result.

### Desktop layout

```text
┌──────────────────────────────────────────────────────────────┐
│ RentWell Manager | Listings | Renter preview                │
├──────────────────────────────────────────────────────────────┤
│ 20 demo listings       [Import from property software · Demo] │
│ Select a listing to edit its renter-facing details           │
├──────────────────────────────────────────────────────────────┤
│ Search…                                                     │
│ Property          Rent + fees       Available       Action  │
│ Avenues 2BR       $2,100 + $95      Dec 1           Edit    │
│ Sugar House 1BR   $1,450 + $60      Jan 5           Edit    │
└──────────────────────────────────────────────────────────────┘
```

### Page structure

1. RentWell branding with a clear **Manager workspace** label.
2. Total listing count, brief editing instructions, and a header-level **Import from property software** secondary button with a visible **Demo** badge.
3. Search by title, neighborhood, or zip code.
4. Desktop table and mobile listing cards.
5. Primary row action: **Edit**.
6. Listing editor drawer on desktop and full-screen editor on mobile, with **Save changes** and **Preview as renter**.

### Property-software import action

- Place the button in the dashboard header, not in each listing row.
- Use the exact label **Import from property software** rather than **Sync** or a vendor-specific connection claim.
- Pair the button with a persistent **Demo** badge in the competition build.
- Opening the action shows a compact prototype modal with **Entrata** as an example source and the explanation **Demo connection—no live property data is transferred**.
- The prototype may load one existing synthetic listing into the editor; it does not authenticate, call a vendor API, create a production record, or keep systems synchronized.
- On mobile, keep the action below the listing count as a full-width secondary button.

### Listing row or card

- Thumbnail, title, and neighborhood.
- Base rent and mandatory-fee total.
- Availability.
- Fee-disclosure state.
- Actions: edit and preview as renter.

### Listing editor

Group fields into four sections:

1. **Property:** title, neighborhood, type, bedrooms, bathrooms, square footage.
2. **Costs:** base rent, recurring fee line items, deposit, and a calculated total.
3. **Availability:** available date.
4. **Presentation:** images, amenities, and short description.

The editor includes a live renter-preview panel at desktop width and a **Preview as renter** action on mobile. **Save changes** updates local demo state and the preview; persistence to a production backend is outside the MVP.

### States

- No listings loaded state.
- Unsaved changes indicator.
- Saved confirmation.
- No matching results after filtering.

## Visual system

Reuse the merged RentWell system:

- DM Sans for body text and Manrope for headings.
- Ink `#172c2b`, teal `#087f73`, dark teal `#08685f`.
- Mint `#dff4eb`, soft mint `#f0faf6`, cream `#fbfaf5`, coral `#fee9dc`.
- Rounded 10–12 px controls and cards with subtle borders and shadows.
- Teal primary buttons and white secondary buttons.

Renter cards should feel warm and visual. The manager workspace should be denser and more operational while still using the same tokens.

## Responsive and accessibility requirements

- Produce two primary desktop frames at 1440 px and two mobile frames at 390 px.
- Use component variants for loading, no results, unsaved changes, and saved states rather than separate full-page frames.
- Keep visible keyboard focus styles.
- Maintain WCAG AA text contrast.
- Every icon-only control requires an accessible label.
- Filters remain reachable without horizontal scrolling on mobile; use a filter sheet.
- Price meaning must not depend on color alone.

## Data and trust language

- **Base rent** means the advertised recurring rent before other mandatory charges.
- **Mandatory recurring fees** are shown as separate line items.
- **Estimated true monthly cost** is the sum of known recurring items, not a guarantee of every housing expense.
- **Fees not fully disclosed** is used when the information is unknown.
- RentCast snapshot data appears only in the comparison step, is dated, and is never presented as live manager inventory.
- Synthetic listings and analytics must be labeled **Demo data** in the competition build.

## Branch and implementation boundaries

### `feature/renter-listings-ui`

- Browse Listings page.
- Filters, sorting, cards, details drawer, and empty/loading states.
- Entry into the existing Rental Decision Check.
- Read-only synthetic listing fixtures for the MVP.
- RentCast is invoked only through the existing comparison logic after a renter selects a listing.

### `feature/property-manager-dashboard`

- Manager dashboard.
- Listing editor, local save behavior, and renter preview.
- Local/synthetic state for the MVP; no production backend required.

Both branches begin from the latest `main`. The renter branch should merge first and establish the shared listing model. Before the manager branch opens its PR, update it from the new `main` and reuse that model rather than keeping a duplicate type.

## Non-goals for the competition MVP

- Production authentication or role-based authorization.
- Payments, subscriptions, or billing.
- Rental applications or tenant screening.
- A map-based search experience.
- Real-time synchronization between manager and renter pages.
- Live connection, authentication, or data exchange with Entrata or another property-management platform.
- Live RentCast inventory refresh from the browser.
- Showing sanitized RentCast comparison records as available rental cards.
- A complete property-management system including maintenance, leases, or payments.
- A generic AI chatbot on either page.

## Figma deliverables after approval

- One standard Figma Design file based on the existing RentWell visual system.
- Renter section: desktop and mobile primary frames plus card, filter, and drawer components.
- Manager section: desktop and mobile primary frames plus row/card, editor, save-confirmation, and preview components.
- A short prototype connection from manager preview to renter card and from renter details to the Rental Decision Check.

## Acceptance criteria

- A teammate can understand the manager-to-renter listing flow without explanation.
- Both screens show base rent, fees, and true monthly cost consistently.
- Missing fee data is never represented as zero.
- The renter screen has a direct path into the existing decision checker.
- The manager screen provides a direct renter preview.
- The two implementations can be reviewed and merged independently.
