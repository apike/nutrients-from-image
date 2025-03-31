"use strict";

const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const util = require("util");
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
	"guessed_packaged_food_name": "Granola Bar"
}
`;

const MODEL = "gemini-2.0-flash-lite";

// HTML form for file upload
const htmlForm = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nutrition Facts Analyzer</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      color: #333;
    }
    .container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .upload-form {
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 8px;
      background-color: #f9f9f9;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="file"] {
      display: block;
      width: 100%;
      padding: 10px 0;
    }
    button {
      background-color: #4CAF50;
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    #result {
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 8px;
      background-color: #f9f9f9;
      min-height: 200px;
      white-space: pre-wrap;
    }
    #imagePreview {
      max-width: 100%;
      max-height: 300px;
      margin-top: 10px;
      display: none;
    }
    .capture-btn {
      background-color: #2196F3;
    }
    .capture-btn:hover {
      background-color: #0b7dda;
    }
  </style>
</head>
<body>
  <h1>Nutrition Facts Analyzer</h1>
  <p>Upload a photo of a nutrition label to extract the nutrition facts.</p>
  
  <div class="container">
    <div class="upload-form">
      <form id="uploadForm" enctype="multipart/form-data">
        <div class="form-group">
          <label for="imageFile">Select an image:</label>
          <input type="file" id="imageFile" name="file" accept="image/*" onchange="previewImage(event)">
          <img id="imagePreview" src="#" alt="Preview">
        </div>
        <div class="form-group">
          <button type="submit">Analyze Image</button>
          <button type="button" class="capture-btn" onclick="captureImage()">Take Photo</button>
        </div>
      </form>
    </div>
    
    <div>
      <h2>Results:</h2>
      <div id="result">Results will appear here after analysis...</div>
    </div>
  </div>

  <script>
    // Create a hidden camera element
    let videoElement;
    let stream;

    function previewImage(event) {
      const preview = document.getElementById('imagePreview');
      preview.style.display = 'block';
      preview.src = URL.createObjectURL(event.target.files[0]);
    }

    function captureImage() {
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.style.display = 'none';
        document.body.appendChild(videoElement);
      }

      // Check if already streaming
      if (stream) {
        stopCamera();
        return;
      }

      // Access the device camera
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(mediaStream) {
          stream = mediaStream;
          videoElement.srcObject = stream;
          videoElement.play();

          // Create a canvas to capture the image
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          // Wait a bit for the camera to initialize
          setTimeout(() => {
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // Convert canvas to blob and set it to the file input
            canvas.toBlob(function(blob) {
              const fileInput = document.getElementById('imageFile');
              const dataTransfer = new DataTransfer();
              const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
              dataTransfer.items.add(file);
              fileInput.files = dataTransfer.files;

              // Display the captured image
              const preview = document.getElementById('imagePreview');
              preview.style.display = 'block';
              preview.src = URL.createObjectURL(blob);

              stopCamera();
            }, 'image/jpeg');
          }, 500);
        })
        .catch(function(error) {
          console.error("Error accessing camera: ", error);
          alert("Could not access the camera. Please ensure you have given permission.");
        });
    }

    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    }

    document.getElementById('uploadForm').addEventListener('submit', function(event) {
      event.preventDefault();
      
      const fileInput = document.getElementById('imageFile');
      if (!fileInput.files[0]) {
        alert('Please select an image file first.');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      
      // Show loading state
      const resultDiv = document.getElementById('result');
      resultDiv.textContent = 'Analyzing image...';
      
      fetch('/example/analyze', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        // Format the JSON for display
        resultDiv.textContent = JSON.stringify(data, null, 2);
      })
      .catch(error => {
        console.error('Error:', error);
        resultDiv.textContent = 'Error analyzing image: ' + error.message;
      });
    });
  </script>
</body>
</html>
`;

module.exports = async function (fastify, opts) {
  // Register multipart support for file uploads
  fastify.register(require("@fastify/multipart"));

  // POST endpoint to analyze image
  fastify.post("/analyze", async function (request, reply) {
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
      return {
        error: "Failed to process image: " + error.message,
        nutrition_label_found: "false",
      };
    }
  });

  // Root route - serve HTML form
  fastify.get("/", async function (request, reply) {
    reply.type("text/html");
    return htmlForm;
  });
};
