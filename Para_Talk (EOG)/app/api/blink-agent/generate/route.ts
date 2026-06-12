import { NextResponse } from 'next/server';
import * as archiver from 'archiver';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { industry, problem, type, workflows, tools } = data;

    // Generate Robust System Prompt
    const systemPrompt = `You are a highly advanced, specialized AI Agent acting as a ${type || 'Business Assistant'}.
You serve the ${industry || 'General Business'} industry.
The primary problem you are solving is: ${problem || 'Optimizing workflows'}.

YOUR CORE WORKFLOW:
${workflows && workflows.length > 0 ? workflows.map((w: string, i: number) => `${i + 1}. ${w}`).join('\n') : '1. Assist the user gracefully.'}

YOUR AVAILABLE TOOLS & INTEGRATIONS:
${tools && tools.length > 0 ? tools.join(', ') : 'Basic chat capabilities'}

CRITICAL INSTRUCTIONS:
- You must always maintain a professional and empathetic tone.
- Do not provide medical, legal, or financial advice unless explicitly stated in your training; always include a disclaimer.
- Always aim to capture user intent and push them towards the next logical step in your workflow.
- Never hallucinate integrations or capabilities you do not possess.
- If the user asks for human handover, gracefully escalate the conversation.`;

    const workflowJson = JSON.stringify({
      agentName: `${type?.replace(/\s+/g, '') || 'SmartAgent'}`,
      industry,
      problem,
      type,
      workflows: workflows || [],
      tools: tools || [],
      version: "1.0.0"
    }, null, 2);

    const serverJs = `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Load Prompt
const fs = require('fs');
const systemPrompt = fs.readFileSync('agent_prompt.txt', 'utf8');

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    // INTEGRATE GROQ OR OPENAI HERE USING process.env.API_KEY
    res.json({ reply: "This is a placeholder response from your new " + "${type}" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(\`Agent Server running on port \${PORT}\`));
`;

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${type || 'AI Agent'}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="chat-widget">
        <div class="header">${type || 'AI Assistant'}</div>
        <div id="messages"></div>
        <div class="input-area">
            <input type="text" id="userInput" placeholder="Type your message...">
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>`;

    const styleCss = `body { font-family: system-ui; background: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
#chat-widget { width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden; }
.header { background: #00bcd4; color: white; padding: 15px; font-weight: bold; text-align: center; }
#messages { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.input-area { display: flex; padding: 10px; border-top: 1px solid #eee; }
input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; outline: none; }
button { background: #00bcd4; color: white; border: none; padding: 10px 15px; margin-left: 10px; border-radius: 6px; cursor: pointer; }`;

    const scriptJs = `async function sendMessage() {
    const input = document.getElementById('userInput');
    const msgs = document.getElementById('messages');
    if(!input.value.trim()) return;
    
    msgs.innerHTML += \`<div style="align-self: flex-end; background: #e3f2fd; padding: 8px 12px; border-radius: 12px;">\${input.value}</div>\`;
    const userMessage = input.value;
    input.value = '';
    
    try {
        const res = await fetch('http://localhost:4000/api/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: userMessage })
        });
        const data = await res.json();
        msgs.innerHTML += \`<div style="align-self: flex-start; background: #f1f1f1; padding: 8px 12px; border-radius: 12px;">\${data.reply}</div>\`;
        msgs.scrollTop = msgs.scrollHeight;
    } catch(e) {
        console.error(e);
    }
}`;

    // Calculate Pricing
    let baseInr = 15000;
    let baseUsd = 300;
    if (workflows && workflows.length > 5) { baseInr += 20000; baseUsd += 400; }
    if (tools && tools.includes("WhatsApp Business")) { baseInr += 25000; baseUsd += 500; }
    if (tools && tools.includes("Website chatbot")) { baseInr += 10000; baseUsd += 200; }

    const pricingTxt = `ESTIMATED SELLING PRICE FOR: ${type || 'Custom Agent'}
Industry: ${industry || 'General'}

India Pricing: ₹${baseInr.toLocaleString()} - ₹${(baseInr * 2).toLocaleString()}
International Pricing: $${baseUsd} - $${baseUsd * 2}

Monthly Maintenance Suggested: ₹5,000 / $100

Features Included:
${workflows?.join('\n') || ''}
${tools?.join('\n') || ''}`;

    const clientProposal = `CLIENT PROPOSAL
=================
Problem Statement: ${problem}
Solution: An AI-powered ${type} specifically designed for the ${industry} industry.

Key Workflows:
${workflows?.map((w: string) => '- ' + w).join('\n')}

Integrations:
${tools?.join(', ')}

Investment:
Estimated Setup: ₹${baseInr.toLocaleString()} / $${baseUsd}
`;

    const packageJson = `{
  "name": "blink-agent-${type?.toLowerCase().replace(/\\s+/g, '-') || 'project'}",
  "version": "1.0.0",
  "description": "An AI-powered agent specifically designed for the ${industry || 'general'} industry.",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  }
}`;

    const readmeMd = `# ${type || 'AI Agent'}

An AI-powered assistant designed specifically for the ${industry || 'General'} industry.

## Quick Start

1. Rename \`.env.example\` to \`.env\` and add your AI API keys.
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Start the server:
   \`\`\`bash
   npm start
   \`\`\`
4. Open your browser and navigate to \`http://localhost:4000\` to use the agent's chat interface.

## Features Included
${workflows?.map((w: string) => '- ' + w).join('\\n') || '- Default Agent Capabilities'}

## Supported Integrations
${tools?.join(', ') || 'None'}
`;

    // CREATE ZIP ARCHIVE
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    const chunks: any[] = [];
    
    archive.on('data', (chunk) => chunks.push(chunk));
    
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err) => reject(err));

      archive.append(systemPrompt, { name: 'agent_prompt.txt' });
      archive.append(workflowJson, { name: 'workflow.json' });
      archive.append(serverJs, { name: 'server.js' });
      archive.append(indexHtml, { name: 'public/index.html' });
      archive.append(styleCss, { name: 'public/style.css' });
      archive.append(scriptJs, { name: 'public/script.js' });
      archive.append('GROQ_API_KEY=your_key_here\nOPENAI_API_KEY=your_key_here\nPORT=4000', { name: '.env.example' });
      archive.append(pricingTxt, { name: 'pricing.txt' });
      archive.append(clientProposal, { name: 'client_proposal.txt' });
      archive.append(packageJson, { name: 'package.json' });
      archive.append(readmeMd, { name: 'README.md' });
      
      archive.finalize();
    });

    const safeType = type ? type.replace(/\s+/g, '_') : 'Project';
    
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="BlinkAgent_${safeType}.zip"`,
      },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate agent project' }, { status: 500 });
  }
}
