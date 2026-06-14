import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Badge, Button, Card, CardContent, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { Briefcase, Eye, MapPin, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useGetMe2, useUpdate1, useUpdateUser, uploadCvFile, getGetMe2QueryKey, UserModels } from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/useAuthStore'

export const Route = createFileRoute('/_account/profile')({
  component: ProfilePage,
})

function toInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 50 }, (_, i) => String(currentYear + 5 - i))

function formatExperienceDates(item: UserModels.WorkExperience, currentLang: string) {
  if (!item.startDate) return ''
  const start = formatMonthYear(item.startDate)
  const presentText = currentLang === 'vi' ? 'Hiện tại' : 'Present'
  const end = item.current ? presentText : (item.endDate ? formatMonthYear(item.endDate) : '')
  return `${start} - ${end}`
}

function formatMonthYear(dateStr: string) {
  const parts = dateStr.split('-')
  if (parts.length >= 2) {
    return `${parts[1]}/${parts[0]}`
  }
  return dateStr
}

function formatEducationDates(item: UserModels.Education, currentLang: string) {
  const start = item.startYear ? String(item.startYear) : ''
  const presentText = currentLang === 'vi' ? 'Hiện tại' : 'Present'
  const end = item.endYear ? String(item.endYear) : presentText
  if (!start) return ''
  return `${start} - ${end}`
}

type ExpForm = {
  title: string
  company: string
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  isCurrent: boolean
  location: string
}

type EduForm = {
  school: string
  degree: string
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  isCurrent: boolean
}

function buildCandidateBase(profile: UserModels.CandidateResponse): UserModels.CandidateRequest {
  return {
    address: profile.address,
    bio: profile.bio,
    title: profile.title,
    avatarUrl: profile.avatarUrl,
    skills: profile.skills ?? [],
    yearsOfExperience: profile.yearsOfExperience,
    experiences: profile.experiences ?? [],
    educations: profile.educations ?? [],
    certifications: profile.certifications ?? [],
    languages: profile.languages ?? [],
    preferredLocation: profile.preferredLocation,
    expectedSalaryMin: profile.expectedSalaryMin,
    expectedSalaryMax: profile.expectedSalaryMax,
    portfolioUrl: profile.portfolioUrl,
    githubUrl: profile.githubUrl,
    linkedinUrl: profile.linkedinUrl,
  }
}

function ProfilePage() {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language || 'en'
  const labelStart = currentLang === 'vi' ? 'Bắt đầu' : 'Start'
  const labelEnd = currentLang === 'vi' ? 'Kết thúc' : 'End'
  const labelCurrentWork = currentLang === 'vi' ? 'Đang làm việc tại đây' : 'Currently work here'
  const labelCurrentStudy = currentLang === 'vi' ? 'Đang học tập tại đây' : 'Currently study here'
  const labelMonth = currentLang === 'vi' ? 'Tháng' : 'Month'
  const labelYear = currentLang === 'vi' ? 'Năm' : 'Year'

  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useGetMe2({ query: { enabled: isAuthenticated } })
  const profile = data?.data

  const { mutateAsync: updateCandidate, isPending: isCandidatePending } = useUpdate1()
  const { mutateAsync: updateUser, isPending: isUserPending } = useUpdateUser()
  const isSaving = isCandidatePending || isUserPending

  React.useEffect(() => {
    document.title = t('page_title_profile')
  }, [t])

  const fullName = profile?.fullName ?? ''
  const email = profile?.email ?? ''
  const phone = profile?.phone ?? ''
  const bio = profile?.bio ?? ''
  const title = profile?.title ?? ''
  const address = profile?.address ?? ''
  const skills: string[] = profile?.skills ?? []
  const experiences: UserModels.WorkExperience[] = profile?.experiences ?? []
  const educations: UserModels.Education[] = profile?.educations ?? []
  const initials = toInitials(fullName)

  const [editMode, setEditMode] = React.useState(false)
  const [draft, setDraft] = React.useState({ name: '', email: '', phone: '', location: '', title: '', bio: '' })
  const [skillInput, setSkillInput] = React.useState('')
  const [editingExperienceIdx, setEditingExperienceIdx] = React.useState<number | null>(null)
  const [editingEducationIdx, setEditingEducationIdx] = React.useState<number | null>(null)
  const [expForm, setExpForm] = React.useState<ExpForm>({
    title: '',
    company: '',
    startMonth: '01',
    startYear: String(currentYear),
    endMonth: '01',
    endYear: String(currentYear),
    isCurrent: false,
    location: '',
  })
  const [eduForm, setEduForm] = React.useState<EduForm>({
    school: '',
    degree: '',
    startMonth: '01',
    startYear: String(currentYear),
    endMonth: '01',
    endYear: String(currentYear),
    isCurrent: false,
  })

  const fileRef = React.useRef<HTMLInputElement>(null)

  function handleEditClick() {
    setDraft({
      name: profile?.fullName ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      location: profile?.address ?? '',
      title: profile?.title ?? '',
      bio: profile?.bio ?? '',
    })
    setEditMode(true)
  }

  async function handleSave() {
    if (!profile?.id || !profile?.userId) return
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      toast.error(currentLang === 'vi' ? 'Email không hợp lệ' : 'Invalid email format')
      return
    }
    if (draft.phone && !/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(draft.phone)) {
      toast.error(currentLang === 'vi' ? 'Số điện thoại không hợp lệ (VD: 0901234567)' : 'Invalid phone number (e.g. 0901234567)')
      return
    }
    const userPayload: { fullName?: string; email?: string; phone?: string } = { fullName: draft.name }
    if (draft.email && draft.email !== email) userPayload.email = draft.email
    if (draft.phone !== phone) userPayload.phone = draft.phone || undefined
    try {
      await Promise.all([
        updateCandidate({
          id: profile.id,
          data: { ...buildCandidateBase(profile), address: draft.location, title: draft.title, bio: draft.bio },
        }),
        updateUser({
          userId: profile.userId,
          data: userPayload,
        }),
      ])
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'Hồ sơ đã cập nhật' : 'Profile updated')
      setEditMode(false)
    } catch {
      // Resync from server in case one of the two mutations succeeded before the other failed
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.error(currentLang === 'vi' ? 'Cập nhật thất bại' : 'Update failed')
    }
  }

  const resetExpForm = () => {
    setEditingExperienceIdx(null)
    setExpForm({
      title: '',
      company: '',
      startMonth: '01',
      startYear: String(currentYear),
      endMonth: '01',
      endYear: String(currentYear),
      isCurrent: false,
      location: '',
    })
  }

  const resetEduForm = () => {
    setEditingEducationIdx(null)
    setEduForm({
      school: '',
      degree: '',
      startMonth: '01',
      startYear: String(currentYear),
      endMonth: '01',
      endYear: String(currentYear),
      isCurrent: false,
    })
  }

  async function handleSaveExperience() {
    if (!profile?.id) return
    const startDate = `${expForm.startYear}-${expForm.startMonth}`
    const endDate = expForm.isCurrent ? undefined : `${expForm.endYear}-${expForm.endMonth}`
    const newItem: UserModels.WorkExperience = {
      title: expForm.title,
      company: expForm.company,
      location: expForm.location,
      startDate,
      endDate,
      current: expForm.isCurrent,
    }
    const updated =
      editingExperienceIdx !== null
        ? experiences.map((exp, i) => (i === editingExperienceIdx ? newItem : exp))
        : [...experiences, newItem]
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), experiences: updated },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'Kinh nghiệm đã lưu' : 'Experience saved')
      resetExpForm()
    } catch {
      toast.error(currentLang === 'vi' ? 'Lưu thất bại' : 'Save failed')
    }
  }

  async function handleDeleteExperience(idx: number) {
    if (!profile?.id) return
    const updated = experiences.filter((_, i) => i !== idx)
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), experiences: updated },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'Đã xóa kinh nghiệm' : 'Experience deleted')
    } catch {
      toast.error(currentLang === 'vi' ? 'Xóa thất bại' : 'Delete failed')
    }
  }

  async function handleSaveEducation() {
    if (!profile?.id) return
    const newItem: UserModels.Education = {
      institution: eduForm.school,
      degree: eduForm.degree,
      startYear: Number(eduForm.startYear),
      endYear: eduForm.isCurrent ? undefined : Number(eduForm.endYear),
    }
    const updated =
      editingEducationIdx !== null
        ? educations.map((edu, i) => (i === editingEducationIdx ? newItem : edu))
        : [...educations, newItem]
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), educations: updated },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'Học vấn đã lưu' : 'Education saved')
      resetEduForm()
    } catch {
      toast.error(currentLang === 'vi' ? 'Lưu thất bại' : 'Save failed')
    }
  }

  async function handleDeleteEducation(idx: number) {
    if (!profile?.id) return
    const updated = educations.filter((_, i) => i !== idx)
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), educations: updated },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'Đã xóa học vấn' : 'Education deleted')
    } catch {
      toast.error(currentLang === 'vi' ? 'Xóa thất bại' : 'Delete failed')
    }
  }

  async function handleAddSkill() {
    const value = skillInput.trim()
    if (!value || !profile?.id) return
    if (skills.includes(value)) {
      setSkillInput('')
      return
    }
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), skills: [...skills, value] },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      setSkillInput('')
    } catch {
      toast.error(currentLang === 'vi' ? 'Thêm kỹ năng thất bại' : 'Failed to add skill')
    }
  }

  async function handleRemoveSkill(skill: string) {
    if (!profile?.id) return
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), skills: skills.filter((s) => s !== skill) },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
    } catch {
      toast.error(currentLang === 'vi' ? 'Xóa kỹ năng thất bại' : 'Failed to remove skill')
    }
  }

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
    try {
      await uploadCvFile(file)
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'CV đã tải lên' : 'CV uploaded')
    } catch {
      toast.error(currentLang === 'vi' ? 'Tải CV thất bại' : 'CV upload failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{currentLang === 'vi' ? 'Đang tải hồ sơ...' : 'Loading profile...'}</div>
  if (isError) return <div className="p-8 text-center text-destructive">{currentLang === 'vi' ? 'Tải hồ sơ thất bại.' : 'Failed to load profile.'}</div>

  const basicInfoFields: Array<{ label: string; key: keyof typeof draft; editable: boolean }> = [
    { label: currentLang === 'vi' ? 'Họ và tên' : 'Full Name', key: 'name', editable: true },
    { label: currentLang === 'vi' ? 'Email' : 'Email', key: 'email', editable: true },
    { label: currentLang === 'vi' ? 'Số điện thoại' : 'Phone', key: 'phone', editable: true },
    { label: currentLang === 'vi' ? 'Địa điểm' : 'Location', key: 'location', editable: true },
    { label: currentLang === 'vi' ? 'Tiêu đề' : 'Title', key: 'title', editable: true },
  ]

  const displayValues: Record<string, string> = { name: fullName, email, phone, location: address, title }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-4 p-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">{initials}</div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{address}</p>
            </div>
            <hr className="border-border" />
            <div className="space-y-2 text-sm">
              <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" />{currentLang === 'vi' ? 'Đã ứng tuyển' : 'Applied'}</span><span className="font-semibold text-foreground">0</span></p>
              <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-muted-foreground">♡ {currentLang === 'vi' ? 'Đã lưu' : 'Saved'}</span><span className="font-semibold text-foreground">0</span></p>
              <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-muted-foreground"><Eye className="h-4 w-4" />{currentLang === 'vi' ? 'Lượt xem hồ sơ' : 'Profile views'}</span><span className="font-semibold text-foreground">34</span></p>
            </div>
            <hr className="border-border" />
            {!editMode ? (
              <Button variant="outline" className="w-full" onClick={handleEditClick}>{currentLang === 'vi' ? 'Chỉnh sửa hồ sơ' : 'Edit Profile'}</Button>
            ) : (
              <div className="flex gap-2">
                <Button className="w-full" disabled={isSaving} onClick={handleSave}>{isSaving ? (currentLang === 'vi' ? 'Đang lưu...' : 'Saving...') : (currentLang === 'vi' ? 'Lưu' : 'Save')}</Button>
                <Button variant="outline" className="w-full" disabled={isSaving} onClick={() => setEditMode(false)}>{currentLang === 'vi' ? 'Hủy' : 'Cancel'}</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{currentLang === 'vi' ? 'Thông tin cơ bản' : 'Basic Info'}</h2>
              {basicInfoFields.map(({ label, key, editable }) => (
                <div key={key} className="flex items-start gap-3 border-b border-border py-2 text-sm last:border-0">
                  <span className="w-28 shrink-0 font-medium text-muted-foreground">{label}</span>
                  {editMode && editable ? (
                    <Input
                      value={draft[key] as string}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  ) : (
                    <span className="text-foreground">{displayValues[key]}</span>
                  )}
                </div>
              ))}
              <div className="mt-3">
                <p className="mb-2 text-sm font-medium text-muted-foreground">{currentLang === 'vi' ? 'Giới thiệu bản thân' : 'Bio'}</p>
                {editMode ? (
                  <textarea className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={draft.bio} onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))} />
                ) : (
                  <p className="text-sm text-foreground">{bio}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{currentLang === 'vi' ? 'Kinh nghiệm làm việc' : 'Work Experience'}</h2>
              {experiences.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.location} {item.location && '•'} {formatExperienceDates(item, currentLang)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingExperienceIdx(idx)
                        const [sYear, sMonth] = (item.startDate ?? '').split('-')
                        const [eYear, eMonth] = (item.endDate ?? '').split('-')
                        setExpForm({
                          title: item.title ?? '',
                          company: item.company ?? '',
                          startMonth: sMonth || '01',
                          startYear: sYear || String(currentYear),
                          endMonth: eMonth || '01',
                          endYear: eYear || String(currentYear),
                          isCurrent: !!item.current,
                          location: item.location ?? '',
                        })
                      }}>{currentLang === 'vi' ? 'Sửa' : 'Edit'}</Button>
                      <Button variant="outline" size="sm" disabled={isCandidatePending} onClick={() => handleDeleteExperience(idx)}>{currentLang === 'vi' ? 'Xóa' : 'Delete'}</Button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={expForm.title} onChange={(e) => setExpForm((p) => ({ ...p, title: e.target.value }))} placeholder={currentLang === 'vi' ? 'Chức danh' : 'Title'} />
                <Input value={expForm.company} onChange={(e) => setExpForm((p) => ({ ...p, company: e.target.value }))} placeholder={currentLang === 'vi' ? 'Công ty' : 'Company'} />
                <Input value={expForm.location} onChange={(e) => setExpForm((p) => ({ ...p, location: e.target.value }))} placeholder={currentLang === 'vi' ? 'Địa điểm' : 'Location'} />

                <div className="col-span-2 space-y-3">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground min-w-[70px]">{labelStart}:</span>
                      <Select value={expForm.startMonth} onValueChange={(val) => setExpForm((p) => ({ ...p, startMonth: val }))}>
                        <SelectTrigger className="w-[85px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                          {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={expForm.startYear} onValueChange={(val) => setExpForm((p) => ({ ...p, startYear: val }))}>
                        <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                          {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {!expForm.isCurrent && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground min-w-[70px]">{labelEnd}:</span>
                        <Select value={expForm.endMonth} onValueChange={(val) => setExpForm((p) => ({ ...p, endMonth: val }))}>
                          <SelectTrigger className="w-[85px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                            {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={expForm.endYear} onValueChange={(val) => setExpForm((p) => ({ ...p, endYear: val }))}>
                          <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="expIsCurrent" checked={expForm.isCurrent} onChange={(e) => setExpForm((p) => ({ ...p, isCurrent: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer" />
                      <label htmlFor="expIsCurrent" className="text-sm font-medium text-foreground cursor-pointer select-none">{labelCurrentWork}</label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isCandidatePending} onClick={handleSaveExperience}>
                  {isCandidatePending ? (currentLang === 'vi' ? 'Đang lưu...' : 'Saving...') : editingExperienceIdx !== null ? (currentLang === 'vi' ? 'Lưu sửa' : 'Save Edit') : (currentLang === 'vi' ? 'Thêm kinh nghiệm' : 'Add Experience')}
                </Button>
                {editingExperienceIdx !== null && <Button variant="ghost" size="sm" onClick={resetExpForm}>{currentLang === 'vi' ? 'Hủy' : 'Cancel'}</Button>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{currentLang === 'vi' ? 'Học vấn' : 'Education'}</h2>
              {educations.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
                  <div>
                    <p className="font-semibold text-foreground">{item.institution}</p>
                    <p className="text-sm text-muted-foreground">{item.degree}</p>
                    <p className="text-xs text-muted-foreground">{formatEducationDates(item, currentLang)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingEducationIdx(idx)
                      setEduForm({
                        school: item.institution ?? '',
                        degree: item.degree ?? '',
                        startMonth: '01',
                        startYear: item.startYear ? String(item.startYear) : String(currentYear),
                        endMonth: '01',
                        endYear: item.endYear != null ? String(item.endYear) : String(currentYear),
                        isCurrent: item.endYear == null,
                      })
                    }}>{currentLang === 'vi' ? 'Sửa' : 'Edit'}</Button>
                    <Button variant="outline" size="sm" disabled={isCandidatePending} onClick={() => handleDeleteEducation(idx)}>{currentLang === 'vi' ? 'Xóa' : 'Delete'}</Button>
                  </div>
                </div>
              ))}
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={eduForm.school} onChange={(e) => setEduForm((p) => ({ ...p, school: e.target.value }))} placeholder={currentLang === 'vi' ? 'Trường học' : 'School'} />
                <Input value={eduForm.degree} onChange={(e) => setEduForm((p) => ({ ...p, degree: e.target.value }))} placeholder={currentLang === 'vi' ? 'Bằng cấp' : 'Degree'} />

                <div className="col-span-2 space-y-3">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground min-w-[70px]">{labelStart}:</span>
                      <Select value={eduForm.startMonth} onValueChange={(val) => setEduForm((p) => ({ ...p, startMonth: val }))}>
                        <SelectTrigger className="w-[85px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                          {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={eduForm.startYear} onValueChange={(val) => setEduForm((p) => ({ ...p, startYear: val }))}>
                        <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                          {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {!eduForm.isCurrent && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground min-w-[70px]">{labelEnd}:</span>
                        <Select value={eduForm.endMonth} onValueChange={(val) => setEduForm((p) => ({ ...p, endMonth: val }))}>
                          <SelectTrigger className="w-[85px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                            {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={eduForm.endYear} onValueChange={(val) => setEduForm((p) => ({ ...p, endYear: val }))}>
                          <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto bg-popover text-popover-foreground border border-border shadow-md">
                            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="eduIsCurrent" checked={eduForm.isCurrent} onChange={(e) => setEduForm((p) => ({ ...p, isCurrent: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer" />
                      <label htmlFor="eduIsCurrent" className="text-sm font-medium text-foreground cursor-pointer select-none">{labelCurrentStudy}</label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isCandidatePending} onClick={handleSaveEducation}>
                  {isCandidatePending ? (currentLang === 'vi' ? 'Đang lưu...' : 'Saving...') : editingEducationIdx !== null ? (currentLang === 'vi' ? 'Lưu sửa' : 'Save Edit') : (currentLang === 'vi' ? 'Thêm học vấn' : 'Add Education')}
                </Button>
                {editingEducationIdx !== null && <Button variant="ghost" size="sm" onClick={resetEduForm}>{currentLang === 'vi' ? 'Hủy' : 'Cancel'}</Button>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{currentLang === 'vi' ? 'Kỹ năng & CV' : 'Skills & CV'}</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button disabled={isCandidatePending} onClick={() => handleRemoveSkill(skill)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddSkill() }}
                  placeholder={currentLang === 'vi' ? 'Thêm kỹ năng' : 'Add Skill'}
                />
                <Button disabled={isCandidatePending} onClick={handleAddSkill}>{currentLang === 'vi' ? 'Thêm' : 'Add'}</Button>
              </div>
              <div
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center text-muted-foreground"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files?.[0] ?? null) }}
              >
                <Upload className="h-6 w-6" />
                <p>{currentLang === 'vi' ? 'Kéo thả hoặc click để tải lên' : 'Drag & drop or click to upload'}</p>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{currentLang === 'vi' ? 'Chọn tệp tin' : 'Browse files'}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
