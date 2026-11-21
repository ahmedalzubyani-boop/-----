/**
 * استدعاء تحليل نص الصك أو المحضر عبر المسار الخادمي الآمن (/api/tahlil-sok)
 * يستخدم OPENAI_API_KEY من متغيرات البيئة على الخادم ونموذج gpt-4o دون كشف المفتاح في المتصفح.
 */
export async function tahlilSok(nasSok: string): Promise<string> {
  if (!nasSok || !nasSok.trim()) {
    return '❌ خطأ: يرجى إدخال نص الصك أو المحضر للتحليل.';
  }

  try {
    const response = await fetch('/api/tahlil-sok', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nasSok: nasSok.trim() }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      return data?.error || `❌ خطأ: تعذر التحليل (HTTP ${response.status})`;
    }

    return data.result;
  } catch (err: any) {
    return `❌ خطأ: ${err?.message || 'تعذر الاتصال بالخادم.'}`;
  }
}
