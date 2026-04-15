import { Link } from 'react-router-dom'
import { BookMarked, Library } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlayerBar } from '@/components/PlayerBar'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col pb-44 max-sm:pb-52">
      <header className="border-border/60 bg-background/80 sticky top-0 z-40 overflow-x-clip border-b backdrop-blur-md">
        <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Link to="/" className="group flex min-w-0 flex-col gap-0.5">
            <span className="text-foreground font-serif text-xl tracking-tight">
              Arkham<span className="text-primary">sagor</span>
            </span>
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              Ljudböcker · H.P. Lovecraft
            </span>
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-1 sm:shrink-0 sm:justify-end sm:gap-2">
            <Button variant="ghost" size="sm" asChild className="max-sm:px-2">
              <Link to="/">
                <Library className="size-4" />
                Bibliotek
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="max-sm:px-2">
              <Link to="/bokmarken">
                <BookMarked className="size-4" />
                Bokmärken
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <PlayerBar />
    </div>
  )
}
