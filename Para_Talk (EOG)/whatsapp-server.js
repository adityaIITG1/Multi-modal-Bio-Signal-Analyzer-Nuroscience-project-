const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

let clientState = 'INITIALIZING';
let latestQrDataUrl = null;
let whatsappClient = null;

function initializeWhatsApp() {
  clientState = 'INITIALIZING';
  latestQrDataUrl = null;

  whatsappClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './whatsapp-auth' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
    }
  });

  whatsappClient.on('qr', async (qr) => {
    console.log('[WhatsApp] QR RECEIVED', qr);
    clientState = 'QR_READY';
    try {
      latestQrDataUrl = await qrcode.toDataURL(qr);
    } catch (err) {
      console.error('Failed to generate QR Data URL', err);
    }
  });

  whatsappClient.on('authenticated', () => {
    console.log('[WhatsApp] AUTHENTICATED');
    clientState = 'AUTHENTICATED';
    latestQrDataUrl = null;
  });

  whatsappClient.on('ready', () => {
    console.log('[WhatsApp] READY');
    clientState = 'CONNECTED';
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('[WhatsApp] DISCONNECTED', reason);
    clientState = 'DISCONNECTED';
    latestQrDataUrl = null;
    
    // Automatically re-initialize on disconnect (unless intentional logout)
    setTimeout(() => {
      initializeWhatsApp();
    }, 5000);
  });

  whatsappClient.initialize().catch(err => {
    console.error('[WhatsApp] Initialization error:', err);
    clientState = 'ERROR';
    // Retry initialization after failure (e.g. timeout)
    setTimeout(() => {
      initializeWhatsApp();
    }, 5000);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[WhatsApp Server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WhatsApp Server] Unhandled Rejection:', reason);
});

// Start WhatsApp Client
initializeWhatsApp();

// API Endpoints
app.get('/api/whatsapp/status', (req, res) => {
  res.json({ status: clientState, qr: latestQrDataUrl });
});

app.get('/api/whatsapp/chats', async (req, res) => {
  if (clientState !== 'CONNECTED') {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  try {
    const chats = await whatsappClient.getChats();
    // Return only essential details to keep response light
    const chatList = chats.map(c => ({
      id: c.id._serialized,
      name: c.name || c.id.user,
      isGroup: c.isGroup,
      unreadCount: c.unreadCount,
      timestamp: c.timestamp
    }));
    res.json(chatList);
  } catch (error) {
    console.error('[WhatsApp] Fetch chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.get('/api/whatsapp/chats/:chatId/messages', async (req, res) => {
  if (clientState !== 'CONNECTED') {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  try {
    const chat = await whatsappClient.getChatById(req.params.chatId);
    const messages = await chat.fetchMessages({ limit: 10 });
    const formattedMessages = messages.map(m => ({
      id: m.id._serialized,
      body: m.body,
      fromMe: m.fromMe,
      timestamp: m.timestamp,
      type: m.type
    }));
    res.json(formattedMessages);
  } catch (error) {
    console.error('[WhatsApp] Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/whatsapp/send', async (req, res) => {
  if (clientState !== 'CONNECTED') {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  const { chatId, message } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: 'chatId and message are required' });
  }
  try {
    const sentMsg = await whatsappClient.sendMessage(chatId, message);
    res.json({ success: true, messageId: sentMsg.id._serialized });
  } catch (error) {
    console.error('[WhatsApp] Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/whatsapp/logout', async (req, res) => {
  if (clientState !== 'CONNECTED' && clientState !== 'AUTHENTICATED') {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  try {
    await whatsappClient.logout();
    clientState = 'DISCONNECTED';
    latestQrDataUrl = null;
    res.json({ success: true });
    
    // Re-initialize to get new QR
    setTimeout(() => {
      initializeWhatsApp();
    }, 3000);
  } catch (error) {
    console.error('[WhatsApp] Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

const PORT = process.env.WHATSAPP_PORT || 3001;
app.listen(PORT, () => {
  console.log(`[WhatsApp Server] Running on http://localhost:${PORT}`);
});
