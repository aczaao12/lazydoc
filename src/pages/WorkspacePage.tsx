import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Puzzle } from 'lucide-react'

export default function WorkspacePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b bg-background">
        <span className="font-bold">lazydoc</span>
        <Button variant="outline" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-1 size-4" />
          Trang chủ
        </Button>
      </header>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Puzzle className="mx-auto size-12 mb-4 opacity-40" />
          <h2 className="text-lg font-semibold text-foreground">Workspace</h2>
          <p className="text-sm mt-1">Chức năng đang phát triển. Sẽ sớm ra mắt!</p>
        </div>
      </div>
    </div>
  )
}
