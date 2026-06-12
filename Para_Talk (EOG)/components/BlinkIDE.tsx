"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Code, Terminal, Rocket, Bot, Database, Cpu, Settings, 
  Layout, Gamepad, Calculator, Cloud, MessageSquare, 
  Mic, Activity, Newspaper, Folder, FileText, FileSearch, 
  Stethoscope, BookOpen, Bug, Play, Save, Globe,
  Moon, Sun, Zap, Droplet, Flame, Eye, Maximize, Minimize, Palette
} from "lucide-react";

type IDEState = 
  | "MAIN_MENU" 
  | "CREATE_SOFTWARE_TYPE" 
  | "CREATE_SOFTWARE_PROJECT" 
  | "CREATE_SOFTWARE_AESTHETIC"
  | "CREATE_SOFTWARE_STYLE" 
  | "PROMPT_ENG_CATEGORY"
  | "PROMPT_ENG_PROJECT"
  | "PROMPT_ENG_STYLE"
  | "PROMPT_ENG_VOICE"
  | "GENERATING"
  | "CODING_LOOP"
  | "CODE_RESULT"
  | "PREVIEW_WEB"
  | "DEPLOY_SUCCESS"
  | "VIRTUAL_KEYBOARD";

type MenuOption = {
  label: string;
  icon?: any;
  action?: () => void;
  nextState?: IDEState;
  value?: string;
};

const AUTO_SELECT_MS = 2000;

export default function BlinkIDE({ isActive, onExit }: { isActive: boolean, onExit: () => void }) {
  const [ideState, setIdeState] = useState<IDEState>("MAIN_MENU");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  // Prompt builder state
  const [selectedType, setSelectedType] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAesthetic, setSelectedAesthetic] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [promptCategory, setPromptCategory] = useState("");
  const [voiceOutput, setVoiceOutput] = useState("");
  
  // Generated result
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [generationStatus, setGenerationStatus] = useState("");

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Define menus
  const mainMenuOptions: MenuOption[] = [
    { label: "Create Software Mode", icon: Code, nextState: "CREATE_SOFTWARE_TYPE" },
    { label: "Prompt Engineering Mode", icon: Terminal, nextState: "PROMPT_ENG_CATEGORY" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const softwareTypes: MenuOption[] = [
    { label: "Python App", icon: Code, value: "Python App" },
    { label: "Website", icon: Globe, value: "Website" },
    { label: "AI Chatbot", icon: Bot, value: "AI Chatbot" },
    { label: "Data Science Project", icon: Database, value: "Data Science Project" },
    { label: "Arduino Project", icon: Cpu, value: "Arduino Project" },
    { label: "Automation Tool", icon: Settings, value: "Automation Tool" },
    { label: "Dashboard", icon: Layout, value: "Dashboard" },
    { label: "Mobile App UI", icon: Layout, value: "Mobile App UI" },
    { label: "Game", icon: Gamepad, value: "Game" },
    { label: "Chrome Extension", icon: Code, value: "Chrome Extension" },
    { label: "Go Back", icon: Settings, nextState: "MAIN_MENU" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const projectTypes: MenuOption[] = [
    { label: "Calculator", icon: Calculator, value: "Calculator" },
    { label: "Weather App", icon: Cloud, value: "Weather App" },
    { label: "WhatsApp Bot", icon: MessageSquare, value: "WhatsApp Bot" },
    { label: "Voice Assistant", icon: Mic, value: "Voice Assistant" },
    { label: "Medical Dashboard", icon: Activity, value: "Medical Dashboard" },
    { label: "News App", icon: Newspaper, value: "News App" },
    { label: "File Organizer", icon: Folder, value: "File Organizer" },
    { label: "PDF Reader", icon: FileText, value: "PDF Reader" },
    { label: "AI Resume Analyzer", icon: FileSearch, value: "AI Resume Analyzer" },
    { label: "Patient Care App", icon: Stethoscope, value: "Patient Care App" },
    { label: "Go Back", icon: Settings, nextState: "CREATE_SOFTWARE_TYPE" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const aestheticOptions: MenuOption[] = [
    { label: "Dark Mode (Glassmorphism)", icon: Moon, value: "Dark Mode with Glassmorphism" },
    { label: "Light Mode (Clean)", icon: Sun, value: "Light Mode and minimal" },
    { label: "Cyberpunk (Neon)", icon: Zap, value: "Cyberpunk with Neon colors" },
    { label: "Ocean (Blue Gradients)", icon: Droplet, value: "Ocean theme with blue gradients" },
    { label: "Sunset (Warm Colors)", icon: Flame, value: "Sunset theme with warm colors" },
    { label: "High Contrast (Accessible)", icon: Eye, value: "High contrast for accessibility" },
    { label: "Large Text & Buttons", icon: Maximize, value: "Large text and oversized buttons" },
    { label: "Compact & Professional", icon: Minimize, value: "Compact and professional density" },
    { label: "Go Back", icon: Settings, nextState: "CREATE_SOFTWARE_PROJECT" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const codingStyles: MenuOption[] = [
    { label: "Beginner Friendly", icon: BookOpen, value: "Beginner Friendly with simple code" },
    { label: "Professional Code", icon: Code, value: "Professional production-ready code" },
    { label: "With Comments", icon: FileText, value: "Heavily commented code" },
    { label: "Short Code", icon: Code, value: "Short and concise code" },
    { label: "Advanced Version", icon: Rocket, value: "Advanced Version with complex features" },
    { label: "With Error Handling", icon: Bug, value: "Robust code with error handling" },
    { label: "With Beautiful UI", icon: Layout, value: "With Beautiful UI and styling" },
    { label: "With Step-by-Step Explanation", icon: BookOpen, value: "With Step-by-Step Explanation" },
    { label: "Go Back", icon: Settings, nextState: "CREATE_SOFTWARE_AESTHETIC" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const promptCategories: MenuOption[] = [
    { label: "Generate Code Prompt", value: "Generate Code Prompt" },
    { label: "Fix Error Prompt", value: "Fix Error Prompt" },
    { label: "Improve UI Prompt", value: "Improve UI Prompt" },
    { label: "Add Feature Prompt", value: "Add Feature Prompt" },
    { label: "Explain Code Prompt", value: "Explain Code Prompt" },
    { label: "Convert Code Prompt", value: "Convert Code Prompt" },
    { label: "Research Prompt", value: "Research Prompt" },
    { label: "Make Report Prompt", value: "Make Report Prompt" },
    { label: "Make Presentation Prompt", value: "Make Presentation Prompt" },
    { label: "Debug Step-by-Step Prompt", value: "Debug Step-by-Step Prompt" },
    { label: "Go Back", nextState: "MAIN_MENU" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const voiceOptions: MenuOption[] = [
    { label: "With Voice Output", value: "With Voice Output" },
    { label: "Text Only", value: "Text Only" },
    { label: "Go Back", nextState: "PROMPT_ENG_STYLE" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const codingLoopOptions: MenuOption[] = [
    { label: "Run Code", icon: Play, action: () => handleCodingLoop("Run Code") },
    { label: "Type in App (Keyboard)", icon: Terminal, action: () => setIdeState("VIRTUAL_KEYBOARD") },
    { label: "Fix Code", icon: Bug, action: () => handleCodingLoop("Fix Code") },
    { label: "Explain Code", icon: BookOpen, action: () => handleCodingLoop("Explain Code") },
    { label: "Add Feature", icon: Rocket, action: () => handleCodingLoop("Add Feature") },
    { label: "Save Project", icon: Save, action: () => handleCodingLoop("Save Project") },
    { label: "Make Website", icon: Globe, action: () => handleCodingLoop("Make Website") },
    { label: "Make AI Tool", icon: Bot, action: () => handleCodingLoop("Make AI Tool") },
    { label: "Make Report", icon: FileText, action: () => handleCodingLoop("Make Report") },
    { label: "Deploy Project", icon: Rocket, action: () => handleCodingLoop("Deploy Project") },
    { label: "Back to Main Menu", icon: Settings, nextState: "MAIN_MENU" },
    { label: "Exit BlinkIDE", icon: Settings, action: onExit }
  ];

  const getCurrentOptions = (): MenuOption[] => {
    switch (ideState) {
      case "MAIN_MENU": return mainMenuOptions;
      case "CREATE_SOFTWARE_TYPE": return softwareTypes;
      case "CREATE_SOFTWARE_PROJECT": return projectTypes;
      case "CREATE_SOFTWARE_AESTHETIC": return aestheticOptions;
      case "CREATE_SOFTWARE_STYLE": return codingStyles;
      case "PROMPT_ENG_CATEGORY": return promptCategories;
      case "PROMPT_ENG_PROJECT": return projectTypes;
      case "PROMPT_ENG_STYLE": return codingStyles;
      case "PROMPT_ENG_VOICE": return voiceOptions;
      case "CODING_LOOP": return codingLoopOptions;
      case "CODE_RESULT": return [{ label: "Go Back", icon: Settings, nextState: "CODING_LOOP" }, { label: "Exit BlinkIDE", icon: Settings, action: onExit }];
      case "PREVIEW_WEB": return [
        { label: "Close Web Preview", icon: Settings, action: () => { setIdeState("CODING_LOOP"); setPreviewUrl(null); } },
        { label: "Type in App (Keyboard)", icon: Terminal, action: () => setIdeState("VIRTUAL_KEYBOARD") }
      ];
      case "DEPLOY_SUCCESS": return [{ label: "Close Deployment", icon: Settings, action: () => { setIdeState("CODING_LOOP"); setDeployUrl(null); } }];
      case "VIRTUAL_KEYBOARD": return virtualKeyboardOptions;
      default: return [];
    }
  };

  const extractCode = (text: string) => {
    const codeBlockMatch = text.match(/```(?:python|html|js|javascript|css)?\s*\n([\s\S]*?)```/i);
    if (codeBlockMatch) return codeBlockMatch[1].trim();
    const fallbackMatch = text.match(/```([\s\S]*?)```/);
    if (fallbackMatch) return fallbackMatch[1].trim();
    return text.trim();
  };

  const handleKeyboardInput = (char: string) => {
    if (previewUrl) {
      const iframe = document.getElementById("blinkide-preview-iframe") as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "keyboard", char }, "*");
        return;
      }
    }

    let input: HTMLInputElement | HTMLTextAreaElement | null = null;
    let btn: HTMLButtonElement | null = null;
    
    const previewContainer = document.getElementById("blinkide-preview-content");
    if (previewContainer) {
      input = previewContainer.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
      btn = previewContainer.querySelector("button");
    }

    if (char === "ENTER") {
      if (btn) btn.click();
      return;
    }

    if (input) {
      if (char === "BACKSPACE") {
        input.value = input.value.slice(0, -1);
      } else {
        input.value += char;
      }
      input.setAttribute('value', input.value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
    


  const virtualKeyboardOptions: MenuOption[] = [
    ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(char => ({
      label: char,
      action: () => handleKeyboardInput(char)
    })),
    ...Array.from({ length: 10 }, (_, i) => i.toString()).map(char => ({
      label: char,
      action: () => handleKeyboardInput(char)
    })),
    { label: "Space", action: () => handleKeyboardInput(" ") },
    { label: "Backspace", action: () => handleKeyboardInput("BACKSPACE") },
    { label: "Enter / Submit", icon: Play, action: () => handleKeyboardInput("ENTER") },
    { label: "Close Keyboard", icon: Settings, action: () => {
      if (previewUrl) setIdeState("PREVIEW_WEB");
      else setIdeState("CODING_LOOP");
    }}
  ];

  const currentOptions = getCurrentOptions();

  const generateCodeWithAPI = async (promptText: string) => {
    setIdeState("GENERATING");
    setGenerationStatus("Connecting to AI...");
    
    try {
      setGenerationStatus("Writing code...");
      const res = await fetch('/api/groq-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      const data = await res.json();
      if (data.reply) {
        setGeneratedCode(data.reply);
        const isWeb = selectedType.includes("Website") || selectedType.includes("UI") || selectedType.includes("Dashboard") || selectedType.includes("Extension");
        if (isWeb) {
          const code = extractCode(data.reply);
          const scriptToInject = `\n<script>\nwindow.addEventListener("message", (event) => {\n  if (event.data.type === "keyboard") {\n    const char = event.data.char;\n    const input = document.querySelector("input, textarea");\n    const btn = document.querySelector("button");\n    if (char === "ENTER" && btn) { btn.click(); return; }\n    if (input) {\n      if (char === "BACKSPACE") input.value = input.value.slice(0, -1);\n      else input.value += char;\n      input.setAttribute("value", input.value);\n      input.dispatchEvent(new Event("input", { bubbles: true }));\n      input.dispatchEvent(new Event("change", { bubbles: true }));\n    }\n  }\n});\n</script>`;
          const blob = new Blob([code + scriptToInject], { type: 'text/html' });
          setPreviewUrl(URL.createObjectURL(blob));
        }
        setIdeState("CODING_LOOP");
        setActiveIndex(0);
      } else {
        setGenerationStatus("Error generating code.");
        setTimeout(() => setIdeState("MAIN_MENU"), 2000);
      }
    } catch (e) {
      setGenerationStatus("Network Error.");
      setTimeout(() => setIdeState("MAIN_MENU"), 2000);
    }
  };

  const buildPromptAndGenerate = () => {
    let finalPrompt = "";
    const isWeb = selectedType.includes("Website") || selectedType.includes("UI") || selectedType.includes("Dashboard") || selectedType.includes("Extension");
    const constraint = isWeb ? "CRITICAL: You MUST write the ENTIRE application as a single HTML file with embedded CSS and JavaScript (<style> and <script> tags). DO NOT use Python, Flask, Node, or any backend languages. DO NOT output any markdown, explanations, or setup instructions. ONLY output the raw HTML code starting with <!DOCTYPE html>." : "Give full code in one file without markdown.";

    if (promptCategory) {
      finalPrompt = `Act as an expert developer. My task is: ${promptCategory}. I want to build a ${selectedProject} (${selectedType}). Make it ${selectedStyle}. ${voiceOutput === "With Voice Output" ? "Include steps for voice output." : ""} ${constraint} Explain every part.`;
    } else {
      finalPrompt = `Create a ${selectedStyle} ${selectedType} for a ${selectedProject}. Use this aesthetic: ${selectedAesthetic}. Requirements: Use simple code, add comments, add error handling, explain every part, tell me required libraries. ${constraint}`;
    }
    setGeneratedPrompt(finalPrompt);
    generateCodeWithAPI(finalPrompt);
  };



  const handleCodingLoop = async (action: string) => {
    if (action === "Save Project") {
      const code = extractCode(generatedCode);
      const isWeb = selectedType.includes("Website") || selectedType.includes("UI") || selectedType.includes("Dashboard") || selectedType.includes("Extension");
      const ext = isWeb ? ".html" : (selectedType.includes("Arduino") ? ".ino" : ".py");
      
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BlinkIDE_Project_${Date.now()}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      
      setGeneratedCode(prev => prev + "\n\n/* \nSUCCESS: Project saved to your Downloads folder! \n*/");
      return;
    }

    if (action === "Run Code") {
      const code = extractCode(generatedCode);
      const isWeb = selectedType.includes("Website") || selectedType.includes("UI") || selectedType.includes("Dashboard") || selectedType.includes("Extension");
      
      if (isWeb) {
        const scriptToInject = `\n<script>\nwindow.addEventListener("message", (event) => {\n  if (event.data.type === "keyboard") {\n    const char = event.data.char;\n    const input = document.querySelector("input, textarea");\n    const btn = document.querySelector("button");\n    if (char === "ENTER" && btn) { btn.click(); return; }\n    if (input) {\n      if (char === "BACKSPACE") input.value = input.value.slice(0, -1);\n      else input.value += char;\n      input.setAttribute("value", input.value);\n      input.dispatchEvent(new Event("input", { bubbles: true }));\n      input.dispatchEvent(new Event("change", { bubbles: true }));\n    }\n  }\n});\n</script>`;
        const blob = new Blob([code + scriptToInject], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setIdeState("PREVIEW_WEB");
        return;
      } else {
        setIdeState("GENERATING");
        setGenerationStatus("Executing Python code locally...");
        try {
          const response = await fetch('/api/run-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, type: selectedType })
          });
          const data = await response.json();
          const output = data.output || "Error running code.";
          
          setGeneratedCode(prev => prev + "\n\n/* --- RUN OUTPUT ---\n" + output + "\n------------------- */");
          setIdeState("CODING_LOOP");
        } catch (e) {
          setGeneratedCode(prev => prev + "\n\n/* --- RUN OUTPUT ---\nFailed to connect to local execution engine.\n------------------- */");
          setIdeState("CODING_LOOP");
        }
        return;
      }
    }

    if (action === "Deploy Project") {
      const code = extractCode(generatedCode);
      const isWeb = selectedType.includes("Website") || selectedType.includes("UI") || selectedType.includes("Dashboard") || selectedType.includes("Extension");
      
      if (!isWeb) {
        setGeneratedCode(prev => prev + "\n\n/* \nERROR: Real-time network deployment is only supported for Web Apps.\n*/");
        return;
      }
      
      setIdeState("GENERATING");
      setGenerationStatus("Deploying to local network...");
      try {
        const response = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, type: selectedType })
        });
        const data = await response.json();
        if (data.url) {
          setDeployUrl(data.url);
          setIdeState("DEPLOY_SUCCESS");
        } else {
          setGeneratedCode(prev => prev + "\n\n/* \nERROR: Failed to deploy.\n*/");
          setIdeState("CODING_LOOP");
        }
      } catch (e) {
        setGeneratedCode(prev => prev + "\n\n/* \nERROR: Network failure during deployment.\n*/");
        setIdeState("CODING_LOOP");
      }
      return;
    }

    if (action === "Make Report") {
      let loopPrompt = `Here is the current code you generated:\n\n${generatedCode}\n\nPlease generate a detailed report, summary, or documentation for this project. Use markdown formatting. DO NOT output any HTML or code blocks.`;
      
      setIdeState("GENERATING");
      setGenerationStatus("Writing report...");
      try {
        const res = await fetch('/api/groq-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: loopPrompt })
        });
        const data = await res.json();
        if (data.reply) {
          setGeneratedCode(data.reply);
          setPreviewUrl(null);
          setIdeState("CODE_RESULT");
          setActiveIndex(0);
        } else {
          setGenerationStatus("Error generating report.");
          setTimeout(() => setIdeState("CODING_LOOP"), 2000);
        }
      } catch (e) {
        setGenerationStatus("Network Error.");
        setTimeout(() => setIdeState("CODING_LOOP"), 2000);
      }
      return;
    }

    const isWeb = selectedType.includes("Website") || selectedType.includes("UI") || selectedType.includes("Dashboard") || selectedType.includes("Extension");
    const constraint = isWeb ? "CRITICAL: You MUST write the ENTIRE application as a single HTML file with embedded CSS and JavaScript (<style> and <script> tags). DO NOT output any markdown or explanations. ONLY output the raw HTML code starting with <!DOCTYPE html>." : "Give full code in one file.";
    let loopPrompt = `Here is the current code:\n\n${generatedCode}\n\nPlease perform the following action: ${action}. Generate the updated code. ${constraint}`;
    generateCodeWithAPI(loopPrompt);
  };

  const activateOption = useCallback(
    (index: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      setProgress(100);
      
      const option = getCurrentOptions()[index];
      
      if (option.action) {
        option.action();
        window.setTimeout(() => setProgress(0), 100);
        return;
      }

      if (option.nextState) {
        setIdeState(option.nextState);
        setActiveIndex(0);
        return;
      }

      if (option.value) {
        switch (ideState) {
          case "CREATE_SOFTWARE_TYPE":
            setSelectedType(option.value);
            setIdeState("CREATE_SOFTWARE_PROJECT");
            break;
          case "CREATE_SOFTWARE_PROJECT":
          case "PROMPT_ENG_PROJECT":
            setSelectedProject(option.value);
            break;
          case "CREATE_SOFTWARE_AESTHETIC":
            setSelectedAesthetic(option.value);
            break;
          case "CREATE_SOFTWARE_STYLE":
            setSelectedStyle(option.value);
            buildPromptAndGenerate();
            break;
          case "PROMPT_ENG_CATEGORY":
            setPromptCategory(option.value);
            setIdeState("CREATE_SOFTWARE_TYPE"); 
            break;
          case "PROMPT_ENG_VOICE":
            setVoiceOutput(option.value);
            buildPromptAndGenerate();
            break;
        }
        
        if (ideState === "CREATE_SOFTWARE_TYPE" && promptCategory) {
          setIdeState("PROMPT_ENG_PROJECT");
        } else if (ideState === "CREATE_SOFTWARE_PROJECT") {
          setIdeState("CREATE_SOFTWARE_AESTHETIC");
        } else if (ideState === "CREATE_SOFTWARE_AESTHETIC") {
          setIdeState("CREATE_SOFTWARE_STYLE");
        } else if (ideState === "PROMPT_ENG_PROJECT") {
          setIdeState("PROMPT_ENG_STYLE");
        } else if (ideState === "PROMPT_ENG_STYLE") {
          setIdeState("PROMPT_ENG_VOICE");
        }
        
        setActiveIndex(0);
      }
    },
    [ideState, promptCategory, selectedProject, selectedAesthetic, selectedType, selectedStyle, voiceOutput]
  );

  const latestActivateOption = useRef(activateOption);
  useEffect(() => {
    latestActivateOption.current = activateOption;
  }, [activateOption]);

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

      timerRef.current = window.setTimeout(() => latestActivateOption.current(index), AUTO_SELECT_MS);
    },
    []
  );

  const moveNext = useCallback(() => {
    if (ideState === "GENERATING") return;
    setActiveIndex((current) => {
      const next = (current + 1) % getCurrentOptions().length;
      scheduleSelect(next);
      return next;
    });
  }, [scheduleSelect, ideState]);

  useEffect(() => {
    if (!isActive) return;
    
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      moveNext();
    };
    
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moveNext, isActive]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [generatedCode]);

  useEffect(() => {
    if (ideState === "GENERATING") return;
    const activeEl = document.getElementById(`ide-option-${activeIndex}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, ideState]);

  if (!isActive) return null;

  return (
    <div className="flex w-full h-full gap-4 relative z-10 font-sans">
      
      {/* Light-Themed Code Editor Window (Right/Main Area) */}
      <div className="flex-1 bg-white border border-slate-200 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
        {/* Editor Header */}
        <div className="h-12 bg-slate-50 border-b border-slate-200 flex items-center px-4 shrink-0">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
          </div>
          <div className="flex-1 text-center font-mono text-sm text-slate-500 font-medium">
            BlinkIDE - Code Window
          </div>
        </div>

        {/* Editor Content Area */}
        <div ref={contentRef} className="flex-1 overflow-auto p-6 bg-slate-50 text-slate-800 font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {ideState === "GENERATING" ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              >
                <Code className="w-12 h-12 text-blue-500 opacity-50" />
              </motion.div>
              <div className="text-lg font-medium animate-pulse">{generationStatus}</div>
            </div>
          ) : ideState === "DEPLOY_SUCCESS" && deployUrl ? (
            <div className="flex-1 w-full h-full bg-white rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 sm:p-8 shadow-sm border border-slate-200">
              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Project Deployed! 🚀</h2>
                <p className="text-slate-500 text-sm sm:text-base">Anyone on your WiFi network can scan this QR code to view your app instantly.</p>
              </div>
              <div className="p-4 bg-white border-4 border-slate-100 rounded-2xl shadow-sm mb-4">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deployUrl)}`} alt="Deploy QR Code" className="w-[150px] h-[150px] sm:w-[200px] sm:h-[200px]" />
              </div>
              <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 w-full text-center">
                <p className="text-xs text-slate-400 mb-1">Direct Link</p>
                <a href={deployUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-mono text-[11px] sm:text-sm break-all hover:underline">{deployUrl}</a>
              </div>
            </div>
          ) : previewUrl ? (
            <div className="flex-1 w-full h-full bg-white rounded-xl overflow-hidden relative">
              <iframe 
                id="blinkide-preview-iframe"
                src={previewUrl} 
                className="w-full h-[600px] border-0" 
                sandbox="allow-scripts allow-same-origin"
                title="Web Preview"
              />
              {ideState === "VIRTUAL_KEYBOARD" && (
                <div className="absolute top-4 right-4 bg-blue-600 text-white font-bold px-4 py-2 rounded-xl shadow-lg animate-pulse z-50">
                  Virtual Keyboard Active
                </div>
              )}
            </div>
          ) : ideState === "CODE_RESULT" ? (
            <div className="flex-1 w-full h-full bg-slate-900 text-slate-100 font-mono text-[13px] overflow-auto p-6 rounded-xl whitespace-pre-wrap leading-relaxed shadow-inner">
              {generatedCode}
            </div>
          ) : generatedCode ? (
            <div id="blinkide-preview-content" className="w-full h-full" dangerouslySetInnerHTML={{ __html: extractCode(generatedCode) }} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Terminal className="w-16 h-16 mb-4 opacity-20" />
              <p>Welcome to BlinkIDE.</p>
              <p>Select options on the left using your Blink/Spacebar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel (Left Area) */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border border-slate-200 rounded-[24px] shadow-sm flex flex-col p-4 shrink-0 overflow-hidden">
        
        {/* Status / Title */}
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-800 mb-1">
            {ideState === "MAIN_MENU" && "BlinkIDE Control"}
            {ideState === "CREATE_SOFTWARE_TYPE" && "What to create?"}
            {ideState === "CREATE_SOFTWARE_PROJECT" && "Choose Project"}
            {ideState === "CREATE_SOFTWARE_STYLE" && "Coding Style"}
            {ideState === "PROMPT_ENG_CATEGORY" && "Prompt Category"}
            {ideState === "PROMPT_ENG_PROJECT" && "Choose Project"}
            {ideState === "PROMPT_ENG_STYLE" && "Coding Style"}
            {ideState === "PROMPT_ENG_VOICE" && "Voice Output?"}
            {ideState === "CODING_LOOP" && "AI Coding Loop"}
          </h2>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Spacebar / Blink to Navigate
          </div>
        </div>

        {/* Dynamic Options List */}
        <div className="flex-1 overflow-y-auto pr-2 pb-4 hide-scrollbar">
          <div className={`grid ${ideState === 'VIRTUAL_KEYBOARD' ? 'grid-cols-4 gap-1' : 'grid-cols-2 gap-2'} content-start`}>
            {ideState !== "GENERATING" && currentOptions.map((opt, idx) => {
              const isActiveOption = idx === activeIndex;
              const Icon = opt.icon || Terminal;
              return (
                <div 
                  key={idx}
                  id={`ide-option-${idx}`}
                  className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all text-center gap-2 overflow-hidden ${
                    isActiveOption 
                      ? 'border-blue-500 bg-white shadow-md transform scale-[1.02]' 
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {/* Progress background */}
                  {isActiveOption && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-blue-100/60 transition-all duration-75 ease-linear z-0"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  
                  {opt.icon && (
                    <div className={`relative z-10 p-2 rounded-xl transition-colors ${isActiveOption ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="w-5 h-5" strokeWidth={isActiveOption ? 2.5 : 2} />
                    </div>
                  )}
                  
                  <span className={`relative z-10 text-[12px] md:text-[13px] font-bold leading-tight transition-colors ${isActiveOption ? 'text-blue-700' : 'text-slate-600'}`}>
                    {opt.label}
                  </span>

                  {isActiveOption && (
                    <motion.div 
                      layoutId="ideActiveRing"
                      className="absolute inset-0 border-2 border-blue-500 rounded-xl z-20 pointer-events-none"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
