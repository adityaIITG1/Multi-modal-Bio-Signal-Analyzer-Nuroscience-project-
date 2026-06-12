import { NextResponse } from 'next/server';

const CHANNEL_IDS = [
  "UCeVMnSShP_Iviwkknt83cww", // CodeWithHarry (CSE, AI, ML)
  "UCNU_lfiiWBdtULi00hA0_Q", // Krish Naik Hindi (Data Science, ML, AI)
  "UCBwmMxybNsCekFk1n2_A_Qg", // Apna College (CSE, Tech)
  "UCgHDngFV50KmbqF_6-K8XhA", // Code With Aarohi (Data Science, AI, ML)
  "UCaayLD9i5x4MmIoVZxXSv_g", // T-Series Bhakti Sagar (Hanuman Ji, Lord Krishna)
  "UC4T5920h7Zp3h7o8_X6_xVg", // Sanskar TV (Hindu devotion)
  "UC6-F9tJ3eD6r4v4d71_2c1g"  // Premanand Maharaj Ji - Bhajan Marg
];

export async function GET() {
  try {
    let allVideoIds: string[] = [];

    // Fetch RSS feeds for all channels in parallel
    const fetchPromises = CHANNEL_IDS.map(async (channelId) => {
      try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
          // Add a cache buster or short revalidate to ensure fresh content
          next: { revalidate: 3600 } 
        });
        
        if (!res.ok) return [];
        
        const xml = await res.text();
        
        // Use a simple regex to extract <yt:videoId>...</yt:videoId>
        const regex = /<yt:videoId>(.*?)<\/yt:videoId>/g;
        const ids: string[] = [];
        let match;
        while ((match = regex.exec(xml)) !== null) {
          if (match[1]) {
            ids.push(match[1]);
          }
        }
        return ids;
      } catch (err) {
        console.error(`Error fetching channel ${channelId}:`, err);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    
    // Combine all IDs
    results.forEach(ids => {
      allVideoIds = allVideoIds.concat(ids);
    });

    // Remove duplicates
    allVideoIds = Array.from(new Set(allVideoIds));

    // Fisher-Yates shuffle to randomize the feed completely
    for (let i = allVideoIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allVideoIds[i], allVideoIds[j]] = [allVideoIds[j], allVideoIds[i]];
    }

    return NextResponse.json({ videos: allVideoIds });

  } catch (error) {
    console.error('Error fetching YouTube RSS feeds:', error);
    return NextResponse.json(
      { error: "Failed to fetch live feed", videos: [] },
      { status: 500 }
    );
  }
}
