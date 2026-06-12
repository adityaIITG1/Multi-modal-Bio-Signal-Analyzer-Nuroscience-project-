import { NextResponse } from 'next/server';
import { smartAIChat } from '@/lib/ai-router';

export async function POST(request: Request) {
  try {
    const { designType, finalSvg, generationMode } = await request.json();

    const prompt = `
You are a top-tier digital design valuation expert. Your task is to estimate a realistic market value (price) for a newly generated digital asset.

Asset Type: ${designType}
Generation Mode: ${generationMode} (PRO means it has advanced layers/effects)
SVG Code Length: ${finalSvg?.length || 0} characters

Rules:
1. Provide a realistic pricing estimate. For example, a basic YouTube Thumbnail might be "₹500 / $5", while a Pro 3D Logo might be "₹5,000 / $60".
2. You MUST return ONLY the price string in the format "₹XXXX / $YY". No other text. Do not explain.
`;

    const messages = [
      {
        role: 'system',
        content: 'You output ONLY the requested price string, e.g., ₹2,500 / $30.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    let price = await smartAIChat({
      messages,
      tier: 'fast',
      temperature: 0.2,
      maxTokens: 20
    });

    return NextResponse.json({ price: price?.trim() || "₹1,500 / $20" });

  } catch (error: any) {
    console.error('Groq Pricing API Error:', error);
    return NextResponse.json({ price: "₹1,500 / $20" });
  }
}
