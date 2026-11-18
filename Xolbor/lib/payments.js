'use strict';
const express=require('express');
const {randomUUID}=require('node:crypto');

// Historical Xolbor prices, only offered when the explicitly configured test mode is enabled.
const PACKS=Object.freeze({starter:{name:'Starter',xubor:100,cents:499},standard:{name:'Standard',xubor:700,cents:1999},premium:{name:'Premium',xubor:2300,cents:3999},ultimate:{name:'Ultimate',xubor:7000,cents:9999}});
function installPaymentTables(store){store.db.exec(`CREATE TABLE IF NOT EXISTS payment_orders (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),pack_id TEXT NOT NULL,
 xubor INTEGER NOT NULL CHECK(xubor>0),cents INTEGER NOT NULL CHECK(cents>0),currency TEXT NOT NULL,
 session_id TEXT UNIQUE,status TEXT NOT NULL,created_at INTEGER NOT NULL,paid_at INTEGER);
 CREATE INDEX IF NOT EXISTS payment_orders_user ON payment_orders(user_id,created_at);`);}
function fulfillOrder(store,session){
 if(!session||session.livemode!==false||session.payment_status!=='paid'||session.mode!=='payment'||typeof session.id!=='string')return {credited:false};
 return store.transaction(()=>{
  const order=store.db.prepare('SELECT * FROM payment_orders WHERE id=?').get(session.metadata?.order_id||'');
  if(!order)return {credited:false};
  // Checkout may finish before the create request has stored Stripe's session ID.
  if(order.status==='creating'&&!order.session_id)return {credited:false,retry:true};
  if(order.session_id!==session.id||order.currency!==session.currency||order.cents!==session.amount_total||session.client_reference_id!==order.user_id)return {credited:false};
  if(order.status==='paid')return {credited:false,duplicate:true};
  if(order.status!=='pending')return {credited:false};
  const user=store.userById(order.user_id);if(!user)throw new Error('Payment account unavailable');
  user.xubor+=order.xubor;if(!Number.isSafeInteger(user.xubor))throw new Error('Invalid balance');
  store._saveUsers([user],`stripe-test:${order.id}`);
  store.db.prepare("UPDATE payment_orders SET status='paid',paid_at=? WHERE id=? AND status='pending'").run(Date.now(),order.id);
  return {credited:true};
 });
}
function installPayments({app,store,auth}){
 installPaymentTables(store);
 const key=process.env.STRIPE_SECRET_KEY||'',webhookSecret=process.env.STRIPE_WEBHOOK_SECRET||'';
 // Live financial transactions are intentionally not supported by this phase.
 const enabled=process.env.NODE_ENV!=='production'&&process.env.XUBOR_TEST_PAYMENTS==='1'&&key.startsWith('sk_test_')&&webhookSecret.startsWith('whsec_');
 const stripe=enabled?require('stripe')(key):null;
 app.post('/api/payments/stripe/webhook',express.raw({type:'application/json',limit:'64kb'}),(req,res)=>{
  if(!enabled)return res.status(503).json({error:'Paiement de test non configuré.'});
  let event;try{event=stripe.webhooks.constructEvent(req.body,req.get('stripe-signature'),webhookSecret);}catch{return res.status(400).json({error:'Signature non valide.'});}
  if(event.livemode!==false)return res.status(400).json({error:'Événement de production refusé.'});
  try{if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){const result=fulfillOrder(store,event.data?.object);if(result.retry)return res.status(503).json({error:'Commande en cours de création.'});}return res.json({received:true});}catch(error){console.error('[PAYMENT]',error.message);return res.status(500).json({error:'Impossible de traiter le paiement.'});}
 });
 return {enabled,stripe};
}
function installPaymentApi({app,store,auth,payments}){
 app.get('/api/payments/packs',(_req,res)=>res.json({enabled:payments.enabled,mode:payments.enabled?'test':'disabled',packs:payments.enabled?Object.entries(PACKS).map(([id,p])=>({id,...p,currency:'eur'})):[]}));
 app.post('/api/payments/checkout',async(req,res)=>{
  const user=auth.resolve(req);if(!user)return res.status(401).json({error:'Connecte-toi avant de continuer.'});
  if(!payments.enabled)return res.status(503).json({error:'Les achats de Xubor ne sont pas encore disponibles.'});
  const packId=req.body?.packId;
  if(typeof packId!=='string'||!Object.hasOwn(PACKS,packId))return res.status(400).json({error:'Pack invalide.'});
  const pack=PACKS[packId];
  const id=randomUUID();store.db.prepare("INSERT INTO payment_orders(id,user_id,pack_id,xubor,cents,currency,status,created_at) VALUES(?,?,?,?,?,?,'creating',?)").run(id,user.id,packId,pack.xubor,pack.cents,'eur',Date.now());
  try{
   // In test mode, never derive a redirect URL from an untrusted Host header.
   const origin=`http://127.0.0.1:${process.env.PORT||5897}`;
   const session=await payments.stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],client_reference_id:user.id,metadata:{order_id:id},line_items:[{price_data:{currency:'eur',product_data:{name:`Xolbor ${pack.name} — ${pack.xubor} Xubor (test)`},unit_amount:pack.cents},quantity:1}],success_url:`${origin}/hub#wallet`,cancel_url:`${origin}/hub#wallet`},{idempotencyKey:id});
   if(session.livemode!==false||!session.id||!session.url)throw new Error('Invalid test checkout');
   store.db.prepare("UPDATE payment_orders SET session_id=?,status='pending' WHERE id=? AND status='creating'").run(session.id,id);
   return res.json({checkoutUrl:session.url,mode:'test'});
  }catch(error){store.db.prepare("UPDATE payment_orders SET status='failed' WHERE id=? AND status='creating'").run(id);console.error('[PAYMENT] checkout failed:',error.message);return res.status(502).json({error:'Impossible d’ouvrir le paiement de test.'});}
 });
}
module.exports={PACKS,installPayments,installPaymentApi,installPaymentTables,fulfillOrder};
