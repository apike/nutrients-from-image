"use strict";

// HTML form for file upload
const htmlForm = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nutrition Facts Analyzer</title>
  <!-- Load the heic-to library using module import -->
  <script type="module">
    // Import heic-to directly from unpkg (ESM version)
    import * as heicTo from 'https://cdn.jsdelivr.net/npm/heic-to@1.1.10/dist/csp/heic-to.min.js';
    // Expose to global scope for use in our script
    window.heicToLib = heicTo;
  </script>
  <!-- Safari polyfill for createImageBitmap -->
  <script src="https://cdn.jsdelivr.net/npm/createimagebitmap-polyfill@0.1.0/dist/createImageBitmap.polyfill.min.js"></script>
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
    .info {
      margin-top: 10px;
      font-size: 14px;
      color: #666;
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
          <input type="file" id="imageFile" name="file" accept="image/*" onchange="handleImageFile(event)">
          <img id="imagePreview" src="#" alt="Preview">
          <div id="imageInfo" class="info"></div>
        </div>
        <div class="form-group">
          <button type="submit">Analyze Image</button>
        </div>
      </form>
    </div>
    
    <div>
      <h2>Results:</h2>
      <div id="result">Results will appear here after analysis...</div>
    </div>
  </div>

  <script>
    // Debug logging function - console only
    function debugLog(message, data = null) {
      const timestamp = new Date().toLocaleTimeString();
      const formattedMsg = timestamp + ': ' + message;
      
      if (data) {
        console.log(formattedMsg, data);
      } else {
        console.log(formattedMsg);
      }
    }
    
    // Show image information
    function showImageInfo(width, height, size) {
      const sizeInKB = Math.round(size / 1024);
      document.getElementById('imageInfo').innerHTML = 
        \`Image size: \${width}×\${height}px, \${sizeInKB}KB\`;
    }

    // Global processed file variable
    let processedFile = null;
    
    // Fixed max dimension - always resize to this
    const MAX_DIMENSION = 1024;

    // Resize image using canvas - always applied
    async function resizeImage(file, maxDimension = MAX_DIMENSION) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(e) {
          const img = new Image();
          img.src = e.target.result;
          
          img.onload = function() {
            // Get image dimensions
            let width = img.width;
            let height = img.height;
            
            // Check if resize is needed
            if (width <= maxDimension && height <= maxDimension) {
              debugLog('No resize needed, image dimensions are within limits', { width, height });
              showImageInfo(width, height, file.size);
              resolve(file);
              return;
            }
            
            // Calculate new dimensions
            if (width > height && width > maxDimension) {
              height = Math.round(height * (maxDimension / width));
              width = maxDimension;
            } else if (height > maxDimension) {
              width = Math.round(width * (maxDimension / height));
              height = maxDimension;
            }
            
            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to blob
            canvas.toBlob((blob) => {
              const resizedFile = new File([blob], file.name.split('.')[0] + '.jpg', { 
                type: 'image/jpeg',
                lastModified: new Date().getTime()
              });
              showImageInfo(width, height, blob.size);
              resolve(resizedFile);
            }, 'image/jpeg', 0.9);
          };
        };
      });
    }

    // Convert HEIC to JPEG using heic-to library
    async function convertHeicToJpeg(file) {
      debugLog('Starting HEIC conversion with heic-to library');
      
      try {
        // Check if heic-to library is available
        if (!window.heicToLib) {
          debugLog('heic-to library not loaded, skipping conversion');
          throw new Error('HEIC conversion library not available');
        }
        
        // First check if the file is actually a HEIC file
        debugLog('Checking if file is HEIC format');
        const isHeicFile = await window.heicToLib.isHeic(file).catch(err => {
          debugLog('Error checking HEIC format', { message: err.message });
          return false;
        });
        
        debugLog('File HEIC check result', { isHeic: isHeicFile });
        
        if (!isHeicFile) {
          debugLog('File is not a HEIC image, skipping conversion');
          return file;
        }
        
        // Convert the HEIC file to JPEG
        debugLog('Converting HEIC to JPEG');
        const jpegBlob = await window.heicToLib.heicTo({
          blob: file,
          type: 'image/jpeg',
          quality: 0.9
        });
        
        debugLog('HEIC conversion successful', { 
          size: jpegBlob.size,
          type: jpegBlob.type
        });
        
        // Create a new File from the blob
        return new File([jpegBlob], file.name.split('.')[0] + '.jpg', { 
          type: 'image/jpeg',
          lastModified: new Date().getTime()
        });
      } catch (error) {
        debugLog('HEIC conversion error', { message: error.message, stack: error.stack });
        throw error;
      }
    }

    // Fallback method - directly use client-side resizing without format conversion
    async function clientSideResize(file, maxWidth = 1024, maxHeight = 1024) {
      debugLog('Using client-side resize fallback');
      
      return new Promise((resolve, reject) => {
        try {
          // Create a FileReader to read the file
          const reader = new FileReader();
          
          reader.onload = function(e) {
            // Create an image to get the dimensions
            const img = new Image();
            
            img.onload = function() {
              debugLog('Image loaded for resize', { width: img.width, height: img.height });
              
              // Calculate new dimensions maintaining aspect ratio
              let width = img.width;
              let height = img.height;
              
              if (width > height && width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
              } else if (height > maxHeight) {
                width = Math.round(width * (maxHeight / height));
                height = maxHeight;
              }
              
              // Create a canvas to draw the resized image
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              
              // Draw image on canvas
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              
              // Get as JPEG
              canvas.toBlob(function(blob) {
                debugLog('Resize complete', { 
                  originalSize: file.size, 
                  newSize: blob.size,
                  width: width,
                  height: height
                });
                
                // Create a new File
                const resizedFile = new File([blob], file.name.split('.')[0] + '.jpg', { 
                  type: 'image/jpeg',
                  lastModified: new Date().getTime()
                });
                
                resolve(resizedFile);
              }, 'image/jpeg', 0.9);
            };
            
            img.onerror = function() {
              debugLog('Image failed to load for resize');
              reject(new Error('Failed to load image for resizing'));
            };
            
            // Load the image
            img.src = e.target.result;
          };
          
          reader.onerror = function() {
            debugLog('FileReader error', { error: reader.error });
            reject(new Error('Failed to read file for resizing'));
          };
          
          // Read the file as a data URL
          reader.readAsDataURL(file);
        } catch (error) {
          debugLog('Error in client-side resize', { message: error.message });
          reject(error);
        }
      });
    }

    // Handle image files 
    async function handleImageFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const preview = document.getElementById('imagePreview');
      
      debugLog('Processing file', { 
        name: file.name, 
        type: file.type, 
        size: file.size + ' bytes'
      });
      
      try {
        let processedImageFile = file;
        
        // Handle HEIC/HEIF files
        if (file.type === 'image/heic' || 
            file.name.toLowerCase().endsWith('.heic') || 
            file.name.toLowerCase().endsWith('.heif')) {
          
          // Show loading state
          document.getElementById('imageInfo').innerHTML = 'Converting HEIC image...';
          
          try {
            // Try converting with heic-to
            processedImageFile = await convertHeicToJpeg(file);
            document.getElementById('imageInfo').innerHTML = 'HEIC conversion successful!';
          } catch (heicError) {
            debugLog('Primary HEIC conversion failed', { message: heicError.message });
            
            // Try direct resize instead of conversion
            try {
              document.getElementById('imageInfo').innerHTML = 'Conversion failed, trying direct resize...';
              debugLog('Trying direct resize fallback');
              
              // This method tries to load the image and resize it
              // bypassing format conversion issues
              processedImageFile = await clientSideResize(file, 2048, 2048);
              
              document.getElementById('imageInfo').innerHTML = 'Image processed with fallback method';
            } catch (fallbackError) {
              debugLog('All conversion methods failed', { message: fallbackError.message });
              
              // Last attempt - just treat it as JPEG and hope for the best
              document.getElementById('imageInfo').innerHTML = 'All conversion methods failed';
              debugLog('Last resort - trying to process as-is');
              
              if (confirm('Image conversion failed. Try uploading anyway?')) {
                // Just rename it to jpg and hope the server can handle it
                processedImageFile = new File([file], file.name.split('.')[0] + '.jpg', { 
                  type: 'image/jpeg',
                  lastModified: new Date().getTime()
                });
              } else {
                throw new Error('Image conversion failed. Please try a different image format or convert it manually first.');
              }
            }
          }
        }
        
        // Always resize the image to MAX_DIMENSION
        debugLog('Resizing image to ' + MAX_DIMENSION + 'px');
        processedImageFile = await resizeImage(processedImageFile, MAX_DIMENSION);
        debugLog('Processing complete', { 
          name: processedImageFile.name, 
          type: processedImageFile.type, 
          size: processedImageFile.size + ' bytes' 
        });
        
        // Store processed file for upload
        processedFile = processedImageFile;
        
        // Show preview
        preview.style.display = 'block';
        preview.src = URL.createObjectURL(processedFile);
        
      } catch (error) {
        console.error('Error processing image:', error);
        debugLog('Error processing image', { message: error.message, stack: error.stack });
        document.getElementById('imageInfo').innerHTML = 'Error processing image: ' + error.message;
      }
    }

    document.getElementById('uploadForm').addEventListener('submit', function(event) {
      event.preventDefault();
      
      if (!processedFile) {
        alert('Please select an image first.');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', processedFile);
      
      // Show loading state
      const resultDiv = document.getElementById('result');
      resultDiv.textContent = 'Analyzing image...';
      
      debugLog('Submitting image for analysis', { 
        fileName: processedFile.name,
        fileSize: processedFile.size + ' bytes',
        fileType: processedFile.type
      });
      
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

// Export the form route handler
module.exports = function (fastify) {
  // Root route - serve HTML form
  fastify.get("/", async function (request, reply) {
    reply.type("text/html");
    return htmlForm;
  });
};
