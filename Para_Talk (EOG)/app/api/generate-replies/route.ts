import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
  try {
    const { topic, userSide, opponentText, language = 'en-IN' } = await request.json();

    if (!topic || !userSide || !opponentText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let languageInstruction = '';
    if (language === 'hi-IN') {
      languageInstruction = 'Generate all reply texts in HINDI (Devanagari script).';
    } else if (language === 'bn-IN') {
      languageInstruction = 'Generate all reply texts in BENGALI.';
    } else if (language === 'mr-IN') {
      languageInstruction = 'Generate all reply texts in MARATHI.';
    } else if (language === 'ta-IN') {
      languageInstruction = 'Generate all reply texts in TAMIL.';
    } else {
      languageInstruction = 'Generate all reply texts in ENGLISH.';
    }

    const systemPrompt = `You are a debate coach helping a disabled user debate using one blink.

Topic: ${topic}
User side: ${userSide}
Opponent said: ${opponentText}

Generate exactly 4 short spoken debate replies.

Rules:
- Reply 1: strong logical rebuttal
- Reply 2: example-based reply
- Reply 3: emotional/human-impact reply
- Reply 4: balanced diplomatic reply
- Each reply must be 2-3 sentences maximum
- Must be suitable for text-to-speech
- Must be respectful
- Must directly answer opponent's point
- No hate, no abuse, no personal attack
- ${languageInstruction}

Return JSON only in this exact format:
{
  "replies": [
    {"type": "Logical Rebuttal", "text": "..."},
    {"type": "Example-Based Reply", "text": "..."},
    {"type": "Emotional Reply", "text": "..."},
    {"type": "Balanced Reply", "text": "..."}
  ]
}
`;

    const groqModels = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192'];
    let chatCompletion;
    let lastError;

    for (const modelName of groqModels) {
      try {
        chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: systemPrompt
            }
          ],
          model: modelName,
          temperature: 0.5,
          response_format: { type: 'json_object' },
        });
        // If it succeeds, break out of the loop
        break;
      } catch (e: any) {
        lastError = e;
        // If the error is related to model decommissioning or not found, continue to next model
        if (e?.error?.code === 'model_decommissioned' || e?.status === 404 || e?.status === 400) {
          console.log(`Model ${modelName} failed or decommissioned. Trying next...`);
          continue;
        }
        // If it's a different error (like rate limit), throw it to trigger Gemini fallback
        throw e;
      }
    }

    if (!chatCompletion) {
      throw lastError || new Error("All Groq models failed.");
    }

    const replyContent = chatCompletion.choices[0]?.message?.content;
    if (!replyContent) throw new Error("No content generated");

    // Strip markdown code blocks if the model wrapped the JSON
    let cleanContent = replyContent.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(cleanContent);
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Groq API Error in generate-replies:', error);
    
    try {
      // Automatic Fallback to Google Gemini
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        console.log('Falling back to Google Gemini...');
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        const geminiData = await geminiRes.json();
        const text = geminiData.candidates[0].content.parts[0].text;
        
        let cleanContent = text.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```/, '').replace(/```$/, '').trim();
        }

        return NextResponse.json(JSON.parse(cleanContent));
      }
    } catch (fallbackError) {
      console.error('Gemini Fallback Error:', fallbackError);
    }
    
    // Final hardcoded fallback if all AI fails
    const fallback = {
      replies: [
        { type: "Logical Rebuttal", text: "I disagree. The logic is flawed and we need to look at the facts." },
        { type: "Example-Based Reply", text: "For instance, studies have shown that this approach is highly effective in practice." },
        { type: "Emotional Reply", text: "We must consider the human impact and how this affects real people's lives." },
        { type: "Balanced Reply", text: "While you make a fair point, there are two sides to this issue that we must balance." }
      ]
    };
    return NextResponse.json(fallback);
  }
}
