import { NextResponse } from 'next/server';
const archiver = require('archiver');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { siteType, frontend, backend, database, theme, customPrompt, generatedCode } = body;

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Create a stream to capture the zipped data
    const chunks: any[] = [];
    archive.on('data', (chunk: any) => chunks.push(chunk));

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: any) => reject(err));
    });

    // 1. Write the Frontend HTML
    if (generatedCode.html) {
      archive.append(generatedCode.html, { name: 'index.html' });
    }

    // 2. Write the Backend Server Code
    if (generatedCode.serverCode) {
      const ext = backend.includes('Python') ? 'py' : 'js';
      archive.append(generatedCode.serverCode, { name: `server.${ext}` });
    }

    // 3. Write the Database Code
    if (generatedCode.databaseCode) {
      const ext = database.includes('PostgreSQL') ? 'sql' : 'js';
      archive.append(generatedCode.databaseCode, { name: `database_schema.${ext}` });
    }

    // 4. Write a README
    const readme = `
BlinkWeb Studio - AI Generated Full Stack Project
=================================================
Site Type: ${siteType}
Frontend: ${frontend}
Backend: ${backend}
Database: ${database}
Theme: ${theme}
Prompt: ${customPrompt}

To run the frontend:
Simply open index.html in any web browser.

To run the backend (if applicable):
Review the server files provided. You may need to run \`npm install\` or \`pip install\` depending on the stack chosen.
`;
    archive.append(readme, { name: 'README.txt' });

    archive.finalize();
    const buffer = await archivePromise;

    return new Response(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="BlinkWeb_Project.zip"'
      }
    });

  } catch (error) {
    console.error('Web Export API Error:', error);
    return NextResponse.json({ error: "Failed to generate package" }, { status: 500 });
  }
}
