"use strict";

const { GoogleGenAI } = require("@google/genai");

module.exports = async function (fastify, opts) {
  fastify.get("/", async function (request, reply) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: "Why is the sky blue?",
      });
      console.log(response.text);
      return "Response: " + response.text;
    } catch (error) {
      console.error("Error:", error);
      return { error: "Failed to generate content" };
    }
  });
};
