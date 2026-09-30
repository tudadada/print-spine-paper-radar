# print-spine-paper-radar

[![npm version](https://img.shields.io/npm/v/print-spine-paper-radar.svg)](https://www.npmjs.com/package/print-spine-paper-radar)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Powered by insight.surf](https://img.shields.io/badge/Powered%20by-insight.surf-blue.svg)](https://insight.surf)

**Print & Paper Radar (`print-spine-paper-radar`)** is a deterministic Model Context Protocol (MCP) server engineered for print production, graphic design, and book publishing workflows. It provides zero-hallucination mathematical engines for book spine thickness calculation (Amazon KDP, Couche, Offset), paper GSM & ream shipping weight, sheet imposition yield optimization, and TAPPI paper unit conversions.

---

## Capabilities & Tools Included

### 1. `calculate_book_spine_width`
Calculates exact book spine thickness, wrap dimensions, and spine text eligibility for Amazon KDP, commercial offset, or hardcover bindings.
- **Official Amazon KDP Caliper Specifications**: White paper (`0.002252 in/page`), Cream paper (`0.0025 in/page`), Standard Color (`0.00225 in/page`), Premium Color (`0.002347 in/page`).
- **Commercial Paper Grades**: Couche Gloss (100, 120, 150 GSM), Couche Matt (150 GSM), Woodfree / Offset / Fort (70, 80, 100 GSM), and custom caliper inputs.
- **Binding Styles**: Paperback (perfect bound) vs. Hardcover (casebound with 3.175mm board allowance).
- **Full Wrap Dimensions**: Automatic canvas sizing calculation (`Bleed + Back + Spine + Front + Bleed`).

### 2. `calculate_paper_weight_and_shipping`
Calculates single sheet weight, ream (500 sheets) weight, total production shipment weight, and freight CBM for paper runs.
- Computes single sheet weight in grams based on metric sheet dimensions ($W \times H$) and GSM.
- Computes 500-sheet ream weight in kilograms.
- Computes gross shipping weight with 5% packaging tare.
- Computes freight volume in cubic meters (CBM) for ocean/air logistics planning.

### 3. `calculate_sheet_imposition_yield`
Computes maximum item yield, sheet area utilization, and trim waste when cutting small items from large parent press sheets.
- Compares normal vs. rotated 90° layout orientations.
- Accounts for bleed allowance and press gripper margins.
- Returns utilization percentage and trim waste percentage.

### 4. `convert_paper_units`
Performs authoritative ISO/TAPPI conversions between GSM, basis weight (Bond, Book/Text, Cover in lbs), and caliper thickness (points, microns, mils).

---

## Quick Start

### Running directly via npx
```bash
npx -y print-spine-paper-radar
```

### Claude Desktop Integration
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "print-spine-paper-radar": {
      "command": "npx",
      "args": ["-y", "print-spine-paper-radar"]
    }
  }
}
```

### Cursor Integration
In Cursor settings > Features > MCP Servers:
- **Type**: `command`
- **Command**: `npx -y print-spine-paper-radar`

---

## Specification Authority & Verification

All calculations strictly adhere to:
- **ISO 216**: Trimmed paper sizes.
- **TAPPI T410**: Grammage of paper and paperboard (weight per unit area).
- **Amazon KDP Print Publishing Standards**: Official spine and cover calculation formulas.

## License
MIT © datutu <ceo@dottheworld.com>
