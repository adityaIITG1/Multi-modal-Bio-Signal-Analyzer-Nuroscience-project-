import { NextResponse } from 'next/server';
import { smartAIChat } from '@/lib/ai-router';

export async function POST(request: Request) {
  try {
    const { siteType, frontend, backend, database, theme, customPrompt } = await request.json();

    const prompt = `You are a master Full-Stack Web Developer and a world-class UI/UX Designer.
Generate a breathtaking, production-ready website based on this stack:
- Site Type: ${siteType}
- Frontend: ${frontend}
- Backend: ${backend}
- Database: ${database}
- Theme/Style: ${theme}
- Custom Requirements: "${customPrompt}"

CRITICAL DESIGN INSTRUCTIONS:
1. DO NOT CREATE A BASIC PLACEHOLDER. The user wants a "REAL" landing page. It must be stunning, dynamic, and fully fleshed out with actual content (not just "Hello World" or "Mock API Call").
2. Include multiple sections: A stunning Hero Section (with gradients, glassmorphism, or beautiful background), Features Grid, Testimonials/Social Proof, Pricing/Services, and a beautiful Footer.
3. Use Tailwind CSS heavily for advanced styling (shadows, gradients, hover effects, flex/grid layouts, padding, transitions).
4. Include Google Fonts (e.g., 'Inter' or 'Plus Jakarta Sans') and FontAwesome for icons via CDN in the <head>.
5. Use high-quality Unsplash image URLs (e.g., https://source.unsplash.com/random/800x600/?tech,business) for any images.
6. NEVER output simple list items like "ID: 1, Name: John Doe". Always design beautiful cards or tables for data.

Since this is for a "Live Preview Sandbox", you MUST generate a SINGLE comprehensive HTML file containing:
- Valid HTML5 structure.
- Tailwind CSS included via <script src="https://cdn.tailwindcss.com"></script>.
- Tailwind config script to define custom colors based on the requested theme.
- All JavaScript logic inside <script> tags to make it fully interactive (mocking any backend API calls dynamically).

Output ONLY valid JSON containing three fields:
  - "html": A string containing the entire complete, massive HTML/CSS/JS file.
  - "serverCode": A string containing backend code (if applicable).
  - "databaseCode": A string containing database schema (if applicable).
Do not output markdown code blocks outside of the JSON. Just raw JSON.`;

    const messages = [
      {
        role: 'system',
        content: 'You are an elite web designer and engineer. You NEVER write basic stub code. You only write complete, production-ready, breathtaking code. You ONLY output valid raw JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    let resultString = await smartAIChat({
      messages,
      tier: 'smart',
      temperature: 0.5,
      maxTokens: 8000,
      isJson: true
    });

    resultString = resultString || "{}";
    
    // Strip markdown formatting if present
    if (resultString.startsWith('```json')) resultString = resultString.replace(/^```json/, '');
    else if (resultString.startsWith('```')) resultString = resultString.replace(/^```/, '');
    if (resultString.endsWith('```')) resultString = resultString.replace(/```$/, '');
    resultString = resultString.trim();

    const resultJson = JSON.parse(resultString);

    return NextResponse.json({ 
      html: resultJson.html || "<h1>Error generating HTML</h1>",
      serverCode: resultJson.serverCode || "",
      databaseCode: resultJson.databaseCode || ""
    });

  } catch (error: any) {
    console.error('Groq Web API Error:', error.message || error);
    return NextResponse.json({ error: error.message || "Failed to generate website" }, { status: 500 });
  }
}
