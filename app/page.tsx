import { SiteHeader } from "@/components/site-header"
import { InfoSection } from "@/components/info-section"
import { VanityGenerator } from "@/components/vanity-generator"
import { SiteFooter } from "@/components/site-footer"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:py-6">
          <InfoSection />
          <VanityGenerator />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
