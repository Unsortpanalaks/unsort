export default async function handler(req, res) {
  const { token, action } = req.query;

  if (!token || !["accept", "decline"].includes(action)) {
    return sendPage(res, "Invalid link", "This link is invalid or expired.", "❌");
  }

  const SUPABASE_URL = "https://mzcsiqquiigetvwivnhy.supabase.co";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;
  const FROM_EMAIL   = "onboarding@resend.dev";

  const TOUR_LABELS = { food: "Food Tour", walking: "Walking Tour", bike: "Bike Tour" };
  const SLOT_LABELS = { morning: "Morning - 9:30 am to 1:00 pm", afternoon: "Afternoon - 2:30 pm to 6:00 pm" };

  // Fetch booking by token
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?action_token=eq.${token}&select=*`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );
  const bookings = await fetchRes.json();

  if (!bookings || bookings.length === 0) {
    return sendPage(res, "Not found", "This link is invalid or already used.", "❌");
  }

  const booking = bookings[0];

  if (booking.status !== "pending") {
    return sendPage(res, "Already actioned", `This booking was already <strong>${booking.status}</strong>. No changes made.`, booking.status === "accepted" ? "✅" : "❌");
  }

  // Update status
  await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking.id}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: action === "accept" ? "accepted" : "declined" }),
  });

  const dateStr = new Date(booking.tour_date).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  if (action === "accept") {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.email,
        subject: `Booking confirmed - ${TOUR_LABELS[booking.tour_type]} - ${dateStr}`,
        html: `<p>Dear ${booking.first_name}, your ${TOUR_LABELS[booking.tour_type]} on ${dateStr} (${SLOT_LABELS[booking.slot]}) is confirmed! Payment on the day. See you in Copenhagen!</p>`,
      }),
    });
    return sendPage(res, "Booking Accepted! ✅",
      `<strong>${booking.first_name} ${booking.last_name}</strong> confirmed for ${TOUR_LABELS[booking.tour_type]} on ${dateStr}.<br><br>Confirmation sent to <strong>${booking.email}</strong>.<br>The slot is now blocked on your website.`,
      "✅");
  } else {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.email,
        subject: "About your tour request - Good Good Copenhagen",
        html: `<p>Dear ${booking.first_name}, unfortunately we could not confirm your booking for ${dateStr}. Please visit our website to choose another date.</p>`,
      }),
    });
    return sendPage(res, "Booking Declined ❌", `Sorry email sent to <strong>${booking.email}</strong>. The slot is free again.`, "❌");
  }
}

function sendPage(res, title, message, icon) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Good Good Copenhagen</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #F5F0E8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .card { background: #FDFAF5; border: 1.5px solid #1A1714; border-radius: 4px; max-width: 480px; width: 100%; overflow: hidden; }
    .card-header { background: #1A1714; padding: 1.5rem 2rem; }
    .logo { font-family: 'Fraunces', serif; font-weight: 900; font-size: 1.4rem; color: #F5F0E8; letter-spacing: -0.03em; }
    .logo span { color: #C4532A; }
    .card-body { padding: 2.5rem 2rem; text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 1.8rem; letter-spacing: -0.03em; color: #1A1714; margin-bottom: 1rem; line-height: 1.2; }
    p { font-size: 0.95rem; color: #6B5F52; line-height: 1.7; }
    .divider { width: 40px; height: 2px; background: #C4532A; margin: 1.2rem auto; }
    .back-btn { display: inline-block; margin-top: 1.5rem; background: #1A1714; color: #F5F0E8; text-decoration: none; font-size: 0.82rem; font-weight: 500; padding: 0.75rem 1.6rem; border-radius: 2px; letter-spacing: 0.04em; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header"><div class="logo">goodgood<span>copenhagen</span>.</div></div>
    <div class="card-body">
      <div class="icon">${icon}</div>
      <h1>${title}</h1>
      <div class="divider"></div>
      <p>${message}</p>
      <a href="https://unsort.vercel.app" class="back-btn">Back to website</a>
    </div>
  </div>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
