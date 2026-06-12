import { NextResponse } from 'next/server';
import { smartAIChat } from '@/lib/ai-router';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert AI software developer acting as the "BlinkIDE".
Your goal is to generate high-quality code and explanations based on the user's prompt.
If the prompt asks to create or modify code, provide the code within a single markdown code block (e.g. \`\`\`python ... \`\`\`).
Keep any explanations or setup instructions outside the code block, concise and clear.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const reply = await smartAIChat({
      messages,
      tier: 'smart',
      temperature: 0.2,
      maxTokens: 3000
    });

    return NextResponse.json({ reply: reply || "Sorry, I could not generate the code." });
  } catch (error: any) {
    console.error('Groq Code API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch from Groq API' }, { status: 500 });
  }
}
