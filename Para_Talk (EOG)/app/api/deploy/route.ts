import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

export async function POST(request: Request) {
  try {
    const { code, type = "Website" } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (!type.includes("Website") && !type.includes("UI") && !type.includes("Dashboard") && !type.includes("Extension")) {
      return NextResponse.json({ 
        error: "Deployment is currently only supported for Web apps (HTML/JS/CSS)." 
      }, { status: 400 });
    }

    // Ensure public/deployments directory exists
    const deployDir = path.join(process.cwd(), 'public', 'deployments');
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir, { recursive: true });
    }

    // Write to a deployment file
    const filename = `app_${Date.now()}.html`;
    const filepath = path.join(deployDir, filename);
    fs.writeFileSync(filepath, code);

    const localIp = getLocalIpAddress();
    const port = process.env.PORT || 3000;
    
    // Construct the URL
    const url = `http://${localIp}:${port}/deployments/${filename}`;
    
    return NextResponse.json({ url });

  } catch (error: any) {
    console.error('Deploy API Error:', error);
    return NextResponse.json({ error: 'Failed to deploy project' }, { status: 500 });
  }
}
