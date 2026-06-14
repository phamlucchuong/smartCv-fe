import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Button } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { Upload, FileText, Star, Trash2, RefreshCw, Eye, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'
import { useListCvs, useSetDefaultCv, useDeleteCv, useReanalyzeCv, uploadCvFile, getListCvsQueryKey } from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/useAuthStore'

export const Route = createFileRoute('/_account/cv')({
  component: MyCVPage,
})

const cvStatusStyle: Record<string, string> = {
  COMPLETED: 'bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20',
  PROCESSING: 'bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/20',
  PENDING: 'bg-muted text-muted-foreground border border-border',
  FAILED: 'bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20',
}

const cvStatusLabel: Record<string, string> = {
  COMPLETED: 'Đã phân tích',
  PROCESSING: 'Đang xử lý',
  PENDING: 'Chờ xử lý',
  FAILED: 'Thất bại',
}

function getFileType(filename?: string): 'PDF' | 'DOCX' | 'DOC' {
  if (!filename) return 'PDF'
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.endsWith('.docx')) return 'DOCX'
  return 'DOC'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function MyCVPage() {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language || 'vi'
  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useListCvs({ query: { enabled: isAuthenticated } })
  const cvList = data?.data ?? []

  const { mutateAsync: setDefault, isPending: isSettingDefault } = useSetDefaultCv()
  const { mutateAsync: deleteCv, isPending: isDeletingCv } = useDeleteCv()
  const { mutateAsync: reanalyzeCv, isPending: isReanalyzing } = useReanalyzeCv()
  const isAnyPending = isSettingDefault || isDeletingCv || isReanalyzing

  React.useEffect(() => {
    document.title = t('page_title_cv')
  }, [t])

  const [userSelected, setUserSelected] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const ZOOM_STEP = 0.15
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 2.5
  const [zoom, setZoom] = React.useState(1.0)
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))
  const zoomReset = () => setZoom(1.0)

  const defaultSelected = (cvList.find((c) => c.default) ?? cvList[0])?.id ?? ''
  const selected = userSelected ?? defaultSelected
  const cv = cvList.find((c) => c.id === selected) ?? cvList[0]

  React.useEffect(() => { setZoom(1.0) }, [selected])

  const invalidateCvs = () => queryClient.invalidateQueries({ queryKey: getListCvsQueryKey() })

  const handleUpload = async (file: File | null) => {
    if (!file) return
    const validType = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)
    if (!validType) {
      toast.error(t('account_upload_invalid_type'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('account_upload_too_large'))
      return
    }
    setIsUploading(true)
    try {
      await uploadCvFile(file)
      await invalidateCvs()
      toast.success('CV uploaded successfully')
    } catch {
      toast.error('CV upload failed')
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSetDefault = async (cvId: string) => {
    try {
      await setDefault({ cvId })
      await invalidateCvs()
      toast.success('Default CV updated')
    } catch {
      toast.error('Failed to set default CV')
    }
  }

  const handleDelete = async (cvId: string) => {
    try {
      await deleteCv({ cvId })
      await invalidateCvs()
      if (userSelected === cvId) setUserSelected(null)
      toast.success('CV deleted')
    } catch {
      toast.error('Failed to delete CV')
    }
  }

  const handleReanalyze = async (cvId: string) => {
    try {
      await reanalyzeCv({ cvId })
      await invalidateCvs()
      toast.success('Re-analysis triggered')
    } catch {
      toast.error('Failed to trigger re-analysis')
    }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading CVs...</div>
  if (isError) return <div className="p-8 text-center text-destructive">Failed to load CVs.</div>

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">CV của tôi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tối đa 10 CV • Hỗ trợ PDF, DOCX</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="card-surface h-fit space-y-1 p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold text-foreground">Danh sách CV ({cvList.length}/10)</p>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />
            <Button size="sm" variant="outline" disabled={isUploading || cvList.length >= 10} onClick={() => fileRef.current?.click()} className="h-7 gap-1 px-2 text-xs">
              <Upload className="h-3 w-3" />
              {isUploading ? 'Đang tải...' : 'Thêm CV'}
            </Button>
          </div>
          {cvList.map((c) => {
            const fileType = getFileType(c.filename)
            const statusStr = String(c.analysisStatus ?? 'PENDING')
            return (
              <button
                key={c.id}
                onClick={() => setUserSelected(c.id ?? '')}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${selected === c.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-bold">{fileType}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(c.uploadedAt)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cvStatusStyle[statusStr] ?? cvStatusStyle['PENDING']}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        {cvStatusLabel[statusStr] ?? statusStr}
                      </span>
                      {c.default && <span className="inline-flex items-center gap-1 text-xs text-[var(--warning)]"><Star className="h-3 w-3 fill-[var(--warning)]" /> Mặc định</span>}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {cv && (
          <div className="space-y-4">
            <div className="card-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold text-foreground">{cv.filename}</p>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Xem trước"
                    disabled={!cv.url}
                    onClick={() => cv.url && window.open(cv.url, '_blank')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Đặt làm mặc định"
                    disabled={isAnyPending || !!cv.default}
                    onClick={() => cv.id && handleSetDefault(cv.id)}
                  >
                    <Star className={`h-4 w-4 ${cv.default ? 'fill-[var(--warning)] text-[var(--warning)]' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Phân tích lại"
                    disabled={isAnyPending}
                    onClick={() => cv.id && handleReanalyze(cv.id)}
                  >
                    <RefreshCw className={`h-4 w-4 ${isReanalyzing ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Xóa"
                    disabled={isAnyPending || !!cv.default}
                    onClick={() => cv.id && handleDelete(cv.id)}
                    className="text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {cv.url ? (
                <div className="mt-4 flex flex-col h-[calc(100vh-130px)] min-h-[600px] w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between h-10 px-3 bg-muted/40 border-b border-border select-none shrink-0 gap-3">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-3 h-3 rounded-full bg-red-400/80" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
                      <span className="w-3 h-3 rounded-full bg-green-400/80" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground truncate flex-1 text-center max-w-[200px]">
                      {cv.filename}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} className="h-7 w-7 p-0" title="Thu nhỏ">
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <button onClick={zoomReset} className="min-w-[42px] text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1">
                        {Math.round(zoom * 100)}%
                      </button>
                      <Button size="sm" variant="ghost" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} className="h-7 w-7 p-0" title="Phóng to">
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                      <span className="mx-1 h-4 w-px bg-border" />
                      <a
                        href={cv.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-medium"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {currentLang === 'vi' ? 'Toàn màn hình' : 'Full screen'}
                      </a>
                    </div>
                  </div>
                  {/* Iframe container — overflow:auto enables scroll when zoom > 1 */}
                  <div className="flex-1 bg-muted/10 overflow-auto">
                    <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minHeight: '100%' }}>
                      <iframe
                        src={`${cv.url}#toolbar=0&navpanes=0&view=FitH`}
                        className="h-full w-full border-0"
                        title={cv.filename}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex h-[calc(100vh-130px)] min-h-[600px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center shadow-inner">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                    <FileText className="h-6 w-6 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {currentLang === 'vi' ? 'Xem trước CV' : 'CV Preview'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    {currentLang === 'vi'
                      ? 'Chọn một file từ danh sách hoặc tải lên để xem trước nội dung'
                      : 'Select a file from the list or upload one to preview'}
                  </p>
                </div>
              )}
            </div>

            <div className="card-surface ai-gradient space-y-3 border-[var(--ai)]/20 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ai)]"><Sparkles className="h-4 w-4" />AI đánh giá chất lượng CV</div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Trạng thái phân tích</span><span className="font-semibold text-foreground">{cvStatusLabel[String(cv.analysisStatus ?? 'PENDING')] ?? String(cv.analysisStatus ?? 'PENDING')}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
