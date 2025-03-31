"use strict";

const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const PROMPT = `
Given a photo, you will return JSON with some of the relevant nutrition facts pictured, if a nutrition facts label is shown in the photo. You will respond in only valid JSON with this format:

{
	"nutrition_label_found": "true",
	"serving_grams": 40,
	"calories": 170,
	"saturated_fat_grams": 2,
	"sodium_mg": 140,
	"fibre_grams": 1.5,
	"total_sugar_grams": 13,
	"protein_grams": 3,
	"percent_whole_fruit_or_veg_guess": 0,
	"guessed_packaged_food_name": "Kashi Snack Bar"
}
`;

const MODEL = "gemini-2.0-flash-lite";

module.exports = async function (fastify, opts) {
  // Register multipart support for file uploads with limits
  fastify.register(require("@fastify/multipart"), {
    limits: {
      fileSize: 1 * 1024 * 1024, // 1MB limit for original files
    },
  });

  // POST endpoint to analyze image
  fastify.post("/", async function (request, reply) {
    try {
      let imageBuffer;
      let mimeType = "image/jpeg";

      // Handle direct binary uploads (used in tests)
      if (
        request.headers["content-type"] &&
        request.headers["content-type"].startsWith("image/")
      ) {
        imageBuffer = request.body;
        mimeType = request.headers["content-type"];
      }
      // Handle multipart form uploads
      else {
        const data = await request.file();

        if (!data) {
          return { error: "No image file uploaded" };
        }

        // Read the file buffer
        imageBuffer = await data.toBuffer();
        mimeType = data.mimetype;
      }

      if (!imageBuffer) {
        return { error: "Failed to process image data" };
      }

      // Convert buffer to base64
      const base64Image = imageBuffer.toString("base64");

      // Initialize Gemini
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // Prepare content with image and prompt
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: PROMPT },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      });

      // Get the response text
      let responseText = "";
      if (
        response &&
        response.response &&
        typeof response.response.text === "function"
      ) {
        responseText = response.response.text();
      } else if (response && typeof response.text === "function") {
        responseText = response.text();
      } else if (response && response.text) {
        responseText = response.text;
      } else {
        console.log("Unexpected response format:", response);
        return {
          error: "Unexpected API response format",
          nutrition_label_found: "false",
        };
      }

      console.log("Response:", responseText);

      // Parse the JSON if possible
      try {
        // Handle responses that might be wrapped in markdown code blocks
        const cleanResponse = responseText.replace(/```json\n|\n```|```/g, "");
        const jsonResponse = JSON.parse(cleanResponse);
        return jsonResponse;
      } catch (jsonError) {
        console.error("Error parsing JSON:", jsonError);
        return {
          response: responseText,
          nutrition_label_found: "false",
        };
      }
    } catch (error) {
      console.error("Error:", error);

      // Check if this is a file size error and return the appropriate status code
      if (error.code === "FST_REQ_FILE_TOO_LARGE") {
        reply.code(413);
        return {
          error: "File too large: Maximum file size is 1MB",
          nutrition_label_found: "false",
        };
      }

      return {
        error: "Failed to process image: " + error.message,
        nutrition_label_found: "false",
      };
    }
  });
};
