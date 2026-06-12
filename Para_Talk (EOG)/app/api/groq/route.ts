import { NextResponse } from 'next/server';
import { smartAIChat } from '@/lib/ai-router';

export async function POST(request: Request) {
  try {
    const { prompt, language = 'en-IN' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let languageInstruction = 'Keep your answers very simple, short, and to the point. Do not use formatting like bolding or bullet points, just plain text that can be easily spoken aloud.';
    
    if (language === 'hi-IN') {
      languageInstruction += ' YOU MUST REPLY IN HINDI (Devanagari script).';
    } else if (language === 'bn-IN') {
      languageInstruction += ' YOU MUST REPLY IN BENGALI.';
    } else if (language === 'mr-IN') {
      languageInstruction += ' YOU MUST REPLY IN MARATHI.';
    } else if (language === 'ta-IN') {
      languageInstruction += ' YOU MUST REPLY IN TAMIL.';
    }

    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant for a bedridden patient. ${languageInstruction}`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const reply = await smartAIChat({
      messages,
      tier: 'fast',
      temperature: 0.5,
      maxTokens: 150
    });

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Groq API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch from AI Router' }, { status: 500 });
  }
}
