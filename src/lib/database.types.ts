export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      lovecraft_works: {
        Row: {
          slug: string
          title_sv: string
          original_title_en: string | null
          description_sv: string
          sort_order: number
          cover_filename: string | null
          created_at: string
        }
        Insert: {
          slug: string
          title_sv: string
          original_title_en?: string | null
          description_sv: string
          sort_order: number
          cover_filename?: string | null
          created_at?: string
        }
        Update: {
          slug?: string
          title_sv?: string
          original_title_en?: string | null
          description_sv?: string
          sort_order?: number
          cover_filename?: string | null
          created_at?: string
        }
        Relationships: []
      }
      lovecraft_tracks: {
        Row: {
          id: number
          work_slug: string
          sort_order: number
          filename: string
          title_sv: string
        }
        Insert: {
          id?: never
          work_slug: string
          sort_order: number
          filename: string
          title_sv: string
        }
        Update: {
          id?: never
          work_slug?: string
          sort_order?: number
          filename?: string
          title_sv?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lovecraft_tracks_work_slug_fkey'
            columns: ['work_slug']
            isOneToOne: false
            referencedRelation: 'lovecraft_works'
            referencedColumns: ['slug']
          },
        ]
      }
      lovecraft_work_ratings: {
        Row: {
          id: number
          work_slug: string
          client_id: string
          rating: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: never
          work_slug: string
          client_id: string
          rating: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: never
          work_slug?: string
          client_id?: string
          rating?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lovecraft_work_comments: {
        Row: {
          id: string
          work_slug: string
          client_id: string
          author_display_name: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          work_slug: string
          client_id: string
          author_display_name: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          work_slug?: string
          client_id?: string
          author_display_name?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      lovecraft_work_rating_stats: {
        Row: {
          work_slug: string | null
          avg_rating: number | null
          rating_count: number | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
