import { trimMetaDescription } from '@/lib/seoText'

const AUTHOR = { '@type': 'Person' as const, name: 'H. P. Lovecraft' }

export function buildWebSiteJsonLd(siteUrl: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Arkhamsagor',
    url: siteUrl,
    inLanguage: 'sv',
    description: trimMetaDescription(description, 300),
  }
}

export function buildAudiobookJsonLd(opts: {
  url: string
  name: string
  description: string
  imageAbsolute: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Audiobook',
    name: opts.name,
    author: AUTHOR,
    url: opts.url,
    inLanguage: 'sv',
    description: trimMetaDescription(opts.description, 300),
    ...(opts.imageAbsolute ? { image: opts.imageAbsolute } : {}),
  }
}
