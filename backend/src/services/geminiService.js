const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const { TOOL_DECLARATIONS } = require('../tools/mealTools');

let genAI;

/**
 * Lazily initialise the Gemini client so startup doesn't fail
 * if the API key is not yet set.
 */
const getClient = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured. Please set it in backend/.env');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

/**
 * Analyse a food image (nutrition label OR plate of food) and return
 * structured nutrition data ready to pre-fill the entry form.
 *
 * @param {string} imagePath - Absolute path to the uploaded image file
 * @param {string} mimeType  - e.g. 'image/jpeg'
 * @returns {object} nutrition data
 */
const analyzeImage = async (imageInput, mimeType = 'image/jpeg') => {
  // Fallback model list — verified available via ListModels (newest first)
  const IMAGE_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ];

  let base64Image;
  if (Buffer.isBuffer(imageInput)) {
    base64Image = imageInput.toString('base64');
  } else if (typeof imageInput === 'string') {
    const imageData = fs.readFileSync(imageInput);
    base64Image = imageData.toString('base64');
  } else {
    throw new Error('Invalid image input: expected Buffer or file path string');
  }

  const prompt = `You are a nutrition expert. Analyse this image which is either a food product nutrition label or a plate/photo of food.

Extract nutritional information and return ONLY valid JSON (no markdown, no explanation) in exactly this format:
{
  "foodName": "string (name of the food item or dish)",
  "quantity": number (serving size quantity),
  "unit": "string (g, ml, cup, piece, serving, etc.)",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "fiber": number (grams),
  "sugar": number (grams),
  "sodium": number (mg),
  "potassium": number (mg),
  "vitaminC": number (mg),
  "vitaminD": number (IU),
  "calcium": number (mg),
  "iron": number (mg),
  "confidence": "high|medium|low",
  "notes": "any important observations about the image"
}

If a value cannot be determined, use 0. Be as accurate as possible.`;

  let raw = '';
  let lastErr = null;

  for (const modelName of IMAGE_MODELS) {
    try {
      console.log(`[analyzeImage] Trying model: ${modelName}`);
      const model = getClient().getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Image } },
        prompt,
      ]);
      raw = result.response.text().trim();
      if (raw) {
        console.log(`[analyzeImage] Success with model: ${modelName}`);
        break;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[analyzeImage] Model ${modelName} failed:`, err.message);
    }
  }

  if (!raw && lastErr) throw lastErr;
  if (!raw) throw new Error('All Gemini models returned empty response for image analysis.');

  // Extract JSON — handle markdown code fences and conversational wrapping
  let jsonString = raw;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonString = jsonMatch[0];
  } else {
    jsonString = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }

  const parsed = JSON.parse(jsonString);

  // Ensure all numeric fields are proper numbers
  const numericFields = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'potassium', 'vitaminC', 'vitaminD', 'calcium', 'iron'];
  numericFields.forEach((f) => {
    parsed[f] = parseFloat(parsed[f]) || 0;
  });

  return parsed;
};

/**
 * Process raw text extracted from a PDF and use Gemini to parse
 * food diary entries into structured data.
 *
 * @param {string} text - Raw text from pdf-parse
 * @returns {Array} Array of food entry objects
 */
const parsePdfEntries = async (text) => {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `You are a nutrition data parser. The following text was extracted from a food diary or nutrition history PDF.

Parse ALL food entries you can find and return ONLY a valid JSON array (no markdown code blocks, no explanation) with each entry in this format:
[
  {
    "date": "YYYY-MM-DD",
    "mealType": "breakfast|lunch|dinner|snacks",
    "foodName": "string",
    "quantity": number,
    "unit": "string",
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "fiber": number,
    "sugar": number,
    "sodium": number,
    "potassium": number,
    "vitaminC": number,
    "vitaminD": number,
    "calcium": number,
    "iron": number
  }
]

Rules:
- Use 0 for missing numeric values.
- If a date is missing, use today's date (${today}).
- If meal type is not clear, default to "breakfast".
- Return an empty array [] if no entries are found.

PDF text:
${text.substring(0, 12000)}`;

  const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
  let raw = '';
  let lastErr = null;

  for (const modelName of models) {
    try {
      const model = getClient().getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      raw = result.response.text().trim();
      if (raw) break;
    } catch (err) {
      lastErr = err;
      console.warn(`[Gemini] Model ${modelName} failed in parsePdfEntries:`, err.message);
    }
  }

  if (!raw && lastErr) throw lastErr;

  // Extract JSON array from text even if model wraps in code fences or conversational text
  let jsonString = raw;
  const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (match) {
    jsonString = match[0];
  } else {
    jsonString = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }

  let entries = [];
  try {
    entries = JSON.parse(jsonString);
  } catch (e) {
    console.warn(' [Gemini] Direct JSON parse failed, text was:', raw.slice(0, 300));
    if (raw.includes('[]')) return [];
    throw new Error('AI could not extract structured nutrition entries from this document.');
  }

  if (!Array.isArray(entries)) {
    if (entries && typeof entries === 'object' && Array.isArray(entries.entries)) {
      entries = entries.entries;
    } else if (entries && typeof entries === 'object' && Array.isArray(entries.data)) {
      entries = entries.data;
    } else if (entries && typeof entries === 'object') {
      entries = [entries];
    } else {
      entries = [];
    }
  }

  return entries;
};

/**
 * Run a single conversational turn with Gemini using the Function Calling API.
 *
 * Gemini emits structured function calls (not free-text ACTION blocks).
 * The controller dispatches each call through mealTools.js — Gemini never
 * touches the database directly.
 *
 * @param {Array}  history    - Array of { role, content } objects
 * @param {string} userMsg    - Latest user message
 * @param {object} context    - { goalSummary } — minimal context only (NO raw DB entries)
 * @returns {{ response: string, toolCalls: Array }} Clean text + structured tool calls
 */
const chatWithAI = async (history, userMsg, context = {}) => {
  const CHAT_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ];

  // System prompt: no raw DB data is injected here
  const systemInstruction = `You are NutriBot, an intelligent AI nutrition coach in a personal calorie tracker app.

Today's date: ${new Date().toISOString().split('T')[0]}
User's active goal: ${context.goalSummary || 'Not set'}

You have access to four tools:
- logMeal: call when the user wants to log food they ate
- setGoal: call when the user wants to set/update their daily calorie or macro goal
- deleteMeal: call when the user wants to delete/remove a logged meal
- queryEntries: call when the user asks what they have eaten, calorie count, remaining calories, or any summary of their food log

IMPORTANT:
- Always call queryEntries first if you need to know what the user has logged before answering.
- After a tool call you will receive the result; use it to give a warm, helpful, human-readable reply.
- Never invent or assume database values — always use tool results.
- Format replies with emojis, bullet points, and bold text. Be concise and encouraging.`;

  // Build Gemini-format chat history
  const chatHistory = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Convert TOOL_DECLARATIONS to Gemini SDK format
  const tools = [{ functionDeclarations: TOOL_DECLARATIONS }];

  let lastErr = null;

  for (const modelName of CHAT_MODELS) {
    try {
      console.log(` [chatWithAI] Trying model: ${modelName}`);
      const model = getClient().getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools,
      });

      const chat = model.startChat({ history: chatHistory });
      const result = await chat.sendMessage(userMsg);
      const response = result.response;

      // Extract function calls (structured tool calls from Gemini)
      const toolCalls = [];
      const candidates = response.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.functionCall) {
            toolCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            });
          }
        }
      }

      // Extract visible text response
      let responseText = '';
      try { responseText = response.text(); } catch (_) {}

      console.log(`[chatWithAI] Success with model: ${modelName} | toolCalls: ${toolCalls.length}`);
      return { response: responseText.trim(), toolCalls };
    } catch (err) {
      lastErr = err;
      console.warn(`[chatWithAI] Model ${modelName} failed:`, err.message);
    }
  }

  if (lastErr) throw lastErr;
  throw new Error('All Gemini models returned empty response for chat.');
};

/**
 * Send tool results back to Gemini so it can generate the final user-facing reply.
 *
 * @param {Array}  history      - Chat history (Gemini format)
 * @param {string} userMsg      - Original user message
 * @param {Array}  toolResults  - Array of { name, result } tool results
 * @param {object} context      - { goalSummary }
 * @returns {string} Final assistant reply text
 */
const sendToolResults = async (history, userMsg, toolResults, context = {}) => {
  const CHAT_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ];

  const systemInstruction = `You are NutriBot, an intelligent AI nutrition coach in a personal calorie tracker app.

Today's date: ${new Date().toISOString().split('T')[0]}
User's active goal: ${context.goalSummary || 'Not set'}

You have just received tool results. Use them to write a warm, helpful, human-readable reply.
Format replies with emojis, bullet points, and bold text. Be concise and encouraging.`;

  const chatHistory = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const tools = [{ functionDeclarations: TOOL_DECLARATIONS }];

  let lastErr = null;

  for (const modelName of CHAT_MODELS) {
    try {
      const model = getClient().getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools,
      });

      const chat = model.startChat({ history: chatHistory });

      // First send the original user message to get the function call turn
      await chat.sendMessage(userMsg);

      // Then send tool results as functionResponse parts
      const functionResponseParts = toolResults.map(({ name, result }) => ({
        functionResponse: { name, response: result },
      }));

      const finalResult = await chat.sendMessage(functionResponseParts);
      const finalText = finalResult.response.text();

      if (finalText) {
        console.log(`[sendToolResults] Final reply generated with model: ${modelName}`);
        return finalText.trim();
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[sendToolResults] Model ${modelName} failed:`, err.message);
    }
  }

  if (lastErr) throw lastErr;
  throw new Error('All Gemini models failed to generate final reply after tool results.');
};

module.exports = { analyzeImage, parsePdfEntries, chatWithAI, sendToolResults };
