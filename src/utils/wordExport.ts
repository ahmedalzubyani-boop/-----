/**
 * Unified Professional Judicial Document Exporter (Word & PDF / Print)
 * 
 * Features:
 * 1. Clean Official Legal Document formatting for Saudi Courts & Najiz
 * 2. Complete removal of UI elements, buttons, URLs, markdown syntax, and background artifacts
 * 3. Fixed Official Court Header with:
 *    - Platform Name: المستشار العدلي الذكي
 *    - Case & Deed Numbers
 *    - Court & Circuit Names
 *    - Official Bismillah & Parties
 * 4. Dedicated isolated Iframe Printing for PDF (Zero UI bleed, zero repeated background cards)
 * 5. Full Word (.doc) Office XML with A4 margins and Traditional Arabic typography
 */

export interface JudicialDocOptions {
  filename?: string;
  title: string;
  content: string;
  courtName?: string;
  caseNumber?: string;
  parties?: string;
  date?: string;
  appellantName?: string;
}

/**
 * Clean judicial text by stripping markdown tokens, technical URLs, and normalizing paragraphs
 */
export function cleanJudicialText(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Remove raw URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code fences
    .replace(/```[a-z]*\n?/gi, '')
    // Remove markdown horizontal rules
    .replace(/^---+$/gm, '')
    .replace(/^\*\*\*+$/gm, '')
    // Normalize markdown headers (### Heading -> Heading)
    .replace(/^#{1,6}\s*(.*)$/gm, '$1')
    // Trim extra spaces
    .trim();
}

/**
 * Formats plain/markdown legal text into structured HTML paragraphs and headings
 */
function formatContentToHtml(content: string): string {
  const cleaned = cleanJudicialText(content);

  return cleaned
    .split(/\n\s*\n/)
    .map((block) => {
      let trimmed = block.trim();
      if (!trimmed) return '';

      // Clean inline bold markers (**text** -> <strong>text</strong>)
      trimmed = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      trimmed = trimmed.replace(/\*(.*?)\*/g, '<em>$1</em>');

      // Check if paragraph is an official legal heading
      const isHeading =
        trimmed.startsWith('الموضوع:') ||
        trimmed.startsWith('أولاً:') ||
        trimmed.startsWith('ثانياً:') ||
        trimmed.startsWith('ثالثاً:') ||
        trimmed.startsWith('رابعاً:') ||
        trimmed.startsWith('خامساً:') ||
        trimmed.startsWith('أصحاب الفضيلة') ||
        trimmed.startsWith('الطلبات:') ||
        trimmed.startsWith('أسباب الطعن:') ||
        trimmed.startsWith('أسباب ومطاعن') ||
        trimmed.startsWith('الدفوع الشكلية') ||
        trimmed.startsWith('الدفوع الموضوعية') ||
        trimmed.startsWith('وقائع الدعوى:');

      if (isHeading) {
        const formatted = trimmed.replace(/\n/g, '<br/>');
        return `<p class="legal-heading">${formatted}</p>`;
      }

      // Check for closing / signature block
      if (
        trimmed.includes('والله يحفظكم') ||
        trimmed.includes('مقدمه/') ||
        trimmed.includes('مقدمه:') ||
        trimmed.includes('التوقيع:') ||
        trimmed.includes('والله الموفق')
      ) {
        const formatted = trimmed.replace(/\n/g, '<br/>');
        return `<div class="signature-block">${formatted}</div>`;
      }

      const formatted = trimmed.replace(/\n/g, '<br/>');
      return `<p class="legal-paragraph">${formatted}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Generate Complete HTML Document for Printing or Word Export
 */
function buildOfficialDocumentHtml(options: JudicialDocOptions, isForWord = false): string {
  const {
    title,
    content,
    courtName = 'محكمة الاستئناف الموقرة',
    caseNumber = 'المرفقة بالأوراق',
    parties,
    date = new Date().toLocaleDateString('ar-SA'),
    appellantName = 'المستأنف / المدعى عليه',
  } = options;

  const formattedBody = formatContentToHtml(content);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" ${
    isForWord
      ? "xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'"
      : ''
  }>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  ${
    isForWord
      ? `<!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->`
      : ''
  }
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 15mm 20mm 15mm;
    }
    @page Section1 {
      size: 21.0cm 29.7cm;
      margin: 2.5cm 2.0cm 2.5cm 2.0cm;
      mso-header-margin: 1.25cm;
      mso-footer-margin: 1.25cm;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Amiri', 'Traditional Arabic', 'Cairo', 'Times New Roman', serif;
      direction: rtl;
      text-align: right;
      font-size: 14pt;
      line-height: 1.85;
      color: #000000;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .official-header {
      border: 1.5pt solid #0f5132;
      background-color: #f8faf8;
      border-radius: 4pt;
      padding: 12pt 16pt;
      margin-bottom: 22pt;
      display: table;
      width: 100%;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    .header-table td {
      vertical-align: middle;
      border: none;
      padding: 2pt 4pt;
      font-size: 12.5pt;
    }
    .app-title {
      font-size: 13pt;
      font-weight: bold;
      color: #0f5132;
      text-align: right;
    }
    .case-meta {
      text-align: left;
      font-size: 11.5pt;
      color: #333333;
    }
    .bismillah {
      text-align: center;
      font-size: 18pt;
      font-weight: bold;
      color: #000000;
      margin-top: 10pt;
      margin-bottom: 20pt;
      letter-spacing: 0.5pt;
    }
    .document-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 18pt;
      color: #0d3820;
      text-decoration: underline;
    }
    .legal-heading {
      font-size: 15pt;
      font-weight: bold;
      color: #0d3820;
      margin-top: 16pt;
      margin-bottom: 6pt;
      padding-bottom: 3pt;
      border-bottom: 0.5pt solid #c8e6c9;
    }
    .legal-paragraph {
      text-indent: 2em;
      margin-top: 6pt;
      margin-bottom: 6pt;
      text-align: justify;
      text-justify: inter-word;
      font-size: 14pt;
    }
    .signature-block {
      margin-top: 35pt;
      padding-top: 12pt;
      text-align: left;
      line-height: 2.0;
      font-size: 14pt;
    }
    .official-footer {
      margin-top: 40pt;
      border-top: 0.75pt solid #cccccc;
      padding-top: 8pt;
      font-size: 9.5pt;
      color: #666666;
      text-align: center;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body dir="rtl">
  <div class="Section1">
    <!-- Header with Official Emblem, Platform Name, and Case Metadata -->
    <div class="official-header">
      <table class="header-table">
        <tr>
          <td style="width: 50%;">
            <div class="app-title">⚖️ منصة المستشار العدلي الذكي للأنظمة السعودية</div>
            <div style="font-size: 11.5pt; color: #444444; margin-top: 2pt;">
              المحكمة الموجه إليها: <strong>${courtName}</strong>
            </div>
            ${parties ? `<div style="font-size: 11pt; color: #555555; margin-top: 2pt;"><strong>الأطراف:</strong> ${parties}</div>` : ''}
          </td>
          <td style="width: 50%; text-align: left;">
            <div class="case-meta">
              <div><strong>رقم القضية / الصك:</strong> ${caseNumber}</div>
              <div><strong>المستأنف / مقدم الدفع:</strong> ${appellantName}</div>
              <div><strong>تاريخ التحرير:</strong> ${date}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div class="bismillah">بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ</div>

    <!-- Structured Legal Content -->
    <div class="content-body">
      ${formattedBody}
    </div>

    <!-- Footer Note -->
    <div class="official-footer">
      وثيقة عدلية محررة ومعتمدة ومجهزة للتقديم المباشر أو عبر منصة ناجز القضائية • صالحة للطباعة والتوقيع الرسمي
    </div>
  </div>
</body>
</html>`;
}

/**
 * Print Judicial Document in an Isolated Clean Iframe
 * Prevents any UI elements, modal backgrounds, checkboxes, or tech URLs from printing!
 */
export function printJudicialDocument(options: JudicialDocOptions): boolean {
  try {
    const html = buildOfficialDocumentHtml(options, false);

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.id = 'judicial-print-iframe';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      throw new Error('Failed to access print iframe document');
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Give iframe time to layout fonts and styling, then trigger print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print failed, falling back to window.print():', err);
        window.print();
      } finally {
        // Cleanup iframe after a comfortable delay
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }
    }, 400);

    return true;
  } catch (err) {
    console.error('printJudicialDocument error:', err);
    window.print();
    return false;
  }
}

/**
 * Export Judicial Document to Microsoft Word (.doc) with Office XML and A4 margins
 */
export function exportJudicialTextToWord(options: JudicialDocOptions): boolean {
  try {
    const { filename, caseNumber = 'قضائي' } = options;
    const htmlDocument = buildOfficialDocumentHtml(options, true);

    const cleanFilename =
      (filename || `مذكرة_قضائية_${caseNumber}`)
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_') + '.doc';

    const blob = new Blob(['\ufeff', htmlDocument], {
      type: 'application/msword;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = cleanFilename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    return true;
  } catch (err) {
    console.error('Word document export error:', err);
    return false;
  }
}
