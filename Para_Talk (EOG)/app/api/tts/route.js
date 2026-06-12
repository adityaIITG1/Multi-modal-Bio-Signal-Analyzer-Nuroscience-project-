const azureVoices = {
  "en-IN": { voice: "en-IN-NeerjaNeural", locale: "en-IN" },
  "hi-IN": { voice: "hi-IN-SwaraNeural", locale: "hi-IN" },
  "bn-IN": { voice: "bn-IN-TanishaaNeural", locale: "bn-IN" },
  "ta-IN": { voice: "ta-IN-PallaviNeural", locale: "ta-IN" },
  "te-IN": { voice: "te-IN-ShrutiNeural", locale: "te-IN" },
  "mr-IN": { voice: "mr-IN-AarohiNeural", locale: "mr-IN" },
  "gu-IN": { voice: "gu-IN-DhwaniNeural", locale: "gu-IN" },
  "kn-IN": { voice: "kn-IN-SapnaNeural", locale: "kn-IN" },
  "ml-IN": { voice: "ml-IN-SobhanaNeural", locale: "ml-IN" },
  "ne-IN": { voice: "ne-NP-HemkalaNeural", locale: "ne-NP" },
  "ur-IN": { voice: "ur-PK-UzmaNeural", locale: "ur-PK" }
};

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function POST(request) {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    return Response.json({ error: "Azure Speech is not configured." }, { status: 503 });
  }

  const { text, language } = await request.json();
  const voiceConfig = azureVoices[language] || azureVoices["en-IN"];

  if (!text || text.length > 500) {
    return Response.json({ error: "Text is required and must be 500 characters or fewer." }, { status: 400 });
  }

  const ssml = `
    <speak version="1.0" xml:lang="${voiceConfig.locale}">
      <voice xml:lang="${voiceConfig.locale}" name="${voiceConfig.voice}">
        <prosody rate="-6%" pitch="+8%">${escapeXml(text)}</prosody>
      </voice>
    </speak>
  `.trim();

  const azureResponse = await fetch(`https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": speechKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "para-talk"
    },
    body: ssml
  });

  if (!azureResponse.ok) {
    return Response.json({ error: "Azure Speech request failed." }, { status: azureResponse.status });
  }

  return new Response(await azureResponse.arrayBuffer(), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Para-Talk-Voice": voiceConfig.voice
    }
  });
}
