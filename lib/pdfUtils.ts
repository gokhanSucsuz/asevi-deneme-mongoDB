import jsPDF from 'jspdf';

export async function getTurkishPdf(orientation: 'portrait' | 'landscape' = 'portrait'): Promise<jsPDF> {
  const doc = new jsPDF(orientation);
  try {
    // Use a more reliable font source or local if possible, but for now we stick to CDN with better error handling
    const fontUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf'
    ];

    const fetchFont = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch font: ${url}`);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const [regBase64, medBase64] = await Promise.all([
      fetchFont(fontUrls[0]),
      fetchFont(fontUrls[1])
    ]);

    doc.addFileToVFS('Roboto-Regular.ttf', regBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Medium.ttf', medBase64);
    doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

    doc.setFont('Roboto', 'normal');
  } catch (e) {
    console.error('Error loading fonts for PDF, falling back to default', e);
    // Fallback to a standard font that supports some Turkish characters if possible
    doc.setFont('helvetica', 'normal');
  }
  return doc;
}

export async function addVakifLogo(doc: jsPDF, x: number = 14, y: number = 10, size: number = 20) {
  const logoUrl = 'https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg';
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) throw new Error('Failed to fetch logo');
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    doc.addImage(base64, 'JPEG', x, y, size, size);
    return y + size + 5; // Return next Y position
  } catch (e) {
    console.error('Error adding logo to PDF', e);
    return y;
  }
}

export function addReportFooter(doc: jsPDF, personnelName: string) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const dateStr = new Date().toLocaleString('tr-TR');
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    const pageSize = doc.internal.pageSize;
    const pageWidth = pageSize.width;
    const pageHeight = pageSize.height;
    
    doc.text(
      `Raporlayan Personel: ${personnelName} | Rapor Tarihi: ${dateStr} | Sayfa: ${i} / ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
}
