import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

// Load schema + data
const schema = JSON.parse(
  fs.readFileSync("fsms-save-point.schema.json", "utf8")
);

const data = JSON.parse(
  fs.readFileSync("fsms-save-point.json", "utf8")
);

// Validate
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const valid = validate(data);

if (!valid) {
  console.error("FSMS save point validation failed:");
  for (const err of validate.errors ?? []) {
    console.error(`- ${err.instancePath || "/"} ${err.message}`);
  }
  process.exit(1);
}

// Enforce canonical layer order
const expectedLayerMap = [
  "Replay",
  "Compliance",
  "Prediction",
  "Risk",
  "Advisory",
  "HUD"
];

if (JSON.stringify(data.systemLayerMap) !== JSON.stringify(expectedLayerMap)) {
  console.error("FSMS save point validation failed:");
  console.error("- systemLayerMap must remain Replay -> Compliance -> Prediction -> Risk -> Advisory -> HUD");
  process.exit(1);
}

if (
  !data.doNotChangeRules?.orderingRules?.includes(
    "Replay -> Compliance -> Prediction -> Risk -> Advisory -> HUD"
  )
) {
  console.error("FSMS save point validation failed:");
  console.error("- orderingRules must include the canonical system ordering");
  process.exit(1);
}

console.log("FSMS save point is valid.");