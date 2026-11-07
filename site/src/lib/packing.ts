// Packing advisor. From the parcel's size and weight and the box catalog, say what the carriers will
// actually bill for (dimensional weight bites when a box is big and light), which stocked box fits,
// and whether a smaller box would bring the billable weight down. Box inner sizes are read from the
// catalog names, "up to 16 x 12 x 10 in", so the owners can add boxes on the Prices page with no
// code change: keep the three numbers in the name.
import type { Parcel } from '../shipping/types';
import { billableWeightLb, dimWeightLb, lengthPlusGirth } from '../shipping/dim';

export interface BoxOption { code: string; name: string; price: number; dims: [number, number, number] }
export interface PackingAdvice {
  actual_lb: number;
  billable: { carrier: 'USPS' | 'UPS' | 'FedEx' | 'DHL'; lb: number; dimensional: boolean }[];
  dim_applies: boolean;             // at least one carrier bills more than the actual weight
  oversize: boolean;                // length plus girth over 130 inches
  fits: BoxOption | null;           // the smallest stocked box the parcel fits in
  better: { box: BoxOption; saves_lb: number } | null; // a stocked box that would cut the billable weight
}

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL'] as const;
const sorted = (d: number[]) => [...d].sort((a, b) => b - a) as [number, number, number];

/** Inner dimensions from a catalog name, if it carries three numbers: "Medium box, up to 16 x 12 x 10 in". */
export function boxDims(name: string): [number, number, number] | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  return m ? sorted([Number(m[1]), Number(m[2]), Number(m[3])]) : null;
}

export function boxesFrom(items: { code: string; kind: string; name: string; price: number; active?: number }[]): BoxOption[] {
  return items.filter((i) => i.kind === 'box' && (i.active ?? 1)).map((i) => ({ code: i.code, name: i.name, price: i.price, dims: boxDims(i.name)! })).filter((b) => b.dims)
    .sort((a, b) => a.dims[0] * a.dims[1] * a.dims[2] - b.dims[0] * b.dims[1] * b.dims[2]);
}

const fitsIn = (p: [number, number, number], box: [number, number, number]) => p[0] <= box[0] && p[1] <= box[1] && p[2] <= box[2];
const worst = (p: Parcel) => Math.max(...CARRIERS.map((c) => billableWeightLb(c, p)));

export function advise(parcel: Parcel, boxes: BoxOption[]): PackingAdvice {
  const billable = CARRIERS.map((carrier) => ({ carrier, lb: billableWeightLb(carrier, parcel), dimensional: dimWeightLb(carrier, parcel) > parcel.weight_lb }));
  const dims = sorted([parcel.length_in, parcel.width_in, parcel.height_in]);
  const fits = boxes.find((b) => fitsIn(dims, b.dims)) ?? null;
  // A smaller stocked box helps only when the item would still fit, which we cannot know from the
  // outside size alone; so "better" means a box smaller than what was typed that cuts the worst
  // carrier's billable weight, offered as a question for the counter, not a decision.
  // Offer the LARGEST smaller box that still saves at least a pound: the one most likely to hold the contents.
  let better: PackingAdvice['better'] = null;
  const now = worst(parcel);
  for (const b of [...boxes].reverse()) {
    if (b.dims[0] * b.dims[1] * b.dims[2] >= dims[0] * dims[1] * dims[2]) continue;
    const alt = worst({ ...parcel, length_in: b.dims[0], width_in: b.dims[1], height_in: b.dims[2] });
    if (now - alt >= 1) { better = { box: b, saves_lb: Math.round((now - alt) * 10) / 10 }; break; }
  }
  return { actual_lb: parcel.weight_lb, billable, dim_applies: billable.some((b) => b.dimensional), oversize: lengthPlusGirth(parcel) > 130, fits, better };
}
