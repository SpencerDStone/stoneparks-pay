export async function onRequestPost({ request, env }) {
try {
const body = await request.json();


// Server-side validation — never trust client amounts
const SCHOOL_LABELS = { central: 'Central High', ridge: 'Ridge Academy', northview: 'Northview' };
const PERMIT_PRICES = { standard: 5000, senior: 7500, replacement: 1000 }; // cents


const school = body.school;
const permitType = body.permitType;
if (!SCHOOL_LABELS[school] || !PERMIT_PRICES[permitType]) {
return json({ error: 'Invalid school or permit type' }, 400);
}


const unitAmount = PERMIT_PRICES[permitType];
const productName = `Parking Permit — ${SCHOOL_LABELS[school]} — ${permitType}`;


const site = env.SITE_URL || new URL(request.url).origin;
const successUrl = `${site}/success?session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = `${site}/cancel`;


const form = new URLSearchParams();
form.append('mode', 'payment');
form.append('success_url', successUrl);
form.append('cancel_url', cancelUrl);
form.append('payment_method_types[]', 'card');
form.append('payment_method_types[]', 'link');
form.append('allow_promotion_codes', 'true');
form.append('line_items[0][price_data][currency]', 'usd');
form.append('line_items[0][price_data][unit_amount]', String(unitAmount));
form.append('line_items[0][price_data][product_data][name]', productName);
form.append('line_items[0][quantity]', '1');


// Optional: pass metadata for reconciliation
const meta = {
studentName: (body.studentName || '').slice(0, 80),
studentId: (body.studentId || '').slice(0, 40),
plate: (body.plate || '').slice(0, 16),
state: (body.state || '').slice(0, 8),
phone: (body.phone || '').slice(0, 24),
email: (body.email || '').slice(0, 120),
school,
permitType
};
for (const [k, v] of Object.entries(meta)) {
if (v) form.append(`metadata[${k}]`, v);
}


const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
method: 'POST',
headers: {
'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
'Content-Type': 'application/x-www-form-urlencoded'
},
body: form
});


const data = await stripeRes.json();
if (!stripeRes.ok) {
console.error('Stripe error', data);
return json({ error: 'Stripe error', details: data }, 500);
}


return json({ url: data.url });
} catch (err) {
console.error(err);
return json({ error: 'Bad request' }, 400);
}
}


function json(obj, status = 200) {
return new Response(JSON.stringify(obj), {
status,
headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
}
