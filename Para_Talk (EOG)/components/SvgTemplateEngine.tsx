export type LayoutTemplateType = 
  | "Modern Split" 
  | "Centered Hero" 
  | "Diagonal Cut" 
  | "Minimalist Grid" 
  | "Circular Focus" 
  | "Floating Cards" 
  | "Geometric Tech" 
  | "Organic Blobs" 
  | "Neon Cyberpunk" 
  | "Elegant Luxury";

export function generateStaticSvg(
  layout: LayoutTemplateType | string,
  w: number,
  h: number,
  title: string,
  industry: string,
  style: string,
  colorTheme: string
): string {
  // Common text wrapping logic for SVG
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  words.forEach(w => {
    if ((currentLine + w).length > 22) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = w + ' ';
    } else {
      currentLine += w + ' ';
    }
  });
  if (currentLine.trim()) lines.push(currentLine.trim());

  const generateText = (x: string | number, y: string | number, color: string, anchor: string = "start", size: string = "48") => {
    return `<text x="${x}" y="${y}" fill="${color}" font-size="${lines.length > 2 ? '36' : size}" font-family="sans-serif" font-weight="black" text-anchor="${anchor}">
      ${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : (lines.length > 2 ? 40 : 55)}">${line}</tspan>`).join('')}
    </text>`;
  };

  const getColors = () => {
    if (colorTheme.includes("Red")) return { bg1: "#450a0a", bg2: "#991b1b", accent: "#f87171" };
    if (colorTheme.includes("Gold")) return { bg1: "#000000", bg2: "#1a1a1a", accent: "#fbbf24" };
    if (colorTheme.includes("Neon")) return { bg1: "#1e1b4b", bg2: "#312e81", accent: "#c084fc" };
    if (colorTheme.includes("Cyan")) return { bg1: "#083344", bg2: "#164e63", accent: "#22d3ee" };
    return { bg1: "#0f172a", bg2: "#1e293b", accent: "#38bdf8" }; // Default
  };

  const { bg1, bg2, accent } = getColors();
  
  let content = "";

  switch (layout) {
    case "Modern Split":
      content = `
        <rect width="50%" height="100%" fill="${bg1}" />
        <rect x="50%" width="50%" height="100%" fill="${bg2}" />
        <circle cx="75%" cy="50%" r="30%" fill="${accent}" opacity="0.8" />
        <rect x="5%" y="10%" width="120" height="30" rx="15" fill="${accent}" />
        <text x="6%" y="15%" fill="#FFF" font-size="14" font-family="sans-serif" font-weight="bold">NEW DESIGN</text>
        ${generateText("5%", "40%", "#FFF")}
        <text x="5%" y="85%" fill="${accent}" font-size="24" font-family="sans-serif">${industry} • ${style}</text>
      `;
      break;

    case "Centered Hero":
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <ellipse cx="50%" cy="50%" rx="60%" ry="60%" fill="${bg2}" />
        ${generateText("50%", "45%", "#FFF", "middle", "64")}
        <rect x="calc(50% - 60px)" y="80%" width="120" height="30" rx="15" fill="${accent}" />
        <text x="50%" y="84%" fill="${bg1}" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">DISCOVER</text>
      `;
      break;

    case "Diagonal Cut":
      content = `
        <rect width="100%" height="100%" fill="${bg2}" />
        <polygon points="0,0 100%,0 100%,40% 0,80%" fill="${bg1}" />
        <polygon points="100%,40% 100%,45% 0,85% 0,80%" fill="${accent}" />
        ${generateText("5%", "30%", "#FFF")}
        <text x="5%" y="90%" fill="${accent}" font-size="24" font-family="sans-serif" font-weight="bold" font-style="italic">${industry.toUpperCase()}</text>
      `;
      break;

    case "Minimalist Grid":
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <line x1="10%" y1="0" x2="10%" y2="100%" stroke="${bg2}" stroke-width="2" />
        <line x1="90%" y1="0" x2="90%" y2="100%" stroke="${bg2}" stroke-width="2" />
        <line x1="0" y1="20%" x2="100%" y2="20%" stroke="${bg2}" stroke-width="2" />
        <line x1="0" y1="80%" x2="100%" y2="80%" stroke="${bg2}" stroke-width="2" />
        <rect x="15%" y="10%" width="20%" height="5%" fill="${accent}" opacity="0.5" />
        ${generateText("15%", "40%", "#FFF")}
      `;
      break;

    case "Circular Focus":
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <circle cx="50%" cy="50%" r="40%" fill="none" stroke="${accent}" stroke-width="4" opacity="0.3" />
        <circle cx="50%" cy="50%" r="35%" fill="${bg2}" />
        ${generateText("50%", "48%", "#FFF", "middle")}
      `;
      break;

    case "Floating Cards":
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <rect x="20%" y="15%" width="60%" height="70%" rx="24" fill="${bg2}" opacity="0.9" stroke="${accent}" stroke-width="2" />
        <rect x="15%" y="25%" width="50%" height="50%" rx="16" fill="${accent}" opacity="0.2" />
        ${generateText("25%", "40%", "#FFF")}
      `;
      break;

    case "Geometric Tech":
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <polygon points="50%,10% 90%,30% 90%,70% 50%,90% 10%,70% 10%,30%" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5" />
        <polygon points="50%,20% 80%,35% 80%,65% 50%,80% 20%,65% 20%,35%" fill="${bg2}" />
        ${generateText("50%", "48%", "#FFF", "middle")}
        <text x="50%" y="75%" fill="${accent}" font-size="20" font-family="monospace" text-anchor="middle"><${industry}/></text>
      `;
      break;

    case "Organic Blobs":
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <path d="M ${w*0.8} ${h*0.2} Q ${w} ${h*0.5} ${w*0.7} ${h*0.8} T ${w*0.4} ${h*0.9} Q ${w*0.2} ${h*0.7} ${w*0.3} ${h*0.3} Z" fill="${bg2}" opacity="0.8" />
        <circle cx="80%" cy="20%" r="15%" fill="${accent}" />
        ${generateText("10%", "50%", "#FFF")}
      `;
      break;

    case "Neon Cyberpunk":
      content = `
        <rect width="100%" height="100%" fill="#000000" />
        <rect x="5%" y="5%" width="90%" height="90%" fill="none" stroke="${accent}" stroke-width="6" />
        <line x1="5%" y1="15%" x2="95%" y2="15%" stroke="${accent}" stroke-width="2" />
        <rect x="70%" y="5%" width="20%" height="10%" fill="${accent}" />
        <text x="80%" y="11%" fill="#000" font-weight="bold" font-family="monospace" text-anchor="middle">SYS.ON</text>
        ${generateText("10%", "50%", "#FFF")}
      `;
      break;

    case "Elegant Luxury":
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <rect x="10%" y="10%" width="80%" height="80%" fill="none" stroke="${accent}" stroke-width="1" />
        <rect x="12%" y="12%" width="76%" height="76%" fill="none" stroke="${accent}" stroke-width="1" />
        <line x1="50%" y1="15%" x2="50%" y2="25%" stroke="${accent}" stroke-width="1" />
        ${generateText("50%", "50%", "#FFF", "middle")}
        <text x="50%" y="80%" fill="${accent}" font-size="18" font-family="serif" text-anchor="middle" font-style="italic">EST. 2026</text>
      `;
      break;

    default: // Fallback old template
      content = `
        <rect width="100%" height="100%" fill="${bg1}" />
        <circle cx="80%" cy="30%" r="20%" fill="${accent}" opacity="0.8" />
        <rect x="5%" y="10%" width="120" height="30" rx="15" fill="${accent}" />
        <text x="6%" y="15%" fill="#FFF" font-size="14" font-family="sans-serif" font-weight="bold">NEW DESIGN</text>
        ${generateText("5%", "40%", "#FFF")}
      `;
      break;
  }

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      ${content}
    </svg>
  `.trim();
}
