import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileText,
  FileUp,
  Gavel,
  Hash,
  Landmark,
  ListChecks,
  Loader2,
  RefreshCw,
  Scale,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Tag,
  User,
  Users,
  Wallet,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { printJudicialDocument } from '../utils/wordExport';
import { tahlilSok } from '../utils/tahlilSok';

export interface HighAccuracyDeedAnalysis {
  بيانات_القضية: {
    رقم_الصك: string;
    رقم_القضية: string;
    المحكمة: string;
    الدائرة: string;
    تاريخ_الصك_هجري: string;
    نوع_القضية: string;
  };
  الاطراف: {
    المدعي: string;
    المدعى_عليه: string;
    رقم_هوية_المدعى_عليه: string;
    الجنسية: string;
  };
  الوقائع: string;
  التهمة_والمادة_النظامية: string;
  الادلة: string[];
  منطوق_الحكم_حرفيا: string;
  العقوبات: {
    السجن: string;
    الغرامة: string;
    المنع_من_السفر: string;
    المصادرة: string;
    اشياء_اخرى: string;
  };
  هل_الحكم_نهائي: string;
  الصفة_النهائية: string;
  الاستئناف_والنقض: string;
  التماس_اعادة_النظر: {
    هل_يقبل_التماس: string;
    السبب: string;
    الشروط_المطلوبة: string;
  };
  تنبيهات_الدقة: string[];
  ملخص_بسيط_للمواطن: string;
}

interface SourceModalState {
  isOpen: boolean;
  sectionTitle: string;
  extractedPreview: string;
  suggestedPage: number;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 35 * 1024 * 1024; // 35 MB (يكفي لصكوك تصل إلى 20+ صفحة)

function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(';base64,') ? dataUrl.split(';base64,')[1] : dataUrl;
      let mimeType = file.type.toLowerCase();
      if (!mimeType) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lower.endsWith('.png')) mimeType = 'image/png';
        else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
      }
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف داخل المتصفح.'));
    reader.readAsDataURL(file);
  });
}

async function estimatePdfPageCount(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(buffer);
    const pageMatches = text.match(/\/Type\s*\/Page\b(?!s)/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
    const countMatches = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
    if (countMatches.length > 0) {
      return Math.max(...countMatches);
    }
  } catch {
    // Fallback gracefully
  }
  return 1;
}

function formatFullAnalysisAsText(result: HighAccuracyDeedAnalysis): string {
  const c = result.بيانات_القضية;
  const p = result.الاطراف;
  const pen = result.العقوبات;
  const pet = result.التماس_اعادة_النظر;

  return [
    'تقرير تحليل صك الحكم (دقة عالية - Gemini 2.5 Pro)',
    '====================================================',
    '',
    'ملخص بسيط للمواطن:',
    result.ملخص_بسيط_للمواطن,
    '',
    'أولاً: بيانات القضية:',
    `- رقم الصك: ${c.رقم_الصك}`,
    `- رقم القضية: ${c.رقم_القضية}`,
    `- المحكمة: ${c.المحكمة}`,
    `- الدائرة: ${c.الدائرة}`,
    `- تاريخ الصك (هجري): ${c.تاريخ_الصك_هجري}`,
    `- نوع القضية: ${c.نوع_القضية}`,
    '',
    'ثانياً: الأطراف:',
    `- المدعي: ${p.المدعي}`,
    `- المدعى عليه: ${p.المدعى_عليه}`,
    `- رقم هوية المدعى عليه: ${p.رقم_هوية_المدعى_عليه}`,
    `- الجنسية: ${p.الجنسية}`,
    '',
    'ثالثاً: الوقائع:',
    result.الوقائع,
    '',
    'رابعاً: التهمة والمادة النظامية:',
    result.التهمة_والمادة_النظامية,
    '',
    'خامساً: الأدلة:',
    ...result.الادلة.map((ev, idx) => `${idx + 1}. ${ev}`),
    '',
    'سادساً: منطوق الحكم حرفياً:',
    result.منطوق_الحكم_حرفيا,
    '',
    'سابعاً: العقوبات:',
    `- السجن: ${pen.السجن}`,
    `- الغرامة: ${pen.الغرامة}`,
    `- المنع من السفر: ${pen.المنع_من_السفر}`,
    `- المصادرة: ${pen.المصادرة}`,
    `- أشياء أخرى: ${pen.اشياء_اخرى}`,
    '',
    'ثامناً: الصفة النهائية والاستئناف والنقض:',
    `- هل الحكم نهائي: ${result.هل_الحكم_نهائي}`,
    `- الصفة النهائية: ${result.الصفة_النهائية}`,
    `- الاستئناف والنقض: ${result.الاستئناف_والنقض}`,
    '',
    'تاسعاً: التماس إعادة النظر:',
    `- هل يقبل التماس: ${pet.هل_يقبل_التماس}`,
    `- السبب: ${pet.السبب}`,
    `- الشروط المطلوبة: ${pet.الشروط_المطلوبة}`,
    '',
    'عاشراً: تنبيهات الدقة:',
    ...(result.تنبيهات_الدقة.length > 0
      ? result.تنبيهات_الدقة.map((w, idx) => `${idx + 1}. ${w}`)
      : ['لا توجد تناقضات مرصودة.']),
    '',
    '----------------------------------------------------',
    'هذا تحليل ذكاء اصطناعي بدقة عالية للتوضيح فقط، وليس استشارة قانونية، ويجب مراجعة محامي للتأكد',
  ].join('\n');
}

export const JudgmentDeedAnalyzerPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<HighAccuracyDeedAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<'simple' | 'legal' | 'verbatim'>('simple');
  const [copied, setCopied] = useState(false);
  const [copiedVerdict, setCopiedVerdict] = useState(false);

  // Text analysis mode via OpenAI gpt-4o (tahlilSok)
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [deedTextInput, setDeedTextInput] = useState('');
  const [textAnalysisResult, setTextAnalysisResult] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);

  // Source verification modal state
  const [sourceModal, setSourceModal] = useState<SourceModalState>({
    isOpen: false,
    sectionTitle: '',
    extractedPreview: '',
    suggestedPage: 1,
  });
  const [pdfPageNumber, setPdfPageNumber] = useState<number>(1);
  const [estimatedTotalPages, setEstimatedTotalPages] = useState<number>(1);
  const [imageZoom, setImageZoom] = useState<number>(100);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (fileObjectUrl) {
        URL.revokeObjectURL(fileObjectUrl);
      }
    };
  }, [fileObjectUrl]);

  const validateFile = (file: File): string | null => {
    const lowerName = file.name.toLowerCase();
    const isValidExt =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png');
    const isValidMime = ACCEPTED_TYPES.includes(file.type.toLowerCase());

    if (!isValidMime && !isValidExt) {
      return 'صيغة الملف غير مدعومة. يرجى اختيار ملف PDF أو صورة JPG أو PNG فقط.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'حجم الملف يتجاوز الحد المسموح به (35 ميجابايت). يرجى اختيار ملف أصغر.';
    }
    return null;
  };

  const analyzeFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setResult(null);
      return;
    }

    if (fileObjectUrl) {
      URL.revokeObjectURL(fileObjectUrl);
    }

    const nextObjectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setFileObjectUrl(nextObjectUrl);
    setErrorMessage(null);
    setResult(null);
    setIsLoading(true);

    try {
      const { base64, mimeType } = await readFileAsBase64(file);
      setFileMimeType(mimeType);
      if (mimeType === 'application/pdf') {
        const count = await estimatePdfPageCount(file);
        setEstimatedTotalPages(count);
      } else {
        setEstimatedTotalPages(1);
      }

      const response = await fetch('/api/analyze-judgment-deed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType,
          fileName: file.name,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.result) {
        throw new Error(
          data?.error || `فشل تحليل الصك (رمز الاستجابة ${response.status}). يرجى المحاولة مرة أخرى.`
        );
      }

      setResult(data.result as HighAccuracyDeedAnalysis);
      setActiveTab('simple');
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'حدث خطأ غير متوقع أثناء تحليل صك الحكم. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      analyzeFile(file);
    }
  };

  const openSourceModal = (
    sectionTitle: string,
    extractedPreview: string,
    suggestedPage = 1
  ) => {
    const resolvedPage =
      suggestedPage >= 999
        ? Math.max(1, estimatedTotalPages)
        : Math.min(Math.max(1, suggestedPage), Math.max(1, estimatedTotalPages));
    setPdfPageNumber(resolvedPage);
    setImageZoom(100);
    setSourceModal({
      isOpen: true,
      sectionTitle,
      extractedPreview,
      suggestedPage: resolvedPage,
    });
  };

  const VerifySourceButton: React.FC<{
    sectionTitle: string;
    extractedPreview: string;
    suggestedPage?: number;
  }> = ({ sectionTitle, extractedPreview, suggestedPage = 1 }) => (
    <button
      type="button"
      onClick={() => openSourceModal(sectionTitle, extractedPreview, suggestedPage)}
      disabled={!fileObjectUrl}
      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-amber-600/20 text-amber-300 hover:text-amber-200 border border-amber-600/40 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
    >
      <FileSearch className="w-3.5 h-3.5" />
      <span>تحقق من المصدر</span>
    </button>
  );

  const handleCopyFull = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatFullAnalysisAsText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleCopyVerdict = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.منطوق_الحكم_حرفيا);
      setCopiedVerdict(true);
      setTimeout(() => setCopiedVerdict(false), 2500);
    } catch {
      setCopiedVerdict(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!result) return;
    const c = result.بيانات_القضية;
    const p = result.الاطراف;

    printJudicialDocument({
      title: `تحليل صك الحكم - ${c.رقم_الصك}`,
      content: formatFullAnalysisAsText(result),
      courtName: c.المحكمة || 'المحكمة المختصة',
      caseNumber: c.رقم_الصك || c.رقم_القضية || 'غير مذكورة',
      parties: `المدعي: ${p.المدعي} | المدعى عليه: ${p.المدعى_عليه}`,
      date: c.تاريخ_الصك_هجري || new Date().toLocaleDateString('ar-SA'),
      appellantName: 'تحليل صك الحكم بدقة عالية',
    });
  };

  const handleRunTextTahlil = async () => {
    if (!deedTextInput.trim()) return;
    setIsTextLoading(true);
    setErrorMessage(null);
    setTextAnalysisResult(null);
    const output = await tahlilSok(deedTextInput);
    if (output.startsWith('❌ خطأ:')) {
      setErrorMessage(output);
    } else {
      setTextAnalysisResult(output);
    }
    setIsTextLoading(false);
  };

  const handleReset = () => {
    if (fileObjectUrl) {
      URL.revokeObjectURL(fileObjectUrl);
    }
    setSelectedFile(null);
    setFileObjectUrl(null);
    setFileMimeType('');
    setResult(null);
    setTextAnalysisResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isPdfFile = fileMimeType === 'application/pdf' || selectedFile?.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Hero Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 border border-emerald-800/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تحليل دقيق صفحة بصفحة (Gemini 2.5 Pro • درجة الحرارة 0)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
              <Gavel className="w-7 h-7 text-amber-400 shrink-0" />
              <span>تحليل صك الحكم بدقة عالية</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              ارفع صك الحكم كاملاً (ملف PDF حتى 20+ صفحة أو صور JPG/PNG). يقوم النظام بقراءة الصك
              صفحةً بصفحة حتى الصفحة الأخيرة لاستخراج البيانات والأرقام والمنطوق حرفياً ورصد أي
              تناقض، مع زر «تحقق من المصدر» للرجوع إلى الصفحة الأصلية في الصك فوراً.
            </p>
          </div>

          <div className="shrink-0 bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 space-y-1 max-w-xs">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4" />
              <span>التزام حرفي بالصك فقط</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              لا تخمين ولا اختلاق؛ أي معلومة غير واردة تُكتب «غير مذكورة في الصك»، ولا تُحفظ
              ملفاتك على الخادم.
            </p>
          </div>
        </div>
      </div>

      {/* Input Mode Switcher (PDF/Image via Gemini 2.5 Pro vs Pasted Text via OpenAI gpt-4o) */}
      {!isLoading && !isTextLoading && !result && !textAnalysisResult && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setInputMode('file');
              setErrorMessage(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              inputMode === 'file'
                ? 'bg-emerald-700 text-white shadow-md border border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileUp className="w-4 h-4 text-amber-300" />
            <span>رفع ملف الصك (PDF / JPG / PNG — Gemini 2.5 Pro)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInputMode('text');
              setErrorMessage(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              inputMode === 'text'
                ? 'bg-amber-600 text-white shadow-md border border-amber-400/40'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-200" />
            <span>لصق نص الصك للتحليل الفوري (OpenAI GPT-4o)</span>
          </button>
        </div>
      )}

      {/* File Upload Dropzone */}
      {inputMode === 'file' && !isLoading && !result && !textAnalysisResult && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all ${
            isDragging
              ? 'border-amber-400 bg-amber-950/20'
              : 'border-slate-700 bg-slate-900/70 hover:border-emerald-600/70 hover:bg-slate-900'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-amber-400 mb-4">
            <FileUp className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-white mb-2">
            ارفع ملف صك الحكم كاملاً للتحليل الدقيق
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mb-6">
            يقبل <span className="text-emerald-300 font-semibold">PDF</span> (حتى 20 صفحة وأكثر) أو صور{' '}
            <span className="text-emerald-300 font-semibold">JPG</span> /{' '}
            <span className="text-emerald-300 font-semibold">PNG</span> — يُرسل الملف كاملاً دون
            تجزئة أو فقدان للصفحة الأخيرة.
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>اختيار ملف الصك (PDF / JPG / PNG)</span>
          </button>
        </div>
      )}

      {/* Text Paste Card via OpenAI gpt-4o (tahlilSok) */}
      {inputMode === 'text' && !isLoading && !isTextLoading && !result && !textAnalysisResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <span>لصق نص صك الحكم أو محضر الضبط للتحليل (OpenAI GPT-4o)</span>
            </h3>
            <p className="text-xs text-slate-400">
              يستدعي دالة <code className="text-amber-300">tahlilSok</code> على الخادم باستخدام{' '}
              <code className="text-emerald-300">OPENAI_API_KEY</code> من إعدادات الأسرار / ملف{' '}
              <code className="text-emerald-300">.env</code> بأمان دون تضمين المفتاح في المتصفح.
            </p>
          </div>

          <textarea
            value={deedTextInput}
            onChange={(e) => setDeedTextInput(e.target.value)}
            rows={8}
            placeholder="الصق هنا نص صك الحكم أو محضر الضبط أو التحقيق..."
            className="w-full rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-500 focus:outline-none p-4 text-xs sm:text-sm text-slate-100 leading-relaxed resize-y"
          />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleRunTextTahlil}
              disabled={!deedTextInput.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-md transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>تحليل النص الآن (GPT-4o)</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator for text mode */}
      {isTextLoading && (
        <div className="bg-slate-900 border border-amber-700/50 rounded-2xl p-10 text-center space-y-3 shadow-xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <h3 className="text-lg font-bold text-white">جاري تحليل النص عبر GPT-4o...</h3>
        </div>
      )}

      {/* Text Analysis Result Display */}
      {!isTextLoading && textAnalysisResult && (
        <div className="bg-slate-900 border border-emerald-800/50 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <FileCheck2 className="w-5 h-5" />
              <span>نتيجة التحليل القضائي (OpenAI GPT-4o)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    .writeText(textAnalysisResult)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    })
                    .catch(() => {});
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                    <span>نسخ النتيجة</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-xs font-bold text-emerald-200 border border-emerald-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحليل جديد</span>
              </button>
            </div>
          </div>
          <div className="text-xs sm:text-sm text-slate-100 leading-loose whitespace-pre-line bg-slate-950/70 border border-slate-800 rounded-xl p-5">
            {textAnalysisResult}
          </div>
        </div>
      )}

      {/* High-Accuracy Loading Screen */}
      {isLoading && (
        <div className="bg-slate-900 border border-emerald-800/50 rounded-2xl p-10 text-center space-y-4 shadow-xl">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-white">
            جاري قراءة الصك صفحة صفحة... جاري التحقق من الأرقام...
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            التحليل الدقيق عبر نموذج <span className="text-amber-300 font-semibold">Gemini 2.5 Pro</span>{' '}
            يستغرق عادةً من <span className="text-emerald-300 font-semibold">20 إلى 40 ثانية</span>{' '}
            لمطابقة الأرقام والتواريخ وفحص الصفحة الأخيرة والصفة النهائية.
          </p>
          {selectedFile && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>{selectedFile.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Screen */}
      {!isLoading && errorMessage && (
        <div className="bg-rose-950/35 border border-rose-800/70 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <XCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-rose-200">تعذر إتمام تحليل صك الحكم</h3>
            <p className="text-xs sm:text-sm text-rose-300/90 max-w-xl mx-auto leading-relaxed">
              {errorMessage}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            {selectedFile && (
              <button
                type="button"
                onClick={() => analyzeFile(selectedFile)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>رفع ملف آخر</span>
            </button>
          </div>
        </div>
      )}

      {/* Results View (3 Tabs) */}
      {!isLoading && result && (
        <div className="space-y-6">
          {/* Top Action Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  صك رقم: {result.بيانات_القضية.رقم_الصك}
                </h3>
                {selectedFile && (
                  <p className="text-[11px] text-slate-400">{selectedFile.name}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  openSourceModal('مستند صك الحكم الأصلي', `ملف: ${selectedFile?.name || 'الصك'}`, 1)
                }
                disabled={!fileObjectUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-amber-700/40 transition-colors cursor-pointer"
              >
                <FileSearch className="w-4 h-4" />
                <span>عرض الصك الأصلي</span>
              </button>

              <button
                type="button"
                onClick={handleCopyFull}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-300" />
                    <span>نسخ التحليل</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تحميل PDF للتحليل</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 text-xs font-semibold border border-emerald-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحليل صك جديد</span>
              </button>
            </div>
          </div>

          {/* Accuracy Alerts Banner (Always visible if contradictions or missing items exist) */}
          {result.تنبيهات_الدقة && result.تنبيهات_الدقة.length > 0 && (
            <div className="bg-amber-950/35 border border-amber-600/60 rounded-2xl p-5 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>تنبيهات الدقة وملاحظات التطابق في الصك</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openSourceModal(
                      'التحقق من تنبيهات الدقة',
                      result.تنبيهات_الدقة.join('\n• '),
                      1
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 text-xs font-semibold cursor-pointer"
                >
                  <FileSearch className="w-3.5 h-3.5" />
                  <span>تحقق من المصدر</span>
                </button>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                {result.تنبيهات_الدقة.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 3 Results Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('simple')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'simple'
                  ? 'bg-emerald-700 text-white shadow-md border border-emerald-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <User className="w-4 h-4 text-amber-300" />
              <span>1. ملخص بسيط للمواطن</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('legal')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'legal'
                  ? 'bg-emerald-700 text-white shadow-md border border-emerald-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Scale className="w-4 h-4 text-emerald-300" />
              <span>2. التحليل القانوني الكامل</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('verbatim')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'verbatim'
                  ? 'bg-amber-600 text-white shadow-md border border-amber-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ScrollText className="w-4 h-4 text-amber-200" />
              <span>3. منطوق الحكم حرفياً</span>
            </button>
          </div>

          {/* TAB 1: ملخص بسيط للمواطن */}
          {activeTab === 'simple' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-700/50 rounded-2xl p-6 shadow-lg space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 text-base font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>خلاصة الحكم بالعامية السعودية البسيطة</span>
                </div>
                <p className="text-sm sm:text-base text-white leading-loose whitespace-pre-line font-medium">
                  {result.ملخص_بسيط_للمواطن}
                </p>
                <VerifySourceButton
                  sectionTitle="ملخص بسيط للمواطن"
                  extractedPreview={result.ملخص_بسيط_للمواطن}
                  suggestedPage={1}
                />
              </div>

              {/* Quick Cards for Citizen Clarity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <Gavel className="w-4 h-4" />
                    <span>هل الحكم نهائي؟</span>
                  </div>
                  <p className="text-sm font-bold text-white">{result.هل_الحكم_نهائي}</p>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {result.الصفة_النهائية}
                  </p>
                  <VerifySourceButton
                    sectionTitle="الصفة النهائية والقطعية (راجع الصفحة الأخيرة)"
                    extractedPreview={`${result.هل_الحكم_نهائي}\n${result.الصفة_النهائية}`}
                    suggestedPage={999}
                  />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    <span>العقوبات أو الحقوق المحكوم بها</span>
                  </div>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-slate-200">
                    <li><strong className="text-slate-400">السجن:</strong> {result.العقوبات.السجن}</li>
                    <li><strong className="text-slate-400">الغرامة:</strong> {result.العقوبات.الغرامة}</li>
                    <li><strong className="text-slate-400">المنع من السفر:</strong> {result.العقوبات.المنع_من_السفر}</li>
                    <li><strong className="text-slate-400">المصادرة:</strong> {result.العقوبات.المصادرة}</li>
                    <li><strong className="text-slate-400">أشياء أخرى:</strong> {result.العقوبات.اشياء_اخرى}</li>
                  </ul>
                  <VerifySourceButton
                    sectionTitle="العقوبات المحكوم بها"
                    extractedPreview={result.منطوق_الحكم_حرفيا}
                    suggestedPage={1}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: التحليل القانوني الكامل */}
          {activeTab === 'legal' && (
            <div className="space-y-5">
              {/* بيانات القضية */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <Landmark className="w-5 h-5" />
                  <span>بيانات القضية والصك</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs sm:text-sm">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                      <Hash className="w-3.5 h-3.5 text-emerald-400" /> رقم الصك
                    </div>
                    <div className="font-bold text-white">{result.بيانات_القضية.رقم_الصك}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                      <Hash className="w-3.5 h-3.5 text-amber-400" /> رقم القضية
                    </div>
                    <div className="font-bold text-white">{result.بيانات_القضية.رقم_القضية}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                      <Landmark className="w-3.5 h-3.5 text-emerald-400" /> المحكمة
                    </div>
                    <div className="font-bold text-white">{result.بيانات_القضية.المحكمة}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                      <Scale className="w-3.5 h-3.5 text-amber-400" /> الدائرة
                    </div>
                    <div className="font-bold text-white">{result.بيانات_القضية.الدائرة}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" /> تاريخ الصك (هجري)
                    </div>
                    <div className="font-bold text-white">{result.بيانات_القضية.تاريخ_الصك_هجري}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                      <Tag className="w-3.5 h-3.5 text-amber-400" /> نوع القضية
                    </div>
                    <div className="font-bold text-white">{result.بيانات_القضية.نوع_القضية}</div>
                  </div>
                </div>
                <VerifySourceButton
                  sectionTitle="بيانات القضية ورقم الصك"
                  extractedPreview={`رقم الصك: ${result.بيانات_القضية.رقم_الصك}\nرقم القضية: ${result.بيانات_القضية.رقم_القضية}\nالمحكمة: ${result.بيانات_القضية.المحكمة}\nالتاريخ: ${result.بيانات_القضية.تاريخ_الصك_هجري}`}
                  suggestedPage={1}
                />
              </div>

              {/* الأطراف */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>الأطراف</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs sm:text-sm">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">المدعي</div>
                    <div className="font-bold text-white">{result.الاطراف.المدعي}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">المدعى عليه</div>
                    <div className="font-bold text-white">{result.الاطراف.المدعى_عليه}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">رقم هوية المدعى عليه</div>
                    <div className="font-bold text-white">{result.الاطراف.رقم_هوية_المدعى_عليه}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">الجنسية</div>
                    <div className="font-bold text-white">{result.الاطراف.الجنسية}</div>
                  </div>
                </div>
                <VerifySourceButton
                  sectionTitle="بيانات الأطراف ورقم الهوية"
                  extractedPreview={`المدعي: ${result.الاطراف.المدعي}\nالمدعى عليه: ${result.الاطراف.المدعى_عليه}\nالهوية: ${result.الاطراف.رقم_هوية_المدعى_عليه}\nالجنسية: ${result.الاطراف.الجنسية}`}
                  suggestedPage={1}
                />
              </div>

              {/* الوقائع */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>الوقائع (كاملة كما وردت في الصك)</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {result.الوقائع}
                </p>
                <VerifySourceButton
                  sectionTitle="الوقائع المذكورة في الصك"
                  extractedPreview={result.الوقائع}
                  suggestedPage={1}
                />
              </div>

              {/* التهمة والمادة النظامية + الأدلة */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
                  <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    <span>التهمة والمادة النظامية</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {result.التهمة_والمادة_النظامية}
                  </p>
                  <VerifySourceButton
                    sectionTitle="التهمة والمادة النظامية"
                    extractedPreview={result.التهمة_والمادة_النظامية}
                    suggestedPage={2}
                  />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
                  <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                    <ListChecks className="w-5 h-5" />
                    <span>الأدلة والقرائن</span>
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {result.الادلة.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                  <VerifySourceButton
                    sectionTitle="الأدلة المذكورة في الصك"
                    extractedPreview={result.الادلة.join('\n• ')}
                    suggestedPage={2}
                  />
                </div>
              </div>

              {/* العقوبات */}
              <div className="bg-slate-900 border border-emerald-800/40 rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  <span>العقوبات أو المحكوم به</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs sm:text-sm">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">السجن</div>
                    <div className="font-bold text-white">{result.العقوبات.السجن}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">الغرامة</div>
                    <div className="font-bold text-white">{result.العقوبات.الغرامة}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">المنع من السفر</div>
                    <div className="font-bold text-white">{result.العقوبات.المنع_من_السفر}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">المصادرة</div>
                    <div className="font-bold text-white">{result.العقوبات.المصادرة}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">أشياء أخرى</div>
                    <div className="font-bold text-white">{result.العقوبات.اشياء_اخرى}</div>
                  </div>
                </div>
                <VerifySourceButton
                  sectionTitle="تفاصيل العقوبات والمبالغ"
                  extractedPreview={`السجن: ${result.العقوبات.السجن}\nالغرامة: ${result.العقوبات.الغرامة}\nالمنع من السفر: ${result.العقوبات.المنع_من_السفر}\nالمصادرة: ${result.العقوبات.المصادرة}`}
                  suggestedPage={2}
                />
              </div>

              {/* الصفة النهائية والاستئناف والنقض */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-amber-700/40 rounded-2xl p-5 space-y-2.5">
                  <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                    <Gavel className="w-5 h-5" />
                    <span>الصفة النهائية والقطعية</span>
                  </h3>
                  <div className="text-xs sm:text-sm text-white font-semibold">
                    هل الحكم نهائي: <span className="text-amber-300">{result.هل_الحكم_نهائي}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {result.الصفة_النهائية}
                  </p>
                  <VerifySourceButton
                    sectionTitle="الصفة النهائية والصيغة التنفيذية (الصفحة الأخيرة)"
                    extractedPreview={`${result.هل_الحكم_نهائي}\n${result.الصفة_النهائية}`}
                    suggestedPage={999}
                  />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
                  <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                    <Scale className="w-5 h-5" />
                    <span>الاستئناف والنقض</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {result.الاستئناف_والنقض}
                  </p>
                  <VerifySourceButton
                    sectionTitle="طلبات الاستئناف والنقض وقرار المحكمة"
                    extractedPreview={result.الاستئناف_والنقض}
                    suggestedPage={999}
                  />
                </div>
              </div>

              {/* التماس إعادة النظر */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  <span>التماس إعادة النظر</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">هل يقبل التماس؟</div>
                    <div className="font-bold text-amber-300">
                      {result.التماس_اعادة_النظر.هل_يقبل_التماس}
                    </div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">السبب</div>
                    <div className="text-slate-200 leading-relaxed">
                      {result.التماس_اعادة_النظر.السبب}
                    </div>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">الشروط المطلوبة</div>
                    <div className="text-slate-200 leading-relaxed">
                      {result.التماس_اعادة_النظر.الشروط_المطلوبة}
                    </div>
                  </div>
                </div>
                <VerifySourceButton
                  sectionTitle="التماس إعادة النظر والصفة النهائية"
                  extractedPreview={`${result.التماس_اعادة_النظر.هل_يقبل_التماس} — ${result.التماس_اعادة_النظر.السبب}`}
                  suggestedPage={999}
                />
              </div>
            </div>
          )}

          {/* TAB 3: منطوق الحكم حرفياً */}
          {activeTab === 'verbatim' && (
            <div className="bg-gradient-to-br from-slate-900 to-amber-950/25 border border-amber-700/60 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5 text-amber-300 font-bold text-base sm:text-lg">
                  <ScrollText className="w-6 h-6" />
                  <span>منطوق الحكم حرفياً كما ورد في الصك</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyVerdict}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedVerdict ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">تم نسخ المنطوق</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-amber-300" />
                      <span>نسخ المنطوق حرفياً</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 sm:p-6 text-sm sm:text-base text-white leading-loose whitespace-pre-line font-medium">
                {result.منطوق_الحكم_حرفيا}
              </div>

              <VerifySourceButton
                sectionTitle="منطوق الحكم حرفياً"
                extractedPreview={result.منطوق_الحكم_حرفيا}
                suggestedPage={2}
              />
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Mandatory Disclaimer */}
      <div className="bg-amber-950/40 border border-amber-700/60 rounded-xl p-4 flex items-center gap-3 shadow-sm">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-xs sm:text-sm font-semibold text-amber-200 leading-relaxed">
          هذا تحليل ذكاء اصطناعي بدقة عالية للتوضيح فقط، وليس استشارة قانونية، ويجب مراجعة محامي
          للتأكد
        </p>
      </div>

      {/* In-App Source Verification Modal ("تحقق من المصدر") */}
      {sourceModal.isOpen && fileObjectUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <FileSearch className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    تحقق من المصدر — {sourceModal.sectionTitle}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    مقارنة مباشرة مع ملف الصك الأصلي المرفوع ({selectedFile?.name})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isPdfFile ? (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                    <span className="text-slate-400">انتقال لصفحة:</span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={pdfPageNumber}
                      onChange={(e) => setPdfPageNumber(Math.max(1, Number(e.target.value) || 1))}
                      className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setPdfPageNumber(1)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    >
                      الأولى
                    </button>
                    {estimatedTotalPages > 1 && (
                      <button
                        type="button"
                        onClick={() => setPdfPageNumber(estimatedTotalPages)}
                        className="px-2 py-0.5 rounded bg-amber-600/25 hover:bg-amber-600/40 text-amber-200 border border-amber-500/40 cursor-pointer"
                        title="الانتقال للصفحة الأخيرة (الصفة النهائية والصيغة التنفيذية)"
                      >
                        الأخيرة ({estimatedTotalPages})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(50, z - 25))}
                      className="p-1 text-slate-300 hover:text-white cursor-pointer"
                      title="تصغير"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-200 font-bold min-w-[42px] text-center">
                      {imageZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(250, z + 25))}
                      className="p-1 text-slate-300 hover:text-white cursor-pointer"
                      title="تكبير"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <a
                  href={fileObjectUrl}
                  download={selectedFile?.name || 'judgment-deed'}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold border border-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>تنزيل الأصل</span>
                </a>

                <button
                  type="button"
                  onClick={() => setSourceModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Extracted Comparison Strip */}
            <div className="px-5 py-3 bg-emerald-950/30 border-b border-emerald-900/40 text-xs text-slate-200 max-h-32 overflow-y-auto">
              <span className="font-bold text-amber-300 ml-2">المعلومة المستخرجة للمطابقة:</span>
              <span className="whitespace-pre-line">{sourceModal.extractedPreview}</span>
            </div>

            {/* Embedded Original File Viewer */}
            <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-2">
              {isPdfFile ? (
                <iframe
                  key={`pdf-page-${pdfPageNumber}`}
                  src={`${fileObjectUrl}#page=${pdfPageNumber}`}
                  title="معاينة صك الحكم الأصلي"
                  className="w-full h-full rounded-lg border border-slate-800 bg-white"
                />
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={fileObjectUrl}
                    alt="صك الحكم الأصلي"
                    style={{ width: `${imageZoom}%`, maxWidth: 'none' }}
                    className="rounded-lg shadow-xl border border-slate-800 transition-all"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
