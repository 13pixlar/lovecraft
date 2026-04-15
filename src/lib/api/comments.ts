import { supabase } from '@/lib/supabaseClient'

export type WorkComment = {
  id: string
  work_slug: string
  author_display_name: string
  body: string
  created_at: string
}

export async function fetchCommentsForWork(workSlug: string): Promise<WorkComment[]> {
  const { data, error } = await supabase
    .from('lovecraft_work_comments')
    .select('id, work_slug, author_display_name, body, created_at')
    .eq('work_slug', workSlug)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as WorkComment[]
}

export async function createWorkComment(params: {
  workSlug: string
  clientId: string
  authorDisplayName: string
  body: string
}): Promise<WorkComment> {
  const { data, error } = await supabase
    .from('lovecraft_work_comments')
    .insert({
      work_slug: params.workSlug,
      client_id: params.clientId,
      author_display_name: params.authorDisplayName.trim(),
      body: params.body.trim(),
    })
    .select('id, work_slug, author_display_name, body, created_at')
    .single()

  if (error) throw new Error(error.message)
  return data as WorkComment
}
