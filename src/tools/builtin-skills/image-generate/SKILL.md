# image_generate

Generate images using AI models (DALL-E 3, Flux, or Together AI). Returns the file path of the generated image.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "prompt": {
      "type": "string",
      "description": "Text description of the image to generate"
    },
    "size": {
      "type": "string",
      "description": "Image size (e.g. '1024x1024', '1792x1024', '1024x1792'). Default: 1024x1024"
    },
    "style": {
      "type": "string",
      "enum": ["vivid", "natural"],
      "description": "Image style. 'vivid' for hyper-real/dramatic, 'natural' for more natural. Default: vivid"
    },
    "n": {
      "type": "number",
      "description": "Number of images to generate (1-4). Default: 1"
    }
  },
  "required": ["prompt"]
}
```

## Usage Hints

- Requires imageGeneration config with provider and API key.
- Supported providers: openai (DALL-E 3), fal (Flux), together.
- Generated images are saved to ~/.zubo/uploads/generated/.
- If webchat is running, images are accessible via /uploads/generated/{filename}.
