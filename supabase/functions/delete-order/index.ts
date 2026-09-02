// Supabase Edge Function: delete-order
// Called by the Google Apps Script when an order is unclaimed in the analyzer.
//
// Deleting an order is the one operation the analyzer can't reverse, so this is
// deliberately narrow: it removes exactly one row by primary key and refuses a
// request that doesn't name one. There is no bulk or filtered delete here.

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
    // Service role: RLS is enabled on orders with no policies, so this function is
    // the only sanctioned delete path.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : ''

    // An empty or missing id would otherwise become an unfiltered delete.
    if (!orderId) throw new Error('order_id is required.')

    const { data, error } = await supabaseClient
      .from('orders')
      .delete()
      .eq('order_id', orderId)
      .select('order_id')

    if (error) throw error

    // Deleting an order that was never synced is a no-op, not a failure: the
    // analyzer fires this for every unclaim, including same-session ones.
    return new Response(
      JSON.stringify({ status: 'ok', order_id: orderId, deleted: data?.length ?? 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
