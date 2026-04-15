import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Library } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/lib/siteConstants'

export function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Sidan hittades inte · {SITE_NAME}</title>
        <meta name="description" content="Sidan finns inte. Gå tillbaka till biblioteket med svenska Lovecraft-ljudböcker." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="space-y-6 py-8">
        <h1 className="font-serif text-3xl tracking-tight md:text-4xl">Sidan hittades inte</h1>
        <p className="text-muted-foreground max-w-md leading-relaxed">
          Adressen matchar inget verk eller någon sida på den här webbplatsen.
        </p>
        <Button asChild>
          <Link to="/">
            <Library className="size-4" />
            Till biblioteket
          </Link>
        </Button>
      </div>
    </>
  )
}
