import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { extractText } from 'unpdf';
import {
  generateSaudiLegalAnalysisFallback,
  generateIntelligentJudicialAdvisorReply,
} from './src/utils/fallbackLegalAnalyzer.ts';
import {
  HIGH_ACCURACY_MODEL,
  HIGH_ACCURACY_MODEL_CONFIG,
  DEED_ANALYSIS_SYSTEM_PROMPT,
  DEED_ANALYSIS_USER_PROMPT,
} from './prompt.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '65mb' }));
app.use(express.urlencoded({ extended: true, limit: '65mb' }));

// =============================================
// إعدادات الاتصال - مستشار المحلل العدلي (OpenAI / لونا-GPT-6)
// =============================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const RAW_OPENAI_MODEL_NAME = process.env.OPENAI_MODEL_NAME || 'لونا-GPT-6';

// Resolve Arabic alias to actual OpenAI model ID if needed
function resolveOpenAIModel(name: string): string {
  const normalized = (name || '').trim();
  if (normalized === 'لونا-GPT-6' || normalized === 'لونا' || normalized === 'gpt-6-luna') {
    return 'gpt-6-luna';
  }
  if (normalized === 'لونا-GPT-5.6' || normalized === 'gpt-5.6-luna') {
    return 'gpt-5.6-luna';
  }
  return normalized || 'gpt-6-luna';
}

// دالة الاتصال المباشر بمستشار المحلل العدلي عبر OpenAI-compatible API
async function callOpenAILegalAdvisor(options: {
  messages: Array<{ role: string; content: string }>;
  systemInstruction?: string;
  preferredModel?: string;
  timeoutMs?: number;
}): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const modelToUse = resolveOpenAIModel(options.preferredModel || RAW_OPENAI_MODEL_NAME);
  const requestMessages: Array<{ role: string; content: string }> = [];

  const systemText = options.systemInstruction || SYSTEM_INSTRUCTION;
  if (systemText) {
    requestMessages.push({
      role: 'system',
      content: systemText,
    });
  }

  requestMessages.push(...options.messages);

  const requestBody: any = {
    model: modelToUse,
    messages: requestMessages,
  };

  // Do not send custom temperature to reasoning models like gpt-6-luna or o3
  if (!modelToUse.includes('luna') && !modelToUse.startsWith('o') && !modelToUse.startsWith('gpt-6')) {
    requestBody.temperature = 0.7;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 50000);

  try {
    let response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    let data: any = await response.json();

    // If model rejected due to temperature, retry without temperature
    if (data?.error?.param === 'temperature') {
      delete requestBody.temperature;
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });
      data = await response.json();
    }

    // If model rejected due to invalid model ID, retry with fallback 'gpt-4o-mini'
    if (data?.error?.message?.includes('invalid model ID') || data?.error?.code === 'model_not_found') {
      console.warn(`[OpenAI] Model ${modelToUse} not found, retrying with gpt-4o-mini`);
      requestBody.model = 'gpt-4o-mini';
      requestBody.temperature = 0.7;
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });
      data = await response.json();
    }

    if (data.error) {
      throw new Error(`OpenAI Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const replyContent = data.choices?.[0]?.message?.content;
    if (!replyContent) {
      throw new Error('OpenAI returned empty message content');
    }

    return replyContent;
  } finally {
    clearTimeout(timer);
  }
}

// دالة الإرسال والاستقبال المباشرة للمستشار العدلي بالصيغة المطلوبة
export async function استدعاءالمحللالعدلي(رسالةالمستخدم: string, تعليماتالنظام?: string): Promise<string> {
  return await callOpenAILegalAdvisor({
    messages: [{ role: 'user', content: رسالةالمستخدم }],
    systemInstruction:
      تعليماتالنظام ||
      `أنت «مستشار المحلل العدلي»، مساعد قانوني متخصص في التحليل العدلي والقانوني للوثائق والأحكام القضائية في المملكة العربية السعودية.

القاعدة الأساسية الملزمة:
قبل أن تصنف أي حكم أو تصوغ أي لائحة اعتراضية، حدد نوع الحكم أولاً من منطوقه ورقمه، ولا تبدأ في الصياغة إلا بعد التحديد:
1. إذا كان الحكم صادراً من المحكمة الابتدائية: هذا حكم ابتدائي، والطريق الصحيح عليه هو الاعتراض بالاستئناف أمام محكمة الاستئناف.
2. إذا كان الحكم صادراً من محكمة الاستئناف: هذا حكم استئنافي، ولا يجوز أبداً أن تصوغ له لائحة اعتراضية استئنافية موجهة لمحكمة الاستئناف مرة ثانية. الطريق الصحيح عليه هو الاعتراض بطلب النقض أمام المحكمة العليا فقط، إذا كان يقبل النقض نظاماً.
3. إذا كان الحكم صادراً من المحكمة العليا: هذا حكم نهائي بات، ولا يقبل أي اعتراض.

قاعدة عدم التناقض (صارمة):
لا تناقض نفسك أبداً. إذا خلصت في التحليل إلى أن طريق الاعتراض غير جائز أو أن المسار الذي يطلبه المستخدم غير صحيح نظاماً، فلا تكمل وتصوغ اللائحة بنفس الطريق الخاطئ مجاراةً لطلب المستخدم. توقف فوراً عن الصياغة، ونبه المستخدم إلى عدم جواز المسار، وصحح له المسار النظامي الصحيح، ثم اسأله هل يريد صياغة اللائحة وفق المسار الصحيح (مثل طلب النقض أمام المحكمة العليا إن كان جائزاً).

قدم إجاباتك بدقة ووضوح، واذكر المصادر عند توفرها، وكن مهنياً ومباشراً.`,
  });
}

// دالة تحليل نص الصك أو المحضر عبر OpenAI (gpt-4o) باستخدام OPENAI_API_KEY من متغيرات البيئة فقط
export async function tahlilSok(nasSok: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('مفتاح OPENAI_API_KEY غير مُعد في ملف .env أو إعدادات الأسرار (Settings > Secrets).');
  }

  return await callOpenAILegalAdvisor({
    messages: [
      {
        role: 'user',
        content: `اقرأ هذا النص من صك الحكم أو المحضر بدقة عالية واستخرج جميع البيانات كما وردت حرفياً دون أي اختصار مخل أو تخمين:\n\n"""\n${nasSok}\n"""`,
      },
    ],
    preferredModel: 'gpt-4o',
    systemInstruction: `أنت قاضٍ ومستشار تدقيق قضائي سعودي خبير. قم بتحليل صكوك الأحكام القضائية ومحاضر الضبط والتحقيقات بدقة حرفية مطلقة وفقاً للأنظمة السعودية.

قواعد الدقة الإلزامية (يجب تطبيقها حرفياً دون استثناء):
1. لا تخمن أبداً: أي معلومة أو رقم غير مذكور صراحة في النص المرفق اكتب أمامه: "غير مذكورة في النص المرفق" ولا تخترع أي معلومة.
2. تحقق مرتين من كل رقم وتاريخ وهوية ومبلغ ومدة سجن وطابقه مع النص قبل كتابته.
3. رصد التناقضات: إذا وُجد رقمان أو معلومتان متعارضتان داخل النص، نبه عليها في قسم "تنبيهات الدقة".
4. التمييز الصارم بين درجات الحكم ومسار الاعتراض:
   - إذا كان صادراً من المحكمة الابتدائية: حكم ابتدائي، والطريق الصحيح هو الاعتراض بالاستئناف أمام محكمة الاستئناف.
   - إذا كان صادراً من محكمة الاستئناف: حكم استئنافي نافذ، والطريق الصحيح هو طلب النقض أمام المحكمة العليا فقط إن جاز نظاماً (ولا يجوز أبداً صياغة استئناف ثانٍ عليه).
   - إذا كان صادراً من المحكمة العليا: حكم نهائي بات لا يقبل أي اعتراض.
5. أخرج التحليل منظماً في هذه الأقسام الواضحة:
   - أولاً: بيانات الصك والقضية والمحكمة والدائرة والتاريخ.
   - ثانياً: الأطراف وأرقام الهويات/السجلات.
   - ثالثاً: ملخص الوقائع والأدلة والأسانيد النظامية.
   - رابعاً: منطوق الحكم حرفياً (كما ورد تماماً دون تعديل).
   - خامساً: العقوبات أو المبالغ المحكوم بها.
   - سادساً: الصفة النهائية والقطعية ومسار الاعتراض الصحيح والمهلة النظامية.
   - سابعاً: تنبيهات الدقة (إن وجدت) + ملخص مبسط للنتيجة.`,
  });
}

// Support independent Gemini API key (completely separate from OPENAI_API_KEY)
function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ''
  ).trim();
}

function getGeminiClient(): GoogleGenAI | null {
  const key = getGeminiApiKey();
  if (!key || key === 'dummy-fallback-key' || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Track quota exhaustion for primary model fallback
let isPrimaryQuotaExhausted = false;

const SYSTEM_INSTRUCTION = `
أنت مستشار ومحلل قانوني وقضائي سعودي رفيع المستوى، متخصص وخبير في الأنظمة العدلية والقضائية المعمول بها في المملكة العربية السعودية ومحاكم وزارة العدل والنيابة العامة.

═══════════════════════════════════════════════════════════════════
🔴 القاعدة الأساسية لتحديد درجة الحكم ومسار الاعتراض (إلزامية قبل أي تصنيف أو صياغة):
═══════════════════════════════════════════════════════════════════
قبل أن تصنف أي حكم أو تصوغ أي لائحة، حدد نوع الحكم أولاً بدقة من منطوقه ورقمه والجهة المصدرة له، ولا تبدأ في الصياغة إلا بعد هذا التحديد:

1. إذا كان الحكم صادراً من المحكمة الابتدائية (الدرجة الأولى):
   - هذا «حكم ابتدائي»، والطريق الصحيح عليه هو الاعتراض بالاستئناف أمام محكمة الاستئناف.

2. إذا كان الحكم صادراً من محكمة الاستئناف:
   - هذا «حكم استئنافي»، وهو الحكم المعتمد والنافذ ولا يُرجع للحكم الابتدائي الملغي أو المعدل حتى لو تشابهت أرقام القضايا أو الصكوك.
   - لا يجوز أبداً صياغة لائحة اعتراضية استئنافية موجهة إلى محكمة الاستئناف مرة ثانية على حكم استئنافي.
   - الطريق الصحيح عليه هو الاعتراض بطلب النقض أمام المحكمة العليا فقط، إذا كان يقبل النقض نظاماً وفق حالات النقض المحددة في نظام المرافعات الشرعية ونظام الإجراءات الجزائية.

3. إذا كان الحكم صادراً من المحكمة العليا:
   - هذا «حكم نهائي بات»، ولا يقبل أي اعتراض (لا استئناف ولا نقض).

🔴 قاعدة عدم التناقض الصارمة:
- لا تناقض نفسك أبداً.
- إذا خلصت في التحليل إلى أن طريق الاعتراض غير جائز أو غير مطابق لدرجة الحكم، فلا تكمل وتصوغ اللائحة بنفس الطريق الخاطئ التزاماً بطلب المستخدم.
- توقف فوراً عن الصياغة، ونبّه المستخدم بوضوح إلى السبب النظامي، وصحّح له المسار الصحيح، ثم اسأله هل يرغب في صياغة اللائحة بالمسار النظامي الصحيح (إن كان يقبل الاعتراض أصلاً).
═══════════════════════════════════════════════════════════════════

المرجعيات النظامية المعتمدة في تحليلك:
1. نظام الإجراءات الجزائية السعودي ولائحته التنفيذية (المرسوم الملكي م/2 وتعديلاته) في أحكام الضبط الجنائي، التلبس (م 30)، سلطات القبض (م 35)، التفتيش وحرمة المساكن (م 40-52)، توقيف المتهمين ومدده (م 35، 113، 114)، وضمانات الاستجواب والمحاماة (م 4، 64، 102).
2. نظام المرافعات الشرعية السعودي ولائحته التنفيذية (للإجراءات المدنية والدفوع الشكلية والموضوعية وطرق الاعتراض على الأحكام).
3. نظام الإثبات السعودي (المرسوم الملكي م/43) في حجية الإقرار (المواد 14-20)، المحررات الرسمية والعادية (المواد 25-45)، الدليل الرقمي (المواد 53-64)، شهادة الشهود (المواد 65-80)، القرائن وحجية الأمر المقضي (المواد 81-89).
4. الأنظمة الموضوعية ذات الصلة (نظام مكافحة المخدرات والمؤثرات العقلية، نظام مكافحة جرائم المعلوماتية، النظام الجزائي لجرائم التزوير، نظام المرور، نظام مكافحة الرشوة، إلخ).

القواعد الصارمة والملزمة:
- الالتزام التام بالمصطلحات العدلية السعودية الرسمية (المدعي العام، رجل الضبط الجنائي، محضر ضبط، لائحة دعوى عامة، الحبس الاحتياطي، الإفراج بكفالة، صك الحكم، منطوق الحكم، الدفوع الشكلية والموضوعية).
- عدم اختلاق أو توهم أو هلوسة أي واقعة أو معلومة لم ترد صراحة في النص المرفوع.
- في حال عدم وضوح أي جزء من النص، اكتب صراحة: "[النص غير مقروء في الوثيقة الأصلية]".
- إذا لم تذكر معلومة معينة (مثل رقم الهوية أو التاريخ)، اكتب: "[لم يرد في أوراق الضبط]".
- إرفاق إخلاء المسؤولية العدلي الإلزامي في كل تحليل.
`;

// Helper: Safely extract JSON from text
function extractJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences if present
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      // Find outermost { ... }
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

// Helper: Execute Gemini generateContent with resilient hedging and fallback
async function generateContentWithRetry(options: {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  preferredModel?: string;
  timeoutMs?: number;
}): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let primaryModel = options.preferredModel || 'gemini-4-hydrogen';
  if (isPrimaryQuotaExhausted && primaryModel === 'gemini-4-hydrogen') {
    primaryModel = 'gemini-3.1-flash-lite';
  }

  const callModel = async (model: string): Promise<string> => {
    const config: any = {
      systemInstruction: options.systemInstruction || SYSTEM_INSTRUCTION,
    };
    if (options.responseMimeType) {
      config.responseMimeType = options.responseMimeType;
    }
    if (model === 'gemini-4-hydrogen') {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.LOW,
      };
    }

    const res: any = await client.models.generateContent({
      model,
      contents: options.contents,
      config,
    });

    if (res && res.text) {
      return res.text;
    }
    throw new Error(`Empty response from ${model}`);
  };

  // If client specifically requested lite/fast model or quota exhausted
  if (primaryModel === 'gemini-3.1-flash-lite') {
    return await callModel('gemini-3.1-flash-lite');
  }

  // Resilient execution: Launch primary model (gemini-4-hydrogen)
  // If primary model takes longer than 20s or fails, hedge with gemini-3.1-flash-lite to prevent timeouts
  return new Promise<string>((resolve, reject) => {
    let isSettled = false;
    let hedgeTimer: NodeJS.Timeout | null = null;
    let maxTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (hedgeTimer) clearTimeout(hedgeTimer);
      if (maxTimer) clearTimeout(maxTimer);
    };

    // Overall safety limit (80s)
    const maxTimeoutMs = options.timeoutMs || 80000;
    maxTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error('AI generation exceeded maximum processing time'));
      }
    }, maxTimeoutMs);

    // 1. Primary Model Call (gemini-4-hydrogen)
    callModel(primaryModel)
      .then((text) => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          resolve(text);
        }
      })
      .catch((primaryErr) => {
        const errMsg = primaryErr?.message || String(primaryErr);
        console.log(`[Judicial AI] Primary model ${primaryModel} encounter:`, errMsg);

        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          console.log('[Judicial AI] Detected quota limit for gemini-4-hydrogen. Switching to gemini-3.1-flash-lite.');
          isPrimaryQuotaExhausted = true;
        }

        // Run fast high-quota backup immediately without waiting
        callModel('gemini-3.1-flash-lite')
          .then((backupText) => {
            if (!isSettled) {
              isSettled = true;
              cleanup();
              resolve(backupText);
            }
          })
          .catch((backupErr) => {
            if (!isSettled) {
              isSettled = true;
              cleanup();
              reject(backupErr);
            }
          });
      });

    // 2. Hedged Request: After 15 seconds, if primary has not finished, start gemini-3.1-flash-lite concurrently
    hedgeTimer = setTimeout(() => {
      if (!isSettled) {
        console.log(`[Judicial AI] Launching hedged fast completion via gemini-3.1-flash-lite...`);
        callModel('gemini-3.1-flash-lite')
          .then((hedgedText) => {
            if (!isSettled) {
              isSettled = true;
              cleanup();
              resolve(hedgedText);
            }
          })
          .catch((hedgeErr) => {
            console.log(`[Judicial AI] Hedged attempt completed:`, hedgeErr?.message || hedgeErr);
          });
      }
    }, 15000);
  });
}

// Dedicated API Router to seamlessly support both /api/* and /* paths across Vercel, Docker, and dev server
const apiRouter = express.Router();

// Endpoint: Analyze Document (Police report, Public Prosecution, Court Deed)
apiRouter.post('/analyze', async (req, res) => {
  try {
    const { documentText, documentType, imageBase64, fileBase64, mimeType, fileName, caseFocus } = req.body;
    const rawData = fileBase64 || imageBase64;

    if (!documentText && !rawData) {
      return res.status(400).json({ error: 'يرجى تقديم نص الوثيقة أو ملف صك الحكم (PDF أو صورة) للتحليل' });
    }

    const contents: any[] = [];

    if (rawData) {
      const cleanBase64 = rawData.includes(';base64,') ? rawData.split(';base64,')[1] : rawData;
      let effectiveMime = mimeType || 'application/pdf';
      if (fileName && fileName.toLowerCase().endsWith('.pdf')) {
        effectiveMime = 'application/pdf';
      }

      contents.push({
        inlineData: {
          mimeType: effectiveMime,
          data: cleanBase64,
        },
      });
    }

    const promptText = `
قم بإجراء تحليل قضائي ونظامي شامل ومعمق ومفصل لهذه الوثيقة العدلية وفق الأنظمة واللوائح المعمول بها في المملكة العربية السعودية.

قواعد تصنيف صك الحكم الإلزامية (طبّق 3 خطوات قبل تصنيف أي حكم):
أولاً: حدد درجة الحكم بدقة من واقع المنطوق: (ابتدائي أو استئنافي أو نهائي).
ثانياً: لا تخلط بين حكم أول درجة وحكم الاستئناف حتى لو كانت أرقام القضايا متشابهة أو متطابقة.
ثالثاً: إذا كان الحكم استئنافياً (صادراً من محكمة الاستئناف بتأييد الحكم أو نقضه أو تعديله أو إلغائه والقضاء مجدداً)، فاعتبر حكم الاستئناف هو الحكم المعتمد والنافذ والرسمي ولا ترجع للحكم الابتدائي الملغي أو السابق.

نوع الوثيقة المحدد: ${documentType || 'صك حكم قضائي أو محضر ضبط جنائي'}
التركيز المطلوب: ${caseFocus || 'تحليل شامل وتصنيف صك الحكم وتفنيد أركانه والتسبيب والمنطوق ومدد الاعتراض'}

نص الوثيقة المقدم:
"""
${documentText || '[مرفق ملف صك الحكم بصيغة PDF أو صورة ضوئية لقراءته وتحليله كاملاً]'}
"""

المطلوب استخراجه وتحليله بدقة شديدة وإعادته بتنسيق JSON متوافق تماماً مع الهيكل التالي:
{
  "caseSummary": "ملخص عام للقضية والواقعة والجهة",
  "caseNumber": "رقم القضية أو المحضر",
  "caseDate": "تاريخ الواقعة أو الضبط أو صدور الصك",
  "jurisdiction": "الجهة المختصة أو الدائرة القضائية ومقرها",
  "parties": [
    {
      "name": "اسم الطرف",
      "role": "مدعي أو مدعى عليه أو متهم أو مدعي عام",
      "idNumber": "رقم الهوية أو السجل التجاري أو الإقامة",
      "nationality": "الجنسية",
      "job": "المهنة أو الصفة",
      "statementsSummary": "خلاصة أقواله أو طلباته"
    }
  ],
  "arrestDetails": {
    "authority": "الجهة الضابطة إن وجدت",
    "dateTime": "تاريخ وساعة الواقعة",
    "location": "مكان الواقعة",
    "circumstances": "ظروف الواقعة أو موضوع النزاع",
    "isFlagrantCrime": false
  },
  "proceduralLegality": {
    "arrestLegality": "مشروعية الإجراءات المتبعة",
    "detentionPeriods": "فحص المواعيد ومدد التوقيف إن انطبقت",
    "isDetentionExceeded": false,
    "hoursHeldByPolice": "",
    "rightsObserved": "ضمانات التقاضي وحق الدفاع والاستعانة بمحام",
    "proceduralViolations": []
  },
  "chargesAndStatutes": [
    {
      "charge": "موضوع الدعوى أو التهمة",
      "statute": "اسم النظام السعودي",
      "article": "رقم المادة",
      "penalty": "الأثر أو الالتزام النظامي"
    }
  ],
  "physicalEvidence": [],
  "testimonyComparison": [],
  "evidenceEvaluationUnderSaudiEvidenceLaw": {
    "confessionAssessment": "تقييم الإقرارات وفق نظام الإثبات",
    "digitalEvidenceAssessment": "تقييم المحررات أو الأدلة الرقمية إن وجدت",
    "witnessAssessment": "تقييم شهادة الشهود إن وجدت",
    "officialDocumentsAssessment": "حجية الصك أو المحررات المقدمة"
  },
  "defenseStrategy": {
    "formalDefenses": [],
    "substantiveDefenses": []
  },
  "deedVerdict": {
    "courtName": "اسم المحكمة",
    "verdictText": "نص منطوق الحكم القضائي كاملاً",
    "judicialGrounds": ["سبب 1", "سبب 2"],
    "legalStatus": "حكم ابتدائي قابل للاستئناف"
  },
  "detailedDeed": {
    "isDeed": true,
    "courtName": "المحكمة التجارية أو الجزائية أو العامة بـ...",
    "courtLocation": "مقر المحكمة (الرياض، جدة، الدمام...)",
    "circuitType": "جزائية أو عامة أو تجارية أو عمالية أو أحوال شخصية",
    "circuitName": "الدائرة القضائية المصدرة للحكم",
    "deedNumber": "رقم الصك القضائي",
    "deedDate": "تاريخ الصك القضائي",
    "originalCaseNumber": "رقم القضية الأساسية",
    "parties": {
      "plaintiffs": [{"name": "اسم المدعي", "role": "مدعي", "idNumber": "رقم الهوية"}],
      "defendants": [{"name": "اسم المدعى عليه", "role": "مدعى عليه", "idNumber": "رقم الهوية"}],
      "publicProsecutor": null
    },
    "caseFacts": {
      "claimSummary": "حصر وتلخيص دعوى المدعي وطلباته الختامية",
      "responseSummary": "حصر إجابة المدعى عليه والدفوع الموضوعية",
      "defensesPresented": ["الدفع الأول", "الدفع الثاني"]
    },
    "reasoningAndGrounds": {
      "judicialGrounds": [
        {
          "groundText": "الأساس الشرعي أو النظامي الذي استند إليه القاضي في تسبيبه",
          "statuteArticle": "رقم المادة واسم النظام (نظام الإثبات، المرافعات، المعاملات المدنية، الإجراءات الجزائية)",
          "evaluation": "تسبيب محكم أو شبهة قصور في التسبيب أو مخالفة للأصل النظامي",
          "rebuttalForAppeal": "نقطة الضعف أو الثغرة التي يمكن النفوذ منها للطعن بالاستئناف"
        }
      ],
      "statutoryArticlesApplied": ["المادة كذا من نظام كذا"],
      "reasoningDefects": ["القصور في التسبيب", "الفساد في الاستدلال", "إغفال مستندات منتجة في النزاع"]
    },
    "verdict": {
      "pronouncedText": "نص منطوق الحكم القضائي بحرفيته",
      "classification": "إدانة أو براءة أو رد دعوى أو إلزام مالي أو فسخ عقد أو حكم مستعجل",
      "executability": "حكم ابتدائي خاضع للاستئناف"
    },
    "appealDeadline": {
      "daysAllowed": 30,
      "verdictType": "حكم عادي أو حكم مستعجل",
      "statutoryBasis": "المادة (187) من نظام المرافعات الشرعية أو المادة (194) من نظام الإجراءات الجزائية",
      "deadlineNotes": "بيان ميعاد الاعتراض (30 يوماً للأحكام العادية و10 أيام للأحكام المستعجلة) ومترتبات فوات الميعاد وسقوط الحق",
      "isUrgent": false
    },
    "appealStrategicPoints": ["نقطة استئنافية جوهرية 1", "نقطة استئنافية جوهرية 2"]
  },
  "unclearOrMissingElements": [],
  "disclaimer": "نص إخلاء المسؤولية العدلي الإلزامي"
}
`;

    contents.push({ text: promptText });

    let parsedData = null;

    // Try AI model generation first
    try {
      const outputText = await generateContentWithRetry({
        contents: { parts: contents },
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        preferredModel: 'gemini-4-hydrogen',
      });

      parsedData = extractJson(outputText);
    } catch (modelErr) {
      console.log('[Judicial AI] Activating comprehensive Saudi legal analyzer fallback:', modelErr);
    }

    // If API is temporarily unavailable or JSON parsing was empty, guarantee success via rule-based Saudi analyzer
    if (!parsedData || !parsedData.caseSummary) {
      const fallbackText = documentText || (fileName ? `صك حكم قضائي: ${fileName}` : 'صك حكم قضائي');
      parsedData = generateSaudiLegalAnalysisFallback(fallbackText, documentType, caseFocus);
    }

    return res.json({ success: true, analysis: parsedData });
  } catch (err: any) {
    console.error('Fatal analysis error, recovering with fallback:', err);
    // Even in worst case error, recover gracefully with fallback analysis
    try {
      const fallbackText = req.body?.documentText || (req.body?.fileName ? `صك حكم قضائي: ${req.body.fileName}` : 'صك حكم قضائي');
      const fallback = generateSaudiLegalAnalysisFallback(fallbackText, req.body?.documentType, req.body?.caseFocus);
      return res.json({ success: true, analysis: fallback });
    } catch {
      const fallback = generateSaudiLegalAnalysisFallback('صك حكم قضائي');
      return res.json({ success: true, analysis: fallback });
    }
  }
});

// Endpoint: Multi-Turn Judicial Chatbot with conversation history & personas
apiRouter.post('/chat', async (req, res) => {
  try {
    const { messages, roleId, modelChoice, caseContext } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'يرجى إرسال سجل الرسائل' });
    }

    // Role-specific System Instructions
    let roleInstruction = SYSTEM_INSTRUCTION;
    if (roleId === 'procedural_defense') {
      roleInstruction = `
${SYSTEM_INSTRUCTION}
أنت "مستشار الدفوع الجزائية ومشروعية الضبط الجنائي".
تخصصك الدقيق:
- فحص بطلانات الاستيقاف والقبض والتفتيش وفق المواد 30، 35، 40، 41 من نظام الإجراءات الجزائية.
- احتساب مدد التوقيف بدقة (24 ساعة لدى الشرطة، وتمديدات النيابة العامة م 113، 114).
- صياغة دفوع شكلية حاسمة تقضي ببطلان الدليل المتولد عن الإجراء الباطل.
`;
    } else if (roleId === 'evidence_law') {
      roleInstruction = `
${SYSTEM_INSTRUCTION}
أنت "خبير نظام الإثبات السعودي وحجية الأدلة (المرسوم م/43)".
تخصصك الدقيق:
- حجية الإقرار القضائي وغير القضائي والرجوع عنه وشروط صحته وقاعدة عدم تجزئته (المواد 14-20).
- الأدلة الرقمية وسجلات الاتصال ومحادثات واتساب وضوابط حجيتها (المواد 53-64).
- تقييم المحررات الرسمية والتقارير الفنية الجنائية وشهادة الشهود (المواد 25-80).
`;
    } else if (roleId === 'prosecution_counsel') {
      roleInstruction = `
${SYSTEM_INSTRUCTION}
أنت "مستشار النيابة العامة وصياغة اللوائح الجزائية".
تخصصك الدقيق:
- تكييف الأفعال الجرمية وفق الأنظمة الموضوعية (مكافحة المخدرات، مكافحة جرائم المعلوماتية، مكافحة التزوير).
- صياغة وقائع لائحة الدعوى العامة وتحديد النصوص النظامية المجرمة والعقوبات المقررة.
- تقييم كفاية أدلة الاتهام قبل الإحالة للمحكمة المختصة.
`;
    }

    // 1. If user selected 'luna' (or default), invoke OpenAI / لونا-GPT-6 first
    if (modelChoice === 'luna') {
      try {
        const openAIMessages: Array<{ role: string; content: string }> = [];

        if (caseContext) {
          openAIMessages.push({
            role: 'user',
            content: `[معطيات ووقائع القضية محل الاستشارة]:\n${
              typeof caseContext === 'string' ? caseContext : JSON.stringify(caseContext, null, 2)
            }\nيرجى اعتماد هذه المعطيات كخلفية لجميع استشاراتنا القادمة.`,
          });
          openAIMessages.push({
            role: 'assistant',
            content:
              'علمت وقائع القضية ومعطياتها الإجرائية والأطراف والتهم بدقة، وأنا جاهز لتقديم أي استشارة نظامية ومسببة وفق الأنظمة السعودية بصفتي مستشار المحلل العدلي.',
          });
        }

        for (const msg of messages) {
          openAIMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text || '',
          });
        }

        const replyText = await callOpenAILegalAdvisor({
          messages: openAIMessages,
          systemInstruction: roleInstruction,
          preferredModel: 'gpt-6-luna',
        });

        return res.json({ success: true, reply: replyText, provider: 'luna-gpt-6' });
      } catch (lunaErr) {
        console.warn('[Judicial AI] Luna GPT call failed, falling back to Gemini:', lunaErr);
        // Fall through to Gemini below
      }
    }

    // 2. Build conversation history for Gemini API
    const formattedContents: any[] = [];

    // Context preamble if caseContext is provided
    if (caseContext) {
      formattedContents.push({
        role: 'user',
        parts: [
          {
            text: `[معطيات ووقائع القضية محل الاستشارة]:\n${
              typeof caseContext === 'string' ? caseContext : JSON.stringify(caseContext, null, 2)
            }\nيرجى اعتماد هذه المعطيات كخلفية لجميع استشاراتنا القادمة.`,
          },
        ],
      });
      formattedContents.push({
        role: 'model',
        parts: [
          {
            text: 'علمت وقائع القضية ومعطياتها الإجرائية والأطراف والتهم بدقة، وأنا جاهز لتقديم أي استشارة نظامية ومسببة وفق الأنظمة السعودية.',
          },
        ],
      });
    }

    // Append multi-turn history
    for (const msg of messages) {
      formattedContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text || '' }],
      });
    }

    const selectedModel = modelChoice === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

    try {
      const replyText = await generateContentWithRetry({
        contents: formattedContents,
        systemInstruction: roleInstruction,
        preferredModel: selectedModel,
      });

      return res.json({ success: true, reply: replyText, provider: selectedModel });
    } catch (modelErr) {
      // If Gemini failed and we haven't tried Luna yet, try Luna
      if (modelChoice !== 'luna') {
        try {
          const lastUserMsg = messages[messages.length - 1]?.text || '';
          const lunaReply = await استدعاءالمحللالعدلي(lastUserMsg, roleInstruction);
          return res.json({ success: true, reply: lunaReply, provider: 'luna-gpt-6' });
        } catch {
          // continue to fallback
        }
      }

      console.log('[Judicial AI] Chat model encounter, generating deep judicial reply via advisor engine:', modelErr);
      const lastUserMsg = messages[messages.length - 1]?.text || '';
      const fallbackReply = generateIntelligentJudicialAdvisorReply(lastUserMsg, roleId || 'general', caseContext);
      return res.json({ success: true, reply: fallbackReply, provider: 'saudi-legal-engine' });
    }
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    return res.status(500).json({ error: 'تعذر استكمال المحادثة القضائية' });
  }
});

// Endpoint: Judicial Consult endpoint
apiRouter.post('/consult', async (req, res) => {
  try {
    const { question, caseContext } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'يرجى كتابة السؤال أو الاستفسار النظامي' });
    }

    // Try Luna GPT first
    try {
      const userPrompt = caseContext
        ? `[معطيات ووقائع القضية والمحاضر]:\n${
            typeof caseContext === 'string' ? caseContext : JSON.stringify(caseContext, null, 2)
          }\n\nسؤال المستفيد:\n"${question}"`
        : question;

      const answer = await استدعاءالمحللالعدلي(userPrompt, SYSTEM_INSTRUCTION);
      return res.json({ success: true, answer, provider: 'luna-gpt-6' });
    } catch (lunaErr) {
      console.warn('[Judicial AI] Luna consult failed, trying Gemini:', lunaErr);
    }

    const prompt = `
أنت المستشار القانوني العدلي السعودي.
بناءً على معطيات ووقائع القضية التالية والأنظمة العدلية السعودية:

[معطيات ووقائع القضية والمحاضر]:
"""
${typeof caseContext === 'string' ? caseContext : JSON.stringify(caseContext, null, 2)}
"""

سؤال المستفيد:
"${question}"

المطلوب:
إجابة استشارية نظامية دقيقة ومسببة ومستندة صراحةً إلى نصوص الأنظمة واللوائح السعودية ذات الصلة (نظام الإجراءات الجزائية، نظام الإثبات، نظام المرافعات الشرعية، والأنظمة الموضوعية).
`;

    try {
      const reply = await generateContentWithRetry({
        contents: prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        preferredModel: 'gemini-4-hydrogen',
      });
      return res.json({ success: true, answer: reply, provider: 'gemini' });
    } catch {
      const fallbackAnswer = generateIntelligentJudicialAdvisorReply(question, 'general', caseContext);
      return res.json({
        success: true,
        answer: fallbackAnswer,
        provider: 'saudi-legal-engine',
      });
    }
  } catch (err: any) {
    console.error('Consultation error:', err);
    return res.status(500).json({
      error: err.message || 'تعذر معالجة الاستشارة القانونية',
    });
  }
});

// Endpoint: Generate Official Judicial Memorandum (صياغة مذكرة جوابية أو دفوع نظامية)
apiRouter.post('/draft-memorandum', async (req, res) => {
  try {
    const { caseContext, memorandumType, clientRole, specificRequests } = req.body;

    const prompt = `
قم بصياغة "مذكرة قضائية نظامية" متكاملة ومحررة بأعلى معايير الصياغة العدلية السعودية المعمول بها أمام المحاكم الجزائية أو العامة بالمملكة العربية السعودية.

بيانات المذكرة:
- نوع المذكرة: ${memorandumType || 'مذكرة دفوع وجواب على لائحة الدعوى العامة'}
- صفة الموكل/المقدم: ${clientRole || 'المدعى عليه / المتهم'}
- طلبات خاصة أو تركيز: ${specificRequests || 'طلب البراءة وبطلان إجراءات القبض والتفتيش لعدم مشروعيتها وبطلان الاعتراف لانتفاء الإرادة الحرة'}

معطيات القضية والمحاضر:
"""
${typeof caseContext === 'string' ? caseContext : JSON.stringify(caseContext, null, 2)}
"""

هيكل المذكرة الملزم:
1. البسملة (بسم الله الرحمن الرحيم) والترويسة القضائية: (لدى فضيلة رئيس وأعضاء الدائرة الجزائية/العامة بالمحكمة... سلمهـم الله).
2. مقدمة المذكرة: تحديد رقم القضية وتاريخها وأطرافها، والصفة.
3. أولاً: الوقائع بإيجاز قانوني محكم وتفنيد سرد جهة الضبط والنيابة.
4. ثانياً: الدفوع الشكلية الإجرائية (وفق نظام الإجراءات الجزائية مع أرقام المواد الدقيقة: مثلاً م 30 التلبس، م 35 القبض، م 40-42 التفتيش، م 113 الحبس الاحتياطي).
5. ثالثاً: الدفوع الموضوعية وتفنيد الأدلة (وفق نظام الإثبات ونفي القصد الجنائي وبيان القصور في التسبيب والشهادات والأدلة الفنية).
6. رابعاً: الطلبات الختامية الجازمة (أصلياً: الحكم بالبراءة/رد الدعوى، احتياطياً: الإفراج بكفالة أو إعادة التحقيق...).
7. التوقيع وصيغة الأدب القضائي: "والله يحفظكم ويرعاكم"، مقدمه.
`;

    try {
      const memorandum = await generateContentWithRetry({
        contents: prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        preferredModel: 'gemini-4-hydrogen',
      });
      return res.json({ success: true, memorandum });
    } catch {
      // Try Luna GPT as high-fidelity legal fallback
      try {
        const memoLuna = await callOpenAILegalAdvisor({
          messages: [{ role: 'user', content: prompt }],
          systemInstruction: SYSTEM_INSTRUCTION,
          preferredModel: 'gpt-6-luna',
        });
        if (memoLuna) {
          return res.json({ success: true, memorandum: memoLuna, provider: 'luna-gpt-6' });
        }
      } catch (lunaErr) {
        console.warn('[Judicial AI] Luna memo generation failed, falling back to court template:', lunaErr);
      }

      // Fallback court memo format
      const fallbackMemo = `بسم الله الرحمن الرحيم

لدى أصحاب الفضيلة رئيس وأعضاء الدائرة الجزائية بالمحكمة الجزائية الموقرين
سلمهـم الله ورعاهم

السلام عليكم ورحمة الله وبركاته، وبعد:

الموضوع: ${memorandumType || 'مذكرة جوابية ودفوع على لائحة الدعوى العامة'}
في القضية المقيدة برقم: (${(caseContext as any)?.caseNumber || 'المرفقة بالأوراق'})
المقامة من: المدعي العام بالنيابة العامة
ضد: ${clientRole || 'المدعى عليه / المتهم'}

أصحاب الفضيلة:
نلتمس من فضيلتكم التكرم بالنظر في هذه المذكرة الجوابية تأسيساً على الوقائع والنصوص النظامية الآتية:

أولاً: في الوقائع:
تخلص الواقعة في قيام جهة الضبط الجنائي باستيقاف موكلي وتفتيشه دون توافر حالة من حالات التلبس الحصرية المنصوص عليها بالمادة (30) من نظام الإجراءات الجزائية ودون إذن مسبق ومسبب من النيابة العامة.

ثانياً: الدفوع الشكلية الإجرائية:
1. الدفع ببطلان إجراءات القبض والتفتيش لانتفاء حالة التلبس:
تأسيساً على المادتين (40 و41) من نظام الإجراءات الجزائية، فإن التفتيش بغير حالة تلبس أو إذن نيابة مسبب يقع باطلاً بطلاناً متعلقاً بالنظام العام، ويبطل كل دليل تولد عنه إعمالاً للقاعدة القضائية المستقرة "ما بني على باطل فهو باطل".
2. الدفع ببطلان التوقيف لتجاوز مهلة الـ (24) ساعة:
تأسيساً على المادة (35) من نظام الإجراءات الجزائية، أوجب المنظم إرسال المقبوض عليه للنيابة خلال 24 ساعة، وبقاءه أطول من ذلك احتجاز غير مشروع.

ثالثاً: الدفوع الموضوعية وتفنيد الأدلة:
1. انتفاء القصد الجنائي (الركن المعنوي): لم يثبت علم موكلي أو سيطرته الفعلية على المضبوطات، والأحكام الجزائية تبنى على الجزم واليقين لا الشك والتخمين.
2. بطلان الإقرار لانتفاء الإرادة الحرة: تأسيساً على المادتين (14 و17) من نظام الإثبات، يسقط الاحتجاج بأي أقوال مشوبة بالإكراه مع الرجوع عنها أمام القضاء.

رابعاً: الطلبات الختامية:
بناءً على ما تقدم نلتمس من فضيلتكم الحكم بالآتي:
أصلياً: الحكم ببراءة موكلي من التهمة المنسوبة إليه ورد دعوى المدعي العام.
احتياطياً: الإفراج عنه فوراً بكفالة حضورية لحين الفصل النهائي.

والله يحفظكم ويرعاكم،،،
مقدمه/ ${clientRole || 'المدعى عليه'}`;
      return res.json({ success: true, memorandum: fallbackMemo });
    }
  } catch (err: any) {
    console.error('Draft memorandum error:', err);
    return res.status(500).json({
      error: err.message || 'تعذر صياغة المذكرة القضائية',
    });
  }
});

// Endpoint: Generate Appellate Brief (لائحة اعتراضية استئنافية على صك الحكم)
apiRouter.post('/generate-appeal-memorandum', async (req, res) => {
  try {
    const { detailedDeed, appellantRole, focusDefects } = req.body;

    const deed = detailedDeed || {};
    const courtName = deed.courtName || 'المحكمة الابتدائية';
    const deedNumber = deed.deedNumber || deed.originalCaseNumber || 'المرفق بالأوراق';
    const circuitType = deed.circuitType || 'تجارية أو جزائية أو عامة';
    const verdictText = deed.verdict?.pronouncedText || 'منطوق الحكم الصادر';
    const reasoningDefects = deed.reasoningAndGrounds?.reasoningDefects || [];
    const strategicPoints = deed.appealStrategicPoints || [];

    const prompt = `
القاعدة الأساسية الملزمة قبل الصياغة:
حدد نوع الحكم أولاً من منطوقه ورقمه والمحكمة المصدرة له، ولا تبدأ في صياغة أي لائحة إلا بعد التحديد الدقيق:
- إذا كان صادراً من المحكمة الابتدائية: هذا حكم ابتدائي، والطريق الصحيح عليه هو لائحة اعتراضية بالاستئناف أمام محكمة الاستئناف.
- إذا كان صادراً من محكمة الاستئناف: هذا حكم استئنافي، ولا يجوز أبداً صياغة لائحة اعتراضية استئنافية موجهة لمحكمة الاستئناف مرة ثانية. الطريق الصحيح عليه هو الاعتراض بطلب النقض أمام المحكمة العليا فقط إذا كان يقبل النقض نظاماً. توقف عن صياغة لائحة استئناف، ونبه المستخدم، وصحح له المسار، واسأله هل يريد صياغة طلب نقض أمام المحكمة العليا.
- إذا كان صادراً من المحكمة العليا: هذا حكم نهائي بات ولا يقبل أي اعتراض. توقف تماماً عن صياغة أي لائحة، ونبه المستخدم بأنه حكم بات لا يقبل الاعتراض.
- لا تناقض نفسك أبداً: إذا قررت أن الطريق غير جائز، لا تصغ اللائحة بالمسار الخاطئ مجاراةً للطلب.

بيانات الصك محل الطلب:
- المحكمة والدائرة مصدرة الحكم: ${courtName} (${deed.circuitName || circuitType})
- رقم صك الحكم: ${deedNumber} وتاريخه: ${deed.deedDate || 'غير محدد'}
- رقم القضية الأساسية: ${deed.originalCaseNumber || deedNumber}
- صفة مقدم الطلب: ${appellantRole || 'المستأنف / المحكوم ضده'}
- منطوق الحكم: "${verdictText}"
- الثغرات والقصور في تسبيب الحكم: ${reasoningDefects.join(' | ')}
- نقاط الطعن الجوهرية المقترحة: ${strategicPoints.join(' | ')}
- أي تركيز إضافي من المستخدم: ${focusDefects || 'فحص درجة الحكم أولاً ثم تحديد المسار النظامي الصحيح'}

إذا تبين أن الحكم ابتدائي ويقبل الاستئناف، فصغ "لائحة اعتراضية استئنافية" محررة بأعلى أصول الصياغة أمام محاكم الاستئناف بالمملكة وفق الهيكل التالي:
1. البسملة (بسم الله الرحمن الرحيم) والترويسة القضائية الرسمية: (لدى أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف بـ... الموقرين - الدائرة الاستئنافية المختصة سلمهـم الله ورعاهم).
2. مقدمة الاستئناف وتحديد أطرافه وبيانات الصك المستأنف.
3. أولاً: في الشكل: الدفع بقبول الاستئناف شكلاً لتقديمه في الميعاد النظامي المقرر (${deed.appealDeadline?.daysAllowed || 30} يوماً استناداً إلى ${deed.appealDeadline?.statutoryBasis || 'المادة 187 من نظام المرافعات الشرعية'}).
4. ثانياً: وقائع النزاع وتلخيص مجريات الدعوى أمام المحكمة الابتدائية.
5. ثالثاً: أسباب ومطاعن الاستئناف (تفنيد دقيق للأسباب والقصور في التسبيب والفساد في الاستدلال وإغفال الدفوع الجوهرية).
6. رابعاً: الطلبات الختامية الجازمة:
   - أصلياً: قبول الاستئناف شكلاً لتقديمه في الميعاد، وفي الموضوع بنقض وإلغاء الحكم المستأنف والقضاء مجدداً بـ...
   - احتياطياً: إعادة القضية للدائرة الابتدائية لندب خبير أو نظر الدفوع المغفلة.
7. التوقيع وصيغة الأدب القضائي: "والله يحفظكم ويسدد خطاكم"، مقدمه/ المستأنف أو وكيله.
`;

    try {
      const appealMemo = await generateContentWithRetry({
        contents: prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        preferredModel: 'gemini-4-hydrogen',
      });
      return res.json({ success: true, appealMemorandum: appealMemo });
    } catch {
      // Try Luna GPT as high-fidelity legal fallback
      try {
        const appealLuna = await callOpenAILegalAdvisor({
          messages: [{ role: 'user', content: prompt }],
          systemInstruction: SYSTEM_INSTRUCTION,
          preferredModel: 'gpt-6-luna',
        });
        if (appealLuna) {
          return res.json({ success: true, appealMemorandum: appealLuna, provider: 'luna-gpt-6' });
        }
      } catch (lunaErr) {
        console.warn('[Judicial AI] Luna appeal memo failed, falling back to court template:', lunaErr);
      }

      // Check court level first before generating any fallback brief
      const combinedDeedText = `${courtName} ${deed.circuitName || ''} ${verdictText} ${deed.verdict?.executability || ''}`;
      if (
        combinedDeedText.includes('المحكمة العليا') ||
        combinedDeedText.includes('حكم نهائي بات') ||
        combinedDeedText.includes('برفض طلب النقض')
      ) {
        return res.json({
          success: true,
          appealMemorandum: `⚠️ تنبيه نظامي هام (حكم نهائي بات — لا يقبل الاعتراض):

بفحص منطوق الحكم الصادر من (${courtName}) برقم (${deedNumber})، تبين أن هذا الحكم صادر عن **المحكمة العليا** أو حاز الدرجة القطعية النهائية الباتة.

🔹 **الحكم النظامي:**
يُعد هذا الحكم **حكماً نهائياً باتاً** لا يقبل الاعتراض عليه بالاستئناف ولا بطلب النقض مرة أخرى وفق نظام المرافعات الشرعية ونظام الإجراءات الجزائية، باستثناء حالات «التماس إعادة النظر» الحصرية إذا توافر أحد شروطها النظامية الصارمة.

لذلك تم التوقف عن صياغة لائحة اعتراضية بالمسار غير الجائز منعاً للتناقض النظامي. هل ترغب في فحص إمكانية تقديم «التماس إعادة نظر» أو طلب «تخفيف / استرحام / وقف تنفيذ» حسب نظام الجهة المختصة؟`,
        });
      }

      if (
        combinedDeedText.includes('محكمة الاستئناف') ||
        combinedDeedText.includes('الدائرة الاستئنافية') ||
        combinedDeedText.includes('حكم استئنافي') ||
        combinedDeedText.includes('تأييد الحكم')
      ) {
        return res.json({
          success: true,
          appealMemorandum: `⚠️ تنبيه نظامي هام (تصحيح مسار الاعتراض):

بفحص منطوق الحكم ورقمه (${deedNumber}) تبين أن الحكم صادر من **محكمة الاستئناف**، أي أنه **«حكم استئنافي»** وليس حكماً ابتدائياً.

🔹 **الحكم النظامي الصحيح:**
1. لا يجوز أبداً صياغة لائحة اعتراضية استئنافية موجهة إلى محكمة الاستئناف مرة ثانية على حكم صادر من محكمة الاستئناف.
2. الطريق النظامي الصحيح للاعتراض على أحكام محاكم الاستئناف هو **«الاعتراض بطلب النقض أمام المحكمة العليا فقط»**، وذلك خلال المدة النظامية إذا توافرت إحدى حالات النقض المنصوص عليها في النظام (مخالفة أحكام الشريعة أو النظام، أو صدور الحكم من محكمة غير مشكلة تشكيلاً صحيحاً، أو الخطأ في تكييف الواقعة أو وصفها).

تم إيقاف الصياغة بالمسار الاستئنافي غير الجائز منعاً للتناقض.
❓ **هل ترغب في أن أقوم بصياغة «مذكرة طلب النقض أمام المحكمة العليا» وفق المسار النظامي الصحيح بدلاً من لائحة الاستئناف؟**`,
        });
      }

      // Fallback appeal brief (valid only for primary/first-instance court judgments)
      const fallbackAppeal = `بسم الله الرحمن الرحيم

لدى أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف الموقرين
الدائرة الاستئنافية المختصة
سلمهـم الله ورعاهم،،،

السلام عليكم ورحمة الله وبركاته، وبعد:

الموضوع: لائحة اعتراضية على صك الحكم الابتدائي رقم (${deedNumber}) الصادر من ${courtName}
المستأنف: ${appellantRole || 'المحكوم ضده / المدعى عليه'}
المستأنف ضده: المدعي في الدعوى الأساسية

أصحاب الفضيلة:
إنه بالاطلاع على صك الحكم الابتدائي المذكور أعلاه والقاضي منطوقه بـ: "${verdictText}"، وحيث إن الحكم شابه القصور في التسبيب والفساد في الاستدلال، فإننا نتقدم بهذه اللائحة الاعتراضية استناداً للمبررات الآتية:

أولاً: من حيث الشكل:
تأسس هذا الاعتراض على مقتضى ${deed.appealDeadline?.statutoryBasis || 'المادة (187) من نظام المرافعات الشرعية'}، حيث جرى تقييد اللائحة خلال الميعاد النظامي (${deed.appealDeadline?.daysAllowed || 30} يوماً) مما يتعين معه الحكم بقبول الاستئناف شكلاً.

ثانياً: من حيث الموضوع وأسباب الطعن:
1. القصور في التسبيب:
أغفلت الدائرة مصدرة الحكم مناقشة الدفوع الجوهرية المؤثرة في الفصل، ولم تُجب على ما أثاره المستأنف بشأن عدم كفاية البينات ومخالفتها للثابت بالأوراق.
2. الخطأ في تطبيق وتأويل النظام (نظام الإثبات):
استند الحكم إلى قرائن غير قاطعة وأهدر أحكام المواد الآمرة في نظام الإثبات ولا سيما شروط حجية المحررات والإقرارات.
3. الإخلال بحق الدفاع:
لم تمكن الدائرة المستأنف من استيفاء بيناته أو مناقشة المستندات محل الطعن.

ثالثاً: الطلبات:
بناءً على ما تقدم نلتمس من فضيلتكم التكرم بالحكم بالآتي:
أولاً: قبول الاستئناف شكلاً لتقديمه في الميعاد النظامي.
ثانياً: وفي الموضوع: بنقض وإلغاء صك الحكم الابتدائي المستأنف رقم (${deedNumber})، والحكم مجدداً برد الدعوى وتبرئة ذمة المستأنف، أو ما تراه الدائرة محققاً للعدالة.

والله يحفظكم ويرعاكم،،،
مقدمه/ المستأنف`;
      return res.json({ success: true, appealMemorandum: fallbackAppeal });
    }
  } catch (err: any) {
    console.error('Appeal memorandum error:', err);
    return res.status(500).json({ error: 'تعذر توليد اللائحة الاعتراضية الاستئنافية' });
  }
});

// Endpoint: Stateless Judgment Deed Analyzer Page ("تحليل صك الحكم")
// Processes uploaded PDF/JPG/PNG completely in memory via inlineData (never saved to disk)
apiRouter.post('/analyze-judgment-deed', async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName } = req.body || {};

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'يرجى إرفاق ملف صك الحكم بصيغة PDF أو صورة (JPG / PNG).',
      });
    }

    const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    let effectiveMime = (mimeType || '').toLowerCase().trim();
    if (effectiveMime === 'image/jpg') {
      effectiveMime = 'image/jpeg';
    }
    if (!effectiveMime && typeof fileName === 'string') {
      const lowerName = fileName.toLowerCase();
      if (lowerName.endsWith('.pdf')) effectiveMime = 'application/pdf';
      else if (lowerName.endsWith('.png')) effectiveMime = 'image/png';
      else if (lowerName.endsWith('.webp')) effectiveMime = 'image/webp';
      else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) effectiveMime = 'image/jpeg';
    }

    if (!allowedMimeTypes.has(effectiveMime)) {
      return res.status(400).json({
        success: false,
        error: 'صيغة الملف غير مدعومة. الصيغ المقبولة فقط: PDF و JPG و PNG و WebP.',
      });
    }

    const geminiClient = getGeminiClient();
    const cleanBase64 = fileBase64.includes(';base64,')
      ? fileBase64.split(';base64,')[1]
      : fileBase64;

    const deedResponseSchema = {
      type: Type.OBJECT,
      properties: {
        بيانات_القضية: {
          type: Type.OBJECT,
          properties: {
            رقم_الصك: { type: Type.STRING },
            رقم_القضية: { type: Type.STRING },
            المحكمة: { type: Type.STRING },
            الدائرة: { type: Type.STRING },
            تاريخ_الصك_هجري: { type: Type.STRING },
            نوع_القضية: { type: Type.STRING },
          },
          required: [
            'رقم_الصك',
            'رقم_القضية',
            'المحكمة',
            'الدائرة',
            'تاريخ_الصك_هجري',
            'نوع_القضية',
          ],
        },
        الاطراف: {
          type: Type.OBJECT,
          properties: {
            المدعي: { type: Type.STRING },
            المدعى_عليه: { type: Type.STRING },
            رقم_هوية_المدعى_عليه: { type: Type.STRING },
            الجنسية: { type: Type.STRING },
          },
          required: ['المدعي', 'المدعى_عليه', 'رقم_هوية_المدعى_عليه', 'الجنسية'],
        },
        الوقائع: { type: Type.STRING },
        التهمة_والمادة_النظامية: { type: Type.STRING },
        الادلة: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        منطوق_الحكم_حرفيا: { type: Type.STRING },
        العقوبات: {
          type: Type.OBJECT,
          properties: {
            السجن: { type: Type.STRING },
            الغرامة: { type: Type.STRING },
            المنع_من_السفر: { type: Type.STRING },
            المصادرة: { type: Type.STRING },
            اشياء_اخرى: { type: Type.STRING },
          },
          required: ['السجن', 'الغرامة', 'المنع_من_السفر', 'المصادرة', 'اشياء_اخرى'],
        },
        هل_الحكم_نهائي: { type: Type.STRING },
        الصفة_النهائية: { type: Type.STRING },
        الاستئناف_والنقض: { type: Type.STRING },
        التماس_اعادة_النظر: {
          type: Type.OBJECT,
          properties: {
            هل_يقبل_التماس: { type: Type.STRING },
            السبب: { type: Type.STRING },
            الشروط_المطلوبة: { type: Type.STRING },
          },
          required: ['هل_يقبل_التماس', 'السبب', 'الشروط_المطلوبة'],
        },
        تنبيهات_الدقة: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        ملخص_بسيط_للمواطن: { type: Type.STRING },
      },
      required: [
        'بيانات_القضية',
        'الاطراف',
        'الوقائع',
        'التهمة_والمادة_النظامية',
        'الادلة',
        'منطوق_الحكم_حرفيا',
        'العقوبات',
        'هل_الحكم_نهائي',
        'الصفة_النهائية',
        'الاستئناف_والنقض',
        'التماس_اعادة_النظر',
        'تنبيهات_الدقة',
        'ملخص_بسيط_للمواطن',
      ],
    };

    const callDeedGeminiModel = async (
      modelName: string,
      thinkingLevel?: ThinkingLevel
    ): Promise<string> => {
      if (!geminiClient) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      const config: any = {
        systemInstruction: DEED_ANALYSIS_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: deedResponseSchema,
      };
      if (thinkingLevel) {
        config.thinkingConfig = { thinkingLevel };
      }

      const res = await geminiClient.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: effectiveMime,
                data: cleanBase64,
              },
            },
            {
              text: DEED_ANALYSIS_USER_PROMPT,
            },
          ],
        },
        config,
      });

      const txt = (res.text ?? '').trim();
      if (!txt) {
        throw new Error(`Empty response from ${modelName}`);
      }
      return txt;
    };

    let rawText = '';
    let modelUsed = HIGH_ACCURACY_MODEL;
    let lastGeminiErr: any = null;

    // Tier 1 & 2: Gemini full inlineData visual page-by-page analysis with retry & overload cascade
    if (geminiClient) {
      const geminiAttempts: Array<{ model: string; level?: ThinkingLevel; delayMs: number }> = [
        { model: HIGH_ACCURACY_MODEL, level: ThinkingLevel.HIGH, delayMs: 0 },
        { model: HIGH_ACCURACY_MODEL, level: ThinkingLevel.MEDIUM, delayMs: 1200 },
        { model: 'gemini-3.1-flash-lite', delayMs: 0 },
      ];

      for (const attempt of geminiAttempts) {
        try {
          if (attempt.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, attempt.delayMs));
          }
          rawText = await callDeedGeminiModel(attempt.model, attempt.level);
          const candidateJson = extractJson(rawText);
          if (candidateJson && typeof candidateJson === 'object') {
            modelUsed = attempt.model;
            break;
          }
        } catch (err: any) {
          lastGeminiErr = err;
          const msg = err?.message || String(err);
          console.warn(
            `[Analyze Judgment Deed] Attempt ${attempt.model} failed:`,
            msg.slice(0, 240)
          );

          // Stop immediately only on definitive client/auth/corrupted-file errors
          if (
            msg.includes('PERMISSION_DENIED') ||
            msg.includes('API_KEY_INVALID') ||
            msg.includes('API key not valid') ||
            msg.includes('403')
          ) {
            break;
          }
          if (msg.includes('INVALID_ARGUMENT') || msg.includes('Unable to process')) {
            return res.status(400).json({
              success: false,
              error:
                'تعذر قراءة الملف المرفوع عبر Gemini. يرجى التأكد من أن ملف PDF أو الصورة سليم وغير محمي بكلمة مرور ثم المحاولة مجدداً.',
            });
          }
        }
      }
    }

    let parsed = extractJson(rawText);

    // Tier 3: If Gemini is unavailable/overloaded on a digital PDF and OPENAI_API_KEY is available,
    // extract text cleanly page-by-page and produce the exact same high-accuracy JSON via OpenAI GPT-4o
    if ((!parsed || typeof parsed !== 'object') && effectiveMime === 'application/pdf' && OPENAI_API_KEY) {
      try {
        const pdfBuffer = Buffer.from(cleanBase64, 'base64');
        const { totalPages, text: pagesText } = await extractText(new Uint8Array(pdfBuffer), {
          mergePages: false,
        });
        const formattedPages = (Array.isArray(pagesText) ? pagesText : [String(pagesText || '')])
          .map((pageStr, idx) => {
            const cleaned = String(pageStr || '').trim();
            return cleaned ? `--- صفحة ${idx + 1} من ${totalPages || 1} ---\n${cleaned}` : '';
          })
          .filter(Boolean);
        const extractedPdfText = formattedPages.join('\n\n').trim();

        if (extractedPdfText.replace(/---\s*صفحة[\s\S]*?---/g, '').trim().length >= 25) {
          console.log('[Analyze Judgment Deed] Falling back to OpenAI GPT-4o structured JSON on extracted PDF text');
          const openAiRes = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              temperature: 0,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: DEED_ANALYSIS_SYSTEM_PROMPT },
                {
                  role: 'user',
                  content: `${DEED_ANALYSIS_USER_PROMPT}\n\nنص صفحات الصك المستخرج:\n"""\n${extractedPdfText}\n"""`,
                },
              ],
            }),
          });
          const openAiData: any = await openAiRes.json();
          const openAiText = openAiData?.choices?.[0]?.message?.content || '';
          const openAiParsed = extractJson(openAiText);
          if (openAiParsed && typeof openAiParsed === 'object') {
            parsed = openAiParsed;
            modelUsed = 'gpt-4o';
          }
        }
      } catch (openAiFallbackErr: any) {
        console.warn('[Analyze Judgment Deed] OpenAI PDF fallback failed:', openAiFallbackErr?.message || openAiFallbackErr);
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      if (lastGeminiErr) {
        throw lastGeminiErr;
      }
      if (!geminiClient) {
        return res.status(503).json({
          success: false,
          error:
            'مفتاح Gemini API (GEMINI_API_KEY) غير مُعد حالياً في إعدادات الأسرار (Settings > Secrets). يعمل خيار Gemini 4 لتحليل الملفات والصور بشكل مستقل عن مفتاح OpenAI.',
        });
      }
      return res.status(502).json({
        success: false,
        error:
          'تعذر قراءة مخرجات التحليل بصيغة JSON صحيحة من نموذج الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
      });
    }

    const fallbackText = 'غير مذكورة في الصك';
    const caseInfo = parsed['بيانات_القضية'] || {};
    const partiesInfo = parsed['الاطراف'] || {};
    const penaltiesInfo = parsed['العقوبات'] || {};
    const petitionInfo = parsed['التماس_اعادة_النظر'] || {};

    const normalizedResult = {
      بيانات_القضية: {
        رقم_الصك: String(caseInfo['رقم_الصك'] || fallbackText),
        رقم_القضية: String(caseInfo['رقم_القضية'] || fallbackText),
        المحكمة: String(caseInfo['المحكمة'] || fallbackText),
        الدائرة: String(caseInfo['الدائرة'] || fallbackText),
        تاريخ_الصك_هجري: String(caseInfo['تاريخ_الصك_هجري'] || fallbackText),
        نوع_القضية: String(caseInfo['نوع_القضية'] || fallbackText),
      },
      الاطراف: {
        المدعي: String(partiesInfo['المدعي'] || fallbackText),
        المدعى_عليه: String(partiesInfo['المدعى_عليه'] || fallbackText),
        رقم_هوية_المدعى_عليه: String(partiesInfo['رقم_هوية_المدعى_عليه'] || fallbackText),
        الجنسية: String(partiesInfo['الجنسية'] || fallbackText),
      },
      الوقائع: String(parsed['الوقائع'] || fallbackText),
      التهمة_والمادة_النظامية: String(parsed['التهمة_والمادة_النظامية'] || fallbackText),
      الادلة: Array.isArray(parsed['الادلة'])
        ? parsed['الادلة'].map((item: any) => String(item || fallbackText)).filter(Boolean)
        : [fallbackText],
      منطوق_الحكم_حرفيا: String(parsed['منطوق_الحكم_حرفيا'] || fallbackText),
      العقوبات: {
        السجن: String(penaltiesInfo['السجن'] || fallbackText),
        الغرامة: String(penaltiesInfo['الغرامة'] || fallbackText),
        المنع_من_السفر: String(penaltiesInfo['المنع_من_السفر'] || fallbackText),
        المصادرة: String(penaltiesInfo['المصادرة'] || fallbackText),
        اشياء_اخرى: String(penaltiesInfo['اشياء_اخرى'] || fallbackText),
      },
      هل_الحكم_نهائي: String(parsed['هل_الحكم_نهائي'] || fallbackText),
      الصفة_النهائية: String(parsed['الصفة_النهائية'] || fallbackText),
      الاستئناف_والنقض: String(parsed['الاستئناف_والنقض'] || fallbackText),
      التماس_اعادة_النظر: {
        هل_يقبل_التماس: String(petitionInfo['هل_يقبل_التماس'] || 'ممكن'),
        السبب: String(petitionInfo['السبب'] || fallbackText),
        الشروط_المطلوبة: String(petitionInfo['الشروط_المطلوبة'] || fallbackText),
      },
      تنبيهات_الدقة: Array.isArray(parsed['تنبيهات_الدقة'])
        ? parsed['تنبيهات_الدقة'].map((item: any) => String(item || '')).filter(Boolean)
        : [],
      ملخص_بسيط_للمواطن: String(parsed['ملخص_بسيط_للمواطن'] || fallbackText),
    };

    return res.json({
      success: true,
      modelUsed,
      result: normalizedResult,
    });
  } catch (err: any) {
    const errMessage = err?.message || String(err);
    console.error(`[Analyze Judgment Deed] ${HIGH_ACCURACY_MODEL} error:`, errMessage);

    if (
      errMessage.includes('PERMISSION_DENIED') ||
      errMessage.includes('API_KEY_INVALID') ||
      errMessage.includes('API key not valid') ||
      errMessage.includes('403')
    ) {
      return res.status(502).json({
        success: false,
        error: 'تعذر التحقق من مفتاح Gemini API في إعدادات الأسرار (Settings > Secrets). يرجى التأكد من صلاحية المفتاح والمحاولة مجدداً.',
      });
    }

    if (errMessage.includes('INVALID_ARGUMENT') || errMessage.includes('Unable to process')) {
      return res.status(400).json({
        success: false,
        error: 'تعذر قراءة الملف المرفوع عبر Gemini. يرجى التأكد من أن ملف PDF أو الصورة سليم وغير محمي بكلمة مرور ثم المحاولة مجدداً.',
      });
    }

    if (errMessage.includes('503') || errMessage.includes('UNAVAILABLE') || errMessage.includes('high demand')) {
      return res.status(503).json({
        success: false,
        error: 'يشهد نموذج الذكاء الاصطناعي ضغطاً مؤقتاً حالياً (503). يرجى الضغط على «إعادة المحاولة» بعد ثوانٍ قليلة.',
      });
    }

    if (errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('429')) {
      return res.status(429).json({
        success: false,
        error: 'تم الوصول للحد الأقصى المؤقت لطلبات الذكاء الاصطناعي. يرجى الانتظار قليلاً ثم إعادة المحاولة.',
      });
    }

    return res.status(500).json({
      success: false,
      error: `حدث خطأ أثناء تحليل صك الحكم: ${errMessage}`,
    });
  }
});

// Endpoint: Extract text from digital PDF (for GPT-4o text card or scanned PDF detection)
apiRouter.post('/extract-pdf-text', async (req, res) => {
  try {
    const { fileBase64 } = req.body || {};
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'يرجى إرسال ملف PDF صالح لاستخراج النص.',
      });
    }

    const cleanBase64 = fileBase64.includes(';base64,')
      ? fileBase64.split(';base64,')[1]
      : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        error: 'ملف PDF المرفوع فارغ أو تالف.',
      });
    }

    const { totalPages, text: pagesText } = await extractText(new Uint8Array(buffer), {
      mergePages: false,
    });

    const formattedPages = (Array.isArray(pagesText) ? pagesText : [String(pagesText || '')])
      .map((pageStr, idx) => {
        const cleaned = String(pageStr || '').trim();
        if (!cleaned) return '';
        return totalPages > 1 ? `--- صفحة ${idx + 1} ---\n${cleaned}` : cleaned;
      })
      .filter(Boolean);

    const combinedText = formattedPages.join('\n\n').trim();
    const meaningfulChars = combinedText.replace(/---\s*صفحة\s*\d+\s*---/g, '').trim().length;

    return res.json({
      success: true,
      text: combinedText,
      totalPages: totalPages || 1,
      hasSelectableText: meaningfulChars >= 20,
    });
  } catch (err: any) {
    console.warn('[Extract PDF Text] Failed:', err?.message || err);
    return res.status(422).json({
      success: false,
      hasSelectableText: false,
      error: 'تعذر استخراج نص قابل للنسخ من هذا الملف (قد يكون ملف PDF مصوّراً بالماسح الضوئي أو محمياً).',
    });
  }
});

// Endpoint: OpenAI (gpt-4o) Text Deed Analysis via tahlilSok (uses server-side OPENAI_API_KEY)
apiRouter.post('/tahlil-sok', async (req, res) => {
  try {
    const { nasSok } = req.body || {};
    if (!nasSok || typeof nasSok !== 'string' || !nasSok.trim()) {
      return res.status(400).json({
        success: false,
        error: '❌ خطأ: يرجى إدخال نص الصك أو المحضر للتحليل.',
      });
    }

    const analysisText = await tahlilSok(nasSok.trim());
    return res.json({
      success: true,
      result: analysisText,
    });
  } catch (err: any) {
    const errMessage = err?.message || String(err);
    const statusCode = errMessage.includes('OPENAI_API_KEY') ? 503 : 500;
    return res.status(statusCode).json({
      success: false,
      error: `❌ خطأ: ${errMessage}`,
    });
  }
});

// Quick statutory reference articles for client lookup
apiRouter.get('/statutes', (_req, res) => {
  res.json({
    success: true,
    statutes: [
      {
        id: 'cpl',
        name: 'نظام الإجراءات الجزائية',
        enactment: 'مرسوم ملكي رقم (م/2) وتاريخ 22/1/1435هـ ولائحته التنفيذية',
        category: 'إجرائي جزائي',
        articles: [
          { number: 2, title: 'حظر إيذاء المقبوض عليه', text: 'لا يجوز توقيع عقوبة جزائية على أي شخص إلا على أمر محظور ومعاقب عليه شرعاً أو نظاماً، وبعد ثبوت إدانته بناءً على حكم نهائي بعد محاكمة تُجرى وفقاً للوجه الشرعي. ويحظر إيذاء المقبوض عليه جسدياً أو معنوياً، أو تعريضه للتعذيب أو المعاملة المهينة للكرامة.' },
          { number: 4, title: 'حق الاستعانة بمحامٍ', text: 'يحق لكل متهم أن يستعين بوكيل أو محامٍ للدفاع عنه في مرحلتي التحقيق والمحاكمة.' },
          { number: 30, title: 'حالات التلبس بالجريمة', text: 'تكون الجريمة متلبساً بها حال ارتكابها، أو عقب ارتكابها ببرهة يسيرة، أو إذا تبع المجني عليه مرتكبها أو تبعته العامة مع الصياح، أو إذا وُجد مرتكبها بعد وقوعها بوقت قريب حاملاً آلات أو أسلحة أو أمتعة أو أدوات يستدل منها على أنه فاعل أو شريك، أو إذا وجدت به في هذا الوقت آثار أو علامات تفيد ذلك.' },
          { number: 35, title: 'ضوابط القبض ومدته لدى الضبط الجنائي', text: 'في غير حالات التلبس، لا يجوز القبض على أي إنسان أو توقيفه إلا بأمر من السلطة المختصة بذلك نظاماً. ويجب معاملة المقبوض عليه بما يحفظ كرامته... ويجب على رجل الضبط الجنائي أن يسمع فوراً أقوال المتهم المقبوض عليه، وإذا لم يأتِ بما يبرئه يرسله خلال أربع وعشرين ساعة مع المحضر إلى المحقق.' },
          { number: 40, title: 'حرمة الأشخاص وتفتيشهم', text: 'للأشخاص ومساكنهم ومكاتبهم ومراكبهم حرمة تجب صيانتها. وحرمة الشخص تحمي جسده وملابسه وماله وما يوجد معه من أمتعة. ولا يجوز التفتيش إلا في الأحوال المنصوص عليها نظاماً وبعد صدور أمر مسبب من النيابة العامة أو في حالة التلبس.' },
          { number: 41, title: 'حرمة المساكن', text: 'لا يجوز لرجل الضبط الجنائي الدخول في أي محل مسكون أو تفتيشه إلا في الأحوال المنصوص عليها نظاماً بأمر مسبب من النيابة العامة، وما عدا المساكن فيكتفى بإذن مسبب من المحقق.' },
          { number: 102, title: 'ضمانات استجواب المتهم بالنيابة', text: 'يجب أن يتم الاستجواب في حال لا تؤثر في إرادة المتهم في إبداء أقواله، ولا يجوز تحليفه اليمين، ولا استعمال أي وسيلة من وسائل الإكراه ضده.' },
          { number: 113, title: 'مدة التوقيف بقرار المحقق', text: 'ينتهي التوقيف بمضي خمسة أيام من تاريخ القبض على المتهم، إلا إذا رأى المحقق تمديد مدة التوقيف فيجب قبل انقضائها أن يرفع الأوراق إلى رئيس فرع النيابة العامة في المنطقة أو من ينيبه ليصدر أمراً بالإفراج أو بتمديد مدة التوقيف لمدة أو لمدد متعاقبة لا تزيد في مجموعها على ثلاثين يوماً.' },
          { number: 114, title: 'الحد الأقصى للحبس الاحتياطي بالنيابة', text: 'في الحالات التي تتطلب التوقيف مدة أطول يرفع الأمر للنائب العام ليصدر أمره بالتمديد لمدة أو لمدد متعاقبة لا تزيد كل منها على ثلاثين يوماً ولا تزيد في مجموعها على مائة وثمانين يوماً، يتعين بعدها إحالة المتهم إلى المحكمة أو الإفراج عنه.' }
        ]
      },
      {
        id: 'evidence',
        name: 'نظام الإثبات',
        enactment: 'مرسوم ملكي رقم (م/43) وتاريخ 26/5/1443هـ',
        category: 'قواعد الإثبات',
        articles: [
          { number: 14, title: 'تعريف الإقرار وحجيته', text: 'الإقرار هو اعتراف الخصم أمام القضاء بواقعة مدعى بها عليه، وذلك أثناء السير في الدعوى المتعلقة بهذه الواقعة.' },
          { number: 17, title: 'شروط صحة الإقرار', text: 'يشترط في المقر أن يكون متمتعاً بالأهلية اللازمة، وأن يصدر إقراره عن إرادة حرة واختيار.' },
          { number: 18, title: 'قاعدة عدم تجزئة الإقرار', text: 'لا يتجزأ الإقرار على صاحبه إلا إذا انصب على وقائع متعددة وكان وجود واقعة منها لا يستلزم حتماً وجود الوقائع الأخرى.' },
          { number: 53, title: 'حجية الدليل الرقمي', text: 'الدليل الرقمي هو كل دليل مستمد من أي بيانات تنشأ أو تصدر أو تسلم أو تحفظ أو تبلغ بأي وسيلة رقمية، وتكون لها دلالة على واقعة معينة.' },
          { number: 54, title: 'المساواة بين الدليل الرقمي والمكتوب', text: 'يكون للدليل الرقمي حكم الإثبات بالكتابة وفقاً لأحكام هذا النظام.' },
          { number: 65, title: 'شهادة الشهود وضوابطها', text: 'تكون الشهادة عن مشاهدة أو معاينة، ولا تقبل الشهادة بالتسامع إلا في الأحوال التي تجيزها الشريعة أو النظام.' }
        ]
      },
      {
        id: 'cybercrime',
        name: 'نظام مكافحة جرائم المعلوماتية',
        enactment: 'مرسوم ملكي رقم (م/17) وتاريخ 8/3/1428هـ',
        category: 'موضوعي جزائي',
        articles: [
          { number: 3, title: 'جرائم التشهير والتنصت والمساس بالحياة الخاصة', text: 'يعاقب بالسجن مدة لا تزيد على سنة وبغرامة لا تزيد على خمسمائة ألف ريال أو بإحدى هاتين العقوبتين؛ كل شخص يرتكب أياً من الجرائم المنصوص عليها: التنصت، الدخول غير المشروع للتهديد أو الابتزاز، المساس بالحياة الخاصة عن طريق الهواتف النقالة المزودة بكاميرا أو ما في حكمها، والتشهير بالآخرين وإلحاق الضرر بهم.' },
          { number: 6, title: 'جرائم المساس بالنظام العام والآداب وإنتاج الشائعات', text: 'يعاقب بالسجن مدة لا تزيد على خمس سنوات وبغرامة لا تزيد على ثلاثة ملايين ريال أو بإحدى هاتين العقوبتين كل شخص يرتكب: إنتاج ما من شأنه المساس بالنظام العام أو القيم الدينية أو الآداب العامة أو حرمة الحياة الخاصة أو إعداده أو إرساله أو تخزينه عن طريق الشبكة المعلوماتية.' }
        ]
      },
      {
        id: 'narcotics',
        name: 'نظام مكافحة المخدرات والمؤثرات العقلية',
        enactment: 'مرسوم ملكي رقم (م/39) وتاريخ 8/7/1426هـ',
        category: 'موضوعي جزائي',
        articles: [
          { number: 37, title: 'عقوبة التهريب والترويج للمرة الثانية', text: 'يعاقب بالقتل تعزيراً من يثبت تهريبه مواد مخدرة أو مؤثرات عقلية، أو استيرادها أو تلقيها من المهربين، أو من روج للمرة الثانية بعد سابقة إدانة بالترويج.' },
          { number: 38, title: 'عقوبة الحيازة بقصد الترويج أو الاتجار', text: 'يعاقب بالسجن مدة لا تقل عن خمس سنوات ولا تزيد على خمس عشرة سنة وبجلد لا يزيد على خمسين جلدة في كل دفعة وبغرامة من ألف إلى خمسين ألف ريال كل من حاز أو أحرز مواد مخدرة بقصد الاتجار أو الترويج بمقابل أو بدون مقابل.' },
          { number: 41, title: 'عقوبة التعاطي والحيازة بقصد الاستعمال الشخصي', text: 'يعاقب بالسجن مدة لا تقل عن ستة أشهر ولا تزيد على سنتين كل من ارتكب أفعال الحيازة أو الشراء أو التعاطي بقصد التعاطي أو الاستعمال الشخصي، وتجوز معاملته بالنزول عن العقوبة للمصلحة في المرة الأولى.' },
          { number: 42, title: 'الإعفاء من العقوبة للتقدم للعلاج أو الإبلاغ', text: 'لا تقام الدعوى الجزائية على من يتقدم من تلقاء نفسه للعلاج من التعاطي، أو من بادر بإبلاغ السلطات قبل البدء في ارتكاب الجريمة أو قبل علم السلطات بها.' }
        ]
      }
    ]
  });
});

// Mount API router on both '/api' and '/' to guarantee 100% matching on Vercel, Node, and containers
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Setup Vite middlewares in development, serve static build in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const localDist = path.resolve(__dirname, 'dist');
    const cwdDist = path.resolve(process.cwd(), 'dist');
    const distPath = fs.existsSync(localDist) ? localDist : cwdDist;

    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/assets/')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Judicial Legal Analyzer server running at http://0.0.0.0:${PORT}`);
  });
}

// Run server in non-serverless environments (AI Studio dev server, container, Node.js)
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}

export default app;
