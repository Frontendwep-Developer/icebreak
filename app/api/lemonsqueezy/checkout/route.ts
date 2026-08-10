import { NextRequest, NextResponse } from "next/server";

// Lemon Squeezy'da API chaqirmasdan ham checkout link qurish mumkin,
// lekin API orqali qurish "custom data" (email) ni ishonchli tarzda
// checkout ichiga qo'shib beradi — shu email webhook orqali qaytib keladi.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "email kerak" }, { status: 400 });
    }

    const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email,
              custom: { user_email: email },
            },
            product_options: {
              redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/tool?upgraded=1`,
            },
          },
          relationships: {
            store: {
              data: {
                type: "stores",
                id: process.env.LEMONSQUEEZY_STORE_ID,
              },
            },
            variant: {
              data: {
                type: "variants",
                id: process.env.LEMONSQUEEZY_VARIANT_ID,
              },
            },
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Lemon Squeezy error:", data);
      return NextResponse.json(
        { error: "Checkout yaratib bo'lmadi" },
        { status: 500 }
      );
    }

    const checkoutUrl = data?.data?.attributes?.url;
    return NextResponse.json({ url: checkoutUrl });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
