# Icebreak — $0 byudjet bilan ishga tushirish qo'llanmasi

Bu loyiha: lidlar ro'yxatini yuklab, AI orqali shaxsiylashtirilgan cold outreach email yozib beruvchi SaaS. Bepul: oyiga 10 ta email. Pro ($19/oy): oyiga 500 ta.

Xarajat mantig'i: foydalanuvchi to'lagunча sizdan hech qanday pul chiqmaydi. Anthropic'ning bepul trial krediti (yangi hisobda odatda beriladi) birinchi mijozlaringizni qamrab olish uchun yetadi. Birinchi obuna tushgach ($19), shu pulning $1-2'ini API balansiga qo'shib qo'yasiz — qolgani sof foyda.

---

## 1-qadam: Loyihani kompyuteringizda ishga tushirish

```bash
npm install
npm run dev
```

Bu ishlashi uchun avval quyidagi 3 ta xizmatda BEPUL hisob ochish kerak.

---

## 2-qadam: Supabase (baza) — bepul

1. https://supabase.com → "New project" (bepul reja yetarli)
2. Loyiha yaratilgach, chap menyudan **SQL Editor** ga o'ting va quyidagi kodni ishga tushiring:

```sql
create table users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  plan text default 'free',
  credits_used int default 0,
  period text,
  created_at timestamp default now()
);
```

3. **Project Settings → API** bo'limidan:
   - `Project URL` → bu `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (secret!) → bu `SUPABASE_SERVICE_ROLE_KEY`

---

## 3-qadam: Anthropic API kaliti

1. https://console.anthropic.com → **API Keys** → "Create key"
2. Bu `ANTHROPIC_API_KEY` bo'ladi
3. Yangi hisoblarga odatda bir necha dollarlik bepul trial krediti beriladi — shu bilan birinchi 50-100 mijozni test qilsangiz bo'ladi
4. Kodda eng arzon model (`claude-haiku-4-5`) ishlatilgan — narxni oshirmoqchi bo'lsangiz `app/api/generate/route.ts` faylida model nomini almashtirasiz

---

## 4-qadam: Stripe (to'lov) — bepul, komissiya faqat sotuvdan

1. https://dashboard.stripe.com → ro'yxatdan o'ting
2. **Product catalog → Add product**: nomi "Icebreak Pro", narxi $19/oy (recurring)
3. Yaratilgan mahsulotning **Price ID** (masalan `price_1AbC...`) → bu `STRIPE_PRO_PRICE_ID`
4. **Developers → API keys** → `Secret key` → bu `STRIPE_SECRET_KEY`
5. **Developers → Webhooks → Add endpoint**:
   - URL: `https://sizning-domeningiz.vercel.app/api/stripe/webhook`
   - Eventlar: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Yaratilgach ko'rsatiladigan **Signing secret** → bu `STRIPE_WEBHOOK_SECRET`

> Diqqat: avval **Test mode**da sinab ko'ring (Stripe test kartalari bilan). Hammasi ishlagach, "Activate payments" bosib jonli (live) rejimga o'ting va kalitlarni live kalitlarga almashtiring.

---

## 5-qadam: Vercel'ga bepul deploy qilish

1. Kodni GitHub'ga yuklang (`git init`, `git add .`, `git commit`, GitHub'da repo yarating, push qiling)
2. https://vercel.com → GitHub repo'ni import qiling (bepul)
3. **Environment Variables** bo'limiga `.env.example` dagi barcha qiymatlarni kiriting
4. Deploy qiling — bir necha daqiqada tayyor bo'ladi, domeningiz: `https://sizning-loyiha.vercel.app`
5. Shu domenni `NEXT_PUBLIC_APP_URL` ga qo'ying va qayta deploy qiling

---

## 6-qadam: Birinchi mijozlarni topish (pul sarflamasdan)

- Reddit: r/sales, r/SaaS, r/Entrepreneur — "I built a tool that..." formatida foydali post yozing (spam emas, haqiqiy tajriba sifatida)
- Indie Hackers'da "Launched" bo'limida e'lon qiling
- Twitter/X'da build-in-public sifatida jarayonni ulashib boring
- Product Hunt'ga (bepul) chiqaring — bu eng ko'p organik trafik keltiradi

---

## Nima o'zgartirish mumkin (keyingi bosqich)

- Auth qo'shish (hozircha faqat email orqali — soddalik uchun; Supabase Auth yoki Clerk qo'shsangiz xavfsizroq bo'ladi)
- CSV export
- Email yuborishni to'g'ridan-to'g'ri integratsiya qilish (masalan Gmail API orqali)
- Boshqa tillar/valyutalarga moslashtirish

---

## Fayl tuzilishi

```
app/page.tsx              → Landing page
app/tool/page.tsx         → Asosiy tool (lead kiritish, natija ko'rish)
app/api/generate/route.ts → AI chaqiruv + limit tekshirish
app/api/stripe/checkout/  → Stripe to'lov sahifasi yaratish
app/api/stripe/webhook/   → To'lov muvaffaqiyatli bo'lganda userni "pro"ga o'tkazish
lib/supabaseAdmin.ts      → Supabase server klienti
```
