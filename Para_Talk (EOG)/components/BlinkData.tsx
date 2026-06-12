"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Settings,
  Database,
  Code,
  BarChart2,
  FileText,
  Brain,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Activity,
  FileSpreadsheet,
  ShieldCheck,
  PieChart as PieChartIcon,
  TrendingUp,
  Users,
  CheckCircle2,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LabelList,
} from "recharts";

type MenuOption = {
  label: string;
  icon?: React.ElementType;
  action?: () => void;
  nextState?: string;
  value?: string;
};

type BlinkDataProps = {
  isActive: boolean;
  onExit: () => void;
};

const AUTO_SELECT_MS = 5000;

const businessMockData = [
  { name: "Jan", sales: 4200, profit: 2400 },
  { name: "Feb", sales: 3000, profit: 1398 },
  { name: "Mar", sales: 2000, profit: 9800 },
  { name: "Apr", sales: 2780, profit: 3908 },
  { name: "May", sales: 1890, profit: 4800 },
  { name: "Jun", sales: 2390, profit: 3800 },
];

const medicalMockData = [
  { name: "P001", heartRate: 78, age: 45, bp: 120 },
  { name: "P002", heartRate: 88, age: 62, bp: 135 },
  { name: "P003", heartRate: 65, age: 28, bp: 110 },
  { name: "P004", heartRate: 145, age: 71, bp: 160 },
  { name: "P005", heartRate: 72, age: 53, bp: 125 },
];

const weatherMockData = [
  { name: "1-May", temp: 15, humidity: 65 },
  { name: "2-May", temp: 22, humidity: 45 },
  { name: "3-May", temp: 35, humidity: 85 },
  { name: "4-May", temp: 16, humidity: 60 },
  { name: "5-May", temp: 19, humidity: 65 },
];

const retailMockData = [
  { name: "Fruits & Veg", sales: 250, profit: 45 },
  { name: "Snack Foods", sales: 180, profit: 30 },
  { name: "Household", sales: 150, profit: 40 },
  { name: "Frozen Foods", sales: 120, profit: 25 },
  { name: "Dairy", sales: 90, profit: 15 },
];

const medicalPapers = [
  {
    id: "m1",
    title: "Advancements in EOG-Based BCIs for ALS Patients",
    authors: "Dr. A. Smith, Dr. J. Doe",
    year: 2026,
    abstract:
      "This paper explores novel electrooculography (EOG) techniques that significantly improve communication speed for paralyzed patients. By utilizing advanced signal processing, the system achieves a 40% reduction in error rates.",
  },
  {
    id: "m2",
    title: "Predictive Health Monitoring in Complete Locked-in Syndrome",
    authors: "K. Lee et al.",
    year: 2025,
    abstract:
      "A comprehensive study on using continuous vital sign monitoring to predict autonomic dysreflexia in paralyzed patients. Machine learning models demonstrated a 92% accuracy in predicting spikes in blood pressure.",
  },
  {
    id: "m3",
    title: "Non-invasive Neural Interfaces: A Review",
    authors: "M. Johnson",
    year: 2026,
    abstract:
      "An extensive literature review covering the last decade of non-invasive BCI development, focusing on EEG, fNIRS, and EOG modalities and their real-world applications in home care settings.",
  },
];

const mlPapers = [
  {
    id: "ml1",
    title: "Large Language Models for Real-time Synthesis of Patient Data",
    authors: "Dr. S. Gupta et al.",
    year: 2026,
    abstract:
      "We present a novel LLM architecture designed specifically to run locally on edge devices to synthesize patient telemetry data in real-time without relying on cloud infrastructure, ensuring patient privacy.",
  },
  {
    id: "ml2",
    title: "Zero-shot Anomaly Detection in Time-series Vital Signs",
    authors: "R. Chen",
    year: 2025,
    abstract:
      "This research demonstrates the efficacy of transformer-based models in detecting anomalies in continuous heart rate and blood pressure data with zero prior training on the specific patient's baseline.",
  },
  {
    id: "ml3",
    title: "Optimizing Vector Embeddings for Medical Literature Search",
    authors: "T. Williams",
    year: 2026,
    abstract:
      "By fine-tuning embedding models on specialized medical corpora, we achieved a 15% increase in retrieval accuracy for clinical decision support systems.",
  },
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function BlinkDataAnalyst({ isActive, onExit }: BlinkDataProps) {
  const [dataState, setDataState] = useState<string>("MAIN_MENU");
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<string>("Bar Chart");
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [researchTopic, setResearchTopic] = useState<"MEDICAL" | "ML" | null>(
    null,
  );

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedRowCount, setUploadedRowCount] = useState<number>(0);
  const [datasetType, setDatasetType] = useState<
    "BUSINESS" | "MEDICAL" | "WEATHER" | "DYNAMIC" | "RETAIL"
  >("BUSINESS");
  const [chartData, setChartData] = useState<any[]>(businessMockData);
  const [tableData, setTableData] = useState<{
    headers: string[];
    rows: string[][];
  }>({ headers: [], rows: [] });

  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [categoryColumn, setCategoryColumn] = useState<string>("name");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const latestActivateOption = useRef<(idx: number) => void>(() => {});

  const stopScanner = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }, []);

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const simulateTerminal = async (lines: string[], onComplete: () => void) => {
    setDataState("EXECUTING");
    setTerminalLines([]);

    for (let i = 0; i < lines.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setTerminalLines((prev) => [...prev, lines[i]]);
    }

    await new Promise((r) => setTimeout(r, 1000));
    setActiveIndex(0);
    onComplete();
  };

  const executeDataScienceTask = (taskName: string) => {
    if (taskName === "Upload Dataset") {
      setDataState("UPLOAD_VIEW");
    } else if (taskName === "View Dataset") {
      simulateTerminal(
        [
          "> import pandas as pd",
          `> df = pd.read_csv('${uploadedFileName || "dataset.csv"}')`,
          "> Rendering full dataset...",
        ],
        () => {
          setDataState("TABLE_VIEW");
          speak("Displaying full dataset preview in table format.");
        },
      );
    } else if (taskName === "Clean Data") {
      simulateTerminal(
        [
          "> Initializing Expert AI Data Purifier...",
          `> Loading dataset '${uploadedFileName || "dataset.csv"}'...`,
          "> Performing deep statistical analysis...",
          "> Detecting and resolving outliers via IQR and Z-score methods...",
          "> Imputing missing values using advanced k-NN algorithms...",
          "> Normalizing distributions & handling collinearity...",
          "> Data purification complete. Dataset is now production-ready.",
        ],
        () => {
          setAiReport(
            `Expert data cleaning complete. ${uploadedRowCount > 0 ? `Processed ${uploadedRowCount} rows from ${uploadedFileName}.` : ""} Complex outliers removed, missing values imputed via k-NN, and dataset optimized for high-performance modeling.`,
          );
          setDataState("REPORT_VIEW");
        },
      );
    } else if (taskName === "Train Model") {
      simulateTerminal(
        [
          "> from sklearn.ensemble import RandomForestClassifier",
          "> X_train, X_test, y_train, y_test = train_test_split(X, y)",
          "> model = RandomForestClassifier()",
          "> model.fit(X_train, y_train)",
          "> Training complete. Evaluating accuracy...",
          "> Accuracy: 94.2%",
        ],
        () => {
          setAiReport(
            "Model trained successfully. Random Forest achieved 94.2% accuracy on the test set.",
          );
          setDataState("REPORT_VIEW");
        },
      );
    } else if (taskName === "Explain Result") {
      setAiReport(
        "Based on the recent chart generation, we can observe that sales hit a peak in March. The Random Forest model predicts continued growth if this trend stabilizes.",
      );
      setDataState("REPORT_VIEW");
      speak(
        "Based on the recent chart generation, we can observe that sales hit a peak in March. The Random Forest model predicts continued growth if this trend stabilizes.",
      );
    } else if (taskName === "Generate PowerBI") {
      simulateTerminal(
        [
          "> import dash",
          "> import plotly.express as px",
          `> Generating BI dashboard for ${uploadedFileName || "dataset.csv"}...`,
          "> Compiling KPI metrics and visuals...",
          "> PowerBI-style dashboard successfully compiled.",
        ],
        () => {
          setDataState("POWERBI_VIEW");
          speak(
            "Dashboard compiled successfully. Displaying key performance indicators and dimensional analysis.",
          );
        },
      );
    } else if (taskName === "Generate Retail BI") {
      simulateTerminal(
        [
          "> Generating Item Type & Fat Content matrices...",
          "> 40+ Years Data Scientist AI evaluating trends...",
          "> Retail BI Dashboard compiled.",
        ],
        () => {
          setDataState("POWERBI_VIEW");
          speak(
            "Retail AI dashboard generated based on current dataset. Review the aggregated metrics.",
          );
        },
      );
    }
  };

  const executeChartTask = (type: string) => {
    setChartType(type);
    simulateTerminal(
      [
        "> import matplotlib.pyplot as plt",
        `> Generating ${type}...`,
        "> Rendering visualization...",
      ],
      () => {
        setShowChart(true);
        setDataState("CHART_VIEW");
      },
    );
  };

  const getCurrentOptions = (): MenuOption[] => {
    switch (dataState) {
      case "MAIN_MENU":
        return [
          {
            label: "Data Science Mode",
            icon: Database,
            nextState: "DATA_SCIENCE_MENU",
          },
          {
            label: "AI Researcher Mode",
            icon: Brain,
            nextState: "AI_RESEARCH_MENU",
          },
          {
            label: "Machine Learning Mode",
            icon: Activity,
            nextState: "ML_MENU",
          },
          {
            label: "Dashboard Mode",
            icon: BarChart2,
            nextState: "DASHBOARD_MENU",
          },
          { label: "Exit BlinkData", icon: Settings, action: onExit },
        ];
      case "DATA_SCIENCE_MENU":
        return [
          {
            label: "Upload Dataset",
            icon: FileSpreadsheet,
            action: () => executeDataScienceTask("Upload Dataset"),
          },
          {
            label: "View Dataset",
            icon: Search,
            action: () => executeDataScienceTask("View Dataset"),
          },
          {
            label: "AI Data Cleaning",
            icon: ShieldCheck,
            action: () => executeDataScienceTask("Clean Data"),
          },
          { label: "Make Chart", icon: BarChart2, nextState: "CHART_MENU" },
          {
            label: "AI Chat with Data",
            icon: Brain,
            action: () => {
              setChatMessages([
                {
                  role: "assistant",
                  text: "Hello! I am your AI Data Analyst. What would you like to know about the uploaded dataset?",
                },
              ]);
              setDataState("AI_CHAT_VIEW");
              setActiveIndex(0);
            },
          },
          {
            label: "Forecasting Models",
            icon: TrendingUp,
            action: () => {
              setDataState("FORECAST_VIEW");
              setActiveIndex(0);
            },
          },
          { label: "Go Back", icon: ChevronLeft, nextState: "MAIN_MENU" },
        ];
      case "AI_CHAT_VIEW":
        return [
          {
            label: "Summarize Dataset",
            icon: Brain,
            action: () => {
              setChatMessages((prev) => [
                ...prev,
                { role: "user", text: "Summarize the dataset." },
                {
                  role: "assistant",
                  text: `This dataset contains ${tableData.rows.length} rows and ${tableData.headers.length} columns. The primary numerical columns are ${numericColumns.join(", ")}.`,
                },
              ]);
              speak(
                "This dataset contains " + tableData.rows.length + " rows.",
              );
            },
          },
          {
            label: "Find Anomalies",
            icon: Activity,
            action: () => {
              setChatMessages((prev) => [
                ...prev,
                { role: "user", text: "Find anomalies." },
                {
                  role: "assistant",
                  text: `I detected a 14% deviation from the moving average in ${numericColumns[0]}. This requires attention.`,
                },
              ]);
              speak(`I detected a 14% deviation in ${numericColumns[0]}`);
            },
          },
          {
            label: "Go Back",
            icon: ChevronLeft,
            action: () => {
              setDataState("DATA_SCIENCE_MENU");
              setActiveIndex(0);
            },
          },
        ];
      case "FORECAST_VIEW":
        return [
          {
            label: "Run 30-Day Forecast",
            icon: TrendingUp,
            action: () =>
              simulateTerminal(
                [
                  "> Initializing ARIMA model...",
                  "> Training on historical data...",
                  "> Projection complete!",
                ],
                () => {
                  speak("30-day forecast generated successfully. Displaying projected trends.");
                  setChartType("Forecast Projection");
                  setShowChart(true);
                  setDataState("CHART_VIEW");
                },
              ),
          },
          {
            label: "Go Back",
            icon: ChevronLeft,
            action: () => {
              setDataState("DATA_SCIENCE_MENU");
              setActiveIndex(0);
            },
          },
        ];
      case "CHART_MENU":
        return [
          { label: "Bar Chart", action: () => executeChartTask("Bar Chart") },
          { label: "Line Chart", action: () => executeChartTask("Line Chart") },
          { label: "Pie Chart", action: () => executeChartTask("Pie Chart") },
          {
            label: "Go Back",
            icon: ChevronLeft,
            nextState: "DATA_SCIENCE_MENU",
          },
        ];
      case "AI_RESEARCH_MENU":
        return [
          {
            label: "Search Medical Literature",
            icon: Search,
            action: () => {
              setResearchTopic("MEDICAL");
              setDataState("RESEARCH_RESULTS_VIEW");
              setActiveIndex(0);
            },
          },
          {
            label: "Search AI & Data Science",
            icon: Search,
            action: () => {
              setResearchTopic("ML");
              setDataState("RESEARCH_RESULTS_VIEW");
              setActiveIndex(0);
            },
          },
          {
            label: "Generate Final AI Report",
            icon: FileText,
            action: () => {
              setDataState("RESEARCH_REPORT_VIEW");
              setActiveIndex(0);
            },
          },
          { label: "Go Back", icon: ChevronLeft, nextState: "MAIN_MENU" },
        ];
      case "RESEARCH_RESULTS_VIEW":
        return [
          {
            label: "Read Paper 1",
            icon: FileText,
            action: () => {
              speak(
                `Abstract: ${researchTopic === "MEDICAL" ? medicalPapers[0].abstract : mlPapers[0].abstract}`,
              );
            },
          },
          {
            label: "Read Paper 2",
            icon: FileText,
            action: () => {
              speak(
                `Abstract: ${researchTopic === "MEDICAL" ? medicalPapers[1].abstract : mlPapers[1].abstract}`,
              );
            },
          },
          {
            label: "Generate AI Summary of All",
            icon: Brain,
            action: () => {
              setDataState("RESEARCH_REPORT_VIEW");
              setActiveIndex(0);
            },
          },
          {
            label: "Go Back",
            icon: ChevronLeft,
            action: () => {
              setDataState("AI_RESEARCH_MENU");
              setActiveIndex(0);
            },
          },
        ];
      case "RESEARCH_REPORT_VIEW":
        return [
          {
            label: "Read Aloud",
            icon: Play,
            action: () =>
              speak(
                "Reading final AI generated research report. This report synthesizes key findings from multiple academic papers to provide a comprehensive literature review.",
              ),
          },
          {
            label: "Download PDF Report",
            icon: Download,
            action: () => {
              speak("Preparing PDF download.");
              setTimeout(() => window.print(), 1000);
            },
          },
          {
            label: "Dismiss Report",
            icon: ChevronLeft,
            action: () => {
              setDataState("AI_RESEARCH_MENU");
              setActiveIndex(0);
            },
          },
        ];
      case "ML_MENU":
        return [
          {
            label: "Classification",
            action: () => executeDataScienceTask("Train Model"),
          },
          {
            label: "Regression",
            action: () =>
              simulateTerminal(
                [
                  "> Linear Regression initialized",
                  "> fitting data...",
                  "> MSE: 0.042",
                ],
                () => setDataState("ML_MENU"),
              ),
          },
          {
            label: "Clustering",
            action: () =>
              simulateTerminal(
                [
                  "> KMeans(n_clusters=3)",
                  "> Clustering data points...",
                  "> Silhouette Score: 0.68",
                ],
                () => setDataState("ML_MENU"),
              ),
          },
          { label: "Go Back", icon: ChevronLeft, nextState: "MAIN_MENU" },
        ];
      case "DASHBOARD_MENU":
        return [
          {
            label: "Upload Dataset",
            icon: FileSpreadsheet,
            action: () => executeDataScienceTask("Upload Dataset"),
          },
          {
            label: "Generate PowerBI",
            icon: PieChartIcon,
            action: () => executeDataScienceTask("Generate PowerBI"),
          },
          {
            label: "Retail AI Dashboard",
            icon: PieChartIcon,
            action: () => executeDataScienceTask("Generate Retail BI"),
          },
          { label: "Sales Chart", action: () => executeChartTask("Bar Chart") },
          {
            label: "Health Chart",
            action: () => executeChartTask("Line Chart"),
          },
          { label: "Go Back", icon: ChevronLeft, nextState: "MAIN_MENU" },
        ];
      case "REPORT_VIEW":
        return [
          {
            label: "Read Aloud",
            icon: Play,
            action: () => {
              if (aiReport) speak(aiReport);
            },
          },
          {
            label: "Dismiss Report",
            icon: ChevronLeft,
            action: () => {
              setAiReport(null);
              setDataState("DATA_SCIENCE_MENU");
            },
          },
        ];
      case "TABLE_VIEW":
        return [
          {
            label: "Read Data",
            icon: Play,
            action: () => {
              if (tableData.rows.length > 0) {
                const firstRow = tableData.rows[0];
                speak(
                  `First row: ${tableData.headers.map((h, i) => `${h} is ${firstRow[i]}`).join(", ")}.`,
                );
              }
            },
          },
          {
            label: "Scroll Down",
            icon: ChevronDown,
            action: () => {
              if (tableRef.current)
                tableRef.current.scrollBy({ top: 300, behavior: "smooth" });
            },
          },
          {
            label: "Scroll Up",
            icon: ChevronUp,
            action: () => {
              if (tableRef.current)
                tableRef.current.scrollBy({ top: -300, behavior: "smooth" });
            },
          },
          {
            label: "Dismiss Table",
            icon: ChevronLeft,
            action: () => setDataState("DATA_SCIENCE_MENU"),
          },
        ];
      case "UPLOAD_VIEW":
        return [
          {
            label: "Use Built-in Demo Dataset",
            icon: Database,
            action: () => {
              stopScanner();
              setUploadedFileName("demo_patient_data.csv");
              setUploadedRowCount(20);
              setDatasetType("MEDICAL");
              setChartData(medicalMockData);
              setTableData({
                headers: [
                  "PatientID",
                  "Age",
                  "HeartRate",
                  "BloodPressure",
                  "Temperature",
                  "Status",
                ],
                rows: [
                  ["P001", "45", "78", "120/80", "98.6", "Stable"],
                  ["P002", "62", "88", "140/90", "99.1", "Monitor"],
                  ["P003", "28", "65", "110/70", "98.4", "Stable"],
                  ["P004", "71", "95", "150/95", "100.2", "Critical"],
                  ["P005", "53", "72", "125/82", "98.7", "Stable"],
                ],
              });
              simulateTerminal(
                [
                  "> File 'demo_patient_data.csv' loaded from internal storage",
                  "> Read 20 rows",
                  "> Upload complete. Ready for analysis.",
                ],
                () => {
                  setDataState("DATA_SCIENCE_MENU");
                  setActiveIndex(0);
                },
              );
            },
          },
          {
            label: "Cancel Upload",
            icon: ChevronLeft,
            action: () => setDataState("DATA_SCIENCE_MENU"),
          },
        ];
      case "CHART_VIEW":
        return [
          {
            label: "Explain Chart",
            icon: Play,
            action: () => {
              speak(
                `This ${chartType} visualizes the performance trends. March shows the highest activity.`,
              );
            },
          },
          {
            label: "Dismiss Chart",
            icon: ChevronLeft,
            action: () => {
              setShowChart(false);
              setDataState("DATA_SCIENCE_MENU");
            },
          },
        ];
      case "POWERBI_VIEW":
        return [
          {
            label: "Read Insights",
            icon: Play,
            action: () => {
              speak(
                `The dashboard indicates strong performance metrics. We have ${uploadedRowCount || 6} total records analyzed, with an upward trend in overall volume. The pie chart distribution highlights the largest segments.`,
              );
            },
          },
          {
            label: "Download Report",
            icon: Download,
            action: () => {
              speak("Preparing PDF download.");
              setTimeout(() => window.print(), 1000);
            },
          },
          {
            label: "Dismiss Dashboard",
            icon: ChevronLeft,
            action: () => setDataState("DASHBOARD_MENU"),
          },
        ];
      default:
        return [];
    }
  };

  const currentOptions = getCurrentOptions();

  const activateOption = useCallback(
    (index: number) => {
      const option = currentOptions[index];
      if (!option) return;

      if (option.action) {
        option.action();
        window.setTimeout(() => setProgress(0), 100);
        return;
      }

      if (option.nextState) {
        setDataState(option.nextState);
        setActiveIndex(0);
        window.setTimeout(() => setProgress(0), 100);
      }
    },
    [currentOptions],
  );

  const scheduleSelect = useCallback((index: number) => {
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
      () => latestActivateOption.current(index),
      AUTO_SELECT_MS,
    );
  }, []);

  useEffect(() => {
    latestActivateOption.current = activateOption;
  }, [activateOption]);

  useEffect(() => {
    if (dataState === "EXECUTING" || !isActive) return;
    if (currentOptions.length === 0) return;

    scheduleSelect(activeIndex);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [activeIndex, scheduleSelect, dataState, isActive, currentOptions.length]);

  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || dataState === "EXECUTING") return;
      event.preventDefault();

      stopScanner();

      setActiveIndex((prev) => (prev + 1) % currentOptions.length);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, dataState, currentOptions.length]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-50 flex overflow-hidden font-sans rounded-3xl">
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv,.txt,.xlsx,.xls"
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        onChange={(e) => {
          stopScanner();
          const file = e.target.files?.[0];
          if (file) {
            setUploadedFileName(file.name);
            const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

            const processDataText = (text: string) => {
              let rowCount = 0;
              if (text) {
                const lines = text
                  .split("\n")
                  .filter((l) => l.trim().length > 0);
                rowCount = lines.length > 1 ? lines.length - 1 : 0;
                setUploadedRowCount(rowCount);

                // Parse up to 100 rows for preview
                if (lines.length > 0) {
                  const headers = lines[0].split(",").map((h) => h.trim());
                  const rows = lines
                    .slice(1, 101)
                    .map((l) => l.split(",").map((c) => c.trim()));
                  setTableData({ headers, rows });

                  // Dynamic Column Parsing & Dataset Auto-Detection
                  const nums: string[] = [];
                  let catCol = headers[0];

                  if (rows.length > 0) {
                    headers.forEach((h, i) => {
                      // Check first valid row to see if the column is numerical
                      const val = rows[0][i]?.trim();
                      if (val && !isNaN(Number(val))) {
                        nums.push(h);
                      }
                    });
                  }

                  if (nums.length > 0) {
                    setNumericColumns(nums);
                    catCol =
                      headers.find((h) => !nums.includes(h)) || headers[0];
                    setCategoryColumn(catCol);

                    // Build dynamic chart data objects from the first 50 rows
                    const dynamicData = rows.slice(0, 50).map((row) => {
                      const obj: any = {};
                      headers.forEach((h, i) => {
                        const val = row[i];
                        obj[h] = nums.includes(h) ? Number(val) : val;
                      });
                      return obj;
                    });

                    setDatasetType("DYNAMIC");
                    setChartData(dynamicData);
                  } else {
                    // Fallback to basic detection if parsing fails
                    const headerStr = headers.join("").toLowerCase();
                    if (
                      headerStr.includes("heartrate") ||
                      headerStr.includes("patient")
                    ) {
                      setDatasetType("MEDICAL");
                      setChartData(medicalMockData);
                    } else if (
                      headerStr.includes("temp") ||
                      headerStr.includes("weather")
                    ) {
                      setDatasetType("WEATHER");
                      setChartData(weatherMockData);
                    } else {
                      setDatasetType("BUSINESS");
                      setChartData(businessMockData);
                    }
                  }
                }
              }

              simulateTerminal(
                [
                  `> File '${file.name}' received`,
                  `> Read ${rowCount} rows`,
                  "> Upload complete. Ready for analysis.",
                ],
                () => {
                  setDataState("DATA_SCIENCE_MENU");
                  setActiveIndex(0);
                },
              );
            };

            if (isExcel) {
              const reader = new FileReader();
              reader.onload = (evt) => {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: "binary" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const csv = XLSX.utils.sheet_to_csv(worksheet);
                processDataText(csv);
              };
              reader.readAsBinaryString(file);
            } else {
              const reader = new FileReader();
              reader.onload = (evt) => {
                processDataText(evt.target?.result as string);
              };
              reader.readAsText(file);
            }
          } else {
            setDataState("DATA_SCIENCE_MENU");
          }
        }}
      />
      {/* Sidebar Navigation */}
      {dataState !== "EXECUTING" && dataState !== "UPLOAD_VIEW" && (
        <div className="w-[300px] xl:w-[360px] flex-shrink-0 flex flex-col gap-4 bg-white/60 p-4 border-r border-slate-200 shadow-sm backdrop-blur-md z-10 print:hidden">
          <div className="mb-2">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-6 h-6 text-indigo-500" />
              BlinkData AI
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wider">
              SPACEBAR / BLINK TO NAVIGATE
            </p>
            {uploadedFileName && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-3 flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-xl border border-green-200 shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span
                  className="text-xs font-bold truncate"
                  title={uploadedFileName}
                >
                  Ready: {uploadedFileName}
                </span>
              </motion.div>
            )}
          </div>

          <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 pb-8">
            <AnimatePresence mode="popLayout">
              {currentOptions.map((opt, i) => {
                const isActiveOption = i === activeIndex;
                const Icon = opt.icon || Code;

                return (
                  <motion.div
                    key={opt.label + i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`relative p-5 rounded-2xl border-2 transition-all duration-300 shadow-sm flex flex-col items-center justify-center text-center overflow-hidden
                      ${
                        isActiveOption
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]"
                          : "border-slate-200 bg-white text-slate-600"
                      }
                    `}
                  >
                    <Icon
                      className={`w-8 h-8 mb-2 ${isActiveOption ? "text-indigo-600" : "text-slate-400"}`}
                    />
                    <span className="font-bold text-lg">{opt.label}</span>

                    {isActiveOption && (
                      <div
                        className="absolute bottom-0 left-0 h-1.5 bg-indigo-500 transition-all duration-75 ease-linear"
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 bg-slate-100 p-6 relative overflow-hidden flex flex-col items-center justify-center">
        {dataState === "EXECUTING" && (
          <div className="w-full max-w-3xl bg-slate-900 rounded-xl shadow-2xl overflow-hidden font-mono text-green-400 text-lg border border-slate-700">
            <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-2 text-slate-400 text-sm font-sans">
                BlinkData Kernel - Executing
              </span>
            </div>
            <div className="p-6 h-[400px] overflow-y-auto flex flex-col gap-2">
              {terminalLines.map((line, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {line}
                </motion.div>
              ))}
              <motion.div
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-3 h-6 bg-green-400 mt-2"
              />
            </div>
          </div>
        )}

        {dataState === "CHART_VIEW" && showChart && (
          <div className="w-full h-full max-w-5xl bg-white rounded-2xl shadow-xl p-8 flex flex-col">
            <h3 className="text-2xl font-bold text-slate-800 mb-6">
              {chartType} Analysis
            </h3>
            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "Bar Chart" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={categoryColumn} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey={
                        numericColumns.length > 0
                          ? numericColumns[0]
                          : datasetType === "MEDICAL"
                            ? "heartRate"
                            : datasetType === "WEATHER"
                              ? "temp"
                              : "sales"
                      }
                      fill="#8884d8"
                    />
                    <Bar
                      dataKey={
                        numericColumns.length > 1
                          ? numericColumns[1]
                          : datasetType === "MEDICAL"
                            ? "age"
                            : datasetType === "WEATHER"
                              ? "humidity"
                              : "profit"
                      }
                      fill="#82ca9d"
                    />
                  </BarChart>
                ) : chartType === "Pie Chart" ? (
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={150}
                      paddingAngle={5}
                      dataKey={
                        numericColumns.length > 1
                          ? numericColumns[1]
                          : datasetType === "MEDICAL"
                            ? "age"
                            : datasetType === "WEATHER"
                              ? "humidity"
                              : "profit"
                      }
                      nameKey={categoryColumn}
                      labelLine={true}
                      label={({ name, percent }) =>
                        `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={categoryColumn} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={
                        numericColumns.length > 0
                          ? numericColumns[0]
                          : datasetType === "MEDICAL"
                            ? "heartRate"
                            : datasetType === "WEATHER"
                              ? "temp"
                              : "sales"
                      }
                      stroke="#8884d8"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey={
                        numericColumns.length > 1
                          ? numericColumns[1]
                          : datasetType === "MEDICAL"
                            ? "age"
                            : datasetType === "WEATHER"
                              ? "humidity"
                              : "profit"
                      }
                      stroke="#82ca9d"
                      strokeWidth={3}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {dataState === "REPORT_VIEW" && aiReport && (
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 p-6 flex items-center gap-4 text-white">
              <Brain className="w-10 h-10" />
              <h3 className="text-2xl font-bold">AI Analysis Report</h3>
            </div>
            <div className="p-8">
              <p className="text-xl text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                {aiReport}
              </p>
            </div>
          </div>
        )}

        {dataState === "TABLE_VIEW" && (
          <div className="w-full h-full max-w-6xl bg-white rounded-3xl shadow-2xl p-6 flex flex-col border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Search className="w-6 h-6 text-indigo-500" />
                Dataset Preview
              </h3>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                Showing top {tableData.rows.length} rows (Total:{" "}
                {uploadedRowCount})
              </span>
            </div>

            <div
              ref={tableRef}
              className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-inner"
            >
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {tableData.headers.map((header, idx) => (
                      <th
                        key={idx}
                        className="px-6 py-3 font-bold border-b border-slate-200"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-6 py-4 font-medium text-slate-600"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {tableData.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={100}
                        className="px-6 py-8 text-center text-slate-400"
                      >
                        No data available in preview.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {dataState === "POWERBI_VIEW" &&
          (() => {
            const isMedical = datasetType === "MEDICAL";
            const isWeather = datasetType === "WEATHER";
            const isRetail = datasetType === "RETAIL";

            const kpi1 = isMedical
              ? {
                  label: "Total Patients",
                  value: "1,240",
                  sub: "Active records",
                }
              : isWeather
                ? {
                    label: "Avg Temperature",
                    value: "21.4°C",
                    sub: "Global median",
                  }
                : isRetail
                  ? {
                      label: "Total Sales",
                      value: "997.16K",
                      sub: "Across all outlets",
                    }
                  : {
                      label: "Total Revenue",
                      value: "$45,290",
                      sub: "+12.5% MoM",
                    };
            const kpi2 = isMedical
              ? {
                  label: "Avg Heart Rate",
                  value: "76 bpm",
                  sub: "Normal range",
                }
              : isWeather
                ? {
                    label: "Precipitation",
                    value: "12%",
                    sub: "-5% vs last month",
                  }
                : isRetail
                  ? {
                      label: "Average Sales",
                      value: "141.24",
                      sub: "Per transaction",
                    }
                  : { label: "Transactions", value: "1,492", sub: "High volume" };
            const kpi3 = isMedical
              ? {
                  label: "Critical Alerts",
                  value: "3",
                  sub: "Requires attention",
                }
              : isWeather
                ? { label: "Active Storms", value: "1", sub: "Tracking" }
                : isRetail
                  ? {
                      label: "Avg Rating",
                      value: "3.92",
                      sub: "Customer Satisfaction",
                    }
                  : { label: "Anomalies", value: "4", sub: "Unusual patterns" };

            const insightText = isMedical
              ? "Dataset contains 1,240 patient records. Average heart rate is stable at 76 bpm. 3 patients have been flagged for critically high blood pressure in the last 48 hours."
              : isWeather
                ? "Dataset contains weather data across 50 cities. Global median temperature is 21.4°C. A significant anomaly in humidity (85%) was detected on 3-May."
                : isRetail
                  ? "Based on 40+ years of retail analytics: Total sales reached 997.16K. 'Fruits & Vegetables' and 'Snack Foods' dominate item types. Low-fat content outperforms regular. Outlet establishment trends stabilized after recent expansion."
                  : "Dataset contains 500 sales records across 6 categories. Food contributes 38% of total expenses. Spending increased 14% month-over-month.";

            const anomalyAlert = isMedical
            // Dynamic Aggregations for the unified beautiful layout
            let totalSales = 0;
            const totalItems = chartData.length || 1;
            let avgRating = 0;
            const itemsObj: any = {};
            const pieData: any = {};
            const outletPie: any = {};
            const outletBar: any = {};
            const lineDataObj: any = {};
            const locTotals: any = {};

            chartData.forEach((d) => {
              // Try to identify logical columns
              let valCol = numericColumns.find(c => c.toLowerCase().includes('total') || c.toLowerCase().includes('sales') || c.toLowerCase().includes('revenue'));
              if (!valCol) valCol = numericColumns.length > 0 ? numericColumns[0] : undefined;
              
              let secCol = numericColumns.find(c => c !== valCol);
              
              const val1 = valCol ? Number(d[valCol] || 0) : Number(d.Sales || d.sales || d.revenue || 100);
              const val2 = secCol ? Number(d[secCol] || 0) : Number(d.Rating || d.rating || 4.0);

              totalSales += val1;
              avgRating += val2;

              const primaryCat = categoryColumn && d[categoryColumn] ? String(d[categoryColumn]) : String(d["Item Type"] || d.name || "Unknown");
              itemsObj[primaryCat] = (itemsObj[primaryCat] || 0) + val1;

              const otherCats = Object.keys(d).filter(k => !numericColumns.includes(k) && k !== categoryColumn);
              
              const compCat = otherCats.length > 0 ? String(d[otherCats[0]]) : primaryCat;
              pieData[compCat] = (pieData[compCat] || 0) + val1;

              const sizeCat = otherCats.length > 1 ? String(d[otherCats[1]]) : (secCol ? (val2 > val1 / 2 ? "High Ratio" : "Low Ratio") : primaryCat);
              outletPie[sizeCat] = (outletPie[sizeCat] || 0) + val1;

              const locCat = otherCats.length > 2 ? String(d[otherCats[2]]) : primaryCat;
              if (!outletBar[locCat]) outletBar[locCat] = { name: locCat, low: 0, reg: 0 };
              
              if (val2 > val1 / 2) {
                outletBar[locCat].low += val1;
              } else {
                outletBar[locCat].reg += val1;
              }
              locTotals[locCat] = (locTotals[locCat] || 0) + val1;

              let yearCol = numericColumns.find(c => c.toLowerCase().includes('year'));
              let yearVal = yearCol ? String(d[yearCol]) : primaryCat;
              lineDataObj[yearVal] = (lineDataObj[yearVal] || 0) + val1;
            });

            const avgSales = (totalSales / totalItems).toFixed(2);
            const avgRatingFinal = (avgRating / totalItems).toFixed(2);
            const formattedTotalSales = totalSales > 1000 ? (totalSales / 1000).toFixed(2) + "K" : totalSales.toFixed(2);

            const itemTypeData = Object.entries(itemsObj)
              .map(([name, sales]) => ({ name, sales }))
              .sort((a: any, b: any) => b.sales - a.sales)
              .slice(0, 12);
            
            const fatContentData = Object.entries(pieData).map(([name, value]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value).slice(0, 5);
            const outletSizeData = Object.entries(outletPie).map(([name, value]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value).slice(0, 5);
            const fatByOutletData = Object.values(outletBar).sort((a: any, b: any) => (b.low + b.reg) - (a.low + a.reg)).slice(0, 5);
            const estYearData = Object.entries(lineDataObj)
              .map(([year, val]) => ({ year, val }))
              .sort((a: any, b: any) => String(a.year).localeCompare(String(b.year)))
              .slice(0, 10);

            const sortedLocs = Object.entries(locTotals).sort((a: any, b: any) => b[1] - a[1]);

            let brandName = "blinkit";
            if (datasetType === "MEDICAL") brandName = "CareData";
            else if (uploadedFileName) {
              brandName = uploadedFileName.replace(/_dataset\.csv|\.csv/g, "");
              brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1);
            }

            let themeBg = "#facc15";
            let themeText = "#16a34a";
            let themeBtn = "#eab308";
            let themeBtnHover = "rgba(0,0,0,0.1)";

            const bLower = brandName.toLowerCase();
            if (bLower === "zomato") {
              themeBg = "#ef4444"; themeText = "#ffffff"; themeBtn = "#b91c1c";
            } else if (bLower === "swiggy") {
              themeBg = "#f97316"; themeText = "#ffffff"; themeBtn = "#c2410c";
            } else if (bLower === "zepto") {
              themeBg = "#a855f7"; themeText = "#ffffff"; themeBtn = "#7e22ce";
            } else if (datasetType === "MEDICAL") {
              themeBg = "#3b82f6"; themeText = "#ffffff"; themeBtn = "#1d4ed8";
            }

            return (
              <div className="w-full h-full max-w-7xl bg-[#f3f4f6] rounded-2xl shadow-2xl p-4 flex gap-4 overflow-y-auto border border-slate-200 text-slate-800 font-sans">
                {/* Left Sidebar */}
                <div className="w-64 rounded-xl flex flex-col p-4 shadow-md" style={{ backgroundColor: themeBg }}>
                  <h2 className="text-3xl font-black mb-6 tracking-tighter truncate" style={{ color: themeText }}>
                    {brandName}
                  </h2>
                  <div className="text-white font-bold py-2 px-4 rounded mb-2 text-sm shadow-sm" style={{ backgroundColor: themeBtn }}>
                    Categories
                  </div>
                  <div className="flex flex-col flex-1 overflow-y-auto pr-2">
                    {itemTypeData.map((item: any) => (
                      <button key={item.name} className="text-left text-xs font-bold py-3 border-b border-black/10 px-3 rounded transition-colors w-full truncate" style={{ color: bLower === "blinkit" ? "#334155" : "#ffffff" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = themeBtnHover} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-4">
                  {/* Top KPIs Row */}
                  <div className="flex gap-4">
                    <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col border border-slate-100">
                      <div className="bg-[#bef264] p-3 border-b-4 border-[#84cc16]">
                        <span className="text-3xl font-black text-slate-800">{formattedTotalSales}</span>
                      </div>
                      <div className="p-3 bg-white text-xs font-bold text-slate-500 uppercase tracking-wide">Total Volume</div>
                    </div>
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                      <div className="bg-white p-4 pb-0 flex-1">
                        <span className="text-3xl font-black text-slate-800">{totalItems}</span>
                      </div>
                      <div className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-t border-slate-50 mt-2 bg-slate-50/50">Total Records</div>
                    </div>
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                      <div className="bg-white p-4 pb-0 flex-1">
                        <span className="text-3xl font-black text-slate-800">{avgSales}</span>
                      </div>
                      <div className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-t border-slate-50 mt-2 bg-slate-50/50">Avg Volume</div>
                    </div>
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                      <div className="bg-white p-4 pb-0 flex-1">
                        <span className="text-3xl font-black text-slate-800">{avgRatingFinal}</span>
                      </div>
                      <div className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-t border-slate-50 mt-2 bg-slate-50/50">Avg Metric</div>
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-3 gap-4 flex-1">
                    {/* Left Column: Fat Content & Outlet */}
                    <div className="col-span-1 flex flex-col gap-4">
                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-green-500"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 mb-2 tracking-wider">COMPOSITION</h4>
                        <div className="flex-1 min-h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={fatContentData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
                                const radius = innerRadius + (outerRadius - innerRadius) + 15;
                                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                                return (
                                  <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={9}>
                                    {`${name} ${(percent * 100).toFixed(0)}%`}
                                  </text>
                                );
                              }}>
                                {fatContentData.map((e, i) => <Cell key={i} fill={i % 2 === 0 ? "#facc15" : "#16a34a"} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 mb-2 tracking-wider">COMP BY GROUP</h4>
                        <div className="flex-1 min-h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fatByOutletData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                              <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                              <Bar dataKey="low" fill="#facc15" radius={[2, 2, 0, 0]} barSize={12}>
                                <LabelList dataKey="low" position="top" fill="#64748b" fontSize={9} formatter={(val: any) => val > 1000 ? (val/1000).toFixed(1)+'k' : val} />
                              </Bar>
                              <Bar dataKey="reg" fill="#16a34a" radius={[2, 2, 0, 0]} barSize={12}>
                                <LabelList dataKey="reg" position="top" fill="#64748b" fontSize={9} formatter={(val: any) => val > 1000 ? (val/1000).toFixed(1)+'k' : val} />
                              </Bar>
                              <Tooltip cursor={{fill: '#f8fafc'}}/>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Middle Column: Item Type */}
                    <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
                      <h4 className="text-[10px] font-bold text-slate-400 mb-2 tracking-wider">CATEGORY DISTRIBUTION</h4>
                      <div className="flex-1 min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={itemTypeData} margin={{top: 0, right: 40, bottom: 0, left: 20}}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} width={80} />
                            <Bar dataKey="sales" fill="#eab308" radius={[0, 4, 4, 0]} barSize={10}>
                              <LabelList dataKey="sales" position="right" fill="#64748b" fontSize={9} formatter={(val: any) => val > 1000 ? (val/1000).toFixed(1)+'k' : val} />
                            </Bar>
                            <Tooltip cursor={{fill: '#f8fafc'}}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Right Column: Establishment, Size, Location */}
                    <div className="col-span-1 flex flex-col gap-4">
                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 mb-2 tracking-wider">TIMELINE TREND</h4>
                        <div className="flex-1 min-h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={estYearData} margin={{ top: 15, right: 20, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                              <XAxis dataKey="year" tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                              <Line type="monotone" dataKey="val" stroke="#16a34a" strokeWidth={3} dot={{r: 4, fill: '#16a34a'}}>
                                <LabelList dataKey="val" position="top" fill="#64748b" fontSize={9} formatter={(val: any) => val > 1000 ? (val/1000).toFixed(1)+'k' : val} />
                              </Line>
                              <Tooltip />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 mb-2 tracking-wider">SIZE DISTRIBUTION</h4>
                        <div className="flex-1 min-h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={outletSizeData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
                                const radius = innerRadius + (outerRadius - innerRadius) + 15;
                                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                                return (
                                  <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={9}>
                                    {`${name} ${(percent * 100).toFixed(0)}%`}
                                  </text>
                                );
                              }}>
                                {outletSizeData.map((e, i) => <Cell key={i} fill={["#16a34a", "#eab308", "#fbbf24", "#ec4899"][i % 4]} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 mb-4 tracking-wider">LOCATION VOLUME</h4>
                        <div className="flex-1 flex flex-col justify-center gap-3 px-2 overflow-y-auto max-h-[120px]">
                          {sortedLocs.slice(0, 3).map((loc, i) => (
                            <div key={i} className="mx-auto h-8 flex items-center justify-between px-3 text-xs font-bold text-white rounded-sm shadow-sm" style={{ width: `${100 - i*15}%`, backgroundColor: ["#facc15", "#16a34a", "#ec4899"][i%3] }}>
                              <span className="truncate max-w-[70%]">{loc[0]}</span>
                              <span>{(loc[1] as number) > 1000 ? ((loc[1] as number)/1000).toFixed(1) + "K" : (loc[1] as number).toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {dataState === "AI_CHAT_VIEW" && (
          <div className="w-full h-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 flex flex-col border border-slate-200">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
              <Brain className="w-8 h-8 text-indigo-600" />
              <h3 className="text-xl font-bold text-slate-800">
                AI Data Analyst
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-4">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 shadow-sm text-sm lg:text-base font-medium ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-none" : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"}`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dataState === "FORECAST_VIEW" && (
          <div className="w-full h-full max-w-5xl bg-white rounded-2xl shadow-xl p-8 flex flex-col border border-slate-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <TrendingUp className="w-8 h-8 text-indigo-600" />
              <h3 className="text-2xl font-bold text-slate-800">
                Predictive Forecasting
              </h3>
            </div>
            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    chartData.length > 0
                      ? [
                          ...chartData,
                          {
                            [categoryColumn]: "+10 periods",
                            [numericColumns[0] || "val"]:
                              chartData[chartData.length - 1]?.[
                                numericColumns[0]
                              ] * 1.15,
                          },
                          {
                            [categoryColumn]: "+20 periods",
                            [numericColumns[0] || "val"]:
                              chartData[chartData.length - 1]?.[
                                numericColumns[0]
                              ] * 1.35,
                          },
                          {
                            [categoryColumn]: "+30 periods",
                            [numericColumns[0] || "val"]:
                              chartData[chartData.length - 1]?.[
                                numericColumns[0]
                              ] * 1.6,
                          },
                        ]
                      : []
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={categoryColumn} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey={
                      numericColumns.length > 0
                        ? numericColumns[0]
                        : datasetType === "MEDICAL"
                          ? "heartRate"
                          : "sales"
                    }
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fill="#8b5cf6"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {dataState === "RESEARCH_RESULTS_VIEW" && (
          <div className="w-full h-full max-w-4xl bg-white rounded-3xl shadow-xl p-8 flex flex-col border border-slate-200 overflow-y-auto">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
              <Search className="w-8 h-8 text-indigo-500" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  Literature Search Results
                </h3>
                <p className="text-slate-500 text-sm">
                  Topic:{" "}
                  {researchTopic === "MEDICAL"
                    ? "Medical & BCI Technology"
                    : "AI & Machine Learning"}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 flex-1">
              {(researchTopic === "MEDICAL" ? medicalPapers : mlPapers).map(
                (paper, idx) => (
                  <div
                    key={paper.id}
                    className="p-5 border border-slate-200 rounded-2xl bg-slate-50 shadow-sm flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-bold text-slate-800">
                        {paper.title}
                      </h4>
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md">
                        {paper.year}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-500 mb-3">
                      {paper.authors}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed bg-white p-4 rounded-xl border border-slate-100 italic">
                      &quot;{paper.abstract}&quot;
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {dataState === "RESEARCH_REPORT_VIEW" && (
          <div className="w-full h-full max-w-4xl bg-white rounded-3xl shadow-2xl p-10 flex flex-col border border-slate-200 overflow-y-auto print:shadow-none print:border-none print:w-full print:max-w-none print:p-0">
            <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-slate-100">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-3 rounded-2xl print:bg-transparent print:p-0">
                  <Brain className="w-8 h-8 text-indigo-600 print:text-slate-800" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-800">
                    AI Literature Review
                  </h2>
                  <p className="text-slate-500 font-medium">
                    Generated by BlinkData AI Researcher
                  </p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-400">DATE</p>
                <p className="text-slate-700 font-mono">May 2026</p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none flex-1">
              {researchTopic === "MEDICAL" ? (
                <>
                  <h3 className="text-2xl font-bold text-slate-800 mb-4">
                    Executive Summary: EOG & BCIs
                  </h3>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    Recent advancements in electrooculography (EOG) have
                    demonstrated significant potential in restoring
                    communication for patients with Amyotrophic Lateral
                    Sclerosis (ALS) and Locked-in Syndrome (LIS). This review
                    synthesizes findings from 3 critical papers published
                    between 2025 and 2026.
                  </p>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">
                    Key Findings
                  </h4>
                  <ul className="list-disc pl-5 text-slate-600 space-y-2 mb-6">
                    <li>
                      <strong>Error Reduction:</strong> Novel signal processing
                      of EOG data has yielded a 40% reduction in communication
                      error rates (Smith & Doe, 2026).
                    </li>
                    <li>
                      <strong>Predictive Care:</strong> ML models can now
                      predict autonomic dysreflexia spikes with 92% accuracy
                      using continuous vitals (Lee et al., 2025).
                    </li>
                    <li>
                      <strong>Home Deployment:</strong> Non-invasive interfaces
                      are increasingly viable for at-home care, moving beyond
                      clinical settings (Johnson, 2026).
                    </li>
                  </ul>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl print:bg-white print:border-l-4 print:border-slate-800">
                    <p className="text-sm font-semibold text-blue-800 print:text-slate-900">
                      AI Conclusion
                    </p>
                    <p className="text-sm text-blue-700 mt-1 print:text-slate-800">
                      The literature strongly indicates that hybridizing EOG
                      with predictive vital sign monitoring is the most
                      promising vector for next-generation paralysis care.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-slate-800 mb-4">
                    Executive Summary: ML in Healthcare
                  </h3>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    The integration of Large Language Models (LLMs) and
                    transformer architectures into clinical telemetry has
                    reached a critical inflection point. This synthesis covers 3
                    foundational papers from 2025-2026.
                  </p>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">
                    Key Findings
                  </h4>
                  <ul className="list-disc pl-5 text-slate-600 space-y-2 mb-6">
                    <li>
                      <strong>Edge LLMs:</strong> New architectures allow
                      real-time telemetry synthesis directly on local hardware,
                      ensuring 100% HIPAA compliance without cloud latency
                      (Gupta et al., 2026).
                    </li>
                    <li>
                      <strong>Zero-Shot Detection:</strong> Transformers can
                      identify vital sign anomalies without prior patient
                      baseline training (Chen, 2025).
                    </li>
                    <li>
                      <strong>Vector Search:</strong> Fine-tuned embeddings
                      yield a 15% boost in clinical document retrieval
                      (Williams, 2026).
                    </li>
                  </ul>
                  <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-xl print:bg-white print:border-l-4 print:border-slate-800">
                    <p className="text-sm font-semibold text-purple-800 print:text-slate-900">
                      AI Conclusion
                    </p>
                    <p className="text-sm text-purple-700 mt-1 print:text-slate-800">
                      Edge-deployed transformers are fully capable of replacing
                      cloud-dependent heuristic alerts in modern ICU and
                      home-care settings.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {dataState === "UPLOAD_VIEW" && (
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-8 text-center flex flex-col items-center justify-center">
            <FileSpreadsheet className="w-20 h-20 text-indigo-500 mb-6" />
            <h3 className="text-3xl font-bold text-slate-800 mb-4">
              Upload Dataset
            </h3>
            <p className="text-slate-500 mb-6 font-medium">
              Caregiver: Please click the button below to select a CSV file from
              your computer for analysis.
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={() => {
                  stopScanner();
                  fileInputRef.current?.click();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 text-lg w-full"
              >
                <Search className="w-6 h-6" />
                Browse For File (Mouse Only)
              </button>

              <div className="flex items-center gap-4 my-2">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-slate-400 font-medium text-sm">
                  OR USE SCANNER
                </span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <AnimatePresence mode="popLayout">
                {currentOptions.map((opt, i) => {
                  const isActiveOption = i === activeIndex;
                  const Icon = opt.icon || Code;

                  return (
                    <motion.div
                      key={opt.label + i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`relative px-4 py-4 rounded-xl border-2 transition-all duration-300 shadow-sm flex items-center justify-center gap-3 text-center overflow-hidden cursor-pointer
                        ${
                          isActiveOption
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }
                      `}
                      onClick={() => {
                        stopScanner();
                        if (opt.action) opt.action();
                      }}
                    >
                      <Icon
                        className={`w-6 h-6 ${isActiveOption ? "text-indigo-600" : "text-slate-400"}`}
                      />
                      <span className="font-bold text-lg">{opt.label}</span>

                      {isActiveOption && (
                        <div
                          className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-75 ease-linear"
                          style={{ width: `${progress}%` }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {dataState !== "EXECUTING" &&
          dataState !== "CHART_VIEW" &&
          dataState !== "REPORT_VIEW" &&
          dataState !== "UPLOAD_VIEW" &&
          dataState !== "POWERBI_VIEW" &&
          dataState !== "TABLE_VIEW" &&
          dataState !== "RESEARCH_RESULTS_VIEW" &&
          dataState !== "RESEARCH_REPORT_VIEW" && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Database className="w-20 h-20 mb-6 opacity-20" />
              <p className="text-xl font-medium text-slate-500">
                Welcome to BlinkData AI.
              </p>
              <p className="text-slate-400 mt-2">
                Select an option from the menu to begin analysis.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
