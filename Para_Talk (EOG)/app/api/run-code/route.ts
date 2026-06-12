import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(request: Request) {
  try {
    const { code, type = "Python App" } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (!type.includes("Python") && !type.includes("Data Science") && !type.includes("AI Chatbot")) {
      return NextResponse.json({ 
        output: "Backend execution is currently only supported for Python projects. For Web apps, it should open in your browser." 
      });
    }

    // Ensure temp directory exists
    const tempDir = path.join(process.cwd(), '.temp_runs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Write to a temporary file
    const filename = `script_${Date.now()}.py`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, code);

    // Run the python script
    // Using a timeout of 10 seconds to prevent infinite loops
    try {
      const { stdout, stderr } = await execPromise(`python "${filepath}"`, { timeout: 10000 });
      
      // Clean up temp file
      try { fs.unlinkSync(filepath); } catch(e) {}
      
      return NextResponse.json({ 
        output: stdout || (stderr ? `Error Output:\n${stderr}` : "Script executed successfully with no output.")
      });
    } catch (execError: any) {
      // Clean up temp file
      try { fs.unlinkSync(filepath); } catch(e) {}
      
      let errorMsg = execError.stderr || execError.message || "Unknown execution error";
      if (execError.killed) {
        errorMsg = "Execution timed out after 10 seconds. Possible infinite loop.";
      }
      return NextResponse.json({ output: `Error Output:\n${errorMsg}` });
    }

  } catch (error: any) {
    console.error('Run Code API Error:', error);
    return NextResponse.json({ error: 'Failed to run code' }, { status: 500 });
  }
}
