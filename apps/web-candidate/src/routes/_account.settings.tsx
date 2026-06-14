import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { Bell, Settings, Shield, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  useGetSettings,
  useChangeMyPassword,
  useUpdateNotifications,
  useUpdatePrivacy,
  useDeleteMyAccount,
  getGetSettingsQueryKey,
} from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/useAuthStore'

export const Route = createFileRoute('/_account/settings')({
  component: SettingsPage,
})

type SectionKey = 'account' | 'notifications' | 'privacy' | 'danger'

type NotificationUiKey = 'jobRecommendations' | 'applicationUpdates' | 'newMessages' | 'promotionalEmails'

const NOTIFICATION_API_KEY: Record<NotificationUiKey, string> = {
  jobRecommendations: 'emailJobSuggestions',
  applicationUpdates: 'emailApplicationUpdates',
  newMessages: 'pushNotifications',
  promotionalEmails: 'marketingEmails',
}

function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, signOut } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: settingsData } = useGetSettings({ query: { enabled: isAuthenticated } })
  const settingsPayload = settingsData?.data

  const { mutateAsync: changePassword, isPending: isChangingPassword } = useChangeMyPassword()
  const { mutateAsync: updateNotifications, isPending: isUpdatingNotifications } = useUpdateNotifications()
  const { mutateAsync: updatePrivacy, isPending: isUpdatingPrivacy } = useUpdatePrivacy()
  const { mutateAsync: deleteAccount, isPending: isDeletingAccount } = useDeleteMyAccount()

  const [activeSection, setActiveSection] = React.useState<SectionKey>('account')
  const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false)
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')

  React.useEffect(() => {
    document.title = t('page_title_settings')
  }, [t])

  const notifications = {
    jobRecommendations: settingsPayload?.notifications?.emailJobSuggestions ?? false,
    applicationUpdates: settingsPayload?.notifications?.emailApplicationUpdates ?? false,
    newMessages: settingsPayload?.notifications?.pushNotifications ?? false,
    promotionalEmails: settingsPayload?.notifications?.marketingEmails ?? false,
  }

  const privacy = {
    showCvToRecruiters: settingsPayload?.privacy?.showCvToRecruiters ?? false,
    showContactInfo: settingsPayload?.privacy?.showContactInfo ?? false,
  }

  const invalidateSettings = () => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() })

  const menuItems: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
    { key: 'account', label: 'Account', icon: <Settings className="h-4 w-4" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
    { key: 'privacy', label: 'Privacy', icon: <Shield className="h-4 w-4" /> },
    { key: 'danger', label: 'Danger Zone', icon: <TriangleAlert className="h-4 w-4" /> },
  ]

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 8) {
      toast.error(t('account_password_too_short'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('account_password_mismatch'))
      return
    }
    try {
      await changePassword({ data: { currentPassword, newPassword } })
      toast.success('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Failed to update password. Check your current password.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const handleToggleNotification = async (uiKey: NotificationUiKey, value: boolean) => {
    const current = settingsPayload?.notifications ?? {}
    try {
      await updateNotifications({
        data: {
          emailJobSuggestions: current.emailJobSuggestions ?? false,
          emailApplicationUpdates: current.emailApplicationUpdates ?? false,
          pushNotifications: current.pushNotifications ?? false,
          marketingEmails: current.marketingEmails ?? false,
          [NOTIFICATION_API_KEY[uiKey]]: value,
        },
      })
      await invalidateSettings()
    } catch {
      toast.error('Failed to update notification settings')
    }
  }

  const handleTogglePrivacy = async (field: 'showCvToRecruiters' | 'showContactInfo', value: boolean) => {
    const current = settingsPayload?.privacy ?? {}
    try {
      await updatePrivacy({
        data: {
          showCvToRecruiters: current.showCvToRecruiters ?? false,
          showContactInfo: current.showContactInfo ?? false,
          [field]: value,
        },
      })
      await invalidateSettings()
    } catch {
      toast.error('Failed to update privacy settings')
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount()
      setOpenDeleteDialog(false)
      signOut()
      toast.success(t('account_deleted_toast'))
      navigate({ to: '/signin' })
    } catch {
      toast.error('Failed to delete account')
      setOpenDeleteDialog(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="p-4">
            <h1 className="mb-3 text-lg font-semibold text-foreground">Settings</h1>
            <hr className="mb-3 border-border" />
            <div className="flex gap-2 overflow-x-auto lg:flex-col">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${activeSection === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted/60'}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {activeSection === 'account' && (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Account Settings</h2>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Change Password</h3>
                <Input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                <Input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <Button className="mt-2" disabled={isChangingPassword} onClick={handlePasswordUpdate}>
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Email Address</h3>
                <Input type="email" disabled placeholder="Email change not available yet" />
                <p className="text-xs text-muted-foreground">Email changes require a verification flow not yet implemented.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'notifications' && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Notification Preferences</h2>
              <ToggleRow
                label="Job Recommendations"
                subLabel="Receive weekly curated job suggestions"
                checked={notifications.jobRecommendations}
                disabled={isUpdatingNotifications}
                onToggle={() => handleToggleNotification('jobRecommendations', !notifications.jobRecommendations)}
              />
              <ToggleRow
                label="Application Updates"
                subLabel="Get notified when employers view your profile"
                checked={notifications.applicationUpdates}
                disabled={isUpdatingNotifications}
                onToggle={() => handleToggleNotification('applicationUpdates', !notifications.applicationUpdates)}
              />
              <ToggleRow
                label="New Messages"
                subLabel="Notifications for recruiter messages"
                checked={notifications.newMessages}
                disabled={isUpdatingNotifications}
                onToggle={() => handleToggleNotification('newMessages', !notifications.newMessages)}
              />
              <ToggleRow
                label="Promotional Emails"
                subLabel="Tips, resources and SmartCV updates"
                checked={notifications.promotionalEmails}
                disabled={isUpdatingNotifications}
                onToggle={() => handleToggleNotification('promotionalEmails', !notifications.promotionalEmails)}
              />
            </CardContent>
          </Card>
        )}

        {activeSection === 'privacy' && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Privacy Settings</h2>
              <ToggleRow
                label="Share CV with Recruiters"
                subLabel="Allow recruiters to view your CV"
                checked={privacy.showCvToRecruiters}
                disabled={isUpdatingPrivacy}
                onToggle={() => handleTogglePrivacy('showCvToRecruiters', !privacy.showCvToRecruiters)}
              />
              <ToggleRow
                label="Show Contact Info"
                subLabel="Display your contact information on profile"
                checked={privacy.showContactInfo}
                disabled={isUpdatingPrivacy}
                onToggle={() => handleTogglePrivacy('showContactInfo', !privacy.showContactInfo)}
              />
            </CardContent>
          </Card>
        )}

        {activeSection === 'danger' && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="font-semibold text-foreground">Delete Account</h3>
                <p className="mt-2 text-sm text-muted-foreground">This action is permanent and cannot be undone.</p>
                <Button variant="destructive" className="mt-3" onClick={() => setOpenDeleteDialog(true)}>Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa tài khoản</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Bạn chắc chắn muốn xóa tài khoản và đăng xuất?</p>
          <DialogFooter>
            <Button variant="outline" disabled={isDeletingAccount} onClick={() => setOpenDeleteDialog(false)}>Hủy</Button>
            <Button variant="destructive" disabled={isDeletingAccount} onClick={handleDeleteAccount}>
              {isDeletingAccount ? 'Đang xóa...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToggleRow({
  label,
  subLabel,
  checked,
  disabled,
  onToggle,
}: {
  label: string
  subLabel: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{subLabel}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`relative h-6 w-10 rounded-full transition-colors shrink-0 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-1'}`} />
      </button>
    </div>
  )
}
