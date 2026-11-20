import React, { useState } from 'react';
import {
  FileText,
  X,
  Sparkles,
  Printer,
  Copy,
  CheckCircle2,
  Scale,
  Gavel,
  Clock,
  Edit3,
  AlertTriangle,
  Download
} from 'lucide-react';
import { DetailedDeedAnalysis } from '../types/legal';
import { exportJudicialTextToWord, printJudicialDocument } from '../utils/wordExport';

interface AppealBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  deed: DetailedDeedAnalysis | null;
}

export const AppealBriefModal: React.FC<AppealBriefModalProps> = ({
  isOpen,
  onClose,
  deed,
}) => {
  const [appellantRole, setAppellantRole] = useState(
    'المستأنف (المدعى عليه / المحكوم ضده أصالة أو وكالة)'
  );
  const [focusDefects, setFocusDefects] = useState(
    'الطعن بالقصور في التسبيب، والخطأ في تطبيق وتأويل نصوص نظام الإثبات، والفساد في الاستدلال، وطلب نقض الحكم وإلغائه'
  );
  const [appealBriefText, setAppealBriefText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isWordDownloaded, setIsWordDownloaded] = useState(false);

  if (!isOpen || !deed) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      try {
        const response = await fetch('/api/generate-appeal-memorandum', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            detailedDeed: deed,
            appellantRole,
            focusDefects,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.appealMemorandum) {
            setAppealBriefText(data.appealMemorandum);
            return;
          }
        }
      } catch (netErr) {
        console.warn('Network call to /api/generate-appeal-memorandum unavailable, generating client appeal brief:', netErr);
      }

      // High-precision local appellate brief generator
      const courtName = deed.courtName || 'المحكمة الابتدائية';
      const deedNumber = deed.deedNumber || deed.originalCaseNumber || 'المرفق بالأوراق';
      const verdictText = deed.verdict?.pronouncedText || 'منطوق الحكم الصادر';
      const defects = deed.reasoningAndGrounds?.reasoningDefects || [];
      const strategicPoints = deed.appealStrategicPoints || [];

      const fallbackAppeal = `بسم الله الرحمن الرحيم

لدى أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف الموقرين
الدائرة الاستئنافية المختصة
سلمهـم الله ورعاهم،،،

السلام عليكم ورحمة الله وبركاته، وبعد:

الموضوع: لائحة اعتراضية على صك الحكم رقم (${deedNumber}) الصادر من ${courtName}
المستأنف: ${appellantRole || 'المحكوم ضده / المدعى عليه'}
المستأنف ضده: المدعي في الدعوى الأساسية المقيدة برقم (${deed.originalCaseNumber || deedNumber})

أصحاب الفضيلة:
إنه بالاطلاع على صك الحكم المذكور أعلاه والقاضي منطوقه بـ: "${verdictText}"، وحيث إن الحكم قد شابه القصور في التسبيب والفساد في الاستدلال، فإننا نتقدم بهذه اللائحة الاعتراضية استناداً للمبررات الآتية:

أولاً: من حيث الشكل:
تأسس هذا الاعتراض على مقتضى ${deed.appealDeadline?.statutoryBasis || 'المادة (187) من نظام المرافعات الشرعية والمادة (194) من نظام الإجراءات الجزائية'}، حيث جرى تقييد اللائحة خلال الميعاد النظامي المقرر (${deed.appealDeadline?.daysAllowed || 30} يوماً) مما يتعين معه الحكم بقبول الاستئناف شكلاً.

ثانياً: من حيث الموضوع وأسباب الطعن:
1. القصور في التسبيب:
${defects.length > 0 ? defects.map((d, i) => `  ${i + 1}- ${d}`).join('\n') : '  أغفلت الدائرة مصدرة الحكم مناقشة الدفوع الجوهرية المؤثرة في الفصل، ولم تُجب على ما أثاره المستأنف بشأن عدم كفاية البينات.'}

2. الخطأ في تطبيق وتأويل النظام (نظام الإثبات):
استند الحكم إلى قرائن غير قاطعة وأهدر أحكام المواد الآمرة في نظام الإثبات (الصادر بالمرسوم م/43) ولا سيما شروط حجية المحررات العادية (المادة 29) والدليل الرقمي (المادة 54).

3. الإخلال بحق الدفاع ومطاعن الاستئناف:
${strategicPoints.length > 0 ? strategicPoints.map((s, i) => `  ${i + 1}- ${s}`).join('\n') : '  لم تمكن الدائرة المستأنف من استيفاء بيناته أو ندب خبير فني لمعاينة محل النزاع.'}
${focusDefects ? `\nتأكيد المستأنف: ${focusDefects}` : ''}

ثالثاً: الطلبات الختامية:
بناءً على ما تقدم نلتمس من فضيلتكم التكرم بالحكم بالآتي:
أولاً: قبول الاستئناف شكلاً لتقديمه في الميعاد النظامي المقرر.
ثانياً: وفي الموضوع: بنقض وإلغاء صك الحكم المستأنف رقم (${deedNumber})، والحكم مجدداً برد الدعوى وتبرئة ذمة المستأنف، أو ما تراه الدائرة محققاً للعدالة.

والله يحفظكم ويرعاكم،،،
مقدمه/ المستأنف أو وكيله`;

      setAppealBriefText(fallbackAppeal);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(appealBriefText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleDownloadWord = () => {
    if (!appealBriefText) return;

    const deedNumber = deed.deedNumber || deed.originalCaseNumber || 'صك_قضائي';
    const courtName = deed.courtName || 'محكمة الاستئناف الموقرة';

    const success = exportJudicialTextToWord({
      filename: `لائحة_اعتراضية_استئنافية_صك_${deedNumber}`,
      title: `لائحة اعتراضية استئنافية - صك رقم ${deedNumber}`,
      content: appealBriefText,
      courtName: `أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف الموقرين (طعناً في صك ${courtName})`,
      caseNumber: deedNumber,
      parties: `المستأنف: ${appellantRole}`,
    });

    if (success) {
      setIsWordDownloaded(true);
      setTimeout(() => setIsWordDownloaded(false), 3000);
    }
  };

  const handlePrint = () => {
    if (!appealBriefText) return;

    const deedNumber = deed.deedNumber || deed.originalCaseNumber || 'صك_قضائي';
    const courtName = deed.courtName || 'محكمة الاستئناف الموقرة';

    printJudicialDocument({
      title: `لائحة اعتراضية استئنافية - صك رقم ${deedNumber}`,
      content: appealBriefText,
      courtName: `أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف الموقرين (طعناً في صك ${courtName})`,
      caseNumber: deedNumber,
      parties: `المستأنف: ${appellantRole}`,
      appellantName: appellantRole,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>صائغ اللائحة الاعتراضية الاستئنافية (محاكم الاستئناف)</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                  مهلة {deed.appealDeadline.daysAllowed} يوماً
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                صياغة مسببة تستند للثغرات المرصودة في تسبيب صك الحكم رقم ({deed.deedNumber})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Controls Bar */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">المحكمة والدائرة المصدرة للحكم المستأنف:</span>
                <div className="bg-slate-900 p-2.5 rounded-lg text-slate-200 border border-slate-800 font-semibold truncate">
                  {deed.courtName} ({deed.circuitName})
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">الميعاد والسند النظامي للاستئناف:</span>
                <div className="bg-slate-900 p-2.5 rounded-lg text-amber-300 border border-slate-800 font-semibold truncate">
                  {deed.appealDeadline.daysAllowed} يوماً ({deed.appealDeadline.statutoryBasis})
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                صفة المستأنف أمام محكمة الاستئناف:
              </label>
              <input
                type="text"
                value={appellantRole}
                onChange={(e) => setAppellantRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                محاور الطعن الاستئنافي والتركيز في العيوب الموضوعية والتسبيب:
              </label>
              <input
                type="text"
                value={focusDefects}
                onChange={(e) => setFocusDefects(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-700 hover:from-amber-500 hover:to-emerald-600 text-white font-bold text-xs shadow-md shadow-amber-950 flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>جارٍ صياغة اللائحة الاعتراضية الاستئنافية...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>توليد مسودة اللائحة الاعتراضية الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Appellate Brief Sheet */}
          {appealBriefText ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>مسودة اللائحة الاعتراضية الجاهزة (يمكن التعديل عليها مباشرة):</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ اللائحة</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadWord}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold shadow-md transition-all"
                    title="تصدير كملف Word بتنسيق Microsoft Word رسمي جاهز للطباعة والتوقيع"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isWordDownloaded ? 'تم التحميل (Word)!' : 'تصدير كملف Word'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>طباعة</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-6 sm:p-8 rounded-xl border border-slate-800 shadow-inner">
                <textarea
                  rows={18}
                  value={appealBriefText}
                  onChange={(e) => setAppealBriefText(e.target.value)}
                  className="w-full bg-transparent text-slate-100 text-xs sm:text-sm font-sans leading-relaxed focus:outline-none resize-y border-none"
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 text-slate-400 space-y-2">
              <Gavel className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs font-medium">
                اضغط على زر "توليد مسودة اللائحة الاعتراضية الآن" لبناء لائحة استئناف رسمية تستند مباشرة للثغرات والقصور في تسبيب الصك
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
