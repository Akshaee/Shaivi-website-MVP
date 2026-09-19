# Before launch — for Dhrithi Surgical Solutions

Everything on this list needs a decision or a file from the client. Nothing here
blocks the pitch; all of it blocks going live.

---

## 1. Artwork we do not have

The build kit that was meant to supply the brand files and photographs did not
reach us, so the site currently runs on **generated stand-ins**. Every one of
them is marked in the code and most are visibly labelled in the page.

### Photographs — seven files, all placeholders

Each file in `src/assets/images/` currently renders a panel reading **"PHOTO
PENDING"**. Replacing a photograph is a drop-in: keep the filename, put the new
file in the same folder, and run `npm run build`.

| File | Where it appears | What the brief describes |
|---|---|---|
| `hero-nurse.jpg` (+ `-cutout.png`) | Home hero — the first thing a visitor sees | Smiling healthcare professional in a blue disposable surgical gown, bouffant cap and sterile gloves, arms crossed |
| `factory-bhatkal.jpg` (+ `-cutout.png`) | About hero, Home "about" teaser | The Bhatkal manufacturing facility |
| `md-sharath-kumar-shetty.jpg` | About leadership, Home leadership teaser | Portrait of the Managing Director. **Square, at least 516 × 516.** |
| `surgical-gown-model.jpg` (+ `-cutout.png`) | Products gowns header, Home gowns panel | Surgeon in a light blue SHAIVI gown with knit cuffs, mask and cap |
| `surgical-team-face-shields.jpg` (+ `-cutout.png`) | Products, reinforced and BVB gowns | Three healthcare workers in reinforced gowns, face shields and masks |
| `operating-room-team.jpg` | Background of the closing call-to-action band | Surgical team operating under theatre lights. Used decoratively behind a dark overlay, so it needs no detail |

Please send **original, high-resolution files** — the brochure images are print
scans and will not hold up on a large screen. A `-cutout.png` is the same subject
with a transparent background; if you cannot supply cut-outs, say so and we will
use the plain photograph everywhere instead.

**Also confirm:** who holds the licence for the cover and back-cover photographs
in the brochure. They look like stock images, and we cannot publish them without
proof of licence.

### Logo — generated, needs approval

`src/assets/brand/` holds a **newly drawn** SHAIVI lockup: a red shield mark with
a care cross, the SHAIVI wordmark in Exo 2 SemiBold, and "SAFETY MEETS CARE"
beneath it in Open Sans. It was built to match the brochure's colours and
typefaces, but it is our interpretation, not your designer's artwork.

Please send the **original vector logo files** (`.ai`, `.eps` or `.svg`). If you
would rather keep what we have drawn, we need that in writing, because the
horizontal lockup in particular is a web adaptation that does not exist in the
printed brochure.

The favicon, app icons, social preview image and the Dhrithi emblem beside the
address are all derived from the same mark and will be regenerated once the real
artwork arrives.

### Colours

Every colour on the site was sampled from photographs of the printed brochure.
Print and camera both shift colour slightly. Please check the swatches in
`docs/brand-board.png` against your designer's source files and tell us about any
that are wrong.

---

## 2. Copy to approve

Small corrections we spotted in the brochure. We have **not** applied any of
them — the website uses your text exactly as printed. Tell us which to change.

| In the brochure | Suggested |
|---|---|
| "Belke poat" | "Belke Post" |
| A stray comma in the Leadership paragraph | Remove it |
| "STANDARD SURGICAL GOWNS", "PATIENT GOWNS" (all caps) | Sentence case |
| "Reinforced And Bvb Surgical Gowns" | "Reinforced and BVB Surgical Gowns" |
| "excellent air and permeable protection" | Unclear — what should this say? |
| Patient Gowns paragraph | A few letters are hidden by glare in our copy; please send the original text |

---

## 3. Claims that need evidence

These appear on the site because they appear in the brochure. Before the site
goes live we need something on file to back each one, or we should soften it.

- **ISO 13485 certification** — certificate number, issuing body and validity dates.
- **"Blocks infectious viruses like HIV/AIDS and SARS"** (BVB fabric). This is the
  strongest claim on the site. The usual evidence is a viral-penetration test
  report to ASTM F1671, which is what AAMI PB70 Level 4 requires. Without it the
  sentence should be reworded.
- **"100% breathable"**, water/alcohol/liquid repellency, anti-static — test data
  or the fabric supplier's technical datasheet.
- **35,000 sq. ft., 200 professionals, 1 acre, founded 8 November 2017** — please
  confirm these are current.
- Any **CDSCO licence number, CIN or GSTIN** you want displayed in the footer.

---

## 4. Content we are missing

The brochure describes gowns in detail but says nothing about the other four
categories. Those sections currently read "Product details are available on
request" with a button through to the enquiry form.

We need a short description, and ideally sizes and specifications, for:

- Surgical Disposable Drape Kits
- Surgical Dressings
- Surgical Packing Materials
- Hygiene & Protective Products

A catalogue PDF would also be useful — we can link or embed it.

---

## 5. Decisions we need

| Question | Why it matters |
|---|---|
| **Where should enquiries go?** An email address, a shared mailbox, a CRM or a webhook. | The form is live but currently only writes a redacted line to the server log. Nothing is delivered until you tell us where. |
| **Is any of your three numbers on WhatsApp Business?** | If so we will add a WhatsApp button. It is switched off until you confirm. |
| **Do you want to promise a reply time?** ("We reply within one working day.") | We have deliberately promised nothing, because an unmet promise costs more trust than no promise. |
| **How long should we keep enquiry details?** | The Privacy Policy currently says "[12 months]" as a placeholder. |
| **Who is your Grievance Officer?** Name and email. | Required by the DPDP Act. The Privacy Policy has a placeholder. |
| **Which domain will the site use?** | Currently `www.dhrithisurgicalsolutions.com`. |
| **Which region should the site be hosted in?** | The Privacy Policy has to state it. |
| **Do you want website analytics?** | None is installed. Adding any would need a consent review, and would be the site's first third-party script. |

---

## 6. Legal

The Privacy Policy on the site is a **template, not legal advice**. It is written
against India's Digital Personal Data Protection Act, 2023 and the DPDP Rules,
2025 (whose notice and consent obligations apply from 13 May 2027), with the IT
Act SPDI Rules continuing to apply until then.

**Your legal adviser must review it before launch.** The page carries a visible
"Draft – pending legal review" badge until you tell us to remove it.

---

## 7. What happens at launch

For reference, these are the switches we throw once you approve:

1. Set `PUBLIC_SITE_INDEXABLE=true` so search engines may index the site (it is
   deliberately blocked today).
2. Set `CONTACT_DELIVERY` to your chosen method and add the credentials.
3. Set a random `IP_HASH_SALT`.
4. Add the production domain and re-run the header checks.
5. Submit the sitemap to Google Search Console.
6. Remove the "Draft – pending legal review" badge from the Privacy Policy.
