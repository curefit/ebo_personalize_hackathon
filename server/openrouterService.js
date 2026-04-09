import { OPENROUTER_CONFIG, isOpenRouterConfigured } from "./openrouterConfig.js";

const MODEL_FALLBACKS = [
  OPENROUTER_CONFIG.MODEL,
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-2.5-flash-image",
];

function buildTryOnPrompt({ productName, color, size, material, fit }) {
  return [
    "Create a realistic virtual try-on edit of the person in the first image.",
    "Keep the person's face, body shape, pose, skin tone, and camera framing intact.",
    "Replace the person's current upper garment with the clothing from the reference image.",
    `Dress them in a ${color} ${productName}.`,
    `The T-shirt should look like a ${fit.toLowerCase()} fit in size ${size}.`,
    material ? `Material look: ${material}.` : "",
    "Use the second image as the garment style reference.",
    "Do not place a flat mockup, mannequin overlay, transparent shirt graphic, or sizing guide on top of the body.",
    "The final shirt must follow the person's shoulders, chest, sleeves, and torso naturally.",
    "The result should feel like a real fitting-room preview.",
    "Do not add extra accessories, props, text, brand posters, split screens, or additional people.",
    "Do not change the background unless needed for natural lighting consistency.",
    "Return one polished image only.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildRequestBody(model, payload) {
  return {
    model,
    modalities: ["image", "text"],
    stream: false,
    image_config: {
      aspect_ratio: "4:5",
      image_size: "1K",
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildTryOnPrompt(payload),
          },
          {
            type: "image_url",
            image_url: {
              url: payload.personImage,
            },
          },
          {
            type: "image_url",
            image_url: {
              url: payload.referenceImage,
            },
          },
        ],
      },
    ],
  };
}

function shouldTryNextModel(status, message) {
  const lowered = String(message || "").toLowerCase();
  return (
    status >= 500 ||
    lowered.includes("no endpoints found") ||
    lowered.includes("model not found") ||
    lowered.includes("provider returned error") ||
    lowered.includes("temporarily unavailable") ||
    lowered.includes("no provider") ||
    lowered.includes("capacity")
  );
}

export async function generateTryOnImage({ personImage, referenceImage, productName, color, size, material, fit }) {
  if (!isOpenRouterConfigured()) {
    throw new Error("OpenRouter API key is missing.");
  }

  const requestPayload = {
    personImage,
    referenceImage,
    productName,
    color,
    size,
    material,
    fit,
  };
  const candidateModels = [...new Set(MODEL_FALLBACKS.filter(Boolean))];
  const attemptErrors = [];

  for (const model of candidateModels) {
    const response = await fetch(`${OPENROUTER_CONFIG.BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_CONFIG.API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_CONFIG.APP_URL,
        "X-Title": OPENROUTER_CONFIG.APP_NAME,
      },
      body: JSON.stringify(buildRequestBody(model, requestPayload)),
    });

    const payload = await response.json().catch(() => ({}));
    const message = payload?.error?.message || payload?.message || "OpenRouter request failed.";

    if (!response.ok) {
      attemptErrors.push(`${model}: ${message}`);
      if (shouldTryNextModel(response.status, message)) {
        continue;
      }

      throw new Error(message);
    }

    const generatedImage =
      payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
      payload?.choices?.[0]?.message?.images?.[0]?.imageUrl?.url;

    if (generatedImage) {
      return {
        imageUrl: generatedImage,
        model: payload?.model || model,
      };
    }

    attemptErrors.push(`${model}: OpenRouter did not return an image.`);
  }

  throw new Error(attemptErrors.at(-1) || "OpenRouter did not return an image.");
}
