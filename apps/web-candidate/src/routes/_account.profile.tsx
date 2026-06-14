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

const currentYear = new Date().getFullYear()
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const years = Array.from({ length: 50 }, (_, i) => String(currentYear + 5 - i))
const pastYears = Array.from({ length: 50 }, (_, i) => String(currentYear - i))

function isFutureYearMonth(yearStr: string, monthStr: string) {
  const y = parseInt(yearStr, 10)
  const m = parseInt(monthStr, 10)
  const now = new Date()
  const currentY = now.getFullYear()
  const currentM = now.getMonth() + 1
  if (y > currentY) return true
  if (y === currentY && m > currentM) return true
  return false
}

function isAfterYearMonth(yearA: string, monthA: string, yearB: string, monthB: string) {
  const yA = parseInt(yearA, 10)
  const mA = parseInt(monthA, 10)
  const yB = parseInt(yearB, 10)
  const mB = parseInt(monthB, 10)
  if (yA > yB) return true
  if (yA === yB && mA > mB) return true
  return false
}

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

function formatCertificationDates(item: UserModels.Certification, currentLang: string) {
  if (!item.issuedDate) return ''
  const issued = formatMonthYear(item.issuedDate)
  const noExpiryText = currentLang === 'vi' ? 'Không hết hạn' : 'No expiry'
  const expiry = item.expiryDate ? formatMonthYear(item.expiryDate) : noExpiryText
  return `${issued} - ${expiry}`
}

const getMonthLabel = (m: string, lang: string) => {
  const monthMapEN: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
  }
  return lang === 'vi' ? `Tháng ${m}` : monthMapEN[m] ?? m
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

type CertForm = {
  name: string
  issuer: string
  issuedMonth: string
  issuedYear: string
  expiryMonth: string
  expiryYear: string
  isNoExpiry: boolean
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
  const labelIssued = currentLang === 'vi' ? 'Ngày cấp' : 'Issued Date'
  const labelExpiry = currentLang === 'vi' ? 'Ngày hết hạn' : 'Expiration Date'
  const labelNoExpiry = currentLang === 'vi' ? 'Chứng chỉ không hết hạn' : 'This credential does not expire'
  const labelCertName = currentLang === 'vi' ? 'Tên chứng chỉ' : 'Certificate name'
  const labelIssuer = currentLang === 'vi' ? 'Tổ chức cấp' : 'Issuer'

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
  const certifications: UserModels.Certification[] = profile?.certifications ?? []
  const initials = toInitials(fullName)

  const [editMode, setEditMode] = React.useState(false)
  const [draft, setDraft] = React.useState({ name: '', email: '', phone: '', location: '', title: '', bio: '' })
  const [skillInput, setSkillInput] = React.useState('')
  const [editingExperienceIdx, setEditingExperienceIdx] = React.useState<number | null>(null)
  const [editingEducationIdx, setEditingEducationIdx] = React.useState<number | null>(null)
  const [editingCertificationIdx, setEditingCertificationIdx] = React.useState<number | null>(null)
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
  const [certForm, setCertForm] = React.useState<CertForm>({
    name: '',
    issuer: '',
    issuedMonth: '01',
    issuedYear: String(currentYear),
    expiryMonth: '01',
    expiryYear: String(currentYear),
    isNoExpiry: true,
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

  const resetCertForm = () => {
    setEditingCertificationIdx(null)
    setCertForm({
      name: '',
      issuer: '',
      issuedMonth: '01',
      issuedYear: String(currentYear),
      expiryMonth: '01',
      expiryYear: String(currentYear),
      isNoExpiry: true,
    })
  }

  async function handleSaveExperience() {
    if (!profile?.id) return
    if (!expForm.title.trim() || !expForm.company.trim()) {
      toast.error(currentLang === 'vi' ? 'Vui lòng điền chức danh và công ty' : 'Please fill in title and company')
      return
    }
    if (isFutureYearMonth(expForm.startYear, expForm.startMonth)) {
      toast.error(currentLang === 'vi' ? 'Ngày bắt đầu không được sau ngày hiện tại' : 'Start date cannot be after current date')
      return
    }
    if (!expForm.isCurrent && isFutureYearMonth(expForm.endYear, expForm.endMonth)) {
      toast.error(currentLang === 'vi' ? 'Ngày kết thúc không được sau ngày hiện tại' : 'End date cannot be after current date')
      return
    }
    if (!expForm.isCurrent && isAfterYearMonth(expForm.startYear, expForm.startMonth, expForm.endYear, expForm.endMonth)) {
      toast.error(currentLang === 'vi' ? 'Ngày bắt đầu không được sau ngày kết thúc' : 'Start date cannot be after end date')
      return
    }
    const startDate = `${expForm.startYear}-${expForm.startMonth}-01`
    const endDate = expForm.isCurrent ? undefined : `${expForm.endYear}-${expForm.endMonth}-01`
    const newItem: UserModels.WorkExperience = {
      title: expForm.title.trim(),
      company: expForm.company.trim(),
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
    if (!eduForm.school.trim() || !eduForm.degree.trim()) {
      toast.error(currentLang === 'vi' ? 'Vui lòng điền trường học và bằng cấp' : 'Please fill in school and degree')
      return
    }
    const sYear = Number(eduForm.startYear)
    const eYear = eduForm.isCurrent ? currentYear : Number(eduForm.endYear)
    if (sYear > currentYear) {
      toast.error(currentLang === 'vi' ? 'Năm bắt đầu không được sau năm hiện tại' : 'Start year cannot be after current year')
      return
    }
    if (!eduForm.isCurrent && eYear > currentYear) {
      toast.error(currentLang === 'vi' ? 'Năm kết thúc không được sau năm hiện tại' : 'End year cannot be after current year')
      return
    }
    if (!eduForm.isCurrent && sYear > eYear) {
      toast.error(currentLang === 'vi' ? 'Năm bắt đầu không được sau năm kết thúc' : 'Start year cannot be after end year')
      return
    }
    const newItem: UserModels.Education = {
      institution: eduForm.school.trim(),
      degree: eduForm.degree.trim(),
      startYear: sYear,
      endYear: eduForm.isCurrent ? undefined : eYear,
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

  async function handleSaveCertification() {
    if (!profile?.id) return
    if (!certForm.name.trim() || !certForm.issuer.trim()) {
      toast.error(currentLang === 'vi' ? 'Vui lòng điền tên chứng chỉ và tổ chức cấp' : 'Please fill in certificate name and issuer')
      return
    }
    if (isFutureYearMonth(certForm.issuedYear, certForm.issuedMonth)) {
      toast.error(currentLang === 'vi' ? 'Ngày cấp không được sau ngày hiện tại' : 'Issued date cannot be after current date')
      return
    }
    if (!certForm.isNoExpiry && isAfterYearMonth(certForm.issuedYear, certForm.issuedMonth, certForm.expiryYear, certForm.expiryMonth)) {
      toast.error(currentLang === 'vi' ? 'Ngày cấp không được sau ngày hết hạn' : 'Issued date cannot be after expiration date')
      return
    }
    const issuedDate = `${certForm.issuedYear}-${certForm.issuedMonth}-01`
    const expiryDate = certForm.isNoExpiry ? undefined : `${certForm.expiryYear}-${certForm.expiryMonth}-01`
    const newItem: UserModels.Certification = {
      name: certForm.name.trim(),
      issuer: certForm.issuer.trim(),
      issuedDate,
      expiryDate,
    }
    const updated =
      editingCertificationIdx !== null
        ? certifications.map((c, i) => (i === editingCertificationIdx ? newItem : c))
        : [...certifications, newItem]
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), certifications: updated },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'Chứng chỉ đã lưu' : 'Certificate saved')
      resetCertForm()
    } catch {
      toast.error(currentLang === 'vi' ? 'Lưu thất bại' : 'Save failed')
    }
  }

  async function handleDeleteCertification(idx: number) {
    if (!profile?.id) return
    const updated = certifications.filter((_, i) => i !== idx)
    try {
      await updateCandidate({
        id: profile.id,
        data: { ...buildCandidateBase(profile), certifications: updated },
      })
      await queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
      toast.success(currentLang === 'vi' ? 'Đã xóa chứng chỉ' : 'Certificate deleted')
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

                <div className="col-span-2 mt-2">
                  <div className="flex flex-wrap items-end gap-6">
                    {/* Start Date */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">{labelStart}</label>
                      <div className="flex gap-2">
                        <Select value={expForm.startMonth} onValueChange={(val) => setExpForm((p) => ({ ...p, startMonth: val }))}>
                          <SelectTrigger className="w-[130px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {months.map((m) => (
                              <SelectItem key={m} value={m}>
                                {getMonthLabel(m, currentLang)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={expForm.startYear} onValueChange={(val) => setExpForm((p) => ({ ...p, startYear: val }))}>
                          <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {pastYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* End Date */}
                    {!expForm.isCurrent && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">{labelEnd}</label>
                        <div className="flex gap-2">
                          <Select value={expForm.endMonth} onValueChange={(val) => setExpForm((p) => ({ ...p, endMonth: val }))}>
                            <SelectTrigger className="w-[130px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              {months.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {getMonthLabel(m, currentLang)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={expForm.endYear} onValueChange={(val) => setExpForm((p) => ({ ...p, endYear: val }))}>
                            <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              {pastYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Checkbox */}
                    <div className="flex items-center h-9 pb-1">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="expIsCurrent" checked={expForm.isCurrent} onChange={(e) => setExpForm((p) => ({ ...p, isCurrent: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer" />
                        <label htmlFor="expIsCurrent" className="text-sm font-medium text-foreground cursor-pointer select-none">{labelCurrentWork}</label>
                      </div>
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

                <div className="col-span-2 mt-2">
                  <div className="flex flex-wrap items-end gap-6">
                    {/* Start Date */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">{labelStart}</label>
                      <div className="flex gap-2">
                        <Select value={eduForm.startMonth} onValueChange={(val) => setEduForm((p) => ({ ...p, startMonth: val }))}>
                          <SelectTrigger className="w-[130px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {months.map((m) => (
                              <SelectItem key={m} value={m}>
                                {getMonthLabel(m, currentLang)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={eduForm.startYear} onValueChange={(val) => setEduForm((p) => ({ ...p, startYear: val }))}>
                          <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {pastYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* End Date */}
                    {!eduForm.isCurrent && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">{labelEnd}</label>
                        <div className="flex gap-2">
                          <Select value={eduForm.endMonth} onValueChange={(val) => setEduForm((p) => ({ ...p, endMonth: val }))}>
                            <SelectTrigger className="w-[130px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              {months.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {getMonthLabel(m, currentLang)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={eduForm.endYear} onValueChange={(val) => setEduForm((p) => ({ ...p, endYear: val }))}>
                            <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              {pastYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Checkbox */}
                    <div className="flex items-center h-9 pb-1">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="eduIsCurrent" checked={eduForm.isCurrent} onChange={(e) => setEduForm((p) => ({ ...p, isCurrent: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer" />
                        <label htmlFor="eduIsCurrent" className="text-sm font-medium text-foreground cursor-pointer select-none">{labelCurrentStudy}</label>
                      </div>
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
              <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">{currentLang === 'vi' ? 'Chứng chỉ' : 'Certifications'}</h2>
              {certifications.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.issuer}</p>
                    <p className="text-xs text-muted-foreground">{formatCertificationDates(item, currentLang)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingCertificationIdx(idx)
                      const [sYear, sMonth] = (item.issuedDate ?? '').split('-')
                      const [eYear, eMonth] = (item.expiryDate ?? '').split('-')
                      setCertForm({
                        name: item.name ?? '',
                        issuer: item.issuer ?? '',
                        issuedMonth: sMonth || '01',
                        issuedYear: sYear || String(currentYear),
                        expiryMonth: eMonth || '01',
                        expiryYear: eYear || String(currentYear),
                        isNoExpiry: !item.expiryDate,
                      })
                    }}>{currentLang === 'vi' ? 'Sửa' : 'Edit'}</Button>
                    <Button variant="outline" size="sm" disabled={isCandidatePending} onClick={() => handleDeleteCertification(idx)}>{currentLang === 'vi' ? 'Xóa' : 'Delete'}</Button>
                  </div>
                </div>
              ))}
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={certForm.name} onChange={(e) => setCertForm((p) => ({ ...p, name: e.target.value }))} placeholder={labelCertName} />
                  <Input value={certForm.issuer} onChange={(e) => setCertForm((p) => ({ ...p, issuer: e.target.value }))} placeholder={labelIssuer} />
                </div>

                <div className="mt-2">
                  <div className="flex flex-wrap items-end gap-6">
                    {/* Issued Date */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">{labelIssued}</label>
                      <div className="flex gap-2">
                        <Select value={certForm.issuedMonth} onValueChange={(val) => setCertForm((p) => ({ ...p, issuedMonth: val }))}>
                          <SelectTrigger className="w-[130px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {months.map((m) => (
                              <SelectItem key={m} value={m}>
                                {getMonthLabel(m, currentLang)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={certForm.issuedYear} onValueChange={(val) => setCertForm((p) => ({ ...p, issuedYear: val }))}>
                          <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {pastYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Expiry Date */}
                    {!certForm.isNoExpiry && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">{labelExpiry}</label>
                        <div className="flex gap-2">
                          <Select value={certForm.expiryMonth} onValueChange={(val) => setCertForm((p) => ({ ...p, expiryMonth: val }))}>
                            <SelectTrigger className="w-[130px]"><SelectValue placeholder={labelMonth} /></SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              {months.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {getMonthLabel(m, currentLang)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={certForm.expiryYear} onValueChange={(val) => setCertForm((p) => ({ ...p, expiryYear: val }))}>
                            <SelectTrigger className="w-[100px]"><SelectValue placeholder={labelYear} /></SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Checkbox */}
                    <div className="flex items-center h-9 pb-1">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="certIsNoExpiry" checked={certForm.isNoExpiry} onChange={(e) => setCertForm((p) => ({ ...p, isNoExpiry: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer" />
                        <label htmlFor="certIsNoExpiry" className="text-sm font-medium text-foreground cursor-pointer select-none">{labelNoExpiry}</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isCandidatePending} onClick={handleSaveCertification}>
                  {isCandidatePending ? (currentLang === 'vi' ? 'Đang lưu...' : 'Saving...') : editingCertificationIdx !== null ? (currentLang === 'vi' ? 'Lưu sửa' : 'Save Edit') : (currentLang === 'vi' ? 'Thêm chứng chỉ' : 'Add Certificate')}
                </Button>
                {editingCertificationIdx !== null && <Button variant="ghost" size="sm" onClick={resetCertForm}>{currentLang === 'vi' ? 'Hủy' : 'Cancel'}</Button>}
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
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />

              {profile?.cvUrl ? (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 bg-muted/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-bold">
                      PDF
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {currentLang === 'vi' ? 'CV hiện tại' : 'Current CV'}
                      </p>
                      <a
                        href={profile.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {currentLang === 'vi' ? 'Xem CV của bạn' : 'View your CV'}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      {currentLang === 'vi' ? 'Thay thế' : 'Replace'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center text-muted-foreground"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files?.[0] ?? null) }}
                >
                  <Upload className="h-6 w-6" />
                  <p>{currentLang === 'vi' ? 'Kéo thả hoặc click để tải lên' : 'Drag & drop or click to upload'}</p>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{currentLang === 'vi' ? 'Chọn tệp tin' : 'Browse files'}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
