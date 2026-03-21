# Design System Document: High-End Editorial Logistics

## 1. Overview & Creative North Star
Logistics interfaces are traditionally cluttered, rigid, and purely utilitarian. This design system breaks that mold by adopting a **"Precision Editorial"** North Star. We treat the digital waybill not as a spreadsheet, but as a high-stakes business document.

By leveraging intentional asymmetry, expansive whitespace, and sophisticated tonal depth, we elevate Elect Energy Nig. Ltd. from a standard service provider to an authoritative industry leader. The layout moves away from "boxed-in" forms to a fluid, layered experience that prioritizes the most critical data points—destination, tonnage, and authorization—through bold typography and a structured, non-linear hierarchy.

## 2. Colors
Our palette is rooted in the navy and red of the brand, but expanded into a sophisticated range of surface tiers to provide depth without visual noise.

### The "No-Line" Rule
**Explicit Instruction:** Traditional 1px borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through background color shifts. For instance, a data entry section should sit on `surface-container-low` against a `surface` background.

### Surface Hierarchy & Nesting
Instead of a flat grid, treat the UI as stacked sheets of fine paper.
- **Base Layer:** `surface` (#fbf8fc)
- **Secondary Sectioning:** `surface-container-low` (#f5f3f6)
- **Interactive Cards/Modals:** `surface-container-lowest` (#ffffff) to provide a "lifted" feel.
- **Emphasis Areas:** `surface-container-high` (#eae7eb) for sidebars or metadata panels.

### The "Glass & Gradient" Rule
To ensure a premium feel, floating action panels or header overlays should utilize a **Glassmorphism** effect:
- **Background:** Semi-transparent `surface` with a 20px backdrop-blur.
- **Signature Gradient:** For primary CTAs or waybill status indicators (e.g., "In Transit"), use a subtle linear gradient from `primary` (#00020e) to `primary-container` (#0d1b3e). This adds a "soul" and dimension that flat hex codes cannot achieve.

## 3. Typography
We use a high-contrast pairing of **Manrope** for structural authority and **Inter** for functional clarity.

*   **Display & Headlines (Manrope):** These are the "anchors." `display-md` should be used for waybill numbers or critical totals. `headline-sm` defines major sections like "Receiver's Details."
*   **Body & Titles (Inter):** The "workhorse." `title-md` is for field labels, while `body-md` handles the user-input data.
*   **Brand Voice:** The large size difference between `display` and `body` scales creates an editorial feel, making the document easy to scan at a glance in a high-speed logistics environment.

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than structural shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a soft, natural lift.
*   **Ambient Shadows:** If a floating element (like a "Create Waybill" FAB) is required, use a highly diffused shadow: `blur: 24px`, `opacity: 6%`, color: `on-surface` (#1b1b1e). This mimics natural light.
*   **The "Ghost Border" Fallback:** If a container requires a border for accessibility, use `outline-variant` (#c6c6cf) at **15% opacity**. Never use a 100% opaque border.
*   **Glassmorphism:** Use semi-transparent `surface` tokens on top of `surface-container` tiers to allow secondary colors to "bleed" through, softening the edges of the UI.

## 5. Components

### Input Fields & Forms
*   **Style:** No full boxes. Use a `surface-container-high` bottom-weighted indicator or a subtle tonal background shift.
*   **Labels:** Use `label-md` in `on-surface-variant`.
*   **States:** Error states must use the `secondary` (#b51a1e) for text and `error-container` (#ffdad6) for the background.

### Buttons
*   **Primary:** Solid `primary` (#00020e) with `on-primary` text. Apply a subtle 4px radius (`md`).
*   **Secondary:** `secondary` (#b51a1e) text on a `secondary-container` (#d93633) background at 10% opacity for a sophisticated "tinted" look.

### Cards & Lists
*   **Rule:** Forbid the use of divider lines.
*   **Implementation:** Separate waybill line items using the Spacing Scale (e.g., `spacing-4` or `0.9rem`). Use a alternating `surface-container-low` background for every second item to create a "Zebra" striping that feels integrated, not forced.

### Status Chips
*   **Pending:** `tertiary-container` with `on-tertiary-container` text.
*   **Delivered:** `primary-container` with `on-primary-fixed` text.
*   **Urgent:** `secondary-container` with `on-secondary-fixed` text.

### Logistics-Specific Components
*   **Signature Pad:** A `surface-container-lowest` area with a `ghost-border`. The "Sign Here" text should use `label-sm` with a high `letter-spacing`.
*   **Tonnage Progress Bar:** Use a gradient from `primary` to `secondary` to represent capacity loading.

## 6. Do's and Don'ts

### Do
*   **Do** use `surface-container` tiers to nest content.
*   **Do** favor asymmetric white space to draw the eye toward "Waybill Number" and "Destination."
*   **Do** use `manrope` for all numerical data to emphasize precision.
*   **Do** use `spacing-8` (1.75rem) between major logical sections of the waybill.

### Don't
*   **Don't** use 1px solid black or grey borders.
*   **Don't** use standard "drop shadows" with high opacity; they look "cheap" and dated.
*   **Don't** use high-saturation red for anything other than errors or the brand's primary action—it should be a "surgical" accent.
*   **Don't** crowd the "Description of Goods" section; give it the most vertical breathing room in the layout.