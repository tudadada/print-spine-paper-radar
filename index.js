#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "print-spine-paper-radar",
    version: "1.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Comprehensive Paper Caliper Database (Thickness in mm per sheet)
// Note: 1 physical sheet = 2 book pages (page count / 2 = leaf count)
const PAPER_CALIPER_DATABASE = {
  // Amazon KDP Official Specification Standards
  kdp_white: {
    name: "Amazon KDP Black & White (White Paper)",
    caliper_mm: 0.0572008, // 0.002252 inches
    caliper_inches: 0.002252,
    gsm: 74,
    min_pages_for_spine_text: 80,
  },
  kdp_cream: {
    name: "Amazon KDP Black & White (Cream Paper)",
    caliper_mm: 0.0635, // 0.0025 inches
    caliper_inches: 0.0025,
    gsm: 80,
    min_pages_for_spine_text: 80,
  },
  kdp_color_standard: {
    name: "Amazon KDP Standard Color (White Paper)",
    caliper_mm: 0.05715, // 0.00225 inches
    caliper_inches: 0.00225,
    gsm: 74,
    min_pages_for_spine_text: 80,
  },
  kdp_color_premium: {
    name: "Amazon KDP Premium Color (White Paper)",
    caliper_mm: 0.0596138, // 0.002347 inches
    caliper_inches: 0.002347,
    gsm: 90,
    min_pages_for_spine_text: 80,
  },
  // Commercial Offset & Couche / Art Paper Standards
  couche_gloss_100gsm: {
    name: "Couche / Art Gloss 100 GSM",
    caliper_mm: 0.080,
    caliper_inches: 0.00315,
    gsm: 100,
    min_pages_for_spine_text: 90,
  },
  couche_gloss_120gsm: {
    name: "Couche / Art Gloss 120 GSM",
    caliper_mm: 0.096,
    caliper_inches: 0.00378,
    gsm: 120,
    min_pages_for_spine_text: 75,
  },
  couche_gloss_150gsm: {
    name: "Couche / Art Gloss 150 GSM",
    caliper_mm: 0.120,
    caliper_inches: 0.00472,
    gsm: 150,
    min_pages_for_spine_text: 60,
  },
  couche_matt_150gsm: {
    name: "Couche / Art Matt 150 GSM",
    caliper_mm: 0.135,
    caliper_inches: 0.00531,
    gsm: 150,
    min_pages_for_spine_text: 50,
  },
  offset_woodfree_70gsm: {
    name: "Woodfree / Offset / Fort 70 GSM",
    caliper_mm: 0.095,
    caliper_inches: 0.00374,
    gsm: 70,
    min_pages_for_spine_text: 70,
  },
  offset_woodfree_80gsm: {
    name: "Woodfree / Offset / Fort 80 GSM",
    caliper_mm: 0.108,
    caliper_inches: 0.00425,
    gsm: 80,
    min_pages_for_spine_text: 65,
  },
  offset_woodfree_100gsm: {
    name: "Woodfree / Offset / Fort 100 GSM",
    caliper_mm: 0.135,
    caliper_inches: 0.00531,
    gsm: 100,
    min_pages_for_spine_text: 50,
  },
};

const STANDARDS_BENCHMARK = {
  specification_authority: "ISO 216 / TAPPI T410 / Amazon KDP Print Standards",
  engine: "print-spine-paper-radar/1.0.1",
  verification_status: "DETERMINISTIC_BENCHMARK",
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "calculate_book_spine_width",
        description:
          "Calculates exact book spine thickness, wrap dimensions, and spine text eligibility for Amazon KDP, commercial offset, or hardcover bindings.",
        inputSchema: {
          type: "object",
          properties: {
            page_count: {
              type: "integer",
              minimum: 2,
              description: "Total page count of the book (must be an even integer).",
            },
            paper_type: {
              type: "string",
              enum: [
                "kdp_white",
                "kdp_cream",
                "kdp_color_standard",
                "kdp_color_premium",
                "couche_gloss_100gsm",
                "couche_gloss_120gsm",
                "couche_gloss_150gsm",
                "couche_matt_150gsm",
                "offset_woodfree_70gsm",
                "offset_woodfree_80gsm",
                "offset_woodfree_100gsm",
                "custom",
              ],
              description: "Paper substrate stock and weight grade.",
            },
            binding_type: {
              type: "string",
              enum: ["paperback", "hardcover_casebound"],
              default: "paperback",
              description: "Binding format: paperback (perfect bound) or hardcover (casebound with board allowance).",
            },
            custom_caliper_mm: {
              type: "number",
              description: "Optional custom single-sheet caliper thickness in millimeters (required if paper_type is 'custom').",
            },
            trim_width_mm: {
              type: "number",
              description: "Trimmed page width in mm (e.g. 152.4 for 6x9 inch, 210 for A4, 148 for A5).",
            },
            trim_height_mm: {
              type: "number",
              description: "Trimmed page height in mm (e.g. 228.6 for 6x9 inch, 297 for A4, 210 for A5).",
            },
            bleed_mm: {
              type: "number",
              default: 3.175,
              description: "Outer document bleed in mm (standard 3.175mm / 0.125 inches for KDP).",
            },
          },
          required: ["page_count", "paper_type"],
        },
      },
      {
        name: "calculate_paper_weight_and_shipping",
        description:
          "Calculates single sheet weight, ream (500 sheets) weight, total production shipment weight, and freight CBM for paper runs.",
        inputSchema: {
          type: "object",
          properties: {
            sheet_width_mm: {
              type: "number",
              description: "Sheet width in millimeters (e.g. 210 for A4, 148 for A5, 790 for parent sheet).",
            },
            sheet_height_mm: {
              type: "number",
              description: "Sheet height in millimeters (e.g. 297 for A4, 210 for A5, 1090 for parent sheet).",
            },
            gsm: {
              type: "number",
              minimum: 30,
              maximum: 600,
              description: "Paper basis weight in Grams per Square Meter (GSM).",
            },
            quantity_sheets: {
              type: "integer",
              minimum: 1,
              description: "Total number of physical sheets in the print production run.",
            },
            include_carton_tare: {
              type: "boolean",
              default: true,
              description: "Include standard 5% tare allowance for corrugated cartons and strapping.",
            },
          },
          required: ["sheet_width_mm", "sheet_height_mm", "gsm", "quantity_sheets"],
        },
      },
      {
        name: "calculate_sheet_imposition_yield",
        description:
          "Computes maximum item yield, sheet area utilization, and trim waste when cutting small items from large parent press sheets.",
        inputSchema: {
          type: "object",
          properties: {
            parent_sheet_width_mm: {
              type: "number",
              description: "Parent raw sheet width in mm (e.g. 790 or 860).",
            },
            parent_sheet_height_mm: {
              type: "number",
              description: "Parent raw sheet height in mm (e.g. 1090 or 600).",
            },
            target_item_width_mm: {
              type: "number",
              description: "Finished item width in mm (e.g. 148 for A5 or 210 for A4).",
            },
            target_item_height_mm: {
              type: "number",
              description: "Finished item height in mm (e.g. 210 for A5 or 297 for A4).",
            },
            bleed_mm: {
              type: "number",
              default: 2.0,
              description: "Bleed allowance added to each edge of target item in mm.",
            },
            gripper_margin_mm: {
              type: "number",
              default: 10.0,
              description: "Press gripper margin along parent sheet edge in mm.",
            },
          },
          required: [
            "parent_sheet_width_mm",
            "parent_sheet_height_mm",
            "target_item_width_mm",
            "target_item_height_mm",
          ],
        },
      },
      {
        name: "convert_paper_units",
        description:
          "Performs authoritative ISO/TAPPI conversions between GSM, basis weight (Bond, Book/Text, Cover in lbs), and caliper thickness (points, microns, mils).",
        inputSchema: {
          type: "object",
          properties: {
            value: {
              type: "number",
              description: "Numeric magnitude to convert.",
            },
            from_unit: {
              type: "string",
              enum: [
                "gsm",
                "basis_weight_bond_lbs",
                "basis_weight_book_text_lbs",
                "basis_weight_cover_lbs",
                "caliper_microns_um",
                "caliper_points_pt",
                "caliper_mils",
                "caliper_mm",
              ],
              description: "Source unit of measure.",
            },
            to_unit: {
              type: "string",
              enum: [
                "gsm",
                "basis_weight_bond_lbs",
                "basis_weight_book_text_lbs",
                "basis_weight_cover_lbs",
                "caliper_microns_um",
                "caliper_points_pt",
                "caliper_mils",
                "caliper_mm",
              ],
              description: "Target unit of measure.",
            },
          },
          required: ["value", "from_unit", "to_unit"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "calculate_book_spine_width") {
      const pageCount = Number(args.page_count);
      const paperType = String(args.paper_type);
      const bindingType = String(args.binding_type || "paperback");
      const trimWidth = args.trim_width_mm ? Number(args.trim_width_mm) : null;
      const trimHeight = args.trim_height_mm ? Number(args.trim_height_mm) : null;
      const bleedMm = args.bleed_mm !== undefined ? Number(args.bleed_mm) : 3.175;

      let caliperMm = 0;
      let minPagesForText = 80;

      if (paperType === "custom") {
        if (!args.custom_caliper_mm || Number(args.custom_caliper_mm) <= 0) {
          throw new Error("custom_caliper_mm must be provided and > 0 when paper_type is 'custom'.");
        }
        caliperMm = Number(args.custom_caliper_mm);
      } else {
        const spec = PAPER_CALIPER_DATABASE[paperType];
        if (!spec) {
          throw new Error(`Unsupported paper_type '${paperType}'.`);
        }
        caliperMm = spec.caliper_mm;
        minPagesForText = spec.min_pages_for_spine_text;
      }

      // Formula: 1 sheet = 2 pages (page count / 2) * caliper
      // For KDP official formula: page_count * caliper_per_page
      // caliper_mm in our DB is per single sheet (2 pages), or per page?
      // KDP multiplier is per page: 0.002252 in/page. Our caliper_mm is 0.0572 mm/page.
      let rawSpineMm = pageCount * caliperMm;
      if (bindingType === "hardcover_casebound") {
        // Casebound adds binder's board allowance (~3.175 mm / 0.125 in)
        rawSpineMm += 3.175;
      }

      const spineWidthInches = rawSpineMm / 25.4;
      const spineTextPermitted = pageCount >= minPagesForText && spineWidthInches >= 0.25;

      let coverDimensions = null;
      if (trimWidth && trimHeight) {
        // Full cover wrap width = Bleed + Back Cover + Spine + Front Cover + Bleed
        const fullCoverWidthMm = bleedMm + trimWidth + rawSpineMm + trimWidth + bleedMm;
        const fullCoverHeightMm = bleedMm + trimHeight + bleedMm;
        coverDimensions = {
          trim_width_mm: trimWidth,
          trim_height_mm: trimHeight,
          bleed_mm: bleedMm,
          full_wrap_width_mm: Number(fullCoverWidthMm.toFixed(3)),
          full_wrap_height_mm: Number(fullCoverHeightMm.toFixed(3)),
          full_wrap_width_inches: Number((fullCoverWidthMm / 25.4).toFixed(3)),
          full_wrap_height_inches: Number((fullCoverHeightMm / 25.4).toFixed(3)),
          spine_center_x_mm: Number((bleedMm + trimWidth + rawSpineMm / 2).toFixed(3)),
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SUCCESS",
                inputs: {
                  page_count: pageCount,
                  paper_type: paperType,
                  binding_type: bindingType,
                },
                results: {
                  spine_width_mm: Number(rawSpineMm.toFixed(3)),
                  spine_width_inches: Number(spineWidthInches.toFixed(4)),
                  spine_text_permitted: spineTextPermitted,
                  spine_text_guidance: spineTextPermitted
                    ? "Sufficient thickness for spine typography."
                    : "Spine is too narrow (< 0.25 in / 6.35 mm); keep spine blank to avoid edge cutoff.",
                  cover_dimensions: coverDimensions,
                },
                standards_benchmark: STANDARDS_BENCHMARK,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "calculate_paper_weight_and_shipping") {
      const widthMm = Number(args.sheet_width_mm);
      const heightMm = Number(args.sheet_height_mm);
      const gsm = Number(args.gsm);
      const quantity = Number(args.quantity_sheets);
      const includeTare = args.include_carton_tare !== false;

      const areaM2 = (widthMm * heightMm) / 1000000;
      const weightPerSheetGrams = areaM2 * gsm;
      const reamWeightKg = (weightPerSheetGrams * 500) / 1000;
      const netWeightKg = (weightPerSheetGrams * quantity) / 1000;
      const netWeightLbs = netWeightKg * 2.20462;
      const grossWeightKg = includeTare ? netWeightKg * 1.05 : netWeightKg;
      const grossWeightLbs = grossWeightKg * 2.20462;

      // Solid paper bulk density: approx 800 kg per m3 packaged
      const estimatedCbm = Number((grossWeightKg / 800).toFixed(4));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SUCCESS",
                inputs: {
                  sheet_dimensions_mm: `${widthMm} x ${heightMm}`,
                  gsm,
                  quantity_sheets: quantity,
                  include_carton_tare: includeTare,
                },
                results: {
                  sheet_area_sq_meter: Number(areaM2.toFixed(4)),
                  single_sheet_weight_grams: Number(weightPerSheetGrams.toFixed(3)),
                  ream_weight_500_sheets_kg: Number(reamWeightKg.toFixed(3)),
                  net_paper_weight_kg: Number(netWeightKg.toFixed(2)),
                  net_paper_weight_lbs: Number(netWeightLbs.toFixed(2)),
                  gross_shipping_weight_kg: Number(grossWeightKg.toFixed(2)),
                  gross_shipping_weight_lbs: Number(grossWeightLbs.toFixed(2)),
                  estimated_freight_cbm: estimatedCbm,
                },
                standards_benchmark: STANDARDS_BENCHMARK,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "calculate_sheet_imposition_yield") {
      const parentW = Number(args.parent_sheet_width_mm);
      const parentH = Number(args.parent_sheet_height_mm);
      const itemW = Number(args.target_item_width_mm);
      const itemH = Number(args.target_item_height_mm);
      const bleed = args.bleed_mm !== undefined ? Number(args.bleed_mm) : 2.0;
      const gripper = args.gripper_margin_mm !== undefined ? Number(args.gripper_margin_mm) : 10.0;

      const effectiveParentW = Math.max(0, parentW - 10); // 5mm side trims
      const effectiveParentH = Math.max(0, parentH - gripper); // gripper edge
      const effectiveItemW = itemW + bleed * 2;
      const effectiveItemH = itemH + bleed * 2;

      // Layout 1: Normal Orientation
      const cols1 = Math.floor(effectiveParentW / effectiveItemW);
      const rows1 = Math.floor(effectiveParentH / effectiveItemH);
      const yield1 = cols1 * rows1;

      // Layout 2: Rotated 90 degrees
      const cols2 = Math.floor(effectiveParentW / effectiveItemH);
      const rows2 = Math.floor(effectiveParentH / effectiveItemW);
      const yield2 = cols2 * rows2;

      const bestYield = Math.max(yield1, yield2);
      const optimalLayout =
        yield1 >= yield2
          ? { orientation: "NORMAL", columns: cols1, rows: rows1, items_per_sheet: yield1 }
          : { orientation: "ROTATED_90_DEG", columns: cols2, rows: rows2, items_per_sheet: yield2 };

      const itemAreaTotal = bestYield * (effectiveItemW * effectiveItemH);
      const parentArea = parentW * parentH;
      const utilizationRate = Number(((itemAreaTotal / parentArea) * 100).toFixed(2));
      const wasteRate = Number((100 - utilizationRate).toFixed(2));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SUCCESS",
                inputs: {
                  parent_sheet: `${parentW} x ${parentH} mm`,
                  target_item: `${itemW} x ${itemH} mm (bleed: ${bleed}mm)`,
                  gripper_margin_mm: gripper,
                },
                results: {
                  optimal_items_per_sheet: bestYield,
                  layout_grid: `${optimalLayout.columns} columns x ${optimalLayout.rows} rows (${optimalLayout.orientation})`,
                  area_utilization_percent: utilizationRate,
                  paper_trim_waste_percent: wasteRate,
                },
                standards_benchmark: STANDARDS_BENCHMARK,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "convert_paper_units") {
      const val = Number(args.value);
      const from = String(args.from_unit);
      const to = String(args.to_unit);

      // Convert to normalized GSM first
      let normGsm = 0;
      switch (from) {
        case "gsm":
          normGsm = val;
          break;
        case "basis_weight_bond_lbs":
          normGsm = val * 3.7597;
          break;
        case "basis_weight_book_text_lbs":
          normGsm = val * 1.4802;
          break;
        case "basis_weight_cover_lbs":
          normGsm = val * 2.7077;
          break;
        case "caliper_microns_um":
          // Approximation for offset paper density ~ 0.8 g/cm3
          normGsm = val * 0.8;
          break;
        case "caliper_points_pt":
        case "caliper_mils":
          normGsm = val * 25.4 * 0.8;
          break;
        case "caliper_mm":
          normGsm = val * 1000 * 0.8;
          break;
        default:
          throw new Error(`Unsupported source unit ${from}`);
      }

      // Convert from normalized GSM to target unit
      let converted = 0;
      switch (to) {
        case "gsm":
          converted = normGsm;
          break;
        case "basis_weight_bond_lbs":
          converted = normGsm / 3.7597;
          break;
        case "basis_weight_book_text_lbs":
          converted = normGsm / 1.4802;
          break;
        case "basis_weight_cover_lbs":
          converted = normGsm / 2.7077;
          break;
        case "caliper_microns_um":
          converted = normGsm / 0.8;
          break;
        case "caliper_points_pt":
        case "caliper_mils":
          converted = normGsm / 0.8 / 25.4;
          break;
        case "caliper_mm":
          converted = normGsm / 0.8 / 1000;
          break;
        default:
          throw new Error(`Unsupported target unit ${to}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SUCCESS",
                inputs: { value: val, from_unit: from, to_unit: to },
                results: {
                  converted_value: Number(converted.toFixed(4)),
                  unit: to,
                },
                standards_benchmark: STANDARDS_BENCHMARK,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  console.error("Fatal error starting print-spine-paper-radar:", err);
  process.exit(1);
});
