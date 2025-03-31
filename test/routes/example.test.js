"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { build } = require("../helper");
const fs = require("fs");
const path = require("path");

test("example is loaded", async (t) => {
  const app = await build(t);

  const res = await app.inject({
    url: "/example",
  });
  // Expecting a response from Gemini
  assert.ok(res.statusCode === 200);
});

test("analyze nutrition facts from image", async (t) => {
  const app = await build(t);

  // Path to the image
  const imagePath = path.join(__dirname, "..", "crackers-example.jpg");

  // Create a boundary for the multipart/form-data
  const boundary = "----WebKitFormBoundaryABC123";

  // Create multipart form-data manually
  let payload = "";
  payload += `--${boundary}\r\n`;
  payload +=
    'Content-Disposition: form-data; name="file"; filename="crackers-example.jpg"\r\n';
  payload += "Content-Type: image/jpeg\r\n\r\n";

  // Append file contents
  const fileContent = fs.readFileSync(imagePath);
  const multipartPayload = Buffer.concat([
    Buffer.from(payload, "utf8"),
    fileContent,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ]);

  // POST the multipart form to the analyze endpoint
  const res = await app.inject({
    method: "POST",
    url: "/example/analyze",
    payload: multipartPayload,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  });

  // Check basic structure of the response
  assert.equal(res.statusCode, 200);
  const json = JSON.parse(res.payload);

  // Check that nutrition facts were found
  assert.ok(Object.hasOwn(json, "nutrition_label_found"));
  // If using real Gemini, these should be close to the example in the image
  if (json.nutrition_label_found === "true") {
    assert.ok(Object.hasOwn(json, "serving_grams"));
    assert.ok(Object.hasOwn(json, "calories"));
  }
});
