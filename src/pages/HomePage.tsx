import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Puzzle, FileDown } from 'lucide-react'

const features = [
  {
    icon: BookOpen,
    title: 'Đọc tài liệu',
    desc: 'Mở thư mục hoặc file .zip chứa tài liệu Markdown, xem nội dung với quiz tương tác.',
    path: '/reader',
  },
  {
    icon: FileDown,
    title: 'AI → Word',
    desc: 'Chuyển đổi nội dung Markdown từ AI sang Word, xử lý công thức toán/lý/hóa.',
    path: '/ai-to-word',
  },
  {
    icon: Puzzle,
    title: 'Workspace',
    desc: 'Môi trường làm việc tích hợp — đang phát triển.',
    path: '/workspace',
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">lazydoc</h1>
        <p className="text-muted-foreground mt-1">Học với Markdown + Quiz tương tác</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
        {features.map((f) => {
          const Icon = f.icon
          return (
            <Card
              key={f.path}
              className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => navigate(f.path)}
            >
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <Icon className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
