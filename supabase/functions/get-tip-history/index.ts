// Supabase Edge Function: get-tip-history
// Returns tip aggregates grouped by store and by region, in the same shape
// the analyzer's local buildTipIntelligence() produces, so the client can
// merge the two without reshaping either one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAGE = 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Service role, not anon: RLS is enabled on orders to stop the public
    // anon key from reading the table directly, and this function is the
    // only sanctioned read path.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // PostgREST caps rows per request, so page until exhausted rather than
    // silently aggregating only the first page.
    const rows: any[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('store_name, region, confirmed_tip, base_pay, bonus_pay')
        .not('confirmed_tip', 'is', null)
        .range(from, from + PAGE - 1)

      if (error) throw error
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < PAGE) break
    }

    const storeAgg: Record<string, { tips: number[] }> = {}
    const regionAgg: Record<string, { tips: number[]; totals: number[] }> = {}

    for (const r of rows) {
      const tip = Number(r.confirmed_tip) || 0
      const total = (Number(r.base_pay) || 0) + tip + (Number(r.bonus_pay) || 0)

      if (r.store_name) {
        if (!storeAgg[r.store_name]) storeAgg[r.store_name] = { tips: [] }
        storeAgg[r.store_name].tips.push(tip)
      }
      const region = r.region || 'Unknown'
      if (!regionAgg[region]) regionAgg[region] = { tips: [], totals: [] }
      regionAgg[region].tips.push(tip)
      regionAgg[region].totals.push(total)
    }

    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length

    const storeIntel: Record<string, { avgTip: number; count: number }> = {}
    for (const [store, d] of Object.entries(storeAgg)) {
      storeIntel[store] = { avgTip: mean(d.tips), count: d.tips.length }
    }

    const regionIntel: Record<string, { avgTip: number; avgRate: number; count: number }> = {}
    for (const [region, d] of Object.entries(regionAgg)) {
      const avgTip = mean(d.tips)
      const avgTotal = mean(d.totals)
      regionIntel[region] = {
        avgTip,
        avgRate: avgTotal > 0 ? avgTip / avgTotal : 0,
        count: d.tips.length,
      }
    }

    return new Response(
      JSON.stringify({ storeIntel, regionIntel, sourceOrders: rows.length }),
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
