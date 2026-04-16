import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Resend API Key is not configured' },
      { status: 500 }
    );
  }

  try {
    const { type, data } = await request.json();

    if (type === 'approval_request') {
      const { name, email, tcNo, approvalLink } = data;
      
      const { data: emailData, error } = await resend.emails.send({
        from: 'Aşevi Otomasyon <onboarding@resend.dev>',
        to: ['edirnesydv@gmail.com'],
        subject: 'Yeni Yetkili Personel Onay Talebi',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Yeni Personel Kaydı</h2>
            <p style="color: #475569; font-size: 16px;">Sisteme yeni bir yetkili personel kayıt oldu ve onayınızı bekliyor.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Ad Soyad:</strong> ${name}</p>
              <p style="margin: 5px 0;"><strong>E-posta:</strong> ${email}</p>
            </div>
            
            <p style="color: #475569;">Bu personeli onaylamak için aşağıdaki butona tıklayabilirsiniz:</p>
            
            <a href="${approvalLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Personeli Onayla</a>
            
            <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
              T.C. Edirne Sosyal Yardımlaşma ve Dayanışma Vakfı - Aşevi Dağıtım Otomasyonu
            </p>
          </div>
        `,
      });

      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }

      return NextResponse.json({ success: true, data: emailData });
    }

    if (type === 'approval_notification') {
      const { name, email } = data;
      
      const { data: emailData, error } = await resend.emails.send({
        from: 'Aşevi Otomasyon <onboarding@resend.dev>',
        to: [email],
        subject: 'Hesabınız Onaylandı - Aşevi Otomasyon',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #1e293b; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Hesabınız Onaylandı!</h2>
            <p style="color: #475569; font-size: 16px;">Sayın ${name},</p>
            <p style="color: #475569;">Aşevi Dağıtım Otomasyonu için yaptığınız yetkili personel başvurusu onaylanmıştır.</p>
            
            <p style="color: #475569;">Artık sisteme giriş yapabilirsiniz.</p>
            
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ais-dev-amd4rfqkfmf3xi3qgofkse-206218362643.europe-west3.run.app'}/admin/login" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Sisteme Giriş Yap</a>
            
            <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
              T.C. Edirne Sosyal Yardımlaşma ve Dayanışma Vakfı - Aşevi Dağıtım Otomasyonu
            </p>
          </div>
        `,
      });

      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }

      return NextResponse.json({ success: true, data: emailData });
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  } catch (error) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
