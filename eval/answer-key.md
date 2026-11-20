# Answer key for sample-lease-juniper-row.txt

Fictional test fixture. Use it to score fee extraction and cost math. Keep it out of the app and out of any model prompt.

## Fee items (23 with amounts)

| ID | Item | Amount | Section | Type |
|---|---|---|---|---|
| F1 | Base rent | $2,100 (months 1-6), $2,150 (months 7-12) | 3.1, Exhibit A | Recurring, mandatory |
| F2 | Security deposit | $1,000 | 2.1 | One-time, refundable (less deductions) |
| F3 | Carpet cleaning deduction | $150 | 2.1 | Deducted from deposit regardless of condition |
| F4 | Administrative fee | $250 | 2.2 | One-time, non-refundable |
| F5 | Application fee | $45 per adult ($90 for two) | 2.3 | One-time, non-refundable, already paid |
| F6 | Key fob deposit | $25 x 2 = $50 | 2.4 | One-time, refundable |
| F7 | Lost or damaged fob | $60 each | 2.4 | Conditional |
| F8 | Late fee | 5% of base rent ($105) + $15/day | 3.3 | Conditional, no cap stated |
| F9 | Returned payment | $40 | 3.4 | Conditional |
| F10 | Card convenience fee | 2.9% | 3.5 | Conditional (avoidable with ACH/check) |
| F11 | Reserved parking | $100 | 4.1 | Recurring, mandatory (one space) |
| F12 | Second parking space | $75 | 4.1 | Optional, subject to availability |
| F13 | Community amenity fee | $45 | 4.2 | Recurring, mandatory |
| F14 | Technology package (internet) | $65 | 4.3 | Recurring, mandatory |
| F15 | Pest control | $8 | 4.4 | Recurring, mandatory |
| F16 | Valet trash | $25 | 4.5 | Recurring, mandatory |
| F17 | Water/sewer/storm (RUBS) | approx. $70 | 4.6 | Recurring, estimate only |
| F18 | RUBS billing service fee | $5 | 4.6 | Recurring, mandatory |
| F19 | Landlord-placed insurance | $14 | 4.7 | Conditional (if no proof of insurance) |
| F20 | Pet rent / pet deposit | $35/mo, $300 refundable | 5.1 | Conditional (only with approved pet) |
| F21 | Sublet/assignment transfer fee | $150 | 8.1 | Conditional |
| F22 | Early termination fee | 2 months' base rent | 10.1 | Conditional |
| F23 | Month-to-month premium | $250/mo | 11.1 | Conditional (holdover) |

Also present but with no amount: F24, open-ended future fees on 30 days' notice (4.8).

## Expected calculations

Fixed monthly charges beyond rent (F11, F13, F14, F15, F16, F18): 100 + 45 + 65 + 8 + 25 + 5 = **$248**

| Scenario | Total monthly | Per person (2 occupants) |
|---|---|---|
| Months 1-6, fixed charges only | $2,348 | $1,174 |
| Months 1-6, plus RUBS estimate ($70) | $2,418 | $1,209 |
| Months 7-12, fixed charges only | $2,398 | $1,199 |
| Months 7-12, plus RUBS estimate ($70) | $2,468 | $1,234 |

Cash due at signing: deposit 1,000 + fob deposits 50 + admin fee 250 + first month 2,348 = **$3,648**. Add $90 application fees paid earlier for **$3,738** total cash out.

Non-refundable one-time costs: admin 250 + carpet cleaning 150 + applications 90 = **$490**.

Maximum deposit returned: $1,000 - $150 = $850, before other deductions.

Late fee on first missed day after grace: $105 + $15 = $120.

## Items that must be flagged as "needs clarification" (the traps)

1. **Rent conflict:** Section 3.1 says rent is fixed for the Term, but Exhibit A raises it to $2,150 in months 7-12.
2. **Estimate vs. fixed:** utilities are "approximately $70." Do not present it as a fixed charge.
3. **Open-ended fees:** Section 4.8 lets Landlord add or change fees on 30 days' notice.
4. **Community Rules not attached:** fines are possible but unspecified.
5. **Late fee has no cap:** $15/day continues with no stated limit.
6. **Early termination ambiguity:** "two months' base rent" is $4,200 or $4,300 depending on which rate applies, and it stacks with rent through the 60-day notice period.
7. **Unknown, not zero:** electricity and natural gas costs, and the cost of the renter's insurance policy the resident must buy themselves.
8. **Parking:** only one space is included. A second is conditional on availability.
9. **Joint and several liability (9.1):** each resident can owe the full amount if the other leaves.
10. **Auto-conversion (11.1):** missing the 60-day notice moves the tenancy to month-to-month at +$250.
11. **Occupancy and guests:** two-person maximum, 14-day guest limit.

## Scoring

- Fee recall = items correctly extracted with the right amount / 23.
- Citation accuracy = citations whose quote appears verbatim in the lease and supports the claim / citations shown.
- Math accuracy: every figure in the tables above must match exactly.
- Failure to flag a trap, or presenting an estimate or unknown as a fixed amount, counts as an error.
