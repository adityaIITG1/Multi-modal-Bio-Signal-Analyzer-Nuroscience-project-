import { NextResponse } from 'next/server';
const archiver = require('archiver');
import PDFDocument from 'pdfkit';
import { generateStaticSvg } from '../../../components/SvgTemplateEngine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Assuming the frontend also sends 'layoutTemplate' in the body now. We need to add it to the body in handleDownload in frontend. Let's destructure it:
    const { designType, layoutTemplate = "Modern Split", industry, designStyle, designSize, textStyle, colorTheme, customText, aiSvgResult } = body;

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

    // Create an archiver instance
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // We'll collect chunks to return as a Response
    const chunks: any[] = [];
    archive.on('data', (chunk: any) => chunks.push(chunk));
    
    // A promise to wait until archiving is done
    const archivePromise = new Promise((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: any) => reject(err));
    });

    // 1. JSON Data
    const projectInfo = {
      project: "BlinkDesign Studio Output",
      date: new Date().toISOString(),
      configuration: {
        designType, industry, designStyle, designSize, textStyle, colorTheme
      },
      estimatedPrice: "₹1,500 / $30"
    };
    archive.append(JSON.stringify(projectInfo, null, 2), { name: 'project_info.json' });

    // 2. TXT Prompts
    const promptTxt = `
DESIGN PROMPT:
Type: ${designType}
Industry: ${industry}
Style: ${designStyle}
Size: ${designSize}
Text Style: ${textStyle}
Color Theme: ${colorTheme}
Custom User Text: ${customText || 'None'}

Generate an ultra-high-quality vector image matching these specific constraints.
    `.trim();
    archive.append(promptTxt, { name: 'design_prompt.txt' });

    const clientDescription = `
Hi there! I've attached the ${designStyle} ${designType} for your ${industry} business. 
It leverages a ${colorTheme} theme and a ${textStyle} approach to maximize engagement.
    `.trim();
    archive.append(clientDescription, { name: 'client_description.txt' });
    archive.append("1500 INR", { name: 'selling_price.txt' });

    const readme = `
# BlinkDesign Studio Package
This package contains:
- project_info.json: Raw configuration data.
- design_prompt.txt: The AI prompt used to generate the image.
- client_description.txt: A sales pitch you can copy-paste to your client.
- selling_price.txt: Recommended pricing.
- brief.pdf: A professional PDF summary of the project.
- preview.svg: A vector preview of the design structure.
    `.trim();
    archive.append(readme, { name: 'README.md' });

    let finalSvg = aiSvgResult;
    if (!finalSvg) {
      finalSvg = generateStaticSvg(layoutTemplate, w, h, customText || designType, industry, designStyle, colorTheme);
    }
    archive.append(finalSvg, { name: 'preview.svg' });

    // 4. PDF Summary
    const pdfDoc = new PDFDocument();
    const pdfChunks: Buffer[] = [];
    pdfDoc.on('data', chunk => pdfChunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve) => {
      pdfDoc.on('end', () => resolve(Buffer.concat(pdfChunks)));
    });

    pdfDoc.fontSize(25).text('BlinkDesign Studio Brief', { align: 'center' });
    pdfDoc.moveDown();
    pdfDoc.fontSize(14).text(`Project Type: ${designType}`);
    pdfDoc.text(`Industry: ${industry}`);
    pdfDoc.text(`Style: ${designStyle}`);
    pdfDoc.text(`Size: ${designSize}`);
    pdfDoc.text(`Text Style: ${textStyle}`);
    pdfDoc.text(`Color Theme: ${colorTheme}`);
    pdfDoc.moveDown();
    pdfDoc.text('Thank you for creating with BlinkDesign Studio.');
    pdfDoc.end();

    const pdfBuffer = await pdfPromise;
    archive.append(pdfBuffer, { name: 'brief.pdf' });

    // Finalize the archive
    archive.finalize();

    const zipBuffer = await archivePromise as Buffer;

    return new NextResponse(zipBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="BlinkDesign_${(designType || 'Asset').replace(/\s+/g, "_")}.zip"`
      }
    });

  } catch (error) {
    console.error("Design Export Error:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
