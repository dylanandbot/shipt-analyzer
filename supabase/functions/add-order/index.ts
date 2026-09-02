// Supabase Edge Function: add-order
// Called by the Google Apps Script once per synced row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Service role key: this is a trusted server-to-server write from Apps
    // Script, and it must still work once RLS is enabled on the table.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()

    if (!body.order_id) throw new Error('order_id is required.')
    if (!body.claimed_at) throw new Error('claimed_at is required.')

    const order = {
      order_id: body.order_id,
      claimed_at: body.claimed_at,
      store_name: body.store_name ?? null,
      address: body.address ?? null,
      region: body.region ?? null,
      base_pay: body.base_pay ?? 0,
      bonus_pay: body.bonus_pay ?? 0,
      confirmed_tip: body.confirmed_tip ?? null,
      item_count: body.item_count ?? 0,
      estimated_minutes: body.estimated_minutes ?? 0,
      distance_miles: body.distance_miles ?? 0,
      is_batch: body.is_batch ?? false,
      run_status: body.run_status ?? 'unstarted',
      run_started_at: body.run_started_at ?? null,
      run_ended_at: body.run_ended_at ?? null,
      shop_minutes: body.shop_minutes ?? null,
      // Second delivery of a batch. Null on every single-order row.
      stop2_address: body.stop2_address ?? null,
      stop2_region: body.stop2_region ?? null,
      stop2_tip: body.stop2_tip ?? null,
    }

    // The analyzer re-syncs every claimed order on each sync, so the same
    // order_id arrives repeatedly. Upsert keeps tips and shop time current
    // instead of failing on the primary key.
    const { data, error } = await supabaseClient
      .from('orders')
      .upsert(order, { onConflict: 'order_id' })
      .select('order_id')

    if (error) throw error

    return new Response(JSON.stringify({ status: 'ok', order_id: data?.[0]?.order_id ?? order.order_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
