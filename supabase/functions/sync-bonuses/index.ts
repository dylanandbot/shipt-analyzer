// Supabase Edge Function: sync-bonuses
// Called by the Google Apps Script with the complete current bonus list.
//
// This mirrors rather than appends: bonuses the analyzer no longer has are deleted
// here too. Upserting alone would leave a bonus the user removed sitting in the table
// forever, quietly inflating any earnings total built from it.

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
    // Service role: RLS is enabled on bonuses with no policies, so this function is
    // the only sanctioned write path.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const incoming = Array.isArray(body.bonuses) ? body.bonuses : []

    const rows = incoming
      .filter((b: any) => b && b.bonus_id && b.earned_on)
      .map((b: any) => ({
        bonus_id: String(b.bonus_id),
        earned_on: String(b.earned_on),
        amount: Number(b.amount) || 0,
        note: b.note ? String(b.note) : null,
        synced_at: new Date().toISOString(),
      }))

    // An empty payload means "delete everything" only when the caller says so
    // explicitly — the user removed their last bonus. Without that flag it means
    // "nothing to say", so a failed read upstream can't silently wipe the table.
    if (rows.length === 0) {
      if (body.allow_empty !== true) {
        return new Response(JSON.stringify({ status: 'ok', upserted: 0, deleted: 0, note: 'empty payload ignored' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      const { data: wiped, error: wipeError } = await supabaseClient
        .from('bonuses')
        .delete()
        .not('bonus_id', 'is', null)
        .select('bonus_id')

      if (wipeError) throw wipeError

      return new Response(JSON.stringify({ status: 'ok', upserted: 0, deleted: wiped?.length ?? 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const { error: upsertError } = await supabaseClient
      .from('bonuses')
      .upsert(rows, { onConflict: 'bonus_id' })

    if (upsertError) throw upsertError

    // Diff in JS and delete by explicit id list. Building a PostgREST `not.in(...)`
    // string would mean hand-quoting every id and getting the escaping exactly right.
    const keep = new Set(rows.map((r) => r.bonus_id))
    const { data: existing, error: readError } = await supabaseClient
      .from('bonuses')
      .select('bonus_id')

    if (readError) throw readError

    const stale = (existing ?? []).map((r) => r.bonus_id).filter((id) => !keep.has(id))

    if (stale.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from('bonuses')
        .delete()
        .in('bonus_id', stale)

      if (deleteError) throw deleteError
    }

    return new Response(
      JSON.stringify({ status: 'ok', upserted: rows.length, deleted: stale.length }),
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
