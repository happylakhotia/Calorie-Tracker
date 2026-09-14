const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

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
      console.log(`🤖 [analyzeImage] Trying model: ${modelName}`);
      const model = getClient().getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Image } },
        prompt,
      ]);
      raw = result.response.text().trim();
      if (raw) {
        console.log(`✅ [analyzeImage] Success with model: ${modelName}`);
        break;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ [analyzeImage] Model ${modelName} failed:`, err.message);
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
      console.warn(`⚠️ [Gemini] Model ${modelName} failed in parsePdfEntries:`, err.message);
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
    console.warn('⚠️ [Gemini] Direct JSON parse failed, text was:', raw.slice(0, 300));
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
 * Run a single conversational turn with Gemini given the full chat history.
 *
 * @param {Array}  history   - Array of { role, content } objects
 * @param {string} userMsg   - Latest user message
 * @param {object} context   - { todayEntries, activeGoal } for grounding
 * @returns {string} Assistant response text
 */
const chatWithAI = async (history, userMsg, context = {}) => {
  // Fallback model list — verified available via ListModels (newest first)
  const CHAT_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ];

  const systemContext = `You are NutriBot, an intelligent, full-capability AI nutrition coach embedded in a personal calorie tracker app.

Today's date: ${new Date().toISOString().split('T')[0]}
User's active goal: ${context.activeGoal ? JSON.stringify(context.activeGoal) : 'Not set'}
Today's logged entries: ${context.todayEntries?.length ? JSON.stringify(context.todayEntries) : 'None logged yet'}

YOU HAVE DIRECT ACCESS TO PERFORM ACTIONS IN THE APP VIA ACTION BLOCKS:
1. LOGGING MEALS (CRITICAL):
   Whenever the user asks to log, add, or eat food (e.g. "add protein bar to snacks", "logged 2 boiled eggs for breakfast", "ate a bowl of oatmeal with peanut butter"), you MUST emit a machine-readable ACTION:LOG_ENTRY block on its OWN line at the very END of your message:
   ACTION:LOG_ENTRY:{"date":"YYYY-MM-DD","mealType":"breakfast|lunch|dinner|snacks","foodName":"...","quantity":1,"unit":"piece|g|serving|cup|bar|slice","calories":200,"protein":20,"carbs":25,"fat":5}

   CRITICAL RULES FOR mealType:
   - Must be EXACTLY ONE OF: "breakfast", "lunch", "dinner", "snacks" (always lowercase, always "snacks" with an 's'!).
   - If the user specifies "snack" or "snacks", use "snacks".
   - Estimate realistic calories, protein (g), carbs (g), and fat (g) if the user did not specify exact numbers.

2. SETTING OR UPDATING HEALTH GOALS:
   When the user asks to set or change their target calories or macros (e.g. "set my daily goal to 2200 kcal with 150g protein"):
   ACTION:SET_GOAL:{"dailyCalories":2200,"proteinG":150,"carbsG":200,"fatG":60}

3. DELETING MEALS:
   When the user asks to delete or remove an entry from today (e.g. "remove the protein bar", "delete lunch"):
   ACTION:DELETE_ENTRY:{"id":"entry_id_if_known","foodName":"Protein Bar","mealType":"snacks"}

FORMATTING GUIDELINES:
- Format your visible reply cleanly with emojis, bullet points, and bold text.
- NEVER show the ACTION: lines or raw JSON in your visible explanation. They are machine instructions that the server parses and strips out.
- In your visible reply, confirm naturally and warmly: what was logged, the estimated calories and macros, and how many calories remain today if the user has an active goal.
- Be encouraging, accurate, and concise.`;

  // Build chat history for Gemini
  const chatHistory = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  let raw = '';
  let lastErr = null;

  for (const modelName of CHAT_MODELS) {
    try {
      console.log(`🤖 [chatWithAI] Trying model: ${modelName}`);
      const model = getClient().getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemContext }] },
          { role: 'model', parts: [{ text: 'Understood! I am NutriBot and ready to assist you with meal logging, goals, and nutrition tracking.' }] },
          ...chatHistory,
        ],
      });
      const result = await chat.sendMessage(userMsg);
      raw = result.response.text();
      if (raw) {
        console.log(`✅ [chatWithAI] Success with model: ${modelName}`);
        break;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ [chatWithAI] Model ${modelName} failed:`, err.message);
    }
  }

  if (!raw && lastErr) throw lastErr;
  if (!raw) throw new Error('All Gemini models returned empty response for chat.');

  // Extract ACTION blocks BEFORE stripping them from the visible text
  const actions = [];
  // Matches ACTION:TYPE:{...} with flexible whitespace and multiline support
  const actionRegex = /ACTION:\s*([A-Z_]+)\s*:\s*(\{[\s\S]*?\})/g;
  let match;
  while ((match = actionRegex.exec(raw)) !== null) {
    try {
      const parsed = JSON.parse(match[2]);
      actions.push({ type: match[1].trim(), payload: parsed });
    } catch (_) { /* ignore malformed action */ }
  }

  // Strip ACTION lines so the user never sees them
  const response = raw
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('ACTION:') && !trimmed.startsWith('```ACTION:');
    })
    .join('\n')
    .trim();

  return { response, actions };
};

module.exports = { analyzeImage, parsePdfEntries, chatWithAI };
