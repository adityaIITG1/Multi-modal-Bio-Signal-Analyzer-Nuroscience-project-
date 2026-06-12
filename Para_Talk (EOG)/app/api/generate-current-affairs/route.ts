import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
  try {
    const { language = 'en-IN' } = await request.json();

    let languageInstruction = '';
    if (language === 'hi-IN') {
      languageInstruction = 'Generate all questions and text in HINDI (Devanagari script).';
    } else if (language === 'bn-IN') {
      languageInstruction = 'Generate all questions and text in BENGALI.';
    } else if (language === 'mr-IN') {
      languageInstruction = 'Generate all questions and text in MARATHI.';
    } else if (language === 'ta-IN') {
      languageInstruction = 'Generate all questions and text in TAMIL.';
    } else {
      languageInstruction = 'Generate all questions and text in ENGLISH.';
    }

    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `You are a professional quizmaster generating a Current Affairs Quiz.
Today's date is ${currentDate}.
Generate EXACTLY 10 multiple-choice questions about the ABSOLUTE LATEST global current affairs from the past few weeks leading up to ${currentDate} (breaking news, politics, science, tech, sports, world events). Do NOT provide old questions from previous years.

Rules:
- 10 distinct, factual questions.
- Each question must have exactly 4 short options.
- The 'answer' field must exactly match one of the 4 options.
- Provide a brief 'explanation' (1 sentence) for the correct answer.
- ${languageInstruction}

Return JSON only in this exact format:
{
  "questions": [
    {
      "question": "Which country recently...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option B",
      "explanation": "Option B is correct because..."
    }
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
          temperature: 0.7,
          response_format: { type: 'json_object' },
        });
        break;
      } catch (e: any) {
        lastError = e;
        if (e?.error?.code === 'model_decommissioned' || e?.status === 404 || e?.status === 400) {
          console.log(`Model ${modelName} failed. Trying next...`);
          continue;
        }
        throw e;
      }
    }

    if (!chatCompletion) {
      throw lastError || new Error("All Groq models failed.");
    }

    const replyContent = chatCompletion.choices[0]?.message?.content;
    if (!replyContent) throw new Error("No content generated");

    let cleanContent = replyContent.trim();
    if (cleanContent.startsWith('\`\`\`json')) {
      cleanContent = cleanContent.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    }

    const parsedData = JSON.parse(cleanContent);
    
    if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
      throw new Error("Invalid output format from Groq");
    }

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('Error generating current affairs:', error);
    
    // Gemini Fallback
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const { language = 'en-IN' } = await request.json().catch(() => ({}));
      const prompt = `Today's date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Generate 10 multiple-choice questions about the ABSOLUTE LATEST global current affairs from the past few weeks in JSON format. Do not provide old questions. Format: {"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "B", "explanation": "..."}]}. Language code: ${language}`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      let cleanContent = text.trim();
      if (cleanContent.startsWith('\`\`\`json')) {
        cleanContent = cleanContent.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
      }
      
      return NextResponse.json(JSON.parse(cleanContent));
    } catch (fallbackError) {
      console.error('Gemini fallback failed:', fallbackError);
      
      // Hardcoded fallback data just in case both APIs fail
      const fallback = {
        questions: [
          {
            question: "What is the capital of France?",
            options: ["London", "Berlin", "Paris", "Madrid"],
            answer: "Paris",
            explanation: "Paris is the capital and most populous city of France."
          },
          {
            question: "Which planet is known as the Red Planet?",
            options: ["Venus", "Mars", "Jupiter", "Saturn"],
            answer: "Mars",
            explanation: "Mars is often called the Red Planet due to iron oxide on its surface."
          }
        ]
      };
      return NextResponse.json(fallback);
    }
  }
}
