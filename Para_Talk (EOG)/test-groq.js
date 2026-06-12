const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function main() {
  try {
    const models = await groq.models.list();
    console.log("Available models:", models.data.map(m => m.id));
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'test' }],
      model: 'llama3-70b-8192',
    });
    console.log("Success with llama3-70b-8192:", chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error("Error with llama3-70b-8192:", error.message);
  }
}

main();
