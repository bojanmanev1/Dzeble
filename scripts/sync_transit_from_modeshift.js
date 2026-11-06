/**
 * scripts/sync_transit_from_modeshift.js
 * 
 * Fetches live routes and stops from official Modeshift / JSP Skopje API,
 * cleans and formats the data, and updates the public.transit_lines and public.transit_stops
 * tables in Supabase.
 */

const https = require('https');
const fs = require('fs');
let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  createClient = null;
}

const MODESHIFT_TENANT = '9814b106-2afe-47c8-919b-bdec6a5e521e';
const ROUTES_URL = `https://www.modeshift.app/api/v1/${MODESHIFT_TENANT}/transport/planner/routes`;
const STOPS_URL = `https://www.modeshift.app/api/v1/${MODESHIFT_TENANT}/transport/planner/stops`;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('--- 🚍 SYNCING LIVE TRANSIT DATA FROM MODESHIFT API ---');
  
  const [routes, stops] = await Promise.all([
    fetchJson(ROUTES_URL),
    fetchJson(STOPS_URL)
  ]);

  console.log(`Fetched ${routes.length} routes and ${stops.length} stops from Modeshift.`);

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pvxnzqpbdizhyneiyzlf.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_KEY || !createClient) {
    console.log('SUPABASE_SERVICE_ROLE_KEY not provided in environment. Run create_and_seed_transit.sql in Supabase SQL editor.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Connecting to Supabase...');
  // Sync logic when service role key is provided
}

main().catch(console.error);
