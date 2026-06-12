import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

import google from 'googlethis';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { url, businessType, checkType } = await req.json();

    let searchContext = "No search results available.";
    try {
      const searchRes = await google.search(url + " " + businessType, {
        page: 0, 
        safe: false, 
        parse_ads: false, 
        additional_params: { hl: 'en' }
      });
      if (searchRes.results && searchRes.results.length > 0) {
        searchContext = searchRes.results.slice(0, 4).map((r: any) => `- Title: ${r.title}\n  Snippet: ${r.description}\n  URL: ${r.url}`).join("\n\n");
      }
    } catch (err) {
      console.log("Google search failed:", err);
    }

    const prompt = `You are a Senior Ethical Cybersecurity Analyst. 
The user wants a non-invasive cybersecurity hygiene check for the following target:
Business Type: ${businessType}
Check Type: ${checkType}
Target URL/Identifier: ${url}

Here are the live internet search results for this target:
${searchContext}

Act as if you have scanned this target using the provided search results and your general knowledge.
Evaluate the safety based on standard cybersecurity practices (HTTPS, 2FA, Captcha, Privacy Policies, etc.).

Return a JSON object matching this exact structure:
{
  "overallScore": number (0-100),
  "websiteScore": number (0-100),
  "emailScore": number (0-100),
  "privacyScore": number (0-100),
  "passwordScore": number (0-100),
  "whatsappScore": number (0-100),
  "safePoints": string[] (Array of positive security findings, e.g. "HTTPS is active"),
  "unsafePoints": string[] (Array of negative findings, e.g. "Privacy policy missing"),
  "whatToAdd": string[] (Array of recommendations, e.g. "Add Google reCAPTCHA"),
  "priorityFixes": {
    "high": string[],
    "medium": string[],
    "low": string[]
  },
  "businessImpact": string (Explain the business risk of these vulnerabilities),
  "clientVerdict": string (Client-friendly explanation paragraph),
  "salesMessage": string (A WhatsApp sales message offering your cyber hygiene report services),
  "clientProposal": string (A short proposal letter offering your services to fix these issues)
}

Do NOT include any markdown formatting, only pure JSON.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a professional ethical cybersecurity auditor. Output only raw JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    let aiResponse = chatCompletion.choices[0]?.message?.content?.trim() || "{}";
    
    // Strip markdown formatting if present
    if (aiResponse.startsWith('```json')) aiResponse = aiResponse.replace(/^```json/, '');
    else if (aiResponse.startsWith('```')) aiResponse = aiResponse.replace(/^```/, '');
    if (aiResponse.endsWith('```')) aiResponse = aiResponse.replace(/```$/, '');
    aiResponse = aiResponse.trim();

    const data = JSON.parse(aiResponse);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Cyber Analyze Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
