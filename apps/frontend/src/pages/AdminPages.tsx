import { useEffect, useState } from 'react'
import { ProtectedScreen } from '../components/AppLayout'
import { useToast } from '../feedback/ToastProvider'
import { api } from '../lib/api'
import { fileToDataUrl } from '../lib/files'
import { errorMessageFrom } from '../lib/feedback'
import type { Client, User, UserRole } from '../lib/types'

function Panel({
  title,
  copy,
  children,
}: {
  title: string
  copy?: string
  children: React.ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">{title}</h3>
          {copy ? <p className="panel-copy">{copy}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

type UserFormState = {
  id: string | null
  name: string
  phone: string
  role: UserRole
  password: string
  defaultClientId: string
  profileImageDataUrl: string
  profileImagePreviewUrl: string
  removeProfileImage: boolean
  vehicleType: string
  vehiclePlateNumber: string
  licenseNumber: string
  address: string
  notes: string
}

function createEmptyForm(role: UserRole): UserFormState {
  return {
    id: null,
    name: '',
    phone: '',
    role,
    password: 'ChangeMe123!',
    defaultClientId: '',
    profileImageDataUrl: '',
    profileImagePreviewUrl: '',
    removeProfileImage: false,
    vehicleType: '',
    vehiclePlateNumber: '',
    licenseNumber: '',
    address: '',
    notes: '',
  }
}

function avatarInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function toFormState(user: User): UserFormState {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    password: '',
    defaultClientId: user.defaultClientId ?? '',
    profileImageDataUrl: '',
    profileImagePreviewUrl: user.profileImageUrl ?? '',
    removeProfileImage: false,
    vehicleType: user.vehicleType ?? '',
    vehiclePlateNumber: user.vehiclePlateNumber ?? '',
    licenseNumber: user.licenseNumber ?? '',
    address: user.address ?? '',
    notes: user.notes ?? '',
  }
}

function RiderProfileSummary({ user }: { user: User }) {
  return (
    <div className="mobile-media-row">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt={`${user.name} profile`}
          className="profile-avatar"
        />
      ) : (
        <span className="profile-avatar-placeholder">{avatarInitials(user.name)}</span>
      )}
      <div>
        <p className="font-medium text-(--primary)">{user.name}</p>
        <p className="mt-1 text-sm text-(--surface-muted)">{user.phone}</p>
      </div>
    </div>
  )
}

export function AdminUsersPage({ filterRole }: { filterRole?: 'rider' }) {
  const { showToast } = useToast()
  const defaultRole = filterRole ?? 'ops'
  const [items, setItems] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<UserFormState>(createEmptyForm(defaultRole))

  async function load() {
    setLoading(true)

    try {
      const [response, clientResponse] = await Promise.all([
        api.listUsers({
          role: filterRole,
        }),
        isRiderMode ? api.listClients({ active: true }) : Promise.resolve({ items: [], total: 0 }),
      ])
      setItems(response.items)
      setClients(clientResponse.items)
    } catch (caughtError) {
      showToast({
        tone: 'error',
        title: isRiderMode ? 'Riders failed to load' : 'Users failed to load',
        message: errorMessageFrom(caughtError, 'Unable to load users.'),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setForm(createEmptyForm(defaultRole))
    void load()
  }, [filterRole])

  const isRiderMode = filterRole === 'rider'
  const isEditing = Boolean(form.id)
  const total = items.length
  const active = items.filter((item) => item.active).length
  const inactive = total - active
  const defaultClientName =
    clients.find((client) => client.id === form.defaultClientId)?.name ?? 'No default client'

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    try {
      if (isEditing && form.id) {
        await api.updateUser(form.id, {
          name: form.name,
          phone: form.phone,
          role: isRiderMode ? 'rider' : form.role,
          password: form.password || undefined,
          defaultClientId: isRiderMode ? form.defaultClientId || null : undefined,
          profileImageDataUrl: form.profileImageDataUrl
            ? form.profileImageDataUrl
            : form.removeProfileImage
              ? null
              : undefined,
          vehicleType: isRiderMode ? form.vehicleType || null : undefined,
          vehiclePlateNumber: isRiderMode ? form.vehiclePlateNumber || null : undefined,
          licenseNumber: isRiderMode ? form.licenseNumber || null : undefined,
          address: isRiderMode ? form.address || null : undefined,
          notes: isRiderMode ? form.notes || null : undefined,
        })
        showToast({
          tone: 'success',
          title: isRiderMode ? 'Rider updated' : 'User updated',
          message: `${form.name} was updated successfully.`,
        })
      } else {
        await api.createUser({
          name: form.name,
          phone: form.phone,
          role: isRiderMode ? 'rider' : form.role,
          password: form.password,
          defaultClientId: isRiderMode ? form.defaultClientId || null : undefined,
          profileImageDataUrl: form.profileImageDataUrl || undefined,
          vehicleType: isRiderMode ? form.vehicleType || null : undefined,
          vehiclePlateNumber: isRiderMode ? form.vehiclePlateNumber || null : undefined,
          licenseNumber: isRiderMode ? form.licenseNumber || null : undefined,
          address: isRiderMode ? form.address || null : undefined,
          notes: isRiderMode ? form.notes || null : undefined,
        })
        showToast({
          tone: 'success',
          title: isRiderMode ? 'Rider created' : 'User created',
          message: `${form.name} can now access the workspace.`,
        })
      }

      setForm(createEmptyForm(defaultRole))
      await load()
    } catch (caughtError) {
      const message = errorMessageFrom(
        caughtError,
        isEditing ? 'Unable to update user.' : 'Unable to create user.',
      )
      showToast({
        tone: 'error',
        title: isEditing ? 'Update failed' : 'Create failed',
        message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user: User) {
    try {
      await api.updateUser(user.id, { active: !user.active })
      showToast({
        tone: user.active ? 'warning' : 'success',
        title: user.active ? 'Account deactivated' : 'Account reactivated',
        message: `${user.name} is now ${user.active ? 'inactive' : 'active'}.`,
      })
      await load()
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to update user.')
      showToast({
        tone: 'error',
        title: 'Account update failed',
        message,
      })
    }
  }

  return (
    <ProtectedScreen
      roles={isRiderMode ? ['admin', 'ops'] : ['admin']}
      title={isRiderMode ? 'Riders' : 'Users'}
      subtitle={
        isRiderMode
          ? 'Create rider accounts, store shift details, and keep profile information ready for dispatch handovers.'
          : 'Create users, activate or deactivate accounts, and control who can access the workflow.'
      }
    >
      <div className="inline-stat-grid">
        {[
          ['Total accounts', total],
          ['Active', active],
          ['Inactive', inactive],
        ].map(([label, value]) => (
          <div key={label} className="inline-stat">
            <p className="data-label">{label}</p>
            <p className="inline-stat-value">{value}</p>
          </div>
        ))}
      </div>

      <div className="sheet-grid aside">
        <Panel
          title={
            isRiderMode
              ? isEditing
                ? 'Edit rider profile'
                : 'Add rider profile'
              : isEditing
                ? 'Edit user'
                : 'Add user'
          }
          copy={
            isRiderMode
              ? 'Store the practical details operations needs before assigning deliveries.'
              : 'Create a minimal account, then manage activation from the list.'
          }
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitForm}>
            <label className="field-stack">
              <span className="app-label">Full name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Full name"
                className="app-input"
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Phone number</span>
              <input
                type="text"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="Phone number"
                className="app-input"
                required
              />
            </label>

            {!isRiderMode ? (
              <label className="field-stack">
                <span className="app-label">Role</span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as UserRole,
                    }))
                  }
                  className="app-select"
                >
                  <option value="ops">Ops</option>
                  <option value="rider">Rider</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            ) : (
              <label className="field-stack">
                <span className="app-label">Vehicle type</span>
                <input
                  type="text"
                  value={form.vehicleType}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, vehicleType: event.target.value }))
                  }
                  placeholder="Motorbike, Van, Tricycle"
                  className="app-input"
                />
              </label>
            )}

            <label className="field-stack">
              <span className="app-label">{isEditing ? 'Reset password' : 'Initial password'}</span>
              <input
                type="text"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder={isEditing ? 'Leave blank to keep current password' : 'Initial password'}
                className="app-input"
                required={!isEditing}
              />
            </label>

            {isRiderMode ? (
              <>
                <label className="field-stack">
                  <span className="app-label">Default client</span>
                  <select
                    value={form.defaultClientId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        defaultClientId: event.target.value,
                      }))
                    }
                    className="app-select"
                  >
                    <option value="">No default client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-stack">
                  <span className="app-label">Vehicle plate number</span>
                  <input
                    type="text"
                    value={form.vehiclePlateNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vehiclePlateNumber: event.target.value,
                      }))
                    }
                    placeholder="GR-1234-24"
                    className="app-input"
                  />
                </label>

                <label className="field-stack">
                  <span className="app-label">License number</span>
                  <input
                    type="text"
                    value={form.licenseNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        licenseNumber: event.target.value,
                      }))
                    }
                    placeholder="RIDER-1021"
                    className="app-input"
                  />
                </label>

                <label className="field-stack">
                  <span className="app-label">Profile image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    capture="user"
                    className="app-input"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return

                      try {
                        const dataUrl = await fileToDataUrl(file)
                        setForm((current) => ({
                          ...current,
                          profileImageDataUrl: dataUrl,
                          profileImagePreviewUrl: dataUrl,
                          removeProfileImage: false,
                        }))
                      } catch (caughtError) {
                        const message = errorMessageFrom(
                          caughtError,
                          'Unable to read the selected image.',
                        )
                        showToast({
                          tone: 'error',
                          title: 'Image read failed',
                          message,
                        })
                      }
                    }}
                  />
                </label>

                <div className="field-stack md:col-span-2">
                  <span className="app-label">Profile preview</span>
                  <div className="profile-preview-card">
                    <div className="profile-preview-frame">
                      {form.profileImagePreviewUrl ? (
                        <img
                          src={form.profileImagePreviewUrl}
                          alt="Rider profile preview"
                          className="profile-preview-image"
                        />
                      ) : (
                        <span className="profile-preview-placeholder">
                          {avatarInitials(form.name || 'Rider')}
                        </span>
                      )}
                    </div>
                    <div className="profile-preview-copy">
                      <div className="profile-preview-header">
                        <p className="profile-preview-title">
                          {form.name.trim() || 'Rider identity preview'}
                        </p>
                        <p className="profile-preview-subtitle">
                          {form.phone.trim() || 'Phone number not entered yet'}
                        </p>
                      </div>
                      <div className="profile-preview-facts">
                        <div className="profile-preview-fact">
                          <span className="data-label">Role</span>
                          <span className="data-value">Rider</span>
                        </div>
                        <div className="profile-preview-fact">
                          <span className="data-label">Default client</span>
                          <span className="data-value">{defaultClientName}</span>
                        </div>
                        <div className="profile-preview-fact">
                          <span className="data-label">Vehicle plate</span>
                          <span className="data-value">
                            {form.vehiclePlateNumber.trim() || 'Not recorded'}
                          </span>
                        </div>
                      </div>
                      <p className="profile-preview-text">
                        {form.profileImagePreviewUrl
                          ? 'This photo will appear in rider lists, delivery handovers, and recipient-facing delivery context.'
                          : 'Add a clear front-facing rider photo so operations can confirm the account quickly during dispatch and shift handover.'}
                      </p>
                      {form.profileImagePreviewUrl ? (
                        <button
                          type="button"
                          className="btn-quiet"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              profileImageDataUrl: '',
                              profileImagePreviewUrl: '',
                              removeProfileImage: true,
                            }))
                          }
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <label className="field-stack md:col-span-2">
                  <span className="app-label">Address</span>
                  <textarea
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, address: event.target.value }))
                    }
                    className="app-textarea"
                    placeholder="Rider home base or area"
                  />
                </label>

                <label className="field-stack md:col-span-2">
                  <span className="app-label">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className="app-textarea"
                    placeholder="Shift notes, route familiarity, or operational context"
                  />
                </label>
              </>
            ) : null}

            <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
              {isEditing ? (
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setForm(createEmptyForm(defaultRole))}
                >
                  Cancel edit
                </button>
              ) : null}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting
                  ? isEditing
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditing
                    ? 'Save profile'
                    : 'Create account'}
              </button>
            </div>
          </form>
        </Panel>

        <div className="sheet-stack">
          <div className="sheet-note">
            <p className="app-label">{isRiderMode ? 'Profile scope' : 'Access model'}</p>
            <p className="sheet-note-copy">
              {isRiderMode
                ? 'Each rider can now carry a usable delivery profile: image, vehicle, plate, license, address, and operating notes.'
                : 'Use activation as the control point. Accounts stay on record even when they should not be able to sign in.'}
            </p>
          </div>
          <div className="sheet-note">
            <p className="app-label">Current scope</p>
            <div className="mt-3 space-y-2 text-sm text-(--surface-muted)">
              <p><strong className="text-(--primary)">Admin</strong> manages access and riders.</p>
              <p><strong className="text-(--primary)">Ops</strong> manages riders, clients, reporting, and invoices.</p>
              <p><strong className="text-(--primary)">Rider</strong> creates, dispatches, hands over, and completes assigned jobs.</p>
            </div>
          </div>
        </div>
      </div>

      <Panel
        title={isRiderMode ? 'Rider accounts' : 'User accounts'}
        copy={
          isRiderMode
            ? 'Review and update rider profiles directly from the roster.'
            : 'Toggle account activity directly from the list.'
        }
      >
        {loading ? (
          <p className="text-sm text-(--surface-muted)">Loading accounts...</p>
        ) : (
          <>
            <div className="table-shell desktop-only">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>{isRiderMode ? 'Rider' : 'Name'}</th>
                    <th>Phone</th>
                    <th>{isRiderMode ? 'Profile' : 'Role'}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        {isRiderMode ? <RiderProfileSummary user={user} /> : user.name}
                      </td>
                      <td className="text-(--surface-muted)">{user.phone}</td>
                      <td className="text-(--surface-muted)">
                        {isRiderMode ? (
                          <>
                            <p>{clients.find((client) => client.id === user.defaultClientId)?.name ?? 'No default client'}</p>
                            <p>{user.vehicleType ?? 'No vehicle recorded'}</p>
                            <p>{user.vehiclePlateNumber ?? 'No plate recorded'}</p>
                          </>
                        ) : (
                          user.role
                        )}
                      </td>
                      <td>
                        <div className="action-cluster">
                          <button
                            type="button"
                            className="btn-quiet px-3! py-1.5! text-xs!"
                            onClick={() => setForm(toFormState(user))}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(user)}
                            className={user.active ? 'btn-success !px-3 !py-1.5 !text-xs' : 'btn-secondary !px-3 !py-1.5 !text-xs'}
                          >
                            {user.active ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list mobile-only">
              {items.map((user) => (
                <div key={user.id} className="mobile-record-card">
                  {isRiderMode ? (
                    <RiderProfileSummary user={user} />
                  ) : (
                    <div>
                      <p className="font-medium text-(--primary)">{user.name}</p>
                      <p className="mt-1 text-sm text-(--surface-muted)">{user.phone}</p>
                    </div>
                  )}
                  <div className="mobile-record-row">
                    <div className="data-card">
                      <p className="data-label">{isRiderMode ? 'Vehicle' : 'Role'}</p>
                      <p className="data-value">
                        {isRiderMode ? user.vehicleType ?? 'Not set' : user.role}
                      </p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Status</p>
                      <p className="data-value">{user.active ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    {isRiderMode ? (
                      <>
                        <div className="data-card">
                          <p className="data-label">Default client</p>
                          <p className="data-value">
                            {clients.find((client) => client.id === user.defaultClientId)?.name ?? 'Not set'}
                          </p>
                        </div>
                        <div className="data-card">
                          <p className="data-label">Plate</p>
                          <p className="data-value">{user.vehiclePlateNumber ?? 'Not set'}</p>
                        </div>
                        <div className="data-card">
                          <p className="data-label">License</p>
                          <p className="data-value">{user.licenseNumber ?? 'Not set'}</p>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="action-cluster mt-4">
                    <button
                      type="button"
                      className="btn-quiet !px-3 !py-1.5 !text-xs"
                      onClick={() => setForm(toFormState(user))}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(user)}
                      className={user.active ? 'btn-success !px-3 !py-1.5 !text-xs' : 'btn-secondary !px-3 !py-1.5 !text-xs'}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>
    </ProtectedScreen>
  )
}
