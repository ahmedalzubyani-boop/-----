import React, { useState, useEffect } from 'react';
import { BookOpen, X, Search, Copy, CheckCircle2, ChevronRight, Scale, Bookmark } from 'lucide-react';
import { StatuteCategory } from '../types/legal';

interface StatutesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_STATUTES: StatuteCategory[] = [
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
      { number: 29, title: 'حجية المحرر العادي', text: 'يعد المحرر العادي صادراً ممن وقعه ما لم ينكر صراحة ما هو منسوب إليه من خط أو إمضاء أو ختم أو بصمة.' },
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
];

export const StatutesDrawer: React.FC<StatutesDrawerProps> = ({ isOpen, onClose }) => {
  const [statutes, setStatutes] = useState<StatuteCategory[]>(DEFAULT_STATUTES);
  const [selectedStatuteId, setSelectedStatuteId] = useState<string>('cpl');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/statutes')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.statutes && data.statutes.length > 0) {
            setStatutes(data.statutes);
          }
        })
        .catch((err) => console.log('Using default statutes:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStatute = statutes.find((s) => s.id === selectedStatuteId) || statutes[0];

  const filteredArticles = currentStatute
    ? currentStatute.articles.filter((art) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          art.number.toString().includes(query) ||
          art.title.toLowerCase().includes(query) ||
          art.text.toLowerCase().includes(query)
        );
      })
    : [];

  const handleCopyArticle = (articleNumber: number, title: string, text: string) => {
    const citation = `المادة (${articleNumber}) - [${title}] من ${currentStatute.name} (${currentStatute.enactment}):\n"${text}"`;
    navigator.clipboard.writeText(citation);
    setCopiedKey(`${selectedStatuteId}-${articleNumber}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border-r border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800/40 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                مستعرض الأنظمة واللوائح العدلية السعودية
              </h2>
              <p className="text-[11px] text-slate-400">
                قاعدة بيانات نصوص مواد الإجراءات الجزائية والإثبات والأنظمة الموضوعية
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

        {/* Statute Tabs */}
        <div className="flex items-center gap-1.5 p-3 bg-slate-950/50 border-b border-slate-800 overflow-x-auto no-scrollbar">
          {statutes.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStatuteId(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedStatuteId === s.id
                  ? 'bg-emerald-800/60 text-emerald-200 border border-emerald-700/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Scale className="w-3 h-3" />
              <span>{s.name}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم المادة أو الكلمة المفتاحية (مثل: تلبس، تفتيش، إقرار، ٢٤ ساعة)..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pr-9 pl-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Articles List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {currentStatute && (
            <div className="mb-2 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
              <span>{currentStatute.enactment}</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
                {currentStatute.category}
              </span>
            </div>
          )}

          {filteredArticles.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              لم يتم العثور على مواد مطابقة للبحث
            </div>
          ) : (
            filteredArticles.map((art) => {
              const key = `${selectedStatuteId}-${art.number}`;
              return (
                <div
                  key={art.number}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-emerald-950 border border-emerald-700/50 text-emerald-300 font-mono text-xs flex items-center justify-center font-bold">
                        {art.number}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                        المادة ({art.number}): {art.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyArticle(art.number, art.title, art.text)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-300 px-2 py-1 rounded bg-slate-900 border border-slate-800 transition-colors"
                      title="نسخ نص المادة بالصيغة القضائية"
                    >
                      {copiedKey === key ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ المادة</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans pr-8">
                    {art.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
