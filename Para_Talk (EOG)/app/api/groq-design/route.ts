import { NextResponse } from 'next/server';
import { smartAIChat } from '@/lib/ai-router';

export async function POST(request: Request) {
  try {
    const { designType, industry, designStyle, colorTheme, customText, font, effect, texture, generationMode } = await request.json();

    const getDimensions = () => {
      switch(designType) {
        case "Logo": return { w: 500, h: 500 };
        case "Business Card": return { w: 1050, h: 600 };
        case "A4 Pamphlet": 
        case "Brochure": return { w: 800, h: 1131 };
        case "Social Media Post": return { w: 1080, h: 1080 };
        case "YouTube Thumbnail":
        default: return { w: 1280, h: 720 };
      }
    };
    const { w, h } = getDimensions();

    const prompt = `
You are an expert SVG UI/UX designer. Generate a stunning, scalable vector graphic (SVG).
Type: ${designType}
Industry: ${industry}
Style: ${designStyle}
Color Theme: ${colorTheme}
Main Title: ${customText || designType}
${generationMode === 'PRO' ? `
ADVANCED PROPERTIES:
Font Choice: ${font}
Special Effect: ${effect}
Background Texture: ${texture}
` : ''}

Requirements:
1. The canvas MUST be exactly width="${w}" and height="${h}".
2. Use \`<defs>\` to create stunning gradients and, if required, filters (for shadows/glows/3D) and patterns (for textures).
3. Typography: If the Main Title is long, you MUST break it into multiple <text> tags or use <tspan>. Apply the requested Font Choice.
4. If "Special Effect" requires it, add SVG drop-shadows, glowing filters, or duplicate 3D layers.
5. Provide ONLY the valid raw <svg>...</svg> code string. No markdown backticks, no text.
`;

    const messages = [
      {
        role: 'system',
        content: 'You output ONLY raw SVG code. No markdown. No text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    let svgCode = await smartAIChat({
      messages,
      tier: 'smart',
      temperature: 0.7,
      maxTokens: 1500
    });
    
    // Clean up any accidental markdown backticks just in case
    svgCode = svgCode.replace(/```svg/g, "").replace(/```xml/g, "").replace(/```/g, "").trim();

    return new NextResponse(svgCode || "", {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' }
    });

  } catch (error: any) {
    console.error('Groq Design API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch from Groq API' }, { status: 500 });
  }
}
