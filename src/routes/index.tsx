import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: () => (
    <main className="p-8">
      <Button>NFT Marketplace</Button>
    </main>
  ),
})
