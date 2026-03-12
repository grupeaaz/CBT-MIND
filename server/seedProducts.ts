import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const products = await stripe.products.search({ query: "name:'Presence Premium'" });
  if (products.data.length > 0) {
    console.log('Presence Premium already exists:', products.data[0].id);
    const prices = await stripe.prices.list({ product: products.data[0].id, active: true });
    console.log('Prices:', prices.data.map(p => `${p.id} - ${p.unit_amount} ${p.currency} / ${p.recurring?.interval}`));
    return;
  }

  const product = await stripe.products.create({
    name: 'Presence Premium',
    description: 'Unlimited access to all CBT healing tools, wisdom, and practices. €2/month billed yearly.',
    metadata: {
      app: 'presence',
      type: 'subscription',
    },
  });

  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 2400,
    currency: 'eur',
    recurring: {
      interval: 'year',
    },
    metadata: {
      display_price: '€2/month',
      billing: 'yearly',
    },
  });

  console.log('Created product:', product.id);
  console.log('Created yearly price:', yearlyPrice.id, '- €24/year (€2/month)');
}

createProducts().catch(console.error);
