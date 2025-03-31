"use strict";

const fs = require("fs");
const path = require("path");

// Export the route handler
module.exports = async function (fastify, opts) {
  // GET /test - serve HTML form
  fastify.get("/", async function (request, reply) {
    // Get the path to the HTML file
    const formPath = path.join(__dirname, "form.html");

    // Read the HTML file
    const htmlContent = fs.readFileSync(formPath, "utf8");

    // Set content type and return the HTML
    reply.type("text/html");
    return htmlContent;
  });
};
