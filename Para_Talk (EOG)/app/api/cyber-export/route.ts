import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
const archiver = require('archiver');

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { reportData, businessType, checkType, url } = data;

    const archive = archiver('zip', { zlib: { level: 9 } });
    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: any) => reject(err));
    });

    // 1. Create PDF
    const pdfDoc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const pdfChunks: Buffer[] = [];
    pdfDoc.on('data', chunk => pdfChunks.push(chunk));
    const pdfPromise = new Promise<Buffer>(resolve => {
      pdfDoc.on('end', () => resolve(Buffer.concat(pdfChunks)));
    });

    // Draw PDF Content
    pdfDoc.rect(0, 0, 595.28, 841.89).fill('#0B1121'); // Dark background
    pdfDoc.fillColor('#10B981').fontSize(24).text('BLINKCYBER SHIELD REPORT', { align: 'center' });
    pdfDoc.moveDown();
    
    pdfDoc.fillColor('#FFFFFF').fontSize(14).text(`Business Type: ${businessType}`);
    pdfDoc.text(`Target URL: ${url}`);
    pdfDoc.text(`Check Type: ${checkType}`);
    pdfDoc.moveDown();

    pdfDoc.fillColor('#3B82F6').fontSize(20).text(`Overall Safety Score: ${reportData.overallScore}%`);
    const verdict = reportData.overallScore >= 90 ? 'Highly Safe' : reportData.overallScore >= 75 ? 'Safe but Improve' : reportData.overallScore >= 50 ? 'Medium Risk' : reportData.overallScore >= 25 ? 'High Risk' : 'Critical Risk';
    pdfDoc.fillColor(reportData.overallScore >= 75 ? '#10B981' : reportData.overallScore >= 50 ? '#F59E0B' : '#EF4444').text(`Status: ${verdict}`);
    pdfDoc.moveDown();

    pdfDoc.fillColor('#FFFFFF').fontSize(16).text('Category Scores:');
    pdfDoc.fontSize(12).fillColor('#94A3B8');
    pdfDoc.text(`Website Security: ${reportData.websiteScore}%`);
    pdfDoc.text(`Email / Phishing Safety: ${reportData.emailScore}%`);
    pdfDoc.text(`Password Safety: ${reportData.passwordScore}%`);
    pdfDoc.text(`Data Privacy: ${reportData.privacyScore}%`);
    pdfDoc.text(`WhatsApp Business Safety: ${reportData.whatsappScore}%`);
    pdfDoc.moveDown();

    pdfDoc.addPage();
    pdfDoc.rect(0, 0, 595.28, 841.89).fill('#0B1121');
    pdfDoc.fillColor('#10B981').fontSize(18).text('Safe Points (Passed)');
    pdfDoc.fillColor('#FFFFFF').fontSize(12);
    reportData.safePoints?.forEach((pt: string) => pdfDoc.text(`✅ ${pt}`));
    pdfDoc.moveDown();

    pdfDoc.fillColor('#EF4444').fontSize(18).text('Unsafe Points (Failed/Missing)');
    pdfDoc.fillColor('#FFFFFF').fontSize(12);
    reportData.unsafePoints?.forEach((pt: string) => pdfDoc.text(`❌ ${pt}`));
    pdfDoc.moveDown();

    pdfDoc.fillColor('#3B82F6').fontSize(18).text('What Should Be Added');
    pdfDoc.fillColor('#FFFFFF').fontSize(12);
    reportData.whatToAdd?.forEach((pt: string, i: number) => pdfDoc.text(`${i+1}. ${pt}`));
    pdfDoc.moveDown();

    pdfDoc.addPage();
    pdfDoc.rect(0, 0, 595.28, 841.89).fill('#0B1121');
    pdfDoc.fillColor('#F59E0B').fontSize(18).text('Priority Fixes Timeline');
    pdfDoc.fillColor('#FFFFFF').fontSize(12);
    pdfDoc.text('High Priority (24-48 hours):');
    reportData.priorityFixes?.high?.forEach((pt: string) => pdfDoc.text(`- ${pt}`));
    pdfDoc.moveDown();
    pdfDoc.text('Medium Priority (7 days):');
    reportData.priorityFixes?.medium?.forEach((pt: string) => pdfDoc.text(`- ${pt}`));
    pdfDoc.moveDown();
    pdfDoc.text('Low Priority (30 days):');
    reportData.priorityFixes?.low?.forEach((pt: string) => pdfDoc.text(`- ${pt}`));
    pdfDoc.moveDown();

    pdfDoc.fillColor('#8B5CF6').fontSize(16).text('Business Impact Insight');
    pdfDoc.fillColor('#94A3B8').fontSize(12).text(reportData.businessImpact || 'No specific impact identified.');
    pdfDoc.moveDown();

    pdfDoc.fillColor('#10B981').fontSize(16).text('Client-Friendly Verdict');
    pdfDoc.fillColor('#94A3B8').fontSize(12).text(reportData.clientVerdict || 'N/A');
    pdfDoc.moveDown();

    pdfDoc.addPage();
    pdfDoc.rect(0, 0, 595.28, 841.89).fill('#0B1121');
    pdfDoc.fillColor('#EF4444').fontSize(12).text('DISCLAIMER: This is a basic non-invasive cybersecurity hygiene check. It does not guarantee complete security. Advanced penetration testing should be done only with written permission by trained cybersecurity professionals.', { align: 'center' });

    pdfDoc.end();
    const finalPdfBuffer = await pdfPromise;
    
    // Add files to ZIP
    archive.append(finalPdfBuffer, { name: 'cyber_dashboard_report.pdf' });
    archive.append(JSON.stringify(reportData, null, 2), { name: 'safety_score_data.json' });
    archive.append(reportData.clientProposal || 'No proposal generated.', { name: 'client_proposal.txt' });
    archive.append(reportData.salesMessage || 'No sales message generated.', { name: 'whatsapp_sales_message.txt' });
    archive.append(`Disclaimer:\nThis is a basic non-invasive cybersecurity hygiene check. It does not guarantee complete security.`, { name: 'README.md' });
    
    archive.finalize();
    const zipBuffer = await archivePromise as Buffer;

    return new Response(zipBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="BlinkCyberShield_Report.zip"'
      }
    });
  } catch (error: any) {
    console.error("Cyber Export Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
