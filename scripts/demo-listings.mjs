import { access } from "node:fs/promises";
import path from "node:path";

const requiredStrings = [
  "sourceKey",
  "listingId",
  "managerId",
  "title",
  "neighborhood",
  "description",
  "feeDisclosureState",
  "availableDate",
  "createdAt",
  "updatedAt",
];

function requireNonEmptyString(value, field, listingId = "enrichment record") {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${listingId} requires a non-empty ${field}.`);
  }
}

function requireNonNegativeNumber(value, field, listingId) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${listingId} requires a non-negative numeric ${field}.`);
  }
}

function validateSourceRecord(record) {
  const stringFields = ["zipCode", "propertyType"];
  for (const field of stringFields) requireNonEmptyString(record?.[field], field, "source record");

  for (const field of ["bedrooms", "bathrooms", "price"]) {
    requireNonNegativeNumber(record?.[field], field, "source record");
  }

  if (
    record.squareFootage !== null &&
    (typeof record.squareFootage !== "number" ||
      !Number.isFinite(record.squareFootage) ||
      record.squareFootage < 0)
  ) {
    throw new Error("source record requires squareFootage to be a non-negative number or null.");
  }
}

function validateEnrichmentRecord(record) {
  const listingId = record?.listingId || "enrichment record";
  for (const field of requiredStrings) requireNonEmptyString(record?.[field], field, listingId);

  if (record.feeDisclosureState !== "complete") {
    throw new Error(`${listingId} requires feeDisclosureState to be complete.`);
  }

  requireNonNegativeNumber(record.securityDeposit, "securityDeposit", listingId);

  if (!Array.isArray(record.mandatoryRecurringFees)) {
    throw new Error(`${listingId} requires mandatoryRecurringFees to be an array.`);
  }

  const feeIds = new Set();
  for (const fee of record.mandatoryRecurringFees) {
    requireNonEmptyString(fee?.id, "fee id", listingId);
    requireNonEmptyString(fee?.label, "fee label", listingId);
    requireNonNegativeNumber(fee?.amount, "fee amount", listingId);
    if (feeIds.has(fee.id)) throw new Error(`${listingId} has duplicate fee id ${fee.id}.`);
    feeIds.add(fee.id);
  }

  const explicitlyNoFees = record.noMandatoryRecurringFees === true;
  const explicitlyHasFees = record.noMandatoryRecurringFees === false;
  if (!explicitlyNoFees && !explicitlyHasFees) {
    throw new Error(`${listingId} must explicitly state whether it has no mandatory recurring fees.`);
  }
  if (record.mandatoryRecurringFees.length === 0 && !explicitlyNoFees) {
    throw new Error(`${listingId} must explicitly state whether it has no mandatory recurring fees.`);
  }
  if (record.mandatoryRecurringFees.length > 0 && !explicitlyHasFees) {
    throw new Error(`${listingId} cannot mark no mandatory recurring fees when fee items exist.`);
  }

  for (const [field, values] of [
    ["images", record.images],
    ["amenities", record.amenities],
  ]) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`${listingId} requires at least one ${field} value.`);
    }
    values.forEach((value) => requireNonEmptyString(value, field, listingId));
  }
}

export function createSourceKey(record) {
  validateSourceRecord(record);
  return JSON.stringify([
    record.zipCode,
    record.propertyType,
    record.bedrooms,
    record.bathrooms,
    record.squareFootage,
    record.price,
  ]);
}

export function buildDemoListings(snapshot, enrichment) {
  if (!Array.isArray(snapshot?.listings) || !Array.isArray(enrichment?.listings)) {
    throw new Error("Demo listing inputs must contain listings arrays.");
  }

  const sourceByKey = new Map();
  for (const source of snapshot.listings) {
    const key = createSourceKey(source);
    if (sourceByKey.has(key)) throw new Error(`RentCast snapshot has duplicate source key ${key}.`);
    sourceByKey.set(key, source);
  }

  const enrichmentByKey = new Map();
  const listingIds = new Set();
  for (const record of enrichment.listings) {
    validateEnrichmentRecord(record);
    if (enrichmentByKey.has(record.sourceKey)) {
      throw new Error(`Synthetic fixture has duplicate source key ${record.sourceKey}.`);
    }
    if (listingIds.has(record.listingId)) {
      throw new Error(`Synthetic fixture has duplicate listing ID ${record.listingId}.`);
    }
    enrichmentByKey.set(record.sourceKey, record);
    listingIds.add(record.listingId);
  }

  const missingKeys = [...sourceByKey.keys()].filter((key) => !enrichmentByKey.has(key));
  const extraKeys = [...enrichmentByKey.keys()].filter((key) => !sourceByKey.has(key));
  if (missingKeys.length || extraKeys.length) {
    throw new Error(
      `Synthetic fixture must have exact source coverage (missing ${missingKeys.length}, unmatched ${extraKeys.length}).`,
    );
  }

  const listings = snapshot.listings.map((source) => {
    const sourceKey = createSourceKey(source);
    const presentation = enrichmentByKey.get(sourceKey);
    const mandatoryRecurringFeeTotal = presentation.mandatoryRecurringFees.reduce(
      (total, fee) => total + fee.amount,
      0,
    );

    return {
      market: { sourceKey, ...source },
      synthetic: {
        listingId: presentation.listingId,
        managerId: presentation.managerId,
        title: presentation.title,
        neighborhood: presentation.neighborhood,
        description: presentation.description,
        mandatoryRecurringFees: presentation.mandatoryRecurringFees.map((fee) => ({ ...fee })),
        mandatoryRecurringFeeTotal,
        noMandatoryRecurringFees: presentation.noMandatoryRecurringFees,
        feeDisclosureState: presentation.feeDisclosureState,
        trueMonthlyCost: source.price + mandatoryRecurringFeeTotal,
        securityDeposit: presentation.securityDeposit,
        availableDate: presentation.availableDate,
        images: [...presentation.images],
        amenities: [...presentation.amenities],
        inventorySource: "synthetic",
        createdAt: presentation.createdAt,
        updatedAt: presentation.updatedAt,
      },
      provenance: {
        market: "RentCast sanitized snapshot",
        synthetic: "RentWell synthetic demo fixture",
      },
    };
  });

  return {
    version: 1,
    generatedFrom: snapshot.generatedAt,
    source: snapshot.source,
    query: snapshot.query,
    limitations: snapshot.limitations,
    listingCount: listings.length,
    listings,
  };
}

export async function validateDemoListingAssets(dataset, projectRoot) {
  for (const listing of dataset.listings) {
    for (const imagePath of listing.synthetic.images) {
      if (!imagePath.startsWith("/listings/") || !imagePath.endsWith(".jpg")) {
        throw new Error(`${listing.synthetic.listingId} has invalid local image path ${imagePath}.`);
      }
      const absolutePath = path.join(projectRoot, "public", imagePath.slice(1));
      try {
        await access(absolutePath);
      } catch {
        throw new Error(`${listing.synthetic.listingId} references missing asset ${imagePath}.`);
      }
    }
  }
}
