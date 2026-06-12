"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  Utensils,
  Bath,
  Sun,
  ActivitySquare,
  Gamepad2,
  Brain,
  Activity,
  HeartPulse,
  Stethoscope,
  Pill,
  PhoneCall,
  Mic,
  ShieldAlert,
  Smartphone,
  Radio,
  Eye,
  Globe,
  CloudSun,
  Trophy,
  Database,
  Newspaper,
  Tv,
  ChevronLeft,
  LayoutDashboard,
  MessageSquare,
  Code,
  Paintbrush,
  Terminal,
  Wind,
  Palette,
  Wallet,
  ShieldCheck
} from "lucide-react";
import DinoGame from "./DinoGame";
import GameEngine, { GameType } from "./GameEngine";
import ElectrodeGuide from "./ElectrodeGuide";
import BlinkIDE from "./BlinkIDE";
import BlinkArt from "./BlinkArt";
import BlinkIncomeHub from "./BlinkIncomeHub";
import BlinkKeyboard from "./BlinkKeyboard";
import BlinkDesignStudio from "./BlinkDesignStudio";
import BlinkWebStudio from "./BlinkWebStudio";
import BlinkCyberShield from "./BlinkCyberShield";
import CaretakerCyberTargets from "./CaretakerCyberTargets";
import BlinkAgentBuilder from "./BlinkAgentBuilder";
import BlinkChessAIPro from "./BlinkChessAIPro";
import BlinkDebateArena from "./BlinkDebateArena";
import BlinkCurrentAffairs from "./BlinkCurrentAffairs";
import BlinkYouTube from "./BlinkYouTube";
import { WhatsAppBlinkAssist } from "./WhatsAppBlinkAssist";
import NeuroLab from "./NeuroLab";

type LanguageCode =
  | "en-IN"
  | "hi-IN"
  | "bn-IN"
  | "ta-IN"
  | "te-IN"
  | "mr-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "pa-IN"
  | "ur-IN";

type Message = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge: string;
  isEmergency?: boolean;
  speech: Partial<Record<LanguageCode, string>>;
  action?: string;
  categoryId?: string;
  prompt?: string;
  model?: string;
};

type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  writable: WritableStream<Uint8Array>;
  readable: ReadableStream<Uint8Array>;
};

type NavigatorWithSerial = Navigator & {
  serial?: {
    requestPort: () => Promise<SerialPortLike>;
  };
};

const AUTO_SELECT_MS = 2000;
const RELAY_COMMAND = "RELAY_ON\n";

const careMessages: Message[] = [
  {
    label: "Hello",
    description: "Greetings",
    icon: Mic,
    badge: "Social",
    speech: {
      "en-IN": "Hello.",
      "hi-IN": "नमस्ते",
      "bn-IN": "নমস্কার",
      "mr-IN": "नमस्कार",
      "ta-IN": "வணக்கம்",
    },
  },
  {
    label: "Water",
    description: "Need drinking water",
    icon: Droplets,
    badge: "Hydration",
    speech: {
      "en-IN": "I need water.",
      "hi-IN": "मुझे पानी चाहिए।",
      "bn-IN": "আমার জল দরকার।",
      "mr-IN": "मला पाणी हवे आहे.",
      "ta-IN": "எனக்கு தண்ணீர் வேண்டும்.",
    },
  },
  {
    label: "Food",
    description: "Requesting food",
    icon: Utensils,
    badge: "Nutrition",
    speech: {
      "en-IN": "I am hungry.",
      "hi-IN": "मुझे भूख लगी है।",
      "bn-IN": "আমার খিদে পেয়েছে।",
      "mr-IN": "मला भूक लागली आहे.",
      "ta-IN": "எனக்கு பசிக்கிறது.",
    },
  },
  {
    label: "Toilet",
    description: "Need restroom assist",
    icon: Bath,
    badge: "Hygiene",
    speech: {
      "en-IN": "I want to go to the toilet.",
      "hi-IN": "मुझे शौचालय जाना है।",
      "bn-IN": "আমি টয়লেটে যেতে চাই.",
      "mr-IN": "मला वॉशरूमला जायचे आहे.",
      "ta-IN": "நான் கழிப்பறை செல்ல வேண்டும்.",
    },
  },
  {
    label: "Unwell",
    description: "Please check me",
    icon: HeartPulse,
    badge: "Medical",
    isEmergency: true,
    speech: {
      "en-IN": "I am feeling unwell.",
      "hi-IN": "मेरी तबीयत ठीक नहीं है।",
      "bn-IN": "আমার শরীর ভালো নেই।",
      "mr-IN": "माझी तब्येत ठीक नाही.",
      "ta-IN": "எனக்கு உடல்நிலை சரியில்லை.",
    },
  },
  {
    label: "Play Game",
    description: "Start Dino game",
    icon: Gamepad2,
    badge: "Entertainment",
    action: "game:dino",
    speech: {
      "en-IN": "I want to play a game.",
      "hi-IN": "मैं गेम खेलना चाहता हूँ।",
      "bn-IN": "আমি গেম খেলতে চাই।",
      "mr-IN": "मला गेम खेळायचा आहे.",
      "ta-IN": "நான் கேம் விளையாட வேண்டும்.",
    },
  },
  {
    label: "Headache",
    description: "Head pain",
    icon: Brain,
    badge: "Pain Alert",
    isEmergency: true,
    speech: {
      "en-IN": "I am having a headache.",
      "hi-IN": "मेरे सिर में दर्द है।",
      "bn-IN": "আমার মাথা ব্যথা করছে।",
      "mr-IN": "माझे डोकं दुखत आहे.",
      "ta-IN": "எனக்கு தலைவலி உள்ளது.",
    },
  },
  {
    label: "Stomach Pain",
    description: "Abdominal pain",
    icon: ActivitySquare,
    badge: "Pain Alert",
    isEmergency: true,
    speech: {
      "en-IN": "I am having stomach pain.",
      "hi-IN": "मेरे पेट में दर्द है।",
      "bn-IN": "আমার পেট ব্যথা করছে।",
      "mr-IN": "माझ्या पोटात दुखत आहे.",
      "ta-IN": "எனக்கு வயிற்று வலி உள்ளது.",
    },
  },
  {
    label: "Spinal Pain",
    description: "Back pain",
    icon: Activity,
    badge: "Pain Alert",
    isEmergency: true,
    speech: {
      "en-IN": "I am having back pain.",
      "hi-IN": "मेरी पीठ में दर्द है।",
      "bn-IN": "আমার পিঠে ব্যথা করছে।",
      "mr-IN": "माझी पाठ दुखत आहे.",
      "ta-IN": "எனக்கு முதுகு வலி உள்ளது.",
    },
  },
  {
    label: "Body Pain",
    description: "Pain in body",
    icon: Stethoscope,
    badge: "Pain Alert",
    isEmergency: true,
    speech: {
      "en-IN": "I am having body pain.",
      "hi-IN": "मेरे शरीर में दर्द है।",
      "bn-IN": "আমার শরীরে ব্যথা করছে।",
      "mr-IN": "माझे अंग दुखत आहे.",
      "ta-IN": "எனக்கு உடல் வலி உள்ளது.",
    },
  },
  {
    label: "Breathing",
    description: "Breathing issue",
    icon: Wind,
    badge: "Emergency",
    isEmergency: true,
    speech: {
      "en-IN": "I am having difficulty breathing.",
      "hi-IN": "मुझे सांस लेने में तकलीफ हो रही है।",
      "bn-IN": "আমার শ্বাস নিতে কষ্ট হচ্ছে।",
      "mr-IN": "मला श्वास घेण्यास त्रास होत आहे.",
      "ta-IN": "எனக்கு மூச்சு விடுவதில் சிரமம் உள்ளது.",
    },
  },
  {
    label: "Position",
    description: "Change body position",
    icon: ActivitySquare,
    badge: "Care",
    speech: {
      "en-IN": "Please change my body position.",
      "hi-IN": "कृपया मेरे शरीर की स्थिति बदलें।",
      "bn-IN": "দয়া করে আমার শরীরের অবস্থান পরিবর্তন করুন।",
      "mr-IN": "कृपया माझ्या शरीराची स्थिती बदला.",
      "ta-IN": "தயவுசெய்து என் உடல் நிலையை மாற்றவும்.",
    },
  },
  {
    label: "Medicine",
    description: "Medicine time",
    icon: Pill,
    badge: "Medication",
    speech: {
      "en-IN": "It is my medicine time.",
      "hi-IN": "यह मेरी दवा का समय है।",
      "bn-IN": "আমার ওষুধ খাওয়ার সময় হয়েছে।",
      "mr-IN": "माझी औषध घेण्याची वेळ झाली आहे.",
      "ta-IN": "இது என் மருந்து நேரம்.",
    },
  },
  {
    label: "Call Caregiver",
    description: "Relay call",
    icon: PhoneCall,
    badge: "Emergency",
    isEmergency: true,
    action: "relay",
    speech: {
      "en-IN": "Please call the caregiver.",
      "hi-IN": "कृपया देखभाल करने वाले को बुलाएं।",
      "bn-IN": "দয়া করে সাহায্যকারীকে ডাকুন।",
      "mr-IN": "कृपया काळजीवाहूला बोलवा.",
      "ta-IN": "தயவுசெய்து உதவியாளரை அழைக்கவும்.",
    },
  },
  {
    label: "AI Chatbot",
    description: "Ask AI Questions",
    icon: Terminal,
    badge: "AI",
    action: "mode:ai_chat",
    speech: { "en-IN": "AI Chatbot Mode", "hi-IN": "एआई चैटबॉट", "bn-IN": "এআই চ্যাটবট", "mr-IN": "एआय चॅटबॉट", "ta-IN": "ஏஐ சாட்போட்" },
  },
];

const aiChatMessages: Message[] = [
  { label: "Go Back", description: "Return to Care Mode", icon: ChevronLeft, badge: "Nav", action: "mode:care", speech: { "en-IN": "Go Back" } },
  { label: "Custom Query", description: "Type a question", icon: Terminal, badge: "Custom", action: "open_keyboard", speech: { "en-IN": "Custom Query" } },
  { label: "Tell a Joke", description: "Make me laugh", icon: Activity, badge: "Fun", action: "internet:fetch", prompt: "Tell me a short, clean, funny joke.", speech: { "en-IN": "Tell me a joke" } },
  { label: "Today's News", description: "Brief summary", icon: Newspaper, badge: "News", action: "internet:fetch", prompt: "Give me a very brief, one sentence summary of today's global news.", speech: { "en-IN": "Today's News" } },
  { label: "Fun Fact", description: "Trivia", icon: Brain, badge: "Trivia", action: "internet:fetch", prompt: "Give me a highly interesting fun fact.", speech: { "en-IN": "Give me a fun fact" } },
  { label: "Motivation", description: "Quote", icon: HeartPulse, badge: "Quote", action: "internet:fetch", prompt: "Give me a short motivating quote.", speech: { "en-IN": "Motivation" } },
  { label: "History Fact", description: "This day in history", icon: Globe, badge: "History", action: "internet:fetch", prompt: "What is an interesting event that happened on this day in history?", speech: { "en-IN": "History Fact" } },
  { label: "Short Story", description: "2-sentence story", icon: Tv, badge: "Story", action: "internet:fetch", prompt: "Tell me a very short 2-sentence story.", speech: { "en-IN": "Short Story" } },
  { label: "Poetry", description: "Short poem", icon: Paintbrush, badge: "Art", action: "internet:fetch", prompt: "Recite a very short, beautiful poem.", speech: { "en-IN": "Poetry" } },
  { label: "Diet Tips", description: "Healthy eating", icon: Utensils, badge: "Health", action: "internet:fetch", prompt: "Give me a simple healthy diet tip.", speech: { "en-IN": "Diet Tips" } },
  { label: "Stretching", description: "Bed stretch", icon: ActivitySquare, badge: "Exercise", action: "internet:fetch", prompt: "Suggest a simple stretch I can do while lying in bed.", speech: { "en-IN": "Stretching" } },
  { label: "Sleep Advice", description: "Better sleep", icon: CloudSun, badge: "Health", action: "internet:fetch", prompt: "Give me a tip for better sleep.", speech: { "en-IN": "Sleep Advice" } },
  { label: "Mindfulness", description: "Deep breathing", icon: Wind, badge: "Calm", action: "internet:fetch", prompt: "Guide me through a very short deep breathing exercise.", speech: { "en-IN": "Mindfulness" } },
  { label: "Tech News", description: "Latest in tech", icon: Smartphone, badge: "News", action: "internet:fetch", prompt: "What is the latest major breakthrough in technology?", speech: { "en-IN": "Tech News" } },
  { label: "Sports Update", description: "Recent events", icon: Trophy, badge: "News", action: "internet:fetch", prompt: "Give me a quick update on recent major sports events.", speech: { "en-IN": "Sports Update" } },
  { label: "Space Fact", description: "About the universe", icon: CloudSun, badge: "Science", action: "internet:fetch", prompt: "Tell me a fascinating fact about space or the universe.", speech: { "en-IN": "Space Fact" } },
  { label: "Animal Fact", description: "About nature", icon: Eye, badge: "Nature", action: "internet:fetch", prompt: "Tell me a fun fact about a specific animal.", speech: { "en-IN": "Animal Fact" } },
  { label: "Trivia Question", description: "Test my knowledge", icon: Gamepad2, badge: "Game", action: "internet:fetch", prompt: "Ask me a simple trivia question and immediately give the answer.", speech: { "en-IN": "Trivia Question" } },
  { label: "Word of the Day", description: "Vocabulary", icon: Terminal, badge: "Edu", action: "internet:fetch", prompt: "Teach me a new interesting vocabulary word and its meaning.", speech: { "en-IN": "Word of the Day" } },
  { label: "Quick Math", description: "Puzzle", icon: Code, badge: "Puzzle", action: "internet:fetch", prompt: "Give me a simple math puzzle and solve it.", speech: { "en-IN": "Quick Math" } },
  { label: "Music Fact", description: "About music", icon: Radio, badge: "Art", action: "internet:fetch", prompt: "Tell me an interesting fact about music or a famous musician.", speech: { "en-IN": "Music Fact" } },
  { label: "Movie Trivia", description: "Classic movies", icon: Tv, badge: "Trivia", action: "internet:fetch", prompt: "Tell me a fun fact about a classic popular movie.", speech: { "en-IN": "Movie Trivia" } },
  { label: "Brain Teaser", description: "Riddle", icon: Brain, badge: "Puzzle", action: "internet:fetch", prompt: "Give me a short riddle and its answer.", speech: { "en-IN": "Brain Teaser" } },
  { label: "Happiness Tip", description: "Boost mood", icon: Sun, badge: "Wellness", action: "internet:fetch", prompt: "What is one simple psychological way to boost happiness?", speech: { "en-IN": "Happiness Tip" } },
  { label: "Travel Idea", description: "Beautiful places", icon: Globe, badge: "Imagination", action: "internet:fetch", prompt: "Describe a beautiful place in the world in one vivid sentence.", speech: { "en-IN": "Travel Idea" } },
  { label: "Recipe Idea", description: "Healthy food", icon: Utensils, badge: "Food", action: "internet:fetch", prompt: "Give me an idea for a healthy soup recipe.", speech: { "en-IN": "Recipe Idea" } },
  { label: "Gratitude", description: "Thankfulness", icon: HeartPulse, badge: "Wellness", action: "internet:fetch", prompt: "Give me a thought or quote on the importance of gratitude.", speech: { "en-IN": "Gratitude" } },
  { label: "Relaxation", description: "Calming scene", icon: CloudSun, badge: "Calm", action: "internet:fetch", prompt: "Describe a calming, peaceful beach scene.", speech: { "en-IN": "Relaxation" } },
  { label: "Friendship", description: "Quote", icon: Mic, badge: "Social", action: "internet:fetch", prompt: "Give me a heartwarming quote about friendship.", speech: { "en-IN": "Friendship" } },
  { label: "Book Recommendation", description: "Classic reads", icon: Newspaper, badge: "Reading", action: "internet:fetch", prompt: "Recommend a classic feel-good book and what it's about.", speech: { "en-IN": "Book Recommendation" } },
  { label: "Positive Affirmation", description: "Daily affirmation", icon: Sun, badge: "Wellness", action: "internet:fetch", prompt: "Give me a powerful positive daily affirmation.", speech: { "en-IN": "Positive Affirmation" } }
];

const talkMessages: Message[] = [
  {
    label: "Hello",
    description: "Greetings",
    icon: Mic,
    badge: "Social",
    speech: {
      "en-IN": "Hello.",
      "hi-IN": "नमस्ते",
      "bn-IN": "নমস্কার",
      "mr-IN": "नमस्कार",
      "ta-IN": "வணக்கம்",
    },
  },
  {
    label: "How are you?",
    description: "Friendly greeting",
    icon: Activity,
    badge: "Social",
    speech: {
      "en-IN": "How are you doing today?",
      "hi-IN": "आप आज कैसे हैं?",
      "bn-IN": "আপনি আজ কেমন আছেন?",
      "mr-IN": "तुम्ही आज कसे आहात?",
      "ta-IN": "நீங்கள் இன்று எப்படி இருக்கிறீர்கள்?",
    },
  },
  {
    label: "What are you doing?",
    description: "Ask about them",
    icon: Radio,
    badge: "Social",
    speech: {
      "en-IN": "What are you doing?",
      "hi-IN": "आप क्या कर रहे हैं?",
      "bn-IN": "আপনি কি করছেন?",
      "mr-IN": "तुम्ही काय करत आहात?",
      "ta-IN": "நீங்கள் என்ன செய்கிறீர்கள்?",
    },
  },
  {
    label: "Happy to see you",
    description: "Share affection",
    icon: HeartPulse,
    badge: "Emotion",
    speech: {
      "en-IN": "I am very happy to see you.",
      "hi-IN": "मुझे आपको देखकर बहुत खुशी हुई।",
      "bn-IN": "আমি আপনাকে দেখে খুব আনন্দিত।",
      "mr-IN": "मला तुम्हाला पाहून खूप आनंद झाला.",
      "ta-IN": "உங்களை பார்த்ததில் மிகவும் மகிழ்ச்சி.",
    },
  },
  {
    label: "Sit with me",
    description: "Request company",
    icon: Stethoscope,
    badge: "Social",
    speech: {
      "en-IN": "Please sit with me for some time.",
      "hi-IN": "कृपया कुछ देर मेरे साथ बैठें।",
      "bn-IN": "দয়া করে কিছুক্ষণ আমার সাথে বসুন।",
      "mr-IN": "कृपया थोडा वेळ माझ्यासोबत बसा.",
      "ta-IN": "தயவுசெய்து என்னுடன் சிறிது நேரம் உட்காரவும்.",
    },
  },
  {
    label: "Yes",
    description: "Affirmative",
    icon: Mic,
    badge: "Response",
    speech: {
      "en-IN": "Yes.",
      "hi-IN": "हाँ।",
      "bn-IN": "হ্যাঁ।",
      "mr-IN": "होय.",
      "ta-IN": "ஆம்.",
    },
  },
  {
    label: "No",
    description: "Negative",
    icon: Mic,
    badge: "Response",
    speech: {
      "en-IN": "No.",
      "hi-IN": "नहीं।",
      "bn-IN": "না।",
      "mr-IN": "नाही.",
      "ta-IN": "இல்லை.",
    },
  },
  {
    label: "Thank you",
    description: "Express gratitude",
    icon: ActivitySquare,
    badge: "Polite",
    speech: {
      "en-IN": "Thank you very much.",
      "hi-IN": "आपका बहुत-बहुत धन्यवाद।",
      "bn-IN": "আপনাকে অনেক ধন্যবাদ।",
      "mr-IN": "खूप खूप धन्यवाद.",
      "ta-IN": "மிக்க நன்றி.",
    },
  },
  {
    label: "I love you",
    description: "Express love",
    icon: HeartPulse,
    badge: "Emotion",
    speech: {
      "en-IN": "I love you.",
      "hi-IN": "मैं तुमसे प्यार करता हूँ।",
      "bn-IN": "আমি তোমাকে ভালোবাসি।",
      "mr-IN": "माझे तुझ्यावर प्रेम आहे.",
      "ta-IN": "நான் உன்னை காதலிக்கிறேன்.",
    },
  },
  {
    label: "I'm tired",
    description: "Express fatigue",
    icon: Brain,
    badge: "Status",
    speech: {
      "en-IN": "I am feeling tired.",
      "hi-IN": "मैं थका हुआ महसूस कर रहा हूँ।",
      "bn-IN": "আমি ক্লান্ত বোধ করছি।",
      "mr-IN": "मला थकल्यासारखे वाटत आहे.",
      "ta-IN": "நான் சோர்வாக உணர்கிறேன்.",
    },
  },
  {
    label: "Maybe",
    description: "Uncertain",
    icon: Mic,
    badge: "Response",
    speech: {
      "en-IN": "Maybe.",
      "hi-IN": "शायद।",
      "bn-IN": "হয়তো।",
      "mr-IN": "कदाचित.",
      "ta-IN": "ஒருவேளை.",
    },
  },
  {
    label: "I don't know",
    description: "Uncertain",
    icon: Mic,
    badge: "Response",
    speech: {
      "en-IN": "I don't know.",
      "hi-IN": "मुझे नहीं पता।",
      "bn-IN": "আমি জানি না।",
      "mr-IN": "मला माहित नाही.",
      "ta-IN": "எனக்குத் தெரியாது.",
    },
  },
  {
    label: "Please wait",
    description: "Ask to wait",
    icon: Mic,
    badge: "Request",
    speech: {
      "en-IN": "Please wait a moment.",
      "hi-IN": "कृपया एक पल प्रतीक्षा करें।",
      "bn-IN": "দয়া করে একটু অপেক্ষা করুন।",
      "mr-IN": "कृपया थोडा वेळ थांबा.",
      "ta-IN": "தயவுசெய்து காத்திருக்கவும்.",
    },
  },
  {
    label: "Tell me a story",
    description: "Request story",
    icon: Mic,
    badge: "Social",
    speech: {
      "en-IN": "Can you tell me a story?",
      "hi-IN": "क्या आप मुझे एक कहानी सुना सकते हैं?",
      "bn-IN": "আপনি কি আমাকে একটি গল্প বলতে পারেন?",
      "mr-IN": "तुम्ही मला एक गोष्ट सांगू शकता का?",
      "ta-IN": "எனக்கு ஒரு கதை சொல்ல முடியுமா?",
    },
  },
  {
    label: "Good night",
    description: "Say good night",
    icon: Sun,
    badge: "Social",
    speech: {
      "en-IN": "Good night. Sleep well.",
      "hi-IN": "शुभ रात्रि। अच्छे से सोएं।",
      "bn-IN": "শুভ রাত্রি। ভালো করে ঘুমান।",
      "mr-IN": "शुभ रात्री. शांत झोपा.",
      "ta-IN": "இனிய இரவு. நன்றாக தூங்குங்கள்.",
    },
  },
];

const gameMessages: Message[] = [
  {
    label: "Dino Run",
    description: "Classic Dino game",
    icon: Gamepad2,
    badge: "Game",
    action: "game:dino",
    speech: { "en-IN": "I want to play Dino run." },
  },
  {
    label: "Flappy Bird",
    description: "Flappy Bird clone",
    icon: Gamepad2,
    badge: "Game",
    action: "game:flappy",
    speech: { "en-IN": "I want to play Flappy Bird." },
  },
  {
    label: "Geometry Jump",
    description: "Jumping game",
    icon: Gamepad2,
    badge: "Game",
    action: "game:jump",
    speech: { "en-IN": "I want to play Geometry Jump." },
  },
  {
    label: "Space Shooter",
    description: "Shooter game",
    icon: Gamepad2,
    badge: "Game",
    action: "game:shooter",
    speech: { "en-IN": "I want to play Space Shooter." },
  },
  {
    label: "Basketball",
    description: "Timing game",
    icon: Gamepad2,
    badge: "Game",
    action: "game:basket",
    speech: { "en-IN": "I want to play Basketball." },
  },
  {
    label: "Rocket Landing",
    description: "Landing game",
    icon: Gamepad2,
    badge: "Game",
    action: "game:rocket",
    speech: { "en-IN": "I want to play Rocket Landing." },
  },
  {
    label: "Cyber Tunnel",
    description: "Tunnel runner",
    icon: Gamepad2,
    badge: "Game",
    action: "game:tunnel",
    speech: { "en-IN": "I want to play Cyber Tunnel." },
  },
  {
    label: "Aim Challenge",
    description: "Timing game",
    icon: Gamepad2,
    badge: "Game",
    action: "game:aim",
    speech: { "en-IN": "I want to play Aim Challenge." },
  },
];

const internetCategories: Message[] = [
  {
    label: "News & World",
    description: "Weather, City, World News",
    icon: Globe,
    badge: "Category",
    action: "internet:category",
    categoryId: "news",
    speech: { "en-IN": "News and World", "hi-IN": "समाचार और दुनिया" },
  },
  {
    label: "Sports",
    description: "Cricket, Football, Olympics",
    icon: Trophy,
    badge: "Category",
    action: "internet:category",
    categoryId: "sports",
    speech: { "en-IN": "Sports", "hi-IN": "खेल कूद" },
  },
  {
    label: "Health & Care",
    description: "Tips, Reminders, Questions",
    icon: HeartPulse,
    badge: "Category",
    action: "internet:category",
    categoryId: "health",
    speech: { "en-IN": "Health and Care", "hi-IN": "स्वास्थ्य और देखभाल" },
  },
  {
    label: "Entertainment & Motivation",
    description: "Movies, Stories, Motivation",
    icon: Tv,
    badge: "Category",
    action: "internet:category",
    categoryId: "entertainment",
    speech: {
      "en-IN": "Entertainment and Motivation",
      "hi-IN": "मनोरंजन और प्रेरणा",
    },
  },
  {
    label: "Family / Emergency",
    description: "Urgent Help, Caretaker",
    icon: ShieldAlert,
    badge: "Category",
    isEmergency: true,
    action: "internet:category",
    categoryId: "emergency",
    speech: { "en-IN": "Family and Emergency", "hi-IN": "परिवार और आपातकाल" },
  },
];

const internetOptionsMap: Record<string, Message[]> = {
  news: [
    {
      label: "Weather Today",
      description: "Current city weather",
      icon: CloudSun,
      badge: "News",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Search the web and tell me today's weather in Prayagraj, Uttar Pradesh, India. Keep it short and simple.",
      speech: { "en-IN": "Weather Today", "hi-IN": "आज का मौसम" },
    },
    {
      label: "City News",
      description: "Local updates",
      icon: Newspaper,
      badge: "News",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Search the web and tell me the most important news from Prayagraj today in simple language.",
      speech: { "en-IN": "City News", "hi-IN": "शहर की खबरें" },
    },
    {
      label: "India News",
      description: "National news",
      icon: Globe,
      badge: "News",
      action: "internet:fetch",
      model: "groq/compound",
      prompt:
        "Search the web and tell me today's top 5 important news updates from India in simple language.",
      speech: { "en-IN": "India News", "hi-IN": "भारत की खबरें" },
    },
    {
      label: "World News",
      description: "Global events",
      icon: Globe,
      badge: "News",
      action: "internet:fetch",
      model: "groq/compound",
      prompt:
        "Search the web and tell me today's top 5 world news updates in simple language.",
      speech: { "en-IN": "World News", "hi-IN": "दुनिया की खबरें" },
    },
    {
      label: "Go Back",
      description: "Return to categories",
      icon: ChevronLeft,
      badge: "Nav",
      action: "internet:back",
      speech: { "en-IN": "Go Back", "hi-IN": "पीछे जाएँ" },
    },
  ],
  sports: [
    {
      label: "Cricket Updates",
      description: "Scores and matches",
      icon: Trophy,
      badge: "Sports",
      action: "internet:fetch",
      model: "groq/compound",
      prompt:
        "Search the web and tell me today's latest cricket updates, live scores, India cricket news, and major match results.",
      speech: { "en-IN": "Cricket Updates", "hi-IN": "क्रिकेट अपडेट" },
    },
    {
      label: "Live Cricket Score",
      description: "Current match scores",
      icon: Activity,
      badge: "Sports",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Search the web and tell me the latest live cricket scores for any ongoing matches today. Keep it short.",
      speech: { "en-IN": "Live Cricket Score", "hi-IN": "लाइव क्रिकेट स्कोर" },
    },
    {
      label: "IPL Updates",
      description: "IPL news",
      icon: Trophy,
      badge: "Sports",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Search the web and tell me the latest news and updates regarding IPL.",
      speech: { "en-IN": "IPL Updates", "hi-IN": "आईपीएल अपडेट" },
    },
    {
      label: "Other Sports",
      description: "Football, Tennis, etc",
      icon: ActivitySquare,
      badge: "Sports",
      action: "internet:fetch",
      model: "groq/compound",
      prompt:
        "Search the web and tell me today's important sports news including football, badminton, tennis, kabaddi, and Olympics-related updates.",
      speech: { "en-IN": "Other Sports", "hi-IN": "अन्य खेल" },
    },
    {
      label: "Go Back",
      description: "Return to categories",
      icon: ChevronLeft,
      badge: "Nav",
      action: "internet:back",
      speech: { "en-IN": "Go Back", "hi-IN": "पीछे जाएँ" },
    },
  ],
  health: [
    {
      label: "Daily Health Tips",
      description: "For bedridden patient",
      icon: HeartPulse,
      badge: "Health",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Give safe daily health tips for a bedridden patient. Keep it simple. Do not give risky medical advice. Suggest doctor consultation for serious symptoms.",
      speech: { "en-IN": "Daily Health Tips", "hi-IN": "स्वास्थ्य टिप्स" },
    },
    {
      label: "Medicine Reminder",
      description: "Ask caretaker",
      icon: Pill,
      badge: "Health",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Create a short polite message asking my caretaker whether it is time for my medicine.",
      speech: { "en-IN": "Medicine Reminder", "hi-IN": "दवा की याद" },
    },
    {
      label: "Breathing Exercise",
      description: "Simple exercise",
      icon: Activity,
      badge: "Health",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Give me one simple breathing exercise for a bedridden person to feel calm and relaxed.",
      speech: {
        "en-IN": "Breathing Exercise",
        "hi-IN": "सांस लेने का व्यायाम",
      },
    },
    {
      label: "Ask Doctor",
      description: "Common questions",
      icon: Stethoscope,
      badge: "Health",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Create a short message to ask the doctor about how to manage mild discomfort while being bedridden.",
      speech: { "en-IN": "Ask Doctor", "hi-IN": "डॉक्टर से पूछें" },
    },
    {
      label: "Go Back",
      description: "Return to categories",
      icon: ChevronLeft,
      badge: "Nav",
      action: "internet:back",
      speech: { "en-IN": "Go Back", "hi-IN": "पीछे जाएँ" },
    },
  ],
  entertainment: [
    {
      label: "Motivational Thought",
      description: "Hope and respect",
      icon: Sun,
      badge: "Motivation",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Give a short motivational message for a bedridden or permanently disabled person. Make it hopeful and respectful.",
      speech: { "en-IN": "Motivational Thought", "hi-IN": "प्रेरक विचार" },
    },
    {
      label: "Spiritual Thought",
      description: "Bhagavad Gita",
      icon: Sun,
      badge: "Motivation",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Give one short Bhagavad Gita inspired spiritual thought in simple language for courage and peace.",
      speech: { "en-IN": "Spiritual Thought", "hi-IN": "आध्यात्मिक विचार" },
    },
    {
      label: "Entertainment News",
      description: "Bollywood, movies",
      icon: Tv,
      badge: "Entertainment",
      action: "internet:fetch",
      model: "groq/compound",
      prompt:
        "Search the web and tell me today's Bollywood, movie, OTT, music, and entertainment updates in simple language.",
      speech: { "en-IN": "Entertainment News", "hi-IN": "मनोरंजन की खबरें" },
    },
    {
      label: "Learn Something New",
      description: "Science, history",
      icon: Brain,
      badge: "Entertainment",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Teach me one interesting thing today from science, history, technology, or general knowledge in very simple language.",
      speech: { "en-IN": "Learn Something New", "hi-IN": "कुछ नया सीखें" },
    },
    {
      label: "Go Back",
      description: "Return to categories",
      icon: ChevronLeft,
      badge: "Nav",
      action: "internet:back",
      speech: { "en-IN": "Go Back", "hi-IN": "पीछे जाएँ" },
    },
  ],
  emergency: [
    {
      label: "Emergency Help",
      description: "Urgent need",
      icon: ShieldAlert,
      badge: "Emergency",
      isEmergency: true,
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Create a very urgent emergency message for my caretaker, family, and doctor saying I need immediate help.",
      speech: { "en-IN": "Emergency Help", "hi-IN": "आपातकालीन मदद" },
    },
    {
      label: "Send WhatsApp",
      description: "Draft message",
      icon: Smartphone,
      badge: "Emergency",
      action: "internet:fetch",
      model: "groq/compound-mini",
      prompt:
        "Draft a very short WhatsApp message to my family telling them I need assistance immediately.",
      speech: { "en-IN": "Send WhatsApp", "hi-IN": "व्हाट्सएप भेजें" },
    },
    {
      label: "Local Safety Alerts",
      description: "Weather, traffic",
      icon: Radio,
      badge: "Emergency",
      action: "internet:fetch",
      model: "groq/compound",
      prompt:
        "Search the web and tell me if there are any important local safety alerts, weather alerts, traffic alerts, crime alerts, or public notices for Prayagraj today.",
      speech: {
        "en-IN": "Local Safety Alerts",
        "hi-IN": "स्थानीय सुरक्षा अलर्ट",
      },
    },
    {
      label: "Government Schemes",
      description: "Disability benefits",
      icon: ShieldAlert,
      badge: "Help",
      action: "internet:fetch",
      model: "groq/compound",
      prompt:
        "Search the web and tell me useful government schemes, disability benefits, or support available for disabled people in India.",
      speech: { "en-IN": "Government Schemes", "hi-IN": "सरकारी योजनाएं" },
    },
    {
      label: "Go Back",
      description: "Return to categories",
      icon: ChevronLeft,
      badge: "Nav",
      action: "internet:back",
      speech: { "en-IN": "Go Back", "hi-IN": "पीछे जाएँ" },
    },
  ],
};

const EogWaveform = () => {
  return (
    <div className="relative h-12 w-full overflow-hidden opacity-80 mt-2">
      <motion.svg
        viewBox="0 0 500 50"
        className="absolute inset-0 h-full w-[200%]"
        initial={{ x: 0 }}
        animate={{ x: "-50%" }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        preserveAspectRatio="none"
      >
        <path
          d="M0,25 C20,25 30,10 40,25 C50,40 60,25 70,25 C80,25 90,5 100,25 C110,45 120,25 130,25 C140,25 150,15 160,25 C170,35 180,25 190,25 C200,25 210,5 220,25 C230,45 240,25 250,25 C270,25 280,10 290,25 C300,40 310,25 320,25 C330,25 340,5 350,25 C360,45 370,25 380,25 C390,25 400,15 410,25 C420,35 430,25 440,25 C450,25 460,5 470,25 C480,45 490,25 500,25"
          fill="none"
          stroke="url(#wave-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="wave-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="50%" stopColor="rgba(255,255,255,1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
        </defs>
      </motion.svg>
    </div>
  );
};

export default function NeuroTalkDashboard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<
    "care" | "talk" | "games" | "internet" | "ide" | "art" | "data" | "income" | "ai_chat" | "design" | "web" | "cyber" | "caretaker_cyber" | "chess" | "debate" | "news-quiz" | "youtube" | "blink-agent" | "whatsapp-blink" | "neurolab"
  >("care");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [internetResponse, setInternetResponse] = useState<string | null>(null);
  const [isFetchingInternet, setIsFetchingInternet] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [status, setStatus] = useState("Standby");
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [arduinoState, setArduinoState] = useState("Not Connected");
  const [relayState, setRelayState] = useState("Relay Disconnected");
  const [progress, setProgress] = useState(0);
  const [activeGame, setActiveGame] = useState<GameType | "dino" | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en-IN");
  const [isSelectingMode, setIsSelectingMode] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const appRef = useRef<HTMLElement | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null,
  );

  const board = useMemo(() => {
    let currentBoard = careMessages;
    if (isSelectingMode) {
      currentBoard = [
        {
          label: "Care Mode",
          description: "Basic Needs",
          icon: HeartPulse,
          badge: "Mode",
          action: "mode:care",
          speech: { "en-IN": "Care Mode" },
        },
        {
          label: "Internet Board",
          description: "News & Web",
          icon: Globe,
          badge: "Mode",
          action: "mode:internet",
          speech: { "en-IN": "Internet Board" },
        },
        {
          label: "Normal Talk",
          description: "General Chat",
          icon: MessageSquare,
          badge: "Mode",
          action: "mode:talk",
          speech: { "en-IN": "Normal Talk" },
        },
        {
          label: "Games",
          description: "Play Games",
          icon: Gamepad2,
          badge: "Mode",
          action: "mode:games",
          speech: { "en-IN": "Games" },
        },
        {
          label: "BlinkCoding",
          description: "Code Editor",
          icon: Terminal,
          badge: "Mode",
          action: "mode:ide",
          speech: { "en-IN": "Blink Coding" },
        },
        {
          label: "BlinkArtist",
          description: "Image Generator",
          icon: Paintbrush,
          badge: "Mode",
          action: "mode:art",
          speech: { "en-IN": "Blink Artist" },
        },
        {
          label: "Blink Income AI",
          description: "Your digital agency",
          icon: Database,
          badge: "Mode",
          action: "mode:income",
          speech: { "en-IN": "Blink Income A I" },
        },
        {
          label: "BlinkDesign Studio",
          description: "Infinite Canva",
          icon: Palette,
          badge: "Mode",
          action: "mode:design",
          speech: { "en-IN": "Blink Design Studio" },
        },
        {
          label: "BlinkWeb Studio",
          description: "AI Web Builder",
          icon: Globe,
          badge: "Mode",
          action: "mode:web",
          speech: { "en-IN": "Blink Web Studio" },
        },
        {
          label: "BlinkCyber Shield",
          description: "Cyber Hygiene Audit",
          icon: ShieldCheck,
          badge: "Mode",
          action: "mode:cyber",
          speech: { "en-IN": "Blink Cyber Shield" },
        },
        {
          label: "Caretaker Cyber Targets",
          description: "Manage Cyber Targets",
          icon: ShieldCheck,
          badge: "Caretaker",
          action: "mode:caretaker_cyber",
          speech: { "en-IN": "Caretaker Cyber Targets" },
        },
        {
          label: "BlinkChess AI Pro",
          description: "Play world-class chess",
          icon: ShieldCheck,
          badge: "Game",
          action: "mode:chess",
          speech: { "en-IN": "Blink Chess AI Pro" },
        },
        {
          label: "BlinkDebate Arena",
          description: "Debate with one blink",
          icon: ShieldCheck,
          badge: "Game",
          action: "mode:debate",
          speech: { "en-IN": "Blink Debate Arena" },
        },
        {
          label: "BlinkAgent Builder",
          description: "Build AI agents with one blink",
          icon: Brain,
          badge: "Mode",
          action: "mode:blink-agent",
          speech: { "en-IN": "Blink Agent Builder" },
        },
        {
          label: "Blink WhatsApp",
          description: "Hands-free WhatsApp",
          icon: MessageSquare,
          badge: "App",
          action: "mode:whatsapp-blink",
          speech: { "en-IN": "Blink WhatsApp" },
        },
        {
          label: "Cancel",
          description: "Go Back",
          icon: ChevronLeft,
          badge: "Nav",
          action: "mode:cancel",
          speech: { "en-IN": "Cancel" },
        },
      ] as any;
    } else {
      if (mode === "ai_chat") currentBoard = aiChatMessages;
      else if (mode === "talk") currentBoard = talkMessages;
      else if (mode === "games") currentBoard = gameMessages;
      else if (mode === "internet") {
        currentBoard = selectedCategory
          ? internetOptionsMap[selectedCategory]
          : internetCategories;
      }
      currentBoard = [
        ...currentBoard,
        {
          label: "Switch App Mode",
          description: "Change Tab",
          icon: LayoutDashboard,
          badge: "Nav",
          action: "switch_mode",
          speech: { "en-IN": "Switch App Mode" },
        } as any,
      ];
    }
    return currentBoard;
  }, [mode, isSelectingMode, selectedCategory]);

  const activeMessage = board[activeIndex] || board[0];

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;
      const allVoices = window.speechSynthesis.getVoices();

      const langPrefix = language.split("-")[0];
      let filtered = allVoices.filter(
        (v) =>
          v.lang.startsWith(langPrefix) ||
          v.lang.replace("_", "-").startsWith(langPrefix),
      );

      if (language === "bn-IN" && filtered.length === 0) {
        filtered = allVoices.filter(
          (v) =>
            v.name.toLowerCase().includes("bengali") ||
            v.name.includes("বাংলা"),
        );
      }

      setAvailableVoices(filtered);

      if (filtered.length > 0) {
        if (
          !selectedVoiceURI ||
          !filtered.some((v) => v.voiceURI === selectedVoiceURI)
        ) {
          let best = filtered[0];
          
          // Look for premium Google voices or hi-IN first as the top global default
          const premiumVoice = allVoices.find(v => v.lang.includes("hi-IN") && v.name.includes("Google"))
                            || allVoices.find(v => v.lang.includes("en-IN") && v.name.includes("Google"))
                            || filtered.find(v => v.lang.includes("hi-IN"));
                            
          if (premiumVoice) {
            best = premiumVoice;
            // Ensure this premium voice is included in the dropdown if it wasn't already
            if (!filtered.some(v => v.voiceURI === premiumVoice.voiceURI)) {
              filtered.unshift(premiumVoice);
              setAvailableVoices(filtered);
            }
          } else if (language === "en-IN") {
            // Fallback
            const preferred = filtered.find(
              (v) =>
                v.name.toLowerCase().includes("heera") ||
                v.name.toLowerCase().includes("neerja") ||
                v.name.toLowerCase().includes("aditi") ||
                (v.lang === "en-IN" && v.name.toLowerCase().includes("female")),
            );
            if (preferred) best = preferred;
          }
          setSelectedVoiceURI(best.voiceURI);
        }
      } else {
        setSelectedVoiceURI("");
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [language, selectedVoiceURI]);

  const speakText = useCallback(
    (textToSpeak: string) => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = language;

        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = voices.find((v) => v.voiceURI === selectedVoiceURI);

        if (!selectedVoice) {
          if (language === "en-IN") {
            selectedVoice =
              voices.find(
                (v) =>
                  v.name.toLowerCase().includes("heera") ||
                  v.name.toLowerCase().includes("neerja") ||
                  v.name.toLowerCase().includes("aditi") ||
                  (v.lang === "en-IN" &&
                    v.name.toLowerCase().includes("female")),
              ) || voices.find((v) => v.lang === "en-IN" || v.lang === "en_IN");
          } else {
            selectedVoice = voices.find(
              (v) =>
                v.lang === language || v.lang.replace("_", "-") === language,
            );
          }

          if (!selectedVoice) {
            const langPrefix = language.split("-")[0];
            selectedVoice = voices.find((v) => v.lang.startsWith(langPrefix));
          }
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    },
    [language, selectedVoiceURI],
  );

  const speak = useCallback(
    (message: Message) => {
      const textToSpeak =
        message.speech[language] || message.speech["en-IN"] || "";
      speakText(textToSpeak as string);
    },
    [language, speakText],
  );

  const activateMessage = useCallback(
    async (index: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      setProgress(100);
      const message = board[index];
      setActiveIndex(index);

      if (message.action === "switch_mode") {
        setIsSelectingMode(true);
        setActiveIndex(0);
        return;
      } else if (message.action?.startsWith("mode:")) {
        const newMode = message.action.split(":")[1];
        if (newMode !== "cancel") {
          setMode(newMode as any);
          setSelectedCategory(null);
          setInternetResponse(null);
        }
        setIsSelectingMode(false);
        setActiveIndex(0);
        return;
      } else if (message.action === "open_keyboard") {
        setIsKeyboardOpen(true);
        return;
      } else if (message.action === "internet:category") {
        setSelectedCategory(message.categoryId || null);
        setActiveIndex(0);
        return;
      } else if (message.action === "internet:back") {
        setSelectedCategory(null);
        setActiveIndex(0);
        setInternetResponse(null);
        return;
      } else if (message.action === "internet:fetch") {
        setSpeakingIndex(index);
        setStatus("Fetching from Internet...");
        setIsFetchingInternet(true);
        setInternetResponse(null);

        try {
          const res = await fetch("/api/groq", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: message.prompt,
              model: message.model,
              language,
            }),
          });
          if (!res.ok) throw new Error("Failed to fetch from Groq API");
          const data = await res.json();
          if (data.reply) {
            setInternetResponse(data.reply);
            speakText(data.reply);
            setStatus("Speaking");
          } else {
            setInternetResponse("Failed to fetch data.");
            speakText("Failed to fetch data.");
            setStatus("Error");
          }
        } catch (e) {
          setInternetResponse("Error fetching data.");
          speakText("Error fetching data.");
          setStatus("Error");
        }
        setIsFetchingInternet(false);
        window.setTimeout(() => {
          setSpeakingIndex(null);
          setProgress(0);
        }, 1500);
        return;
      }

      setSpeakingIndex(index);
      setStatus("Speaking");

      speak(message);

      window.setTimeout(() => {
        setSpeakingIndex(null);
        setProgress(0);
        if (message.action && message.action.startsWith("game:")) {
          setActiveGame(message.action.split(":")[1] as GameType | "dino");
        }
      }, 1500);

      if (message.action === "relay" && writerRef.current) {
        await writerRef.current.write(new TextEncoder().encode(RELAY_COMMAND));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, speak, speakText],
  );

  const scheduleSelect = useCallback(
    (index: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);

      setProgress(0);
      let startTime = Date.now();

      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min((elapsed / AUTO_SELECT_MS) * 100, 100);
        setProgress(p);
      }, 50);

      timerRef.current = window.setTimeout(
        () => activateMessage(index),
        AUTO_SELECT_MS,
      );
    },
    [activateMessage],
  );

  const audioCtxRef = useRef<any>(null);

  const playMoveSound = useCallback((index: number) => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        audioCtxRef.current = new AudioContext();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Beautiful Pentatonic Scale (C major pentatonic frequencies)
      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
      const freq = pentatonic[index % pentatonic.length];

      // Soft Marimba / Xylophone sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      // Gentle, musical attack and soft release
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Ignore
    }
  }, []);

  const moveNext = useCallback(() => {
    setActiveIndex((current) => {
      // Clear internet response on move
      setInternetResponse(null);
      const next = (current + 1) % board.length;
      setStatus("Blink detected");
      playMoveSound(next);
      scheduleSelect(next);
      return next;
    });
  }, [board.length, scheduleSelect, playMoveSound]);

  const connectEOGArduino = async () => {
    const serialNavigator = navigator as NavigatorWithSerial;
    if (!serialNavigator.serial) {
      setArduinoState("Unsupported");
      return;
    }
    try {
      const port = await serialNavigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setArduinoState("EOG Arduino Ready");
      setStatus("Listening for Blinks...");

      const reader = port.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim().toUpperCase() === "BLINK") {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    code: "Space",
                    bubbles: true,
                  }),
                );
              }
            }
          }
        } catch (e) {
          console.error("Serial error:", e);
          setArduinoState("Not Connected");
        }
      })();
    } catch {
      setArduinoState("Connection Failed");
    }
  };

  const connectRelay = async () => {
    const serialNavigator = navigator as NavigatorWithSerial;
    if (!serialNavigator.serial) {
      setRelayState("Unsupported");
      return;
    }
    try {
      const port = await serialNavigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      writerRef.current = port.writable.getWriter();
      setRelayState("Relay Connected");
    } catch {
      setRelayState("Relay Failed");
    }
  };

  const lastBlinkTimeRef = useRef<number>(0);

  const handleCustomQuery = async (query: string) => {
    setIsKeyboardOpen(false);
    setStatus("Fetching custom query...");
    setIsFetchingInternet(true);
    setInternetResponse(null);

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          model: "llama3-8b-8192",
          language,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch from Groq API");
      const data = await res.json();
      if (data.reply) {
        setInternetResponse(data.reply);
        speakText(data.reply);
        setStatus("Speaking");
      } else {
        setInternetResponse("Failed to fetch data.");
        speakText("Failed to fetch data.");
        setStatus("Error");
      }
    } catch (e) {
      setInternetResponse("Error fetching data.");
      speakText("Error fetching data.");
      setStatus("Error");
    }
    setIsFetchingInternet(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        isKeyboardOpen ||
        event.code !== "Space" ||
        activeGame !== null ||
        mode === "ide" ||
        mode === "art" ||
        mode === "data" ||
        mode === "income" ||
        mode === "design" ||
        mode === "web" ||
        mode === "cyber" ||
        mode === "chess" ||
        mode === "debate" ||
        mode === "news-quiz" ||
        mode === "youtube" ||
        mode === "caretaker_cyber" ||
        mode === "blink-agent" ||
        mode === "whatsapp-blink" ||
        mode === "neurolab"
      )
        return;
      event.preventDefault();
      moveNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveNext, activeGame, mode, isKeyboardOpen]);

  useEffect(() => {
    const activeBtn = document.getElementById(`board-btn-${activeIndex}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <main
      ref={appRef}
      tabIndex={-1}
      className="fixed inset-0 w-full h-screen text-slate-800 overflow-hidden font-sans outline-none"
      style={{
        background:
          "linear-gradient(135deg, #F8FBFF 0%, #EEF5FF 50%, #F5FAFF 100%)",
      }}
    >
      <div className="mx-auto flex h-full w-full flex-col gap-4 px-6 lg:px-12 py-6">
        {/* Premium Header Segment */}
        <header className="flex flex-col xl:flex-row xl:items-start xl:justify-between shrink-0 mb-4 gap-6">
          <div className="flex flex-col shrink-0 pt-2">
            <div className="flex items-center gap-4 mb-1.5">
              <motion.div
                animate={{ scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="bg-white/90 p-3 rounded-[20px] shadow-[0_8px_30px_rgba(15,76,129,0.12)] border border-white backdrop-blur-md"
              >
                <Stethoscope className="text-blue-600 h-8 w-8" />
              </motion.div>
              <motion.h1
                className="text-5xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#0F4C81] via-[#3B82F6] to-[#00C2FF] drop-shadow-sm"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: "200% 200%" }}
              >
                ParaTalk
              </motion.h1>
            </div>
            <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-500 ml-[72px]">
              EOG Based System
            </h2>
          </div>

          {/* Controls Segment */}
          <div className="flex flex-col items-start xl:items-end gap-3 z-20">
            {/* Top Row: Language, Guide, Utilities */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Language Dropdown */}
              <div className="flex p-1.5 rounded-[20px] bg-white/80 shadow-[0_8px_30px_rgba(15,76,129,0.08)] border border-white backdrop-blur-2xl">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                  className="px-4 py-2 bg-transparent text-[15px] font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">Hindi (हिन्दी)</option>
                  <option value="bn-IN">Bengali (বাংলা)</option>
                  <option value="mr-IN">Marathi (मराठी)</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                </select>
              </div>

              {/* Voice Dropdown */}
              {availableVoices.length > 0 && (
                <div className="flex p-1.5 rounded-[20px] bg-white/80 shadow-[0_8px_30px_rgba(15,76,129,0.08)] border border-white backdrop-blur-2xl">
                  <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="px-4 py-2 bg-transparent text-[14px] font-bold text-slate-700 outline-none cursor-pointer max-w-[150px] md:max-w-[200px] truncate"
                  >
                    {availableVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <ElectrodeGuide />

              {/* Utility Buttons */}
              <div className="flex items-center gap-2 p-2 rounded-[24px] bg-white/90 shadow-[0_8px_30px_rgba(15,76,129,0.12)] border border-white backdrop-blur-2xl hidden md:flex">
                <button
                  onClick={connectEOGArduino}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-[18px] text-[14px] font-black transition-all ${arduinoState === "EOG Arduino Ready" ? "bg-emerald-100 text-emerald-950 shadow-sm" : "bg-emerald-50/50 text-emerald-900 hover:bg-emerald-100/80"}`}
                >
                  <Eye
                    className={`h-5 w-5 ${arduinoState === "EOG Arduino Ready" ? "text-emerald-600 drop-shadow-md" : "text-emerald-500"}`}
                  />
                  <span className="hidden lg:inline">
                    {arduinoState === "EOG Arduino Ready"
                      ? "EOG Ready"
                      : "Connect EOG"}
                  </span>
                </button>
                <div className="w-[2px] h-6 bg-slate-200/80 rounded-full" />
                <button
                  onClick={connectRelay}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-[18px] text-[14px] font-black transition-all ${relayState === "Relay Connected" ? "bg-blue-100 text-blue-950 shadow-sm" : "bg-blue-50/50 text-blue-900 hover:bg-blue-100/80"}`}
                >
                  <Smartphone
                    className={`h-5 w-5 ${relayState === "Relay Connected" ? "text-blue-600 drop-shadow-md" : "text-blue-500"}`}
                  />
                  <span className="hidden lg:inline">
                    {relayState === "Relay Connected"
                      ? "Relay Ready"
                      : "Connect Relay"}
                  </span>
                </button>
                <div className="w-[2px] h-6 bg-slate-200/80 rounded-full" />
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-[18px] text-[14px] font-black bg-purple-100/80 text-purple-950 shadow-sm">
                  <Mic className="h-5 w-5 text-purple-600 drop-shadow-md" />
                  <span className="hidden lg:inline">Voice Active</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Mode Selectors */}
            <div className="flex flex-wrap justify-center gap-1 p-1 rounded-[24px] bg-white/90 shadow-[0_8px_30px_rgba(15,76,129,0.12)] border border-white backdrop-blur-2xl">
              <button
                onClick={() => {
                  setMode("care");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "care" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "care" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-blue-100/80 via-indigo-100/80 to-purple-100/80 rounded-[18px] shadow-[0_2px_15px_rgba(59,130,246,0.15)] border border-blue-200 z-[-1]"
                  />
                )}
                Care
              </button>
              <button
                onClick={() => {
                  setMode("internet");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "internet" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "internet" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-100/80 via-teal-100/80 to-cyan-100/80 rounded-[18px] shadow-[0_2px_15px_rgba(16,185,129,0.15)] border border-emerald-200 z-[-1]"
                  />
                )}
                Internet
              </button>
              <button
                onClick={() => {
                  setMode("talk");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "talk" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "talk" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-orange-100/80 via-amber-100/80 to-yellow-100/80 rounded-[18px] shadow-[0_2px_15px_rgba(245,158,11,0.15)] border border-orange-200 z-[-1]"
                  />
                )}
                Talk
              </button>
              <button
                onClick={() => {
                  setMode("games");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "games" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "games" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-rose-100/80 via-pink-100/80 to-fuchsia-100/80 rounded-[18px] shadow-[0_2px_15px_rgba(225,29,72,0.15)] border border-rose-200 z-[-1]"
                  />
                )}
                Games
              </button>
              <button
                onClick={() => {
                  setMode("ide");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "ide" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "ide" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-slate-200/80 via-slate-300/80 to-slate-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(100,116,139,0.15)] border border-slate-300 z-[-1]"
                  />
                )}
                Coding
              </button>

              <button
                onClick={() => {
                  setMode("income");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "income" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "income" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-200/80 via-green-300/80 to-teal-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(16,185,129,0.15)] border border-emerald-300 z-[-1]"
                  />
                )}
                Income AI
              </button>
              <button
                onClick={() => {
                  setMode("design");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "design" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "design" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-pink-200/80 via-purple-300/80 to-pink-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(236,72,153,0.15)] border border-pink-300 z-[-1]"
                  />
                )}
                Design
              </button>
              <button
                onClick={() => {
                  setMode("web");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "web" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "web" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-200/80 via-teal-300/80 to-emerald-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(16,185,129,0.15)] border border-emerald-300 z-[-1]"
                  />
                )}
                Web Studio
              </button>
              <button
                onClick={() => {
                  setMode("cyber");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "cyber" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "cyber" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-200/80 via-teal-300/80 to-emerald-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(16,185,129,0.15)] border border-emerald-300 z-[-1]"
                  />
                )}
                Cyber Shield
              </button>
              <button
                onClick={() => {
                  setMode("chess");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "chess" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "chess" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-amber-200/80 via-yellow-300/80 to-orange-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(251,191,36,0.15)] border border-amber-300 z-[-1]"
                  />
                )}
                Chess AI
              </button>
              <button
                onClick={() => {
                  setMode("debate");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "debate" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "debate" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-orange-200/80 via-red-300/80 to-rose-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(244,63,94,0.15)] border border-rose-300 z-[-1]"
                  />
                )}
                Debate Arena
              </button>
              <button
                onClick={() => {
                  setMode("news-quiz");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "news-quiz" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "news-quiz" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-200/80 via-teal-300/80 to-cyan-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(20,184,166,0.15)] border border-teal-300 z-[-1]"
                  />
                )}
                News Quiz
              </button>
              <button
                onClick={() => {
                  setMode("youtube");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "youtube" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "youtube" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-red-200/80 via-red-300/80 to-red-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(239,68,68,0.15)] border border-red-300 z-[-1]"
                  />
                )}
                YouTube
              </button>
              <button
                onClick={() => {
                  setMode("blink-agent");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current)
                    window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "blink-agent" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "blink-agent" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-purple-200/80 via-fuchsia-300/80 to-purple-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(168,85,247,0.15)] border border-purple-300 z-[-1]"
                  />
                )}
                Agent Builder
              </button>
              <button
                onClick={() => {
                  setMode("whatsapp-blink");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current) window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "whatsapp-blink" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "whatsapp-blink" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-green-200/80 via-emerald-300/80 to-green-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(16,185,129,0.15)] border border-green-300 z-[-1]"
                  />
                )}
                WhatsApp
              </button>
              <button
                onClick={() => {
                  setMode("neurolab");
                  setActiveIndex(0);
                  setProgress(0);
                  setSelectedCategory(null);
                  setInternetResponse(null);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                  if (intervalRef.current) window.clearInterval(intervalRef.current);
                }}
                className={`relative px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-[12px] font-black rounded-[18px] transition-all z-10 ${mode === "neurolab" ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                {mode === "neurolab" && (
                  <motion.div
                    layoutId="modeTab"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-200/80 via-purple-300/80 to-pink-400/80 rounded-[18px] shadow-[0_2px_15px_rgba(99,102,241,0.15)] border border-indigo-300 z-[-1]"
                  />
                )}
                Neuro Lab
              </button>
            </div>
          </div>
        </header>

        {/* Premium Hero Card */}
        {mode !== "ide" && mode !== "art" && mode !== "income" && mode !== "design" && mode !== "web" && mode !== "blink-agent" && (
          <section className="relative w-full rounded-[32px] p-[2px] overflow-hidden shrink-0">
            {/* Animated Gradient Border Layer */}
            <motion.div
              className="absolute inset-0 z-0 bg-gradient-to-r from-[#0F4C81] via-[#00C2FF] to-[#4ADE80]"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: "200% 200%" }}
            />

            {/* Inner Glass Card */}
            <div
              className="relative z-10 flex flex-col md:flex-row items-center gap-6 rounded-[30px] p-5 md:p-6 md:px-8"
              style={{
                background: "rgba(15, 76, 129, 0.85)",
                backdropFilter: "blur(40px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              {/* Floating Avatar */}
              <motion.div
                animate={{ y: [-5, 5, -5] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative shrink-0 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-white/20 to-white/5 border border-white/20 shadow-[0_0_40px_rgba(0,194,255,0.3)]"
              >
                <div className="text-5xl">🙂</div>
                <div className="absolute -bottom-3 bg-[#4ADE80] text-[#064E3B] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg border border-[#4ADE80]/50">
                  Ready
                </div>
              </motion.div>

              {/* Selection Text */}
              <div className="flex-1 text-white">
                <p className="text-sm font-semibold text-white/60 uppercase tracking-[0.2em] mb-2">
                  {mode === "internet" && selectedCategory
                    ? "Internet Board"
                    : "Current Selection"}
                </p>

                {isFetchingInternet ? (
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">
                      Fetching from Internet...
                    </h2>
                  </div>
                ) : internetResponse ? (
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl md:text-3xl font-bold tracking-tight drop-shadow-md bg-black/20 p-4 rounded-2xl border border-white/10"
                  >
                    &quot;{internetResponse}&quot;
                  </motion.h2>
                ) : (
                  <h2 className="text-5xl md:text-6xl font-black tracking-tight drop-shadow-md">
                    {activeMessage?.label || ""}
                  </h2>
                )}
              </div>

              {/* Live Status */}
              <div className="flex flex-col items-end w-full md:w-auto">
                <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                  <div className="h-2 w-2 rounded-full bg-[#4ADE80] animate-pulse" />
                  <span className="text-sm font-bold text-white/90">
                    Confidence: 98%
                  </span>
                </div>
                <p className="text-xs font-medium text-white/50 mt-2 mr-2">
                  {status}
                </p>
                <EogWaveform />
              </div>
            </div>
          </section>
        )}

        {/* Communication Grid */}
        {mode === "ide" ? (
          <BlinkIDE isActive={true} onExit={() => setMode("care")} />
        ) : mode === "art" ? (
          <BlinkArt isActive={true} onExit={() => setMode("care")} />
        ) : mode === "income" ? (
          <BlinkIncomeHub isActive={true} onExit={() => setMode("care")} />
        ) : mode === "design" ? (
          <BlinkDesignStudio isActive={true} onExit={() => setMode("care")} />
        ) : mode === "web" ? (
          <BlinkWebStudio isActive={true} onExit={() => setMode("care")} />
        ) : mode === "cyber" ? (
          <BlinkCyberShield isActive={true} onExit={() => setMode("care")} speak={speakText} />
        ) : mode === "caretaker_cyber" ? (
          <div className="fixed inset-0 z-[100] bg-slate-900">
            <CaretakerCyberTargets onExit={() => setMode("care")} />
          </div>
        ) : mode === "chess" ? (
          <div className="fixed inset-0 z-[100] bg-[#0A0505]">
            <BlinkChessAIPro isActive={true} onExit={() => setMode("care")} speak={speakText} />
          </div>
        ) : mode === "debate" ? (
          <div className="fixed inset-0 z-[100] bg-slate-950">
            <BlinkDebateArena isActive={true} onExit={() => setMode("care")} speak={speakText} />
          </div>
        ) : mode === "news-quiz" ? (
          <div className="fixed inset-0 z-[100] bg-slate-950">
            <BlinkCurrentAffairs 
              language={language}
              speak={speakText} 
              playSound={(type) => {
                if (type === 'switch') playMoveSound(0);
                else if (type === 'select' || type === 'success') playMoveSound(3);
                else if (type === 'error') playMoveSound(5);
              }} 
            />
            {/* Minimal exit button over the full-screen UI */}
            <button
              onClick={() => setMode("care")}
              className="absolute top-6 left-6 z-[110] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          </div>
        ) : mode === "youtube" ? (
          <BlinkYouTube onExit={() => setMode("care")} />
        ) : mode === "blink-agent" ? (
          <div className="fixed inset-0 z-[100] bg-black">
            <BlinkAgentBuilder onExit={() => setMode("care")} />
          </div>
        ) : mode === "whatsapp-blink" ? (
          <div className="fixed inset-0 z-[100] bg-slate-900 p-4 pt-16">
            <WhatsAppBlinkAssist onClose={() => setMode("care")} />
            <button
              onClick={() => setMode("care")}
              className="absolute top-6 left-6 z-[110] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          </div>
        ) : mode === "neurolab" ? (
          <div className="fixed inset-0 z-[100] bg-slate-950 overflow-y-auto">
            <NeuroLab onExit={() => setMode("care")} />
          </div>
        ) : (
          <section
            className={`grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 flex-1 pb-2 ${
              board.length > 16 ? "overflow-y-auto min-h-0" : "min-h-0"
            }`}
            style={{
              gridTemplateRows: board.length <= 16 ? `repeat(${Math.ceil(board.length / 4)}, minmax(0, 1fr))` : undefined,
              gridAutoRows: board.length > 16 ? "minmax(120px, 1fr)" : undefined,
            }}
          >
            {board.map((message, index) => {
              const isActive = index === activeIndex;
              const isSpeaking = index === speakingIndex;
              const Icon = message.icon;

              // Determine styling based on emergency status
              const defaultBg = message.isEmergency
                ? "linear-gradient(135deg, rgba(255,245,245,0.85), rgba(255,232,232,0.85))"
                : "rgba(255,255,255,0.85)";

              const borderColor = message.isEmergency
                ? "rgba(255,180,180,0.6)"
                : "rgba(255,255,255,0.8)";
              const textAccent = message.isEmergency
                ? "text-red-600"
                : "text-blue-600";
              const badgeBg = message.isEmergency
                ? "bg-red-100/90 text-red-700 border-red-200"
                : "bg-blue-100/90 text-blue-800 border-blue-300";

              return (
                <motion.button
                  id={`board-btn-${index}`}
                  key={message.label}
                  type="button"
                  whileHover={{
                    y: -6,
                    scale: 1.02,
                    boxShadow: message.isEmergency
                      ? "0 20px 40px rgba(220,38,38,0.15), 0 0 45px rgba(220,38,38,0.3)"
                      : "0 20px 40px rgba(59,130,246,0.15), 0 0 45px rgba(59,130,246,0.3)",
                    transition: { duration: 0.3, ease: "easeOut" },
                  }}
                  onClick={() => activateMessage(index)}
                  className="relative flex flex-col items-center justify-center p-2 lg:p-3 text-center outline-none h-full overflow-hidden shrink-0"
                  style={{
                    background: defaultBg,
                    backdropFilter: "blur(24px)",
                    border: `1px solid ${borderColor}`,
                    borderRadius: "28px",
                    boxShadow: isActive
                      ? "0 0 0 2px #3B82F6, 0 0 40px rgba(59,130,246,0.35)"
                      : "0 10px 40px rgba(15,76,129,0.06)",
                  }}
                >
                  {/* Active Pulse Animation Layer */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-[28px] border-[3px] border-blue-500"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                  )}

                  {/* Badge absolutely positioned top right */}
                  <div className="absolute top-2 right-2 lg:top-3 lg:right-3 z-10">
                    <span
                      className={`text-[8px] lg:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeBg} shadow-sm`}
                    >
                      {message.badge}
                    </span>
                  </div>

                  {/* Icon Centered */}
                  <motion.div
                    animate={
                      isActive
                        ? { scale: 1.15, color: "#3B82F6" }
                        : { scale: 1 }
                    }
                    className={`p-2 lg:p-2.5 rounded-[16px] bg-white shadow-sm border border-white/60 ${textAccent} mb-1`}
                  >
                    <Icon strokeWidth={2.5} className="h-6 w-6 lg:h-8 lg:w-8" />
                  </motion.div>

                  {/* Text Centered */}
                  <div className="relative z-10 w-full shrink-0 px-1">
                    <h3 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight leading-tight">
                      {message.label}
                    </h3>
                    <p className="text-[10px] lg:text-xs font-semibold text-slate-500 truncate w-full">
                      {message.description}
                    </p>
                  </div>

                  {/* Progress / Countdown Indicator - absolute bottom right */}
                  {isActive && (
                    <div className="absolute bottom-2 right-2 lg:bottom-3 lg:right-3 flex items-center gap-1.5 bg-white/80 p-1 rounded-lg shadow-sm backdrop-blur-md border border-slate-100">
                      <div className="text-right">
                        <p className="text-[8px] lg:text-[9px] font-bold text-blue-600 uppercase tracking-widest leading-none">
                          Auto-select
                        </p>
                        <p className="text-[10px] lg:text-[11px] font-black text-slate-900 leading-none mt-0.5">
                          {(
                            (AUTO_SELECT_MS -
                              (progress / 100) * AUTO_SELECT_MS) /
                            1000
                          ).toFixed(1)}
                          s
                        </p>
                      </div>
                      <div className="relative h-5 w-5 lg:h-6 lg:w-6">
                        <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            stroke="rgba(59,130,246,0.15)"
                            strokeWidth="4"
                            fill="none"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            stroke="#3B82F6"
                            strokeWidth="4"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray="94"
                            strokeDashoffset={94 - (94 * progress) / 100}
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Speaking Ripple */}
                  <AnimatePresence>
                    {isSpeaking && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0.8 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0 bg-blue-400/20 rounded-[28px] pointer-events-none"
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </section>
        )}
      </div>

      <AnimatePresence>
        {activeGame === "dino" && (
          <DinoGame onClose={() => setActiveGame(null)} />
        )}
        {activeGame && activeGame !== "dino" && (
          <GameEngine
            game={activeGame as GameType}
            onClose={() => setActiveGame(null)}
          />
        )}
      </AnimatePresence>

      {/* Debuggers Squad Branding */}
      <div className="absolute bottom-4 right-6 flex items-center gap-3 z-40 opacity-80 hover:opacity-100 transition-opacity">
        <span className="text-sm font-bold text-slate-500 tracking-wide">
          Made by
        </span>
        <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl px-4 py-1.5 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-white/50">
          <svg viewBox="0 0 100 100" className="h-6 w-6 drop-shadow-md">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="100%" stopColor="#0057FF" />
              </linearGradient>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF007A" />
                <stop offset="100%" stopColor="#7000FF" />
              </linearGradient>
              <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFB800" />
                <stop offset="100%" stopColor="#FF003D" />
              </linearGradient>
            </defs>
            <path
              d="M 40 20 L 10 50 L 40 80"
              fill="none"
              stroke="url(#grad1)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 60 15 L 40 85"
              fill="none"
              stroke="url(#grad2)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 65 20 L 95 50 L 65 80"
              fill="none"
              stroke="url(#grad3)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#FF007A] to-[#7000FF]">
            Debuggers Squad
          </span>
        </div>
      </div>

      <BlinkKeyboard 
        isActive={isKeyboardOpen} 
        onClose={() => setIsKeyboardOpen(false)}
        onSubmit={handleCustomQuery}
      />
    </main>
  );
}
